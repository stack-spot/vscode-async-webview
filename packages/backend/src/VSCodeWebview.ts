import { readFile } from 'fs/promises'
import { camelCase } from 'lodash'
import { Uri, ViewColumn, Webview, WebviewOptions, WebviewPanel, WebviewPanelOptions, window } from 'vscode'
import { ManualPromise, errorToString } from '@stack-spot/vscode-async-webview-shared'
import { VSCodeWebviewBridge } from './VSCodeWebviewBridge'
import { ViewOptions } from './types'

interface ViewColumnWithFocus {
  viewColumn: ViewColumn,
  preserveFocus?: boolean,
}
type ShowOptions = ViewColumn | ViewColumnWithFocus
type PanelOptions = WebviewPanelOptions & WebviewOptions

interface Options<Bridge extends VSCodeWebviewBridge> extends ViewOptions<Bridge> {
  /**
   * Which ViewColumn would you like to use?
   */
  showOptions?: ShowOptions,
  /**
   * The options for the panel containing the webview.
   */
  options?: PanelOptions,
}

/**
 * Represents a Webview loaded into the extension. It creates a Bridge and a State shared between both the extension and the webview.
 * 
 * It creates a Panel with a Webview. The panel is first created when `show()` is called for the first time.
 * 
 * The Webview must be a separate project already compiled (bundled). `path`, in the constructor, must refer to the path to the site
 * directory inside the final extension bundle. This path must be relative to the package.json in the root of the bundle.
 * 
 * If the file to load in the webview is not `index.html`, you should provide a value for `index` in the constructor.
 * 
 * To show a panel with a webview, first create the `VSCodeWebview` with the required config and then call `VSCodeWebview#show()`.
 */
export class VSCodeWebview<Bridge extends VSCodeWebviewBridge = VSCodeWebviewBridge> {
  protected readonly supportVDI: boolean = true
  protected readonly baseUri: Uri
  private readonly title: string
  readonly type: string
  private readonly showOptions: ShowOptions
  protected readonly options: PanelOptions | undefined
  private panel: WebviewPanel | undefined
  protected readonly bridgeFactory: Options<Bridge>['bridgeFactory']
  protected bridge: Bridge | undefined
  private htmlPromise: Promise<string>
  private html: string | undefined
  private readonly index: string
  private bridgePromise: ManualPromise<Bridge> | undefined
  
  constructor({
    path,
    index = 'index.html',
    title,
    type = camelCase(title),
    showOptions = ViewColumn.One,
    context,
    bridgeFactory,
    options,
  }: Options<Bridge>) {
    this.baseUri = Uri.joinPath(context.extensionUri, path)
    this.title = title
    this.type = type
    this.showOptions = showOptions
    this.bridgeFactory = bridgeFactory
    const basePath = process.platform === 'win32' ? this.baseUri.path.replace(/^\//, '') : this.baseUri.path
    this.htmlPromise = readFile(`${basePath}/${index}`, { encoding: 'utf-8' })
    this.index = index
    this.options = {
      enableScripts: true,
      retainContextWhenHidden: false,
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

  protected buildBridge(webview: Webview) {
    try {
      this.bridge = this.bridgeFactory?.call(null, webview)
      if (this.bridge && this.bridgePromise) {
        this.bridgePromise.resolve(this.bridge)
        this.bridgePromise = undefined
      }
    } catch (error) {
      window.showErrorMessage([
        "There was an error while building the webview: unable to instantiate the webview's Bridge.",
        `This is a bug, please report it to the team. Cause: ${errorToString(error)}`,
      ].join('\n'))
    }
  }

  private async buildPanel() {
    this.panel = window.createWebviewPanel(this.type, this.title, this.showOptions, this.options)
    this.buildBridge(this.panel.webview)
    const html = await this.buildHtml(this.panel?.webview.asWebviewUri(this.baseUri))
    this.panel.webview.html = html
    this.panel.onDidDispose(() => {
      this.panel = undefined
      this.bridge?.dispose()
      this.bridge = undefined
    })
  }

  protected treatHTML(html: string, baseSrc: Uri): string {
    if (this.supportVDI) {
      const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' ${baseSrc}; style-src 'unsafe-inline' ${baseSrc}; img-src ${baseSrc} data: https:; font-src ${baseSrc};">`
    return html
      .replace('<head>', `<head>${csp}<base href="${baseSrc}/">`)
      .replace('</body>', `
      <script>
        // Debug script for VDI
        console.log('[WEBVIEW] Script executing');
        window.onerror = (msg, url, line, col, error) => {
          console.error('[WEBVIEW ERROR]', msg, error);
          return true;
        };
      </script>
      </body>
    `)
    }
    return html.replace('<head>', `<head><base href="${baseSrc}/">`)
  }

  /**
   * Shows the webview panel.
   * If the panel has not yet been created, it's created.
   * @param column the column to show the panel at.
   */
  async show(column?: ViewColumn) {
    if (this.panel) this.panel.reveal(column)
    else await this.buildPanel()
  }

  /**
   * Gets a reference to the panel.
   * 
   * If the panel has not yet been created or if it has been disposed, undefined is returned.
   * 
   * @returns the current panel.
   */
  getPanel() {
    return this.panel
  }

  /**
   * Gets the HTML of the webview.
   * 
   * If the webview hasn't been shown yet, this will be undefined.
   * 
   * @returns the html.
   */
  getHTML() {
    return this.html
  }

  /**
   * Gets a reference to the current bridge.
   * 
   * If the bridge has not yet been created or it has been disposed, undefined is returned. The bridge is created/disposed at the same time
   * as the panel.
   * 
   * @returns the current bridge.
   */
  getBridge() {
    return this.bridge
  }

  /**
   * Same as getBridge, but if the bridge has not yet been created, the promise returned will resolve once it's available.
   * @returns a promise that resolves to the bridge.
   */
  getBridgeAsync() {
    if (this.bridge) return Promise.resolve(this.bridge)
    this.bridgePromise = new ManualPromise()
    return this.bridgePromise.promise
  }
}
