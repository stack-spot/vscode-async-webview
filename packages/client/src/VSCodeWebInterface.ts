import { AsyncStateful, StateTypeOf } from '@stack-spot/vscode-async-webview-shared'

type Unpromisify<T> = T extends Promise<infer R> ? Unpromisify<R> : T

// extract only the functions of the Bridge and make every return type a Promise if not already
export type LinkedBridge<T> = Omit<{
  [K in keyof T as T[K] extends (...args: any) => any ? K : never]:
  T[K] extends (...args: infer Args) => infer Return
  ? (...args: Args) => Promise<Unpromisify<Return>>
  : never
}, 'dispose' | 'stream'>

export interface VSCodeWebInterface<
  Bridge extends AsyncStateful = AsyncStateful,
  State = StateTypeOf<Bridge>,
> {
  /**
   * The bridge, allows access to methods declared in the extension.
   */
  readonly bridge: LinkedBridge<Bridge>,
  /**
   * Gets the value for the state with the name passed as parameter.
   * @param key the name of the state to get the value from.
   * @returns the state's value or undefined if the state doesn't exist.
   */
  getState<Key extends keyof State>(key: Key): State[Key],
  /**
   * Sets the value of the state with the name passed as parameter.
   * @param key the name of the state to set.
   * @param value the new value for the state.
   */
  setState<Key extends keyof State>(key: Key, value: State[Key]): void,
  /**
   * Replaces the current state with another.
   * 
   * This will replace every key in the state. i.e. the current state will be lost.
   * @param state the new value for the state.
   */
  initializeState(state: State): void,
  /**
   * Subscribes to changes in the state with the name passed as parameter.
   * 
   * The listener will receive the new value of the state as parameter.
   * @param key the name of the state to observe.
   * @param listener the function to run whenever the state changes.
   * @returns a function to unsubscribe the listener.
   */
  subscribe<Key extends keyof State>(key: Key, listener: (value: State[Key]) => void): () => void,
  /**
   * Streams a string from the extension to the client web app.
   * 
   * @param id the id of the streaming object.
   * @param onData a function that is called whenever there's new data in the streaming channel.
   * @param onError a function to be called if an error happens while streaming.
   * @param onComplete a function to be called if the streaming completes successfully.
   */
  stream(id: string, onData: (data: string) => void, onError?: (error: string) => void, onComplete?: () => void): void,
  /**
   * Client communicate that DOM are mounted
   */
  setViewReady?: () => void,
  /**
   * Logs a message to the console.
   * 
   * @param {string} text - The message to log.
   */
  log(text: string): void,
  /**
   * Logs an error message to the console.
   * 
   * @param {string} text - The error message to log.
   */
  error(text: string): void,
}
