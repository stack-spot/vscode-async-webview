import { readFile } from 'fs/promises'
import { camelCase } from 'lodash'
import { Uri, ViewColumn, Webview, WebviewOptions, WebviewPanel, WebviewPanelOptions, window } from 'vscode'
import { ManualPromise, errorToString } from '@stack-spot/vscode-async-webview-shared'
import { VSCodeWebviewAPI } from './VSCodeWebviewAPI'
import { ViewOptions } from './types'

interface ViewColumnWithFocus {
  viewColumn: ViewColumn,
  preserveFocus?: boolean,
}
type ShowOptions = ViewColumn | ViewColumnWithFocus
type PanelOptions = WebviewPanelOptions & WebviewOptions

interface Options<API extends VSCodeWebviewAPI<any>> extends ViewOptions<API> {
  showOptions?: ShowOptions,
  options?: PanelOptions,
}

export class VSCodeWebview<API extends VSCodeWebviewAPI<any> = VSCodeWebviewAPI<any>> {
  protected readonly baseUri: Uri
  private readonly title: string
  readonly type: string
  private readonly showOptions: ShowOptions
  protected readonly options: PanelOptions | undefined
  private panel: WebviewPanel | undefined
  protected readonly apiFactory: Options<API>['apiFactory']
  protected api: API | undefined
  private htmlPromise: Promise<string>
  private html: string | undefined
  private readonly index: string
  private apiPromise: ManualPromise<API> | undefined

  constructor({
    path,
    index = 'index.html',
    title,
    type = camelCase(title),
    showOptions = ViewColumn.One,
    context,
    apiFactory,
    options,
  }: Options<API>) {
    this.baseUri = Uri.joinPath(context.extensionUri, path)
    this.title = title
    this.type = type
    this.showOptions = showOptions
    this.apiFactory = apiFactory
    const basePath = process.platform === 'win32' ? this.baseUri.path.replace(/^\//, '') : this.baseUri.path
    this.htmlPromise = readFile(`${basePath}/${index}`, { encoding: 'utf-8' })
    this.index = index
    this.options = {
      enableScripts: true,
      localResourceRoots: [this.baseUri],
      ...options,
    }
  }

  protected async buildHtml(baseSrc: Uri) {
    try {
      const htmlText = await this.htmlPromise
      this.html = this.treatHTML(htmlText, baseSrc)
    } catch (error: any) {
      window.showErrorMessage('There was an error while loading the html for the webview. This is a bug, please report it to the team.')
      this.html = `
        <html>
          <body>
            <p>Unable to load webview from ${this.baseUri.path}/${this.index}.</p>
            <p>The underlying error is: ${errorToString(error)}</p>
          </body>
        </html>
      `
    }
    return this.html
  }

  protected buildAPI(webview: Webview) {
    try {
      this.api = this.apiFactory?.call(null, webview)
      if (this.api && this.apiPromise) {
        this.apiPromise.resolve(this.api)
        this.apiPromise = undefined
      }
    } catch (error) {
      window.showErrorMessage([
        "There was an error while building the webview: unable to instantiate the webview's API.",
        `This is a bug, please report it to the team. Cause: ${errorToString(error)}`,
      ].join('\n'))
    }
  }

  private async buildPanel() {
    this.panel = window.createWebviewPanel(this.type, this.title, this.showOptions, this.options)
    this.buildAPI(this.panel.webview)
    const html = await this.buildHtml(this.panel?.webview.asWebviewUri(this.baseUri))
    this.panel.webview.html = html
    this.panel.onDidDispose(() => {
      this.panel = undefined
      this.api?.dispose()
      this.api = undefined
    })
  }

  protected treatHTML(html: string, baseSrc: Uri): string {
    return html.replace('<head>', `<head><base href="${baseSrc}/">`)
  }

  async show(column?: ViewColumn) {
    if (this.panel) this.panel.reveal(column)
    else await this.buildPanel()
  }

  getPanel() {
    return this.panel
  }

  getHTML() {
    return this.html
  }

  getAPI() {
    return this.api
  }

  getAPIAsync() {
    if (this.api) return Promise.resolve(this.api)
    this.apiPromise = new ManualPromise()
    return this.apiPromise.promise
  }
}
