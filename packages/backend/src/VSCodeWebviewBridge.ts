import { Webview } from 'vscode'
import { 
  AsyncState, 
  AsyncStateful, 
  WebviewStreamMessage, 
  asWebViewMessage, 
  logger, 
  WebviewTelemetryMessage,
} from '@stack-spot/vscode-async-webview-shared'
import { MessageHandler } from './MessageHandler'
import { AnyFunction } from './types'

/**
 * This makes the bridge between the extension and webview. Every public method declared here will be callable by both ends of the
 * application.
 * 
 * The bridge also declares a State that lives in the webview, but can accessible by both parts. The Generics received by this class is
 * the type of this state.
 * 
 * Every method declared here will be asynchronous when accessed from the webview.
 * 
 * Every state declared here will be asynchronous when accessed by the extension, but synchronous in the webview.
 * 
 * To access a method from the webview, `VSCodeWebInterface#bridge` must be used.
 * To access a state from the webview, `VSCodeWebInterface#getState`, `VSCodeWebInterface#initializeState`, `VSCodeWebInterface#setState`
 * and `VSCodeWebInterface#observeState` must be used. If you're using React, state management can be replaced by a simple hook.
 * 
 * To access a state from the bridge (this class), use `await this.state.get(name)` and `await this.state.set(name, value)`. Tip: if you
 * don't need to know if the state has finished being set or not, you can omit the `await` to make the code more simple.
 * 
 * If you need to do additional tasks before disposing the bridge, you can overwrite the method `dispose`, just don't forget to call
 * `super.dispose()`.
 */
export abstract class VSCodeWebviewBridge<StateType extends Record<string, any> = Record<string, any>> implements AsyncStateful<StateType> {
  #messageHandler: MessageHandler
  readonly state

  constructor(webview: Webview) {
    this.#messageHandler = this.#createMessageHandler(webview)
    this.state = {
      get: (key: string) => this.#messageHandler.getState.apply(this.#messageHandler, [String(key)]),
      set: (key: string, value: any) => this.#messageHandler.setState.apply(this.#messageHandler, [String(key), value]),
    } as AsyncState<StateType>
  }

  #createMessageHandler(webview: Webview) {
    return new MessageHandler({
      getBridgeHandler: (name: string) => {
        const member = this[name as keyof this]
        return typeof member === 'function' ? (...args: any[]) => (member as AnyFunction).apply(this, args) : undefined
      },
      sendMessageToClient: async (message) => webview.postMessage.apply(webview, [message]),
      listenToMessagesFromClient: (listener) => webview.onDidReceiveMessage((data) => {
        logger.debug('received message from client:', data)
        const message = asWebViewMessage(data)
        if (message) listener(message)
      }),
    })
  }

  /**
   * Streams a string from the extension to the webview.
   * @param message the package to send.
   */
  stream(message: Omit<WebviewStreamMessage, 'type' | 'index'>) {
    this.#messageHandler.stream(message)
  }

  /**
   * Sends extension telemetry events to be registered by the webview
   * @param message the package to send.
   */
  telemetryEvent(message: Omit<WebviewTelemetryMessage, 'type' | 'id'>) {
    this.#messageHandler.telemetryEvent(message)
  }

  dispose() {
    this.#messageHandler.dispose()
  }
}
