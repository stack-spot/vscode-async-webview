import { uniqueId } from 'lodash'
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
  WebviewStreamMessage,
  WebviewTelemetryMessage,
} from '@stack-spot/vscode-async-webview-shared'
import { AnyFunction } from './types'

interface MessageListenerDisposable {
  dispose(): void,
}

interface Dependencies {
  /**
   * Function to send a message to the client app. It must return a promise that resolves to true if the message was successfully sent or
   * false otherwise.
   */
  sendMessageToClient: (message: WebviewMessage) => Promise<boolean>,
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
  private readonly MAX_QUEUE_SIZE = 100
  private readonly deps: Dependencies
  private readonly getStateCalls: Map<string, ManualPromise> = new Map()
  private readonly setStateCalls: Map<string, ManualPromise<void>> = new Map()
  /**
   * If the client is offline (sendMessage returns false), the message is enqueued instead.
   * The queue is consumed as soon as the client becomes online again.
   */
  private queue: WebviewMessage[] = []
  private streaming = new Map<string, { index: number, pending?: Omit<WebviewStreamMessage, 'index' | 'type'>, result: string }>()
  private messageListener?: MessageListenerDisposable
  private disposed = false

  constructor(deps: Dependencies) {
    this.deps = deps
    this.listen()
  }

  private async sendMessageToClient(message: WebviewMessage, onNotSent?: () => void) {
    // Don't send messages if already disposed
    if (this.disposed) return

    const sent = await this.deps.sendMessageToClient(message)
    if (!sent) {
      if (onNotSent) onNotSent()
      else {
        if (this.queue.length >= this.MAX_QUEUE_SIZE) {
          this.queue.shift() // Remove oldest message if queue is full
          logger.warn('Message queue full, dropping oldest message')
        }
        this.queue.push(message)
      }
    }
  }

  private async handleRequestToBridge(message: WebviewRequestMessage) {
    logger.debug('handling bridge call:', message)
    const { id, property = '', arguments: args = [] } = message
    const fn = this.deps.getBridgeHandler(property)
    if (!fn) {
      const error = `"${property}" is not a method or function of the bridge provided to the VSCodeWebview.`
      this.sendMessageToClient(buildBridgeError(id, error))
    }
    let functionHasExecuted = false
    try {
      const result = await fn!(...args)
      functionHasExecuted = true
      logger.debug('sending bridge response to client:', result)
      this.sendMessageToClient(buildBridgeResponse(id, result))
    } catch (error: any) {
      const message = functionHasExecuted
        ? `Error while sending message to client. Please make sure the return value of the method "${property}" in the Bridge provided to the VSCodeWebview is serializable.`
        : errorToString(error)
      this.sendMessageToClient(buildBridgeError(id, message))
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

  private handleClientReadyness() {
    const q = this.queue
    this.queue = []
    q.forEach(m => this.sendMessageToClient(m))
    this.streaming.forEach((value) => {
      const message = value.pending
      const content = value.result
      value.pending = undefined
      value.result = ''
      if (message) this.stream({ ...message, content })
    })
  }

  private listen() {
    // Store the disposable if returned, to clean it up later
    const result = this.deps.listenToMessagesFromClient(async (message) => {
      // Don't process messages if already disposed
      if (this.disposed) return

      switch (message?.type) {
        case messageType.bridge:
          await this.handleRequestToBridge(message)
          break
        case messageType.getState:
          this.handleStateResponse('get', message)
          break
        case messageType.setState:
          this.handleStateResponse('set', message)
          break
        case messageType.ready:
          this.handleClientReadyness()
      }
    })

    // Only store if a disposable was returned (not void/undefined)
    // We need to handle this without testing void for truthiness
    if (result !== undefined && result !== null) {
      const disposable = result as MessageListenerDisposable
      if ('dispose' in disposable && typeof disposable.dispose === 'function') {
        this.messageListener = disposable
      }
    }
  }

  dispose() {
    if (this.disposed) return // Prevent double disposal
    this.disposed = true

    // Reject all pending promises
    this.getStateCalls.forEach((value, key) => {
      value.reject(`The webview closed before the state "${String(key)}" could be retrieved.`)
    })
    this.setStateCalls.forEach((value) => {
      value.reject('The webview closed before the state could be set.')
    })

    // Clear all maps
    this.getStateCalls.clear()
    this.setStateCalls.clear()
    this.streaming.clear()

    // Clear the queue
    this.queue = []

    // Dispose the message listener if it exists
    if (this.messageListener) {
      this.messageListener.dispose()
      this.messageListener = undefined
    }
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
      this.sendMessageToClient(message)
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
      this.sendMessageToClient(message)
    } catch (error) {
      manualPromise.reject(
        `Can't set state with name "${state}". Please, make sure the value passed as parameter is serializable. Cause: ${error}.`,
      )
    }
    return manualPromise.promise
  }

  stream(message: Omit<WebviewStreamMessage, 'index' | 'type'>) {
    if (this.disposed) return

    if (this.streaming.size > 50) {
      const toDelete: string[] = []
      this.streaming.forEach((value, key) => {
        if (!value.pending && value.result === '') {
          toDelete.push(key)
        }
      })
      toDelete.forEach(key => this.streaming.delete(key))
    }

    const currentStreaming = this.streaming.get(message.id) ?? { index: -1, result: '' }
    this.streaming.set(message.id, currentStreaming)
    currentStreaming.result += message.content
    if (currentStreaming.pending) return currentStreaming.pending = message
    currentStreaming.index++
    const withIndex: WebviewStreamMessage = { ...message, index: currentStreaming.index, type: 'vscode-webview-stream' }
    this.sendMessageToClient(withIndex, () => {
      currentStreaming.index = -1
      currentStreaming.pending ??= message
    })
    if (message.complete || message.error) this.streaming.delete(message.id)
  }

  telemetryEvent(message: Omit<WebviewTelemetryMessage, 'type' | 'id'>) {
    this.sendMessageToClient({
      id: uniqueId(),
      type: 'vscode-webview-telemetry',
      ...message,
    })
  }
}
