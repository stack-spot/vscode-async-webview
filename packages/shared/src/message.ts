import { uid } from 'uid'

export const messageType = {
  api: 'vscode-webview:api',
  getState: 'vscode-webview:get-state',
  setState: 'vscode-webview:set-state',
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

/* API messages */

export function buildAPIRequest(method: string, args: any[]): WebviewRequestMessage {
  return { type: messageType.api, property: method, arguments: args, id: uid() }
}

export function buildAPIResponse(id: string, result: any): WebviewResponseMessage {
  return { type: messageType.api, id, result }
}

export function buildAPIError(id: string, error: string): WebviewResponseMessage {
  return { type: messageType.api, id, error }
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
