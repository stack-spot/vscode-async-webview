export class ManualPromise<T = any> {
  readonly promise
  private _resolve: ((value: T) => void) | undefined
  private _reject: ((reason?: string) => void) | undefined
  resolved = false
  rejected = false

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject
    })
  }

  resolve(value: T) {
    if (this._resolve) this._resolve(value)
    this.resolved = true
  }

  reject(reason?: string) {
    if (this._reject) this._reject(reason)
    this.rejected = true
  }
}
