/* eslint-disable react-hooks/rules-of-hooks */

import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { AsyncStateful, StateTypeOf, VSCodeWebInterface } from '@stack-spot/vscode-async-webview-client'

interface VSCodeHooks<T extends VSCodeWebInterface> {
  useState: <
    State extends (T extends VSCodeWebInterface<infer Bridge> ? StateTypeOf<Bridge> : never),
    Key extends keyof State,
  >(key: Key) => [State[Key], Dispatch<SetStateAction<State[Key]>>],
}

export function createVSCodeHooks<T extends VSCodeWebInterface<AsyncStateful<any>>>(vscode: T): VSCodeHooks<T> {
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
