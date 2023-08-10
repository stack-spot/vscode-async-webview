import { WebviewOptions, WebviewView, WebviewViewProvider, window } from 'vscode'
import { ViewOptions } from './types'
import { VSCodeWebview } from './VSCodeWebview'
import { VSCodeWebviewAPI } from './VSCodeWebviewAPI'

export class VSCodeViewProvider<
  API extends VSCodeWebviewAPI<any> = VSCodeWebviewAPI<any>
> extends VSCodeWebview<API> implements WebviewViewProvider {
  private view: WebviewView | undefined

  constructor(options: ViewOptions<API>) {
    super(options)
    if (options.type) {
      options.context.subscriptions.push(window.registerWebviewViewProvider(options.type, this))
    }
  }

  async resolveWebviewView(view: WebviewView) {
    this.view = view
    const { webview } = view
    const html = this.getHTML() ?? await this.buildHtml(webview.asWebviewUri(this.baseUri))
    this.buildAPI(webview)
    webview.options = this.options as WebviewOptions
    webview.html = html
    view.onDidDispose(() => {
      this.view = undefined
      this.api?.dispose()
      this.api = undefined
    })
  }

  override async show() {
    if (this.view) this.view.show()
    else window.showErrorMessage(
      "Can't show Stack Spot view because it has been disposed or not yet started. Please, restart the extension.",
    )
  }

  getView() {
    return this.view
  }
}
