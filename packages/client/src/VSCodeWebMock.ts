import { AsyncStateful, StateTypeOf } from '@stack-spot/vscode-async-webview-shared'
import { LinkedAPI, VSCodeWebInterface } from './VSCodeWebInterface'

export type APIMock<T extends AsyncStateful<any>> = Partial<LinkedAPI<T>>

export class VSCodeWebMock <API extends AsyncStateful<any> = AsyncStateful<Record<string, never>>> implements VSCodeWebInterface<API> {
  readonly api: LinkedAPI<API>
  private state: StateTypeOf<API>
  private readonly mockedApi: APIMock<API>
  private listeners: Partial<{ [K in keyof StateTypeOf<API>]: ((value: StateTypeOf<API>[K]) => void)[] }> = {}

  constructor(initialState: StateTypeOf<API>, api: APIMock<API>) {
    this.state = initialState
    this.mockedApi = api
    this.api = this.createAPIProxy()
  }

  private createAPIProxy() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    return new Proxy({}, {
      get(_, property) {
        const methodName = String(property)
        return (...args: any[]) => {
          JSON.stringify(args) // simulates the serialization step
          const fn = self.mockedApi[methodName as keyof typeof self.mockedApi]
          if (typeof fn === 'function') return fn.apply(self.mockedApi, args)
          // eslint-disable-next-line no-console
          console.log('(MOCK) called api method:', `${methodName}(${args.map((v) => JSON.stringify(v)).join(', ')})`)
        }
      },
    }) as LinkedAPI<API>
  }

  private runListeners<Key extends keyof StateTypeOf<API>>(stateKey: Key, value: StateTypeOf<API>[Key]) {
    this.listeners[stateKey]?.forEach(l => l(value))
  }

  getState<Key extends keyof StateTypeOf<API>>(key: Key): StateTypeOf<API>[Key] {
    JSON.stringify(this.state[key])  // simulates serialization
    return this.state[key]
  }

  setState<Key extends keyof StateTypeOf<API>>(key: Key, value: StateTypeOf<API>[Key]): void {
    this.state[key] = value
    this.runListeners(key, value)
  }

  initializeState(state: StateTypeOf<API>): void {
    this.state = { ...state }
    Object.keys(this.listeners).forEach(key => this.runListeners(key, state[key]))
  }

  subscribe<Key extends keyof StateTypeOf<API>>(key: Key, listener: (value: StateTypeOf<API>[Key]) => void): () => void {
    if (!this.listeners[key]) this.listeners[key] = []
    this.listeners[key]?.push(listener)
    return () => {
      const index = this.listeners[key]?.indexOf(listener)
      if (index !== undefined && index >= 0) this.listeners[key]?.splice(index, 1)
    }
  }
}
