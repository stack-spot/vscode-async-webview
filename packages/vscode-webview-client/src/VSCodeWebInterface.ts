import { AsyncStateful, StateTypeOf } from 'vscode-webview-shared'

type Unpromisify<T> = T extends Promise<infer R> ? Unpromisify<R> : T

// extract only the functions of the API and make every return type a Promise if not already
export type LinkedAPI<T> = Omit<{
  [K in keyof T as T[K] extends (...args: any) => any ? K : never]:
    T[K] extends (...args: infer Args) => infer Return
      ? (...args: Args) => Promise<Unpromisify<Return>>
      : never
}, 'dispose'>

export interface VSCodeWebInterface<
  API extends AsyncStateful<any> = AsyncStateful<any>,
  State = StateTypeOf<API>,
> {
  readonly api: LinkedAPI<API>,
  getState<Key extends keyof State>(key: Key): State[Key],
  setState<Key extends keyof State>(key: Key, value: State[Key]): void,
  initializeState(state: State): void,
  subscribe<Key extends keyof State>(key: Key, listener: (value: State[Key]) => void): () => void,
}
