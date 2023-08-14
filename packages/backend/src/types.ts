import { ExtensionContext, Webview, WebviewOptions } from 'vscode'
import { VSCodeWebviewBridge } from './VSCodeWebviewBridge'

export type AnyFunction = (...args: any[]) => any

export interface ViewOptions<Bridge extends VSCodeWebviewBridge<any>> {
  /**
   * The path to the webview directory.
   * Attention:
   * - This must be the compiled/bundled version of the we application.
   * - This path must be relative to the root package.json in the final extension bundle.
   */
  path: string,
  /**
   * The name of the html file under `path` to show.
   * @default index.html
   */
  index?: string,
  /**
   * The title of the webview
   */
  title: string,
  /**
   * The ExtensionContext
   */
  context: ExtensionContext,
  /**
   * The type. This is the same `type` used by any VSCode view.
   */
  type?: string,
  /**
   * The options for the Webview.
   * 
   * `enableScripts` and `localResourceRoots` will be set to the correct values unless explicitly overwritten by this configuration.
   */
  options?: WebviewOptions,
  /**
   * A factory that creates the Bridge between the extension and the webview. The Bridge must extend VSCodeWebviewBridge which requires a
   * Webview in its constructor. For this reason, this factory function receives a `Webview` as parameter.
   * 
   * If this is not provided, the library won't be able to handle any communication between the two applications.
   * 
   * @param webview the webview loaded
   * @returns an instance of the Bridge
   */
  bridgeFactory?: (webview: Webview) => Bridge,
}
