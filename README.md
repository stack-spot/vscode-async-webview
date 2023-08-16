# Introduction
This is a utility for making it easier to implement web views within VSCode extensions. In summary, this abstracts all the message traffic
between the iframes into an easy to use asynchronous API. Furthermore, it simplifies the injection of a full web app into the extension
without the need of writing HTML strings or specific VSCode code in the web app.

This document is aimed at users of this library. If you want to read the document for developers, please, read [this text](developer.md)
instead.

# Motivation
I've recently inherited a VSCode extension project that heavily relied on a webview. After a deep analysis of the code, I noticed:
- The HTML injection part of the process was very complex and relied a lot in the function `asWebviewUri`, making it very hard to add
new resources to the project.
- The communication between the webview and the extension was very complex, verbose, non-intuitive and prone to errors. Untyped states,
messages with strings mostly untyped, explicit calls to `postMessage` and manual registration of listeners really didn't help.

I needed to elevate the extension to a production level of quality and make it something easy to maintain. I had no doubt I had to scrap
the current project and develop a framework to work on top of the API provided by VSCode. This is this framework.

This is a very new project and the extension we're building on top of it will probably be released next month. As soon as we have a stable
release, I'll put a link to it in here.

The results, for now, have been very satisfactory. The actual code for our extension is super simple and focus on the logic of the
extension, never on details of how to communicate two different applications.

# Development stage
This is currently on Alpha. I'll be moving it to beta as soon as we release the first version of our extension and it's live on the VSCode
store.

This will have a stable release (1.0.0) when we have at least 80% of test coverage.

# Disclaimer
This documentation assumes you're already familiar with the basics of the 
[vscode documentation for creating an extension](https://code.visualstudio.com/api).

# Example
We're going to focus on a very simple example where the webview shows a VSCode notification and the VSCode notification interacts with the
webview state. See the video below.

https://github.com/stack-spot/vscode-async-webview/assets/1119029/ca63df34-3d93-43a3-9055-de64e55fa416

## Extension
### `extension/src/extension.ts`:
```ts
import * as vscode from 'vscode'
import { VSCodeWebview } from '@stack-spot/vscode-async-webview-backend'
import { Bridge } from './Bridge'

export function activate(context: vscode.ExtensionContext) {
	const webview = new VSCodeWebview({
		type: 'myExtension',
		path: 'packages/webview',
		title: 'My Extension',
		bridgeFactory: (webview) => new Bridge(webview),
		context,
	})

	let disposable = vscode.commands.registerCommand('myExtension.start', () => {
		webview.show()
	})

	context.subscriptions.push(disposable)
}
```

### `extension/src/Bridge.ts`:
This is the class that makes the bridge between the two applications.

```ts
import { VSCodeWebviewBridge } from '@stack-spot/vscode-async-webview-backend'
import { ViewState } from './ViewState'
import { window } from 'vscode'

export class Bridge extends VSCodeWebviewBridge<ViewState> {
  async showMessage(message: string) {
    const action = await window.showInformationMessage(message, 'reset counter', 'close')
    if (action === 'reset counter') {
      this.state.set('counter', 0)
    }
  }
}
```

### `extension/src/ViewState.ts`:
This file declares the state shared between the two applications:

```ts
export interface ViewState {
  counter?: number,
}
```

## Webview
This example has been created with React, but you can use anything as your frontend framework.

### `webview/src/vscode.ts`:
This file makes the basic setup for using the lib.

```ts
import { VSCodeWeb, VSCodeWebInterface } from '@stack-spot/vscode-async-webview-client'
import { createVSCodeHooks } from '@stack-spot/vscode-async-webview-react'
import type { Bridge } from 'extension/Bridge'

export const vscode: VSCodeWebInterface<Bridge> = new VSCodeWeb<Bridge>({})
const vsHooks = createVSCodeHooks(vscode)
export const useBridgeState = vsHooks.useState
```

### `webview/src/App.tsx`:
Most of the code here is [Vite's](https://vitejs.dev/) boilerplate. Pay attention to whenever we use `vscode.bridge` and `useBridgeState`,
these are the two structures used in the frontend in order to communicate with the extension.

```tsx
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { useBridgeState, vscode } from './vscode'

function App() {
  const [count = 0, setCount] = useBridgeState('counter')

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => {
          setCount(count + 1)
          vscode.bridge.showMessage(`The counter is at: ${count + 1}.`)
        }}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
```

## Full example
You can find the full example in our [sample project](https://github.com/Tiagoperes/vscode-async-webview-sample).

# Docs
- [Getting started](docs/getting-started.md)
- [Backend library](docs/backend.md)
- [Client library](docs/client.md)
