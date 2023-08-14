/**
 * Checks if environment is VSCode.
 * @returns true if running inside a VSCode extension. False otherwise.
 */
export function isVSCodeEnvironment() {
  // @ts-ignore
  return typeof acquireVsCodeApi !== 'undefined'
}
