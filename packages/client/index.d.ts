declare namespace VScodeAsyncWebviewClient {
  interface Window {
    original?: {
      log: (text: string) => void,
      error: (text: string) => void,
    },
  }
}
