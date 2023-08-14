# Introduction
The client library must be imported by the webview. It connects the web application with the bridge, which resides in the extension, and
the vscode state, which resides in the client side. The state manipulated by this library, under the hood, uses the functions 
[`getState` and `setState` from vscode](https://code.visualstudio.com/api/extension-guides/webview#getstate-and-setstate).

# VSCodeWeb
This class is responsible for acquiring the vscode API and connecting the webview to the bridge. This should never be instantiated more
than once.

To create an instance of VSCodeWeb, you must call `const vscode = new VSCodeWeb<BridgeType>(initialState)`. The bridge type must be informed
as a generic and the initial state as a parameter. If the initial state should be empty, `{}` should be used.

### To access the API provided by the bridge:
```ts
vscode.bridge.method(arguments)
```

### To access a state:
- `vscode.getState(name)` to read the state named `name`;
- `vscode.setState(name, value)` to update the state named `name` with `value`;
- `vscode.initializeState(value)` to replace the whole state with another value;
- `vscode.subscribe(name, listener)` to subscribe `listener` to the changes of the state named `name`. `listener` will receive the new
value as parameter. `vscode.subscribe` returns a function to unsubscribe the listener.

### To get a reference to the original vscode object
```ts
const originalVSCodeObject = VSCodeWeb.vscode
```

As long as `VSCodeWeb` has already been instantiated, `VSCodeWeb.vscode` will contain the object returned by `acquireVsCodeApi()`.

# Browser compatibility and unit testing
It's much easier to build a web application while running it on a browser with hot reloading enabled on the project. Furthermore, it can
be hard to write unit tests the application if we depend on VSCode to do so.

For this reason, this library provides the classes `VSCodeWebMock` and `BridgeMock`. Both `VSCodeWeb` and `VSCodeWebMock` implements the
interface `VSCodeWebInterface`.

The `BridgeMock` is just a mocked version of the API provided by the actual bridge. Check the example below:

`bridge-mock.ts`
```ts
import { BridgeMock } from '@stack-spot/vscode-async-webview-client'
import type { Bridge } from '../../extension/src/Bridge'

export const bridgeMock: BridgeMock<Bridge> = {
  showMessage: async (message) => console.log(message),
}
```

The `VSCodeWebMock` is just a mocked version of `VSCodeWeb`. We must use it whenever we don't detect the VSCode environment:

`vscode.ts`
```ts
import { VSCodeWeb, VSCodeWebMock, isVSCodeEnvironment, VSCodeWebInterface } from '@stack-spot/vscode-async-webview-client'
import type { Bridge } from '../../extension/src/Bridge'
import { bridgeMock } from './bridge-mock'

export const vscode: VSCodeWebInterface<BridgeAPI> = isVSCodeEnvironment()
  ? new VSCodeWeb<BridgeAPI>({})
  : new VSCodeWebMock<BridgeAPI>({}, bridgeMock)
```

Now you can use this project in the browser and can easily test it with Jest!

# Utilities

## Functions
- `isVSCodeEnvironment()`: true if running inside a VSCode extension, false otherwise.

## Colors
VSCode has lots of theme colors, it can very easy to make mistakes when referring them with strings. This utility provides an object with
the names of every theme variable available.

```ts
import { vsColors } from '@stack-spot/vscode-async-webview-client'

const scrollBarBgKey = vsColors.scrollbarSliderBackground
```