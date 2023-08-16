# Introduction
The `@stack-spot/vscode-async-webview-backend` is the backend module of this library. It must be used by the extension itself. This
document will list and explain the main features exported from this package.

# VSCodeWebview
Represents a Webview loaded into the extension. It creates an API (Bridge) and a State shared between both the extension and the webview.
Use the code documentation for more details.

To show a panel with a webview, first create the `VSCodeWebview` with the required config and then call `VSCodeWebview#show()`.

# VSCodeViewProvider
Same as VSCodeWebview, but instead of creating a new Panel, it implements the VSCode's interface WebviewViewProvider instead.

# VSCodeWebviewBridge
This makes the bridge between the extension and webview. Every public method declared here will be callable by both ends of the
application. The bridge also declares a State that lives in the webview, but can accessible by both parts.

Every method declared by the bridge is asynchronous when accessed from the webview while every state declared by it is synchronous when
accessed from the webview, but asynchronous when accessed from the bridge.

To access a method from the webview, `VSCodeWebInterface#bridge` must be used.

To access a state from the webview, `VSCodeWebInterface#getState`, `VSCodeWebInterface#initializeState`, `VSCodeWebInterface#setState`
and `VSCodeWebInterface#observeState` must be used. If you're using React, state management can be replaced by a simple hook.

To access a state from the bridge, use `await VSCodeWebviewBridge#state.get(name)` and `await VSCodeWebviewBridge#state.set(name, value)`.
