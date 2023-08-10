import {
  WebviewRequestMessage,
  asWebViewMessage,
  ManualPromise,
  WebviewResponseMessage,
  buildGetStateResponse,
  buildSetStateResponse,
  messageType,
  buildAPIRequest,
  WebviewMessage,
  AsyncStateful,
  StateTypeOf,
  logger,
  buildGetStateError,
} from 'vscode-webview-shared'
import { LinkedAPI, VSCodeWebInterface } from './VSCodeWebInterface'

export class VSCodeWeb<API extends AsyncStateful<any> = AsyncStateful<Record<string, never>>> implements VSCodeWebInterface<API> {
  private state: StateTypeOf<API>
  private listeners: Partial<{ [K in keyof StateTypeOf<API>]: ((value: StateTypeOf<API>[K]) => void)[] }> = {}
  private apiCalls: Map<string, ManualPromise> = new Map()
  readonly api = this.createAPIProxy() as LinkedAPI<API>
  static vscode: any

  constructor(initialState: StateTypeOf<API>) {
    if (VSCodeWeb.vscode) {
      logger.warn('VSCodeWeb should not be instantiated more than once, this can cause unexpected behavior.')
    } else {
      // @ts-ignore
      VSCodeWeb.vscode = acquireVsCodeApi()
    }
    const stored = VSCodeWeb.vscode.getState()
    if (!stored) VSCodeWeb.vscode.setState(initialState)
    this.state = VSCodeWeb.vscode.getState()
    this.addWindowListener()
  }

  /**
  * Sends a message to the vscode extension.
  * @param message the message to send.
  */
  private static sendMessageToExtension(message: WebviewMessage) {
    VSCodeWeb.vscode.postMessage(message)
  }

  private handleAPIResponse(message: WebviewResponseMessage) {
    logger.debug('handling api response:', message)
    if (!this.apiCalls.has(message.id)) {
      return logger.warn(
        'could not resolve response from api because id is not registered. Maybe the response came while the view was inactive.',
        message,
      )
    }
    if (message.error) {
      this.apiCalls.get(message.id)?.reject(message.error)
    } else {
      this.apiCalls.get(message.id)?.resolve(message.result)
    }
    this.apiCalls.delete(message.id)
  }

  private handleGetStateRequest(message : WebviewRequestMessage) {
    logger.debug('handling get state request:', message)
    try {
      VSCodeWeb.sendMessageToExtension(buildGetStateResponse(message.id, this.getState(message.id as keyof StateTypeOf<API>)))
    } catch (error) {
      VSCodeWeb.sendMessageToExtension(
        buildGetStateError(message.id, `Can't get state with name ${message.id}, please make sure its value is serializable.`)
      )
      throw error
    }
  }

  private handleSetStateRequest(message: WebviewRequestMessage) {
    logger.debug('handling set state request:', message)
    this.setState(message.property as keyof StateTypeOf<API>, message.arguments?.at(0))
    VSCodeWeb.sendMessageToExtension(buildSetStateResponse(message.id))
  }

  private addWindowListener() {
    window.addEventListener('message', ({ data }) => {
      const message = asWebViewMessage(data)
      switch (message?.type) {
        case messageType.api: 
          this.handleAPIResponse(message)
          break
        case messageType.getState:
          this.handleGetStateRequest(message)
          break
        case messageType.setState:
          this.handleSetStateRequest(message)
      }
    })
  }

  private createAPIProxy() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    return new Proxy({}, {
      get(_, property) {
        const methodName = String(property)
        const manualPromise = new ManualPromise()
        // fixme: don't create this function on every get, instead, save it and return it if has already been created
        return (...args: any[]) => {
          logger.debug('making call to api:', methodName, ...args)
          try {
            const message = buildAPIRequest(methodName, args)
            self.apiCalls.set(message.id, manualPromise)
            logger.debug('sending api message:', message)
            VSCodeWeb.sendMessageToExtension(message)
            return manualPromise.promise
          } catch (error) {
            manualPromise.reject(`Can't call "${methodName}" on the webview API, please make sure its parameters are serializable.`)
            throw error
          }
        }
      },
    })
  }

  private runListeners<Key extends keyof StateTypeOf<API>>(stateKey: Key, value: StateTypeOf<API>[Key]) {
    this.listeners[stateKey]?.forEach(l => l(value))
  }

  getState<Key extends keyof StateTypeOf<API>>(key: Key): StateTypeOf<API>[Key] {
    return this.state[key]
  }

  setState<Key extends keyof StateTypeOf<API>>(key: Key, value: StateTypeOf<API>[Key]): void {
    this.state[key] = value
    VSCodeWeb.vscode.setState(this.state)
    this.runListeners(key, value)
  }

  initializeState(state: StateTypeOf<API>): void {
    this.state = { ...state }
    VSCodeWeb.vscode.setState(this.state)
    Object.keys(this.listeners).forEach(key => this.runListeners(key, state[key]))
  }

  subscribe<Key extends keyof StateTypeOf<API>>(key: Key, listener: (value: StateTypeOf<API>[Key]) => void): () => void {
    if (!this.listeners[key]) this.listeners[key] = []
    this.listeners[key]?.push(listener)
    return () => {
      const index = this.listeners[key]?.indexOf(listener)
      if (index !== undefined && index >= 0) this.listeners[key]?.splice(index, 1)
    }
  }
}
