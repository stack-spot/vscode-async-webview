export interface AsyncState<T extends Record<string, any> = Record<string, any>> {
  get: <K extends keyof T>(key: K) => Promise<T[K]>,
  set: <K extends keyof T>(key: K, value: T[K]) => Promise<void>,
}

export interface AsyncStateful<T extends Record<string, any> = Record<string, any>> {
  readonly state: AsyncState<T>,
}

export type StateTypeOf<T extends AsyncStateful> = T extends AsyncStateful<infer R> ? R : never
