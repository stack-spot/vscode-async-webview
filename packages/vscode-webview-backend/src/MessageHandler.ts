import { 
  messageType,
  WebviewRequestMessage,
  WebviewResponseMessage,
  ManualPromise,
  buildAPIError,
  buildAPIResponse,
  buildGetStateRequest,
  buildSetStateRequest,
  WebviewMessage,
  logger,
  errorToString,
} from 'vscode-webview-shared'
import { AnyFunction } from './types'

interface Dependencies {
  sendMessageToClient: (message: WebviewMessage) => void,
  listenToMessagesFromClient: (listener: (message: WebviewMessage) => void) => void,
  getAPIHandler: (name: string) => AnyFunction | undefined,
}

export class MessageHandler {
  private readonly deps: Dependencies
  private readonly getStateCalls: Map<string, ManualPromise> = new Map()
  private readonly setStateCalls: Map<string, ManualPromise<void>> = new Map()
  
  constructor(deps: Dependencies) {
    this.deps = deps
    this.listen()
  }

  private async handleRequestToAPI(message: WebviewRequestMessage) {
    logger.debug('handling api call:', message)
    const { id, property = '', arguments: args = [] } = message
    const fn = this.deps.getAPIHandler(property)
    if (!fn) {
      const error = `"${property}" is not a method or function of the api provided to the VSCodeWebview.`
      this.deps.sendMessageToClient(buildAPIError(id, error))
    }
    let functionHasExecuted = false
    try {
      const result = await fn!(...args)
      functionHasExecuted = true
      logger.debug('sending api response to client:', result)
      this.deps.sendMessageToClient(buildAPIResponse(id, result))
    } catch (error: any) {
      const message = functionHasExecuted
        ? `Error while sending message to client. Please make sure the return value of the method "${property}" in the API provided to the VSCodeWebview is serializable.`
        : `Error while running method "${property}". Cause: ${errorToString(error)}.`
      this.deps.sendMessageToClient(buildAPIError(id, message))
      throw error
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
        case messageType.api:
          this.handleRequestToAPI(message)
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
    this.setStateCalls.forEach((value, key) => {
      value.reject(`The webview closed before the state "${key}" could be set.`)
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
      return manualPromise.promise
    } catch (error) {
      manualPromise.reject(`Can't set state with name "${state}". Please, make sure the value passed as parameter is serializable.`)
      throw error
    }
  }
}
