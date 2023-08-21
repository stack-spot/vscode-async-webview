import { Webview } from 'vscode'
import { MessageHandler } from '../src/MessageHandler'
import { VSCodeWebviewBridge } from '../src/VSCodeWebviewBridge'

jest.mock('../src/MessageHandler')

class Bridge extends VSCodeWebviewBridge<{ test: string, hello: string }> {}

function getMessageHandlerInstance(): MessageHandler {
  return (MessageHandler as jest.Mock).mock.instances[0]
}

describe('VSCodeWebviewBridge', () => {
  const webview: Webview = {
    asWebviewUri: jest.fn(),
    cspSource: '',
    html: '',
    onDidReceiveMessage: jest.fn(),
    postMessage: jest.fn(),
    options: {},
  }
  const bridge = new Bridge(webview)
  
  it('should build message handler', () => {
    expect(MessageHandler).toBeCalled()
  })

  it('should get state', () => {
    bridge.state.get('test')
    expect(getMessageHandlerInstance().getState).toBeCalledWith('test')
  })

  it('should set state', () => {
    bridge.state.set('hello', 'world')
    expect(getMessageHandlerInstance().setState).toBeCalledWith('hello', 'world')
  })

  it('should dispose', () => {
    bridge.dispose()
    expect(getMessageHandlerInstance().dispose).toBeCalled()
  })
})
