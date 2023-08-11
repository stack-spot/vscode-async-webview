import { Webview } from 'vscode'
import { AsyncState, AsyncStateful, asWebViewMessage, logger } from '@stack-spot/vscode-async-webview-shared'
import { MessageHandler } from './MessageHandler'
import { AnyFunction } from './types'

export abstract class VSCodeWebviewAPI<StateType extends object = Record<string, never>> implements AsyncStateful<StateType> {
  #messageHandler: MessageHandler
  readonly state

  constructor(webview: Webview) {
    this.#messageHandler = this.#createMessageHandler(webview)
    this.state = {
      get: (key) => this.#messageHandler.getState.apply(this.#messageHandler, [String(key)]),
      set: (key, value) => this.#messageHandler.setState.apply(this.#messageHandler, [String(key), value]),
    } as AsyncState<StateType>
  }

  #createMessageHandler(webview: Webview) {
    return new MessageHandler({
      getAPIHandler: (name: string) => {
        const member = this[name as keyof this]
        return typeof member === 'function' ? (...args: any[]) => (member as AnyFunction).apply(this, args) : undefined
      },
      sendMessageToClient: (message) => webview.postMessage.apply(webview, [message]),
      listenToMessagesFromClient: (listener) => {
        webview.onDidReceiveMessage((data) => {
          logger.debug('received message from client:', data)
          const message = asWebViewMessage(data)
          if (message) listener(message)
        })
      },
    })
  }

  dispose() {
    this.#messageHandler.dispose()
  }
}
