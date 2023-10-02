import { 
  messageType,
  WebviewRequestMessage,
  WebviewResponseMessage,
  ManualPromise,
  buildBridgeError,
  buildBridgeResponse,
  buildGetStateRequest,
  buildSetStateRequest,
  WebviewMessage,
  logger,
  errorToString,
} from '@stack-spot/vscode-async-webview-shared'
import { AnyFunction } from './types'

interface Dependencies {
  /**
   * Function to send a message to the client app.
   */
  sendMessageToClient: (message: WebviewMessage) => void,
  /**
   * In order to handle the message received from the client, you need to attach the listener passed as parameter to this function to the
   * event of receiving a message.
   */
  listenToMessagesFromClient: (listener: (message: WebviewMessage) => Promise<void>) => void,
  /**
   * A function that, given the method name, returns the corresponding method on the bridge.
   */
  getBridgeHandler: (name: string) => AnyFunction | undefined,
}

/**
 * Send/receive messages to/from the client.
 */
export class MessageHandler {
  private readonly deps: Dependencies
  private readonly getStateCalls: Map<string, ManualPromise> = new Map()
  private readonly setStateCalls: Map<string, ManualPromise<void>> = new Map()
  
  constructor(deps: Dependencies) {
    this.deps = deps
    this.listen()
  }

  private async handleRequestToBridge(message: WebviewRequestMessage) {
    logger.debug('handling bridge call:', message)
    const { id, property = '', arguments: args = [] } = message
    const fn = this.deps.getBridgeHandler(property)
    if (!fn) {
      const error = `"${property}" is not a method or function of the bridge provided to the VSCodeWebview.`
      this.deps.sendMessageToClient(buildBridgeError(id, error))
    }
    let functionHasExecuted = false
    try {
      const result = await fn!(...args)
      functionHasExecuted = true
      logger.debug('sending bridge response to client:', result)
      this.deps.sendMessageToClient(buildBridgeResponse(id, result))
    } catch (error: any) {
      const message = functionHasExecuted
        ? `Error while sending message to client. Please make sure the return value of the method "${property}" in the Bridge provided to the VSCodeWebview is serializable.`
        : errorToString(error)
      this.deps.sendMessageToClient(buildBridgeError(id, message))
    }
  }

  private handleStateResponse(type: 'get' | 'set', message: WebviewResponseMessage) {
    logger.debug(`handling ${type} state response:`, message)
    const map = type === 'get' ? this.getStateCalls : this.setStateCalls
    const promise = map.get(message.id)
    if (!promise) {
      const warning = type === 'get'
        ? `received a state value from the client, but nothing awaits a state value in the backend. Message: ${message}.`
        : `finished setting a state on the client, but nothing awaits this operation in the backend. Message: ${message}`
      return logger.warn(warning)
    }
    if (message.error) {
      return promise.reject(message.error)
    }
    promise.resolve(message.result)
    map.delete(message.id)
  }

  private listen() {
    this.deps.listenToMessagesFromClient(async (message) => {
      switch (message?.type) {
        case messageType.bridge:
          await this.handleRequestToBridge(message)
          break
        case messageType.getState:
          this.handleStateResponse('get', message)
          break
        case messageType.setState:
          this.handleStateResponse('set', message)
      }
    })
  }

  dispose() {
    this.getStateCalls.forEach((value, key) => {
      value.reject(`The webview closed before the state "${String(key)}" could be retrieved.`)
    })
    this.setStateCalls.forEach((value) => {
      value.reject('The webview closed before the state could be set.')
    })
    this.getStateCalls.clear()
    this.setStateCalls.clear()
  }

  getState(name: string): Promise<any> {
    logger.debug('getting state from client:', name)
    const state = String(name)
    const message = buildGetStateRequest(state)
    let manualPromise = this.getStateCalls.get(message.id)
    if (!manualPromise) {
      manualPromise = new ManualPromise()
      this.getStateCalls.set(message.id, manualPromise)
      logger.debug('sending get state message to client:', message)
      this.deps.sendMessageToClient(message)
    }
    return manualPromise.promise
  }

  setState(name: string, value: any): Promise<void> {
    logger.debug('setting state in client:', name, value)
    const state = String(name)
    const manualPromise = new ManualPromise<void>()
    try {
      const message = buildSetStateRequest(state, value)
      this.setStateCalls.set(message.id, manualPromise)
      logger.debug('sending set state message to client:', message)
      this.deps.sendMessageToClient(message)
    } catch (error) {
      manualPromise.reject(
        `Can't set state with name "${state}". Please, make sure the value passed as parameter is serializable. Cause: ${error}.`,
      )
    }
    return manualPromise.promise
  }
}
