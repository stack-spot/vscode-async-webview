import { ExtensionContext, Webview, WebviewOptions } from 'vscode'
import { VSCodeWebviewAPI } from './VSCodeWebviewAPI'

export type AnyFunction = (...args: any[]) => any

export interface ViewOptions<API extends VSCodeWebviewAPI<any>> {
  path: string,
  index?: string,
  title: string,
  context: ExtensionContext,
  type?: string,
  options?: WebviewOptions,
  apiFactory?: (webview: Webview) => API,
}
