export function isVSCodeEnvironment() {
  // @ts-ignore
  return typeof acquireVsCodeApi !== 'undefined'
}
