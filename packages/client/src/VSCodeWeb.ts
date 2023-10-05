import {
  WebviewRequestMessage,
  asWebViewMessage,
  ManualPromise,
  WebviewResponseMessage,
  buildGetStateResponse,
  buildSetStateResponse,
  messageType,
  buildBridgeRequest,
  WebviewMessage,
  AsyncStateful,
  StateTypeOf,
  logger,
  buildGetStateError,
  readyMessage,
} from '@stack-spot/vscode-async-webview-shared'
import { LinkedBridge, VSCodeWebInterface } from './VSCodeWebInterface'

/**
 * This class is responsible for acquiring the vscode API and connecting the webview to the bridge. This should never be instantiated more
 * than once.
 * 
 * To create an instance of VSCodeWeb, you must call `const vscode = new VSCodeWeb<BridgeType>(initialState)`. The bridge type must be
 * informed as a generic and the initial state as a parameter. If the initial state should be empty, `{}` should be used.
 * 
 * This class can be mocked with `VSCodeWebMock`.
 */
export class VSCodeWeb<Bridge extends AsyncStateful<any> = AsyncStateful<Record<string, never>>> implements VSCodeWebInterface<Bridge> {
  private state: StateTypeOf<Bridge>
  private listeners: Partial<{ [K in keyof StateTypeOf<Bridge>]: ((value: StateTypeOf<Bridge>[K]) => void)[] }> = {}
  private bridgeCalls: Map<string, ManualPromise> = new Map()
  readonly bridge = this.createBridgeProxy() as LinkedBridge<Bridge>
  /**
   * Original vscode object obtained by calling `acquireVsCodeApi()`.
   * Will be available after the first time the class is instantiated.
   */
  static vscode: any

  constructor(initialState: StateTypeOf<Bridge>) {
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
    VSCodeWeb.sendMessageToExtension(readyMessage)
  }

  /**
  * Sends a message to the vscode extension.
  * @param message the message to send.
  */
  private static sendMessageToExtension(message: WebviewMessage) {
    VSCodeWeb.vscode.postMessage(message)
  }

  private handleBridgeResponse(message: WebviewResponseMessage) {
    logger.debug('handling bridge response:', message)
    if (!this.bridgeCalls.has(message.id)) {
      return logger.warn(
        'could not resolve response from bridge because id is not registered. Maybe the response came while the view was inactive.',
        message,
      )
    }
    if (message.error) {
      this.bridgeCalls.get(message.id)?.reject(message.error)
    } else {
      this.bridgeCalls.get(message.id)?.resolve(message.result)
    }
    this.bridgeCalls.delete(message.id)
  }

  private handleGetStateRequest(message : WebviewRequestMessage) {
    logger.debug('handling get state request:', message)
    try {
      VSCodeWeb.sendMessageToExtension(buildGetStateResponse(message.id, this.getState(message.id as keyof StateTypeOf<Bridge>)))
    } catch (error) {
      VSCodeWeb.sendMessageToExtension(
        buildGetStateError(message.id, `Can't get state with name ${message.id}, please make sure its value is serializable.`)
      )
      throw error
    }
  }

  private handleSetStateRequest(message: WebviewRequestMessage) {
    logger.debug('handling set state request:', message)
    this.setState(message.property as keyof StateTypeOf<Bridge>, message.arguments?.at(0))
    VSCodeWeb.sendMessageToExtension(buildSetStateResponse(message.id))
  }

  private addWindowListener() {
    window.addEventListener('message', ({ data }) => {
      const message = asWebViewMessage(data)
      switch (message?.type) {
        case messageType.bridge: 
          this.handleBridgeResponse(message)
          break
        case messageType.getState:
          this.handleGetStateRequest(message)
          break
        case messageType.setState:
          this.handleSetStateRequest(message)
      }
    })
  }

  private createBridgeProxy() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    return new Proxy({}, {
      get(_, property) {
        const methodName = String(property)
        const manualPromise = new ManualPromise()
        // fixme: don't create this function on every get, instead, save it and return it if has already been created
        return (...args: any[]) => {
          logger.debug('making call to bridge:', methodName, ...args)
          try {
            const message = buildBridgeRequest(methodName, args)
            self.bridgeCalls.set(message.id, manualPromise)
            logger.debug('sending bridge message:', message)
            VSCodeWeb.sendMessageToExtension(message)
            return manualPromise.promise
          } catch (error) {
            manualPromise.reject(`Can't call "${methodName}" on the bridge, please make sure its parameters are serializable.`)
            throw error
          }
        }
      },
    })
  }

  private runListeners<Key extends keyof StateTypeOf<Bridge>>(stateKey: Key, value: StateTypeOf<Bridge>[Key]) {
    this.listeners[stateKey]?.forEach(l => l(value))
  }

  getState<Key extends keyof StateTypeOf<Bridge>>(key: Key): StateTypeOf<Bridge>[Key] {
    return this.state[key]
  }

  setState<Key extends keyof StateTypeOf<Bridge>>(key: Key, value: StateTypeOf<Bridge>[Key]): void {
    this.state[key] = value
    VSCodeWeb.vscode.setState(this.state)
    this.runListeners(key, value)
  }

  initializeState(state: StateTypeOf<Bridge>): void {
    this.state = { ...state }
    VSCodeWeb.vscode.setState(this.state)
    Object.keys(this.listeners).forEach(key => this.runListeners(key, state[key]))
  }
  
  subscribe<Key extends keyof StateTypeOf<Bridge>>(key: Key, listener: (value: StateTypeOf<Bridge>[Key]) => void): () => void {
    if (!this.listeners[key]) this.listeners[key] = []
    this.listeners[key]?.push(listener)
    return () => {
      const index = this.listeners[key]?.indexOf(listener)
      if (index !== undefined && index >= 0) this.listeners[key]?.splice(index, 1)
    }
  }
}
