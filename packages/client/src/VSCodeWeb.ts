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
  WebviewStreamMessage,
  WebviewTelemetryMessage,
} from '@stack-spot/vscode-async-webview-shared'
import { LinkedBridge, VSCodeWebInterface } from './VSCodeWebInterface'

declare global {
  interface Window {
    original?: {
      log: (text: string) => void,
      error: (text: string) => void,
    },
  }
}

interface StreamingHandler {
  onData: (data: string) => void,
  onError?: (error: string) => void,
  onComplete?: () => void,
}

interface StreamingObject {
  handler?: StreamingHandler,
  index: number,
  queue: Map<number, WebviewStreamMessage>,
}

type TelemetryEvent = (eventName: string, eventType: 'event' | 'error', properties?: object) => void

/**
 * This class is responsible for acquiring the vscode API and connecting the webview to the bridge. This should never be instantiated more
 * than once.
 * 
 * To create an instance of VSCodeWeb, you must call `const vscode = new VSCodeWeb<BridgeType>(initialState)`. The bridge type must be
 * informed as a generic and the initial state as a parameter. If the initial state should be empty, `{}` should be used.
 * 
 * This class can be mocked with `VSCodeWebMock`.
 */
export class VSCodeWeb<Bridge extends AsyncStateful = AsyncStateful> implements VSCodeWebInterface<Bridge> {
  private state: StateTypeOf<Bridge>
  private listeners: Partial<{ [K in keyof StateTypeOf<Bridge>]: ((value: StateTypeOf<Bridge>[K]) => void)[] }> = {}
  private bridgeCalls: Map<string, ManualPromise> = new Map()
  readonly bridge = this.createBridgeProxy() as LinkedBridge<Bridge>
  private streams = new Map<string, StreamingObject>()
  private telemetryEvent: TelemetryEvent
  private windowMessageListener?: (ev: MessageEvent<any>) => any
  private unloadListener?: () => void
  private disposed = false
  private static instance?: VSCodeWeb<any>
  /**
   * Original vscode object obtained by calling `acquireVsCodeApi()`.
   * Will be available after the first time the class is instantiated.
   */
  static vscode: any
  

  constructor(initialState: StateTypeOf<Bridge>, telemetryEvent: TelemetryEvent, sendReadyMessage = true) {
    if (VSCodeWeb.vscode) {
      logger.warn('VSCodeWeb should not be instantiated more than once, this can cause unexpected behavior.')
    } else {
      // @ts-ignore
      VSCodeWeb.vscode = acquireVsCodeApi()
    }

    VSCodeWeb.instance = this

    const stored = VSCodeWeb.vscode.getState()
    if (!stored) VSCodeWeb.vscode.setState(initialState)
    this.state = VSCodeWeb.vscode.getState()
    this.addWindowListener()
    this.setupAutoDispose()
    if (sendReadyMessage) this.setViewReady()

    this.telemetryEvent = telemetryEvent
  }

  log(text: string): void {
    // eslint-disable-next-line no-console
    window.original?.log(text)
  }

  error(text: string): void {
    // eslint-disable-next-line no-console
    window.original?.error(text)
  }

