import { WebviewOptions, WebviewView, WebviewViewProvider, window } from 'vscode'
import { ViewOptions } from './types'
import { VSCodeWebview } from './VSCodeWebview'
import { VSCodeWebviewBridge } from './VSCodeWebviewBridge'

/**
 * Same as {@link VSCodeWebview}, but instead of creating a new Panel, it implements the interface {@link WebviewViewProvider} instead.
 */
export class VSCodeViewProvider<
  Bridge extends VSCodeWebviewBridge = VSCodeWebviewBridge
> extends VSCodeWebview<Bridge> implements WebviewViewProvider {
  private view: WebviewView | undefined

  constructor(options: ViewOptions<Bridge>) {
    super(options)
    if (options.type) {
      options.context.subscriptions.push(window.registerWebviewViewProvider(options.type, this, {
                webviewOptions: { retainContextWhenHidden: true }
            }))
    }
  }

  async resolveWebviewView(view: WebviewView) {
    this.view = view
    const { webview } = view
    const html = this.getHTML() ?? await this.buildHtml(webview.asWebviewUri(this.baseUri))
    this.buildBridge(webview)
    webview.options = this.options as WebviewOptions
    webview.html = html
    view.onDidDispose(() => {
      this.view = undefined
      this.bridge?.dispose()
      this.bridge = undefined
    })
  }

  /**
   * Shows the current view if it's hidden.
   * Same as running the command "{viewType}.focus".
   * 
   * If the view is not available, an error message is shown as a notification in VSCode.
   */
  override async show() {
    if (this.view) this.view.show()
    else window.showErrorMessage(
      "Can't show Stack Spot view because it has been disposed or not yet started. Please, restart the extension.",
    )
  }

  /**
   * Gets the current WebviewView.
   * 
   * If the vire has not yet been created, undefined is returned.
   * 
   * @returns the current view.
   */
  getView() {
    return this.view
  }
}
