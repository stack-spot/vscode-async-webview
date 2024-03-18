/* eslint-disable react-hooks/rules-of-hooks */

import { Dispatch, SetStateAction, useEffect, useState, useRef } from 'react'
import { AsyncStateful, StateTypeOf, VSCodeWebInterface } from '@stack-spot/vscode-async-webview-client'

interface StreamingProps {
  id: string,
  initialValue?: string,
  /**
   * runs when streaming completes with an error.
   */
  onError?: (error: string, partialResult: string) => void,
  /**
   * runs when streaming completes successfuly.
   */
  onSuccess?: (result: string) => void,
  /**
   * runs when streaming completes.
   */
  onFinish?: (result: string) => void,
}

interface VSCodeHooks<T extends VSCodeWebInterface> {
  useState: <
    State extends (T extends VSCodeWebInterface<infer Bridge> ? StateTypeOf<Bridge> : never),
    Key extends keyof State,
  >(key: Key & string) => [State[Key], Dispatch<SetStateAction<State[Key]>>],
  useStream: (props: StreamingProps) => string,
}

export function createVSCodeHooks<T extends VSCodeWebInterface<AsyncStateful>>(vscode: T): VSCodeHooks<T> {
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
    },
    useStream: ({ id, initialValue = '', onError, onSuccess, onFinish }: StreamingProps) => {
      const [, update] = useState(0)
      const value = useRef(initialValue)
      useEffect(() => {
        if (!id) return
        vscode.stream(
          id,
          data => {
            value.current = data
            update(c => c + 1)
          },
          error => {
            if (onError) onError(error, value.current)
            if (onFinish) onFinish(value.current)
          },
          () => {
            if (onSuccess) onSuccess(value.current)
            if (onFinish) onFinish(value.current)
          },
        )
      }, [])
      return value.current
    },
  }
}