  /**
   * Sets up automatic disposal when the window unloads
   */
  private setupAutoDispose() {
    // Clean up when the webview is being destroyed
    this.unloadListener = () => {
      this.dispose()
    }
    window.addEventListener('beforeunload', this.unloadListener)    
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

  private handleGetStateRequest(message: WebviewRequestMessage) {
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

  private processStreamQueue(stream: StreamingObject) {
    const message = stream.queue.get(stream.index)
    stream.queue.delete(stream.index)
    if (!message) return
    if (message.content) stream.handler?.onData(message.content)
    if (message.error || message.complete) this.streams.delete(message.id)
    if (message.error && stream.handler?.onError) stream.handler.onError(message.error)
    if (message.complete && stream.handler?.onComplete) stream.handler.onComplete()
    stream.index++
    this.processStreamQueue(stream)
  }

  private handleStream(message: WebviewStreamMessage) {
    logger.debug('handling stream message:', message)
    if (!this.streams.has(message.id)) this.streams.set(message.id, { index: 0, queue: new Map() })
    const stream = this.streams.get(message.id)!
    stream.queue.set(message.index, message)
    if (stream.handler) this.processStreamQueue(stream)
  }

  private handleTelemetry({ eventName, eventType, properties }: WebviewTelemetryMessage) {
    this.telemetryEvent(eventName, eventType, properties)
  }

  private addWindowListener() {
    this.windowMessageListener = ({ data }) => {
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
          break
        case messageType.telemetry:
          this.handleTelemetry(message as WebviewTelemetryMessage)
          break
        case messageType.stream:
          this.handleStream(message as WebviewStreamMessage)
      }
    }
    window.addEventListener('message', this.windowMessageListener)
  }

  private createBridgeProxy() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    // eslint-disable-next-line @typescript-eslint/ban-types
    const methodCache = new Map<string, Function>()

    return new Proxy({}, {
      get(_, property) {
        const methodName = String(property)

        if (methodCache.has(methodName)) {
          return methodCache.get(methodName)
        }

        const fn = (...args: any[]) => {
          logger.debug('making call to bridge:', methodName, ...args)
          try {
            const message = buildBridgeRequest(methodName, args)
            const manualPromise = new ManualPromise()
            self.bridgeCalls.set(message.id, manualPromise)
            logger.debug('sending bridge message:', message)
            VSCodeWeb.sendMessageToExtension(message)
            return manualPromise.promise
          } catch (error) {
            throw new Error(`Can't call "${methodName}" on the bridge, please make sure its parameters are serializable.`)
          }
        }

        methodCache.set(methodName, fn)
        return fn
      },
    })
  }

  private runListeners<Key extends keyof StateTypeOf<Bridge>>(stateKey: Key, value: StateTypeOf<Bridge>[Key]) {
    this.listeners[stateKey]?.forEach(l => l(value))
  }

  setViewReady() {
    VSCodeWeb.sendMessageToExtension(readyMessage)
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

  stream(id: string, onData: (data: string) => void, onError?: (error: string) => void, onComplete?: () => void): void {
    if (!this.streams.has(id)) this.streams.set(id, { index: 0, queue: new Map() })
    const stream = this.streams.get(id)!
    stream.handler = { onData, onError, onComplete }
    if (stream.queue.size) this.processStreamQueue(stream)
  }

  /**
   * Disposes all resources and cleans up event listeners
   */
  public dispose() {
    if (this.disposed) return
    this.disposed = true
    
    logger.debug('Disposing VSCodeWeb')
    
    // Remove event listeners
    if (this.windowMessageListener) {
      window.removeEventListener('message', this.windowMessageListener)
      this.windowMessageListener = undefined
    }
    
    if (this.unloadListener) {
      window.removeEventListener('beforeunload', this.unloadListener)
      this.unloadListener = undefined
    }
    
    this.bridgeCalls.clear()
    
    // Clear all streams
    this.streams.forEach((stream) => {
      if (stream.handler?.onError) {
        stream.handler.onError('VSCodeWeb is being disposed')
      }
    })
    this.streams.clear()
    
    // Clear listeners
    this.listeners = {}
    
    // Clear static instance
    if (VSCodeWeb.instance === this) {
      VSCodeWeb.instance = undefined
    }
    
    logger.debug('VSCodeWeb disposed successfully')
  }

  /**
   * Static method to get the current instance
   */
  static getInstance<T extends AsyncStateful>(): VSCodeWeb<T> | undefined {
    return VSCodeWeb.instance as VSCodeWeb<T> | undefined
  }

  /**
   * Static method to dispose the current instance
   */
  static disposeInstance() {
    VSCodeWeb.instance?.dispose()
  }
}
