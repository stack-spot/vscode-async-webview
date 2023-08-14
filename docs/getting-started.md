# New project

## Cloning the Sample Project
If you're starting a new project, the easiest way to setup your webview with `vscode-async-webview` is by cloning our
[sample project](https://github.com/Tiagoperes/vscode-async-webview-sample) and starting from there.

If you intend to use React, just edit the package "webview" as you need. Otherwise, replace the contents of this package with your webapp.
If you replace the webview with another project, please mind the notes below:

- The URLs in the web app must all be relative when running it under VSCode, the lib will take care of them by injecting a baseURL
tag into the HTML. In tools like Create React App and Vite, this can be easily done by setting PUBLIC_URL or editing `vite.config.ts`,
respectively.
- The build process must be called "compile" and output the files to `./out/webview` (from the root directory).
- If you don't see anything when the webview is opened inside VSCode, there has probably been an error while loading a script, open the
developer tools to debug.

It's done! You can now jump to [todo](#todo).

## From scratch
1. Use the [recommended approach](https://code.visualstudio.com/api/get-started/your-first-extension) in the VSCode documentation to create
a new project.
2. Follow the guide in the next session (Existing project).

# Existing project:
## 1. Create a new workspace.
To create web views within VSCode you'll need multiple projects: one for the extension itself and at least one another for the webview.
Follow the guide to create a new workspace project for the dependency manager of your choice (npm, yarn, pnpm...).

## 2. Move your extension to the new workspace.
Considering the projects in your workspace are under `packages/`.

1. Move your existing extension to `packages/extension`.
2. Move the files `README.md`, `LICENSE` and `CHANGELOG.md` from `packages/extension` to the root of the workspace.
3. Move the directory `.vscode` from `packages/extension` to the root of the workspace.

## 3. Create the web app
Considering the projects in your workspace are under `packages/`, with the tool of your choice, create a new web project at
`packages/webview`. Notice that, in order for this app to work inside VSCode, it must have relative URLs in its HTML (VSCode will inject a
baseUrl tag). In React, this is normally done by setting the variables `PUBLIC_URL` or `base`.

## 4. Install the dependencies
Below, you can you use the dependency manager of your choice instead of pnpm.

### 1. In `packages/extension`, use a terminal window to type:
```sh
pnpm add @stack-spot/vscode-async-webview-backend
```

### 2. In `packages/webview`, use a terminal window to type:
```sh
pnpm add @stack-spot/vscode-async-webview-client
```

### 3. If your webview uses React, in `packages/webview`, use a terminal window to type:
```sh
pnpm add @stack-spot/vscode-async-webview-react
```

## 5. Bundle the extension
To bundle your extension you must compile both the extension and webview projects into a single app that can be distributed. To do this,
follow the steps below:

  5.1. Make the project "extension" output its compiled files to `./out/packages/extension`.
  5.2. Make the project "webview" output its compiled files to `./out/packages/webview`.
  5.3. Create a simple script to copy the files below ([example](https://github.com/Tiagoperes/vscode-async-webview-sample/blob/main/scripts/bundle.ts)):
      - `./packages/extension/package.json` to `./out/package.json`;
      - `./LICENSE` to `./out/LICENSE`;
      - `./README.md` to `./out/README.md`;
      - `./CHANGELOG.md` to `./out/CHANGELOG.md`.
      - If you use the example provided, be sure to add `ts-node` as a dependency of the root package.json.
  5.4. Change the value of the entry `main` in `packages/extension/package.json` from `extension.js` to `packages/extension.js`.
  5.5. Add scripts to the root package.json. Replace `pnpm` in the json below with the dependency manager of your choice.
  ```json
    "scripts": {
      "compile:extension": "pnpm --filter {project name of extension} {build script}",
      "compile:webview": "pnpm --filter {project name of extension} {build script}",
      "compile": "pnpm compile:extension && pnpm compile:webview",
      "bundle": "ts-node scripts/bundle.ts",
      "package": "cd out && vsce package && cd ../",
      "vscode:prepublish": "pnpm compile && pnpm bundle"
    },
  ```

## 6. Setup launch.json
In order to press F5 in VSCode and run your extension, first, replace the contents of `.vscode/launch.json` with the following:

```json
{
	"version": "0.2.0",
	"configurations": [
		{
			"name": "Run Extension",
			"type": "extensionHost",
			"request": "launch",
			"args": [
				"--extensionDevelopmentPath=${workspaceFolder}/out"
			],
			"outFiles": [
				"${workspaceFolder}/**/*.js",
			],
			"preLaunchTask": "${defaultBuildTask}"
		}
	]
}
```

Now, replace the contents of `.vscode/tasks.json` with:

```json
{
	"version": "2.0.0",
	"tasks": [
		{
			"type": "npm",
			"script": "vscode:prepublish",
			"problemMatcher": "$tsc",
			"isBackground": false,
			"presentation": {
				"reveal": "never"
			},
			"group": {
				"kind": "build",
				"isDefault": true
			}
		},
	]
}
```

## 7. Integrate the webview and extension
To integrate the webview with the extension, we need to:
1. create a ViewState;
2. create a Bridge;
3. instantiate a VSCodeWebview;
4. setup this library in the webview;
5. in the webview, use the shared view state and call methods on the Bridge.

### 7.1 ViewState
This is a simple type file that declares the state shared between the view and the extension. Create `ViewState.ts` under
`packages/extension/src` with the following content:

```ts
export interface ViewState {
  // place here any state that must be read or written from both the extension and webview. "Counter" is the example used for this guide.
  counter?: number,
}
```

### 7.2 Bridge
This is the main file to perform the interaction between the extension and the webview. Every public method declared here is visible by
both applications. Create `Bridge.ts` under `packages/extension/src` with the following content:

```ts
import { VSCodeWebviewAPI } from '@stack-spot/vscode-async-webview-backend'
import { ViewState } from './ViewState'
import { window } from 'vscode'

export class Bridge extends VSCodeWebviewAPI<ViewState> {
  // place here any method that should be called by the webview. Methods here can only return serializable values.
  async showMessage(message: string) {
    const action = await window.showInformationMessage(message, 'reset counter', 'close')
    if (action === 'reset counter') {
      this.state.set('counter', 0)
    }
  }
}
```

The method above will be called by our webview and show a native VSCode notification. This notification will have the button "reset counter"
that, when clicked, will update the webview. This is a good example because it shows interactions starting from both ends.

### 7.3 VSCodeWebview
To start a webview, we must instantiate a `VSCodeWebview`. Edit the file ``packages/extension/src/extension.ts` to do so:

```ts
import * as vscode from 'vscode'
import { VSCodeWebview } from '@stack-spot/vscode-async-webview-backend'
import { Bridge } from './Bridge'

export function activate(context: vscode.ExtensionContext) {
	const webview = new VSCodeWebview({
		type: '{name of the view}',
		path: 'packages/webview',
		title: '{title of the panel}',
		apiFactory: (webview) => new Bridge(webview),
		context,
	})

	let disposable = vscode.commands.registerCommand('{command-name}', () => {
		webview.show()
	})

	context.subscriptions.push(disposable)
}
```

The code above creates the webview and shows it when the command `{command-name}` is run.

**Tip:** if you need a `WebviewViewProvider`, you can use `VSCodeViewProvider` instead of `VSCodeWebview`.

### 7.4 Setup in the webview side
Create the basic setup for this lib in the file `vscode.ts` under `packages/webview/src` with the following content:

```ts
import { VSCodeWeb, VSCodeWebInterface } from '@stack-spot/vscode-async-webview-client'
import { createVSCodeHooks } from '@stack-spot/vscode-async-webview-react' // only if you're using React
// You might want to create a shared package to export the next type if your applications grows too much in complexity
import type { Bridge } from '../../extension/src/Bridge' 

export const vscode: VSCodeWebInterface<Bridge> = new VSCodeWeb<Bridge>({})
const vsHooks = createVSCodeHooks(vscode)  // only if you're using React
export const useAPIState = vsHooks.useState  // only if you're using React
```

If you leave the code like this, it will only work under VSCode, to make it run on a Browser or create unit tests, you must [mock `vscode`
when a VSCode environment is not detected](todo).

### 7.5 Use the shared ViewState and Bridge
In the webview, we interact with the extension by using the ViewState and calling methods on the Bridge.

To call methods on the bridge, in your views, you must import `vscode` from `./vscode` (the file created in the previous step) and call
the method by using `vscode.api.{method}`. Every public method available in `Bridge.ts` will be accessible from `vscode.api`. The only
difference is that, if the method originally returns `Type`, when called from the webview, it will return `Promise<Type>`, i.e. it will be
asynchronous.

To use the ViewState with React, it's as simple as using a hook, just import `useAPIState` from `./vscode`.

To use the ViewState without React, you must use:
- `vscode.getState(name)` to read the state named `name`;
- `vscode.setState(name, value)` to update the state named `name` with `value`;
- `vscode.initializeState(value)` to replace the whole state with another value;
- `vscode.subscribe(name, listener)` to subscribe `listener` to the changes of the state named `name`. `listener` will receive the new
value as parameter. `vscode.subscribe` returns a function to unsubscribe the listener.

Here's an example with React:

```tsx
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { useAPIState, vscode } from './vscode'

function App() {
  const [count = 0, setCount] = useAPIState('counter')

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
          vscode.api.showMessage(`The counter is at: ${count + 1}.`)
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

## 8. Run and distribute.
Press F5 in VSCode and run it! To generate the `.vsix` file just run `pnpm pre-publish && pnpm package` from the root directory (you can
also use npm or yarn). The `.vsix` file will be generated at `./out/{name}-{version}.vsix`.
