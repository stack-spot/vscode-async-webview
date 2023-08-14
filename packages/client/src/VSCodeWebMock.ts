import { AsyncStateful, StateTypeOf } from '@stack-spot/vscode-async-webview-shared'
import { LinkedBridge, VSCodeWebInterface } from './VSCodeWebInterface'

export type BridgeMock<T extends AsyncStateful<any>> = Partial<LinkedBridge<T>>

export class VSCodeWebMock<Bridge extends AsyncStateful<any> = AsyncStateful<Record<string, never>>> implements VSCodeWebInterface<Bridge> {
  readonly bridge: LinkedBridge<Bridge>
  private state: StateTypeOf<Bridge>
  private readonly mockedBridge: BridgeMock<Bridge>
  private listeners: Partial<{ [K in keyof StateTypeOf<Bridge>]: ((value: StateTypeOf<Bridge>[K]) => void)[] }> = {}

  constructor(initialState: StateTypeOf<Bridge>, bridge: BridgeMock<Bridge>) {
    this.state = initialState
    this.mockedBridge = bridge
    this.bridge = this.createBridgeProxy()
  }

  private createBridgeProxy() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    return new Proxy({}, {
      get(_, property) {
        const methodName = String(property)
        return (...args: any[]) => {
          JSON.stringify(args) // simulates the serialization step
          const fn = self.mockedBridge[methodName as keyof typeof self.mockedBridge]
          if (typeof fn === 'function') return fn.apply(self.mockedBridge, args)
          // eslint-disable-next-line no-console
          console.log('(MOCK) called bridge method:', `${methodName}(${args.map((v) => JSON.stringify(v)).join(', ')})`)
        }
      },
    }) as LinkedBridge<Bridge>
  }

  private runListeners<Key extends keyof StateTypeOf<Bridge>>(stateKey: Key, value: StateTypeOf<Bridge>[Key]) {
    this.listeners[stateKey]?.forEach(l => l(value))
  }

  getState<Key extends keyof StateTypeOf<Bridge>>(key: Key): StateTypeOf<Bridge>[Key] {
    JSON.stringify(this.state[key])  // simulates serialization
    return this.state[key]
  }

  setState<Key extends keyof StateTypeOf<Bridge>>(key: Key, value: StateTypeOf<Bridge>[Key]): void {
    this.state[key] = value
    this.runListeners(key, value)
  }

  initializeState(state: StateTypeOf<Bridge>): void {
    this.state = { ...state }
    Object.keys(this.listeners).forEach(key => this.runListeners(key, state[key]))
  }

  subscribe<Key extends keyof StateTypeOf<Bridge>>(key: Key, listener: (value: StateTypeOf<Bridge>[Key]) => void): () => void {
    if (!this.listeners[key]) this.listeners[key] = []
    this.listeners[key]?.push(listener)
    return () => {
      const index = this.listeners[key]?.indexOf(listener)
      if (index !== undefined && index >= 0) this.listeners[key]?.splice(index, 1)
    }
  }
}
