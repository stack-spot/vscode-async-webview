export interface AsyncState<T extends object> {
  get: <K extends keyof T>(key: K) => Promise<T[K]>,
  set: <K extends keyof T>(key: K, value: T[K]) => Promise<void>,
}

export interface AsyncStateful<T extends object> {
  readonly state: AsyncState<T>,
}

export type StateTypeOf<T extends AsyncStateful<any>> = T extends AsyncStateful<infer R> ? R : never
