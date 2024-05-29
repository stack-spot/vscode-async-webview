import { uid } from 'uid'

export const messageType = {
  bridge: 'vscode-webview:bridge',
  getState: 'vscode-webview:get-state',
  setState: 'vscode-webview:set-state',
  ready: 'vscode-webview-ready',
  stream: 'vscode-webview-stream',
  telemetry: 'vscode-webview-telemetry',
} as const

export type MessageType = (typeof messageType)[keyof typeof messageType]

export interface WebviewMessage {
  type: MessageType,
  id: string,
}

export interface WebviewRequestMessage extends WebviewMessage {
  property?: string,
  arguments?: any[],
}

export interface WebviewResponseMessage extends WebviewMessage {
  error?: string,
  result?: any,
}

export interface WebviewStreamMessage extends WebviewMessage {
  content?: string,
  complete?: boolean,
  error?: string,
  /**
   * The order of messages may not be guaranteed. This ensures all of the streaming will be processed in an ordered fashion.
   */
  index: number,
}

export interface WebviewTelemetryMessage extends WebviewMessage {
  eventName: string,
  eventType: 'event' | 'error',
  properties?: object,
}

function isValidMessageType(type: string) {
  return Object.values(messageType as Record<string, string>).includes(type)
}

export function asWebViewMessage(message: any): WebviewMessage | undefined {
  if (
    typeof message === 'object' 
    && isValidMessageType(message.type)
    && message.id 
  ) {
    return message as WebviewMessage
  }
}

/* Bridge messages */

export function buildBridgeRequest(method: string, args: any[]): WebviewRequestMessage {
  return { type: messageType.bridge, property: method, arguments: args, id: uid() }
}

export function buildBridgeResponse(id: string, result: any): WebviewResponseMessage {
  return { type: messageType.bridge, id, result }
}

export function buildBridgeError(id: string, error: string): WebviewResponseMessage {
  return { type: messageType.bridge, id, error }
}

/* GetState messages */

export function buildGetStateRequest(state: string): WebviewRequestMessage {
  return { id: state, type: messageType.getState }
}

export function buildGetStateResponse(state: string, value: any): WebviewResponseMessage {
  return { type: messageType.getState, id: state, result: value }
}

export function buildGetStateError(state: string, error: string): WebviewResponseMessage {
  return { type: messageType.getState, id: state, error }
}

/* SetState messages */

export function buildSetStateRequest(state: string, value: any): WebviewRequestMessage {
  return { id: uid(), type: messageType.setState, property: state, arguments: [value] }
}

export function buildSetStateResponse(id: string): WebviewResponseMessage {
  return { type: messageType.setState, id }
}

export function buildSetStateError(id: string, error: string): WebviewResponseMessage {
  return { type: messageType.setState, id, error }
}

/* Ready message */
export const readyMessage: WebviewMessage = { type: 'vscode-webview-ready', id: 'vscode-webview-ready' }
