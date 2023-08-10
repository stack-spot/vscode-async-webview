/* eslint-disable react-hooks/rules-of-hooks */

import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { StateTypeOf, VSCodeWebInterface } from 'vscode-webview-client'

interface VSCodeHooks<T extends VSCodeWebInterface> {
  useState: <
    State extends (T extends VSCodeWebInterface<infer API> ? StateTypeOf<API> : never),
    Key extends keyof State,
  >(key: Key) => [State[Key], Dispatch<SetStateAction<State[Key]>>],
}

export function createVSCodeHooks<T extends VSCodeWebInterface>(vscode: T): VSCodeHooks<T> {
  return {
    useState: (key) => {
      const [value, setValue] = useState(vscode.getState(key))
      useEffect(() => vscode.subscribe(key, setValue), [key])
      return [
        value,
        (action) => {
          let newValue = typeof action === 'function' ? (action as (prev: any) => any)(vscode.getState(key)) : action
          vscode.setState(key, newValue)
        },
      ]
    }
  }
}
