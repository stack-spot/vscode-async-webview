import { WebviewMessage, WebviewRequestMessage, WebviewResponseMessage } from '@stack-spot/vscode-async-webview-shared'
import { uniqueId } from 'lodash'
import { MessageHandler } from '../src/MessageHandler'

describe('MessageHandler', () => {
  let bridgeMethod: jest.Mock
  let getBridgeHandler: jest.Mock
  let sendMessageToClient: jest.Mock
  let onMessageReceived: (message: WebviewMessage) => Promise<void>
  let handler: MessageHandler

  beforeEach(() => {
    bridgeMethod = jest.fn()
    getBridgeHandler = jest.fn(() => bridgeMethod)
    sendMessageToClient = jest.fn()
    handler = new MessageHandler({
      sendMessageToClient,
      listenToMessagesFromClient: listener => onMessageReceived = listener,
      getBridgeHandler,
    })
  })

  it('should handle method call from client', async () => {
    const id = uniqueId()
    const input = [0, 'a', true, false, null, { a: 1 }, [0, 1, 2]]
    const output = { hello: 'world', a: 1, b: true, c: false, d: null, e: { a: 'a' }, f: [0] }
    const message: WebviewRequestMessage = {
      type: 'vscode-webview:bridge',
      id,
      property: 'test',
      arguments: input,
    }
    const expectedMessageToClient: WebviewResponseMessage = {
      type: 'vscode-webview:bridge',
      id,
      result: output,
    }
    bridgeMethod.mockImplementation(() => output)
    await onMessageReceived(message)
    expect(getBridgeHandler).toBeCalledWith('test')
    expect(bridgeMethod).toBeCalledWith(...input)
    expect(sendMessageToClient).toBeCalledWith(expectedMessageToClient)
  })

  it('should handle async method call from client', async () => {
    const id = uniqueId()
    const input = ['hello']
    const output = 'world'
    const message: WebviewRequestMessage = {
      type: 'vscode-webview:bridge',
      id,
      property: 'asyncTest',
      arguments: input,
    }
    const expectedMessageToClient: WebviewResponseMessage = {
      type: 'vscode-webview:bridge',
      id,
      result: output,
    }
    bridgeMethod.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(output), 100)))
    await onMessageReceived(message)
    expect(getBridgeHandler).toBeCalledWith('asyncTest')
    expect(bridgeMethod).toBeCalledWith(...input)
    expect(sendMessageToClient).toBeCalledWith(expectedMessageToClient)
  })

  it('should handle method runtime error', async () => {
    const id = uniqueId()
    const message: WebviewRequestMessage = {
      type: 'vscode-webview:bridge',
      id,
      property: 'test',
      arguments: [],
    }
    const expectedMessageToClient: WebviewResponseMessage = {
      type: 'vscode-webview:bridge',
      id,
      error: 'Error while running method "test". Cause: My error.',
    }
    bridgeMethod.mockImplementation(() => {
      throw new Error('My error')
    })
    await onMessageReceived(message)
    expect(getBridgeHandler).toBeCalled()
    expect(bridgeMethod).toBeCalled()
    expect(sendMessageToClient).toBeCalledWith(expectedMessageToClient)
  })

  it('should handle error when sending bridge response', async () => {
    const id = uniqueId()
    const message: WebviewRequestMessage = {
      type: 'vscode-webview:bridge',
      id,
      property: 'test',
      arguments: [],
    }
    const expectedMessageToClient: WebviewResponseMessage = {
      type: 'vscode-webview:bridge',
      id,
      error: 'Error while sending message to client. Please make sure the return value of the method "test" in the Bridge provided to the VSCodeWebview is serializable.',
    }
    sendMessageToClient.mockImplementation((message) => {
      if (!message.error) throw new Error()
    })
    await onMessageReceived(message)
    expect(getBridgeHandler).toBeCalled()
    expect(bridgeMethod).toBeCalled()
    expect(sendMessageToClient).toBeCalledWith(expectedMessageToClient)
  })
  
  it('should get state from client', async () => {
    const user = { name: 'Kaladin Stormlight', b: true, c: false, d: [0, 1, 2], e: { a: null } }
    let result: any = undefined
    const expectedMessageToClient: WebviewRequestMessage = {
      type: 'vscode-webview:get-state',
      id: 'user',
    }
    handler.getState('user').then(r => result = r)
    expect(sendMessageToClient).toBeCalledWith(expectedMessageToClient)
    expect(result).toBe(undefined)
    const clientGetResponse: WebviewResponseMessage = {
      type: 'vscode-webview:get-state',
      id: 'user',
      result: user,
    }
    await onMessageReceived(clientGetResponse)
    expect(result).toBe(user)
    // @ts-ignore
    expect(handler.getStateCalls.has('user')).toBe(false)
  })

  it('should reuse get state requests done concurrently', async () => {
    const promise1 = handler.getState('test')
    const promise2 = handler.getState('test')
    const promise3 = handler.getState('test')
    expect(promise1 === promise2 && promise2 === promise3).toBe(true)
    // @ts-ignore
    expect(handler.getStateCalls.size).toBe(1)
    const clientGetResponse: WebviewResponseMessage = {
      type: 'vscode-webview:get-state',
      id: 'test',
      result: 'hello world',
    }
    await onMessageReceived(clientGetResponse)
    expect (await promise1).toBe('hello world')
    expect (await promise2).toBe('hello world')
    expect (await promise3).toBe('hello world')
    // @ts-ignore
    expect(handler.getStateCalls.size).toBe(0)
  })

  it('should set state on client', async () => {
    const prices = [5.8, 7.92, 9.78, { value: 87.87, currency: 'BRL' }, 954.78]
    let completed = false
    let messageId = ''
    sendMessageToClient.mockImplementation(({ id }) => messageId = id)
    const expectedMessageToClient: WebviewRequestMessage = {
      type: 'vscode-webview:set-state',
      id: expect.any(String),
      property: 'prices',
      arguments: [prices],
    }
    handler.setState('prices', prices).then(() => completed = true)
    expect(sendMessageToClient).toBeCalledWith(expectedMessageToClient)
    expect(completed).toBe(false)
    const clientSetResponse: WebviewResponseMessage = {
      type: 'vscode-webview:set-state',
      id: messageId,
    }
    await onMessageReceived(clientSetResponse)
    expect(completed).toBe(true)
    // @ts-ignore
    expect(handler.setStateCalls.has(messageId)).toBe(false)
  })

  it('should handle error when sending message to set state', async () => {
    sendMessageToClient.mockImplementation(() => {
      throw new Error('Serialization error')
    })
    try {
      await handler.setState('hello', 'world')
      expect(true).toBe(false) // expect to fail
    } catch (error) {
      expect(error).toMatch(/^Can't set state with name "hello".* Cause: Error: Serialization error\.$/)
    }
  })

  it('should dispose', async () => {
    const get = handler.getState('test')
    const set = handler.setState('test2', 'blah')
    handler.dispose()
    const results = await Promise.allSettled([get, set])
    expect(results[0]).toEqual({ status: 'rejected', reason: 'The webview closed before the state "test" could be retrieved.' })
    expect(results[1]).toEqual({ status: 'rejected', reason: 'The webview closed before the state could be set.' })
    // @ts-ignore
    expect(handler.getStateCalls.size).toBe(0)
    // @ts-ignore
    expect(handler.setStateCalls.size).toBe(0)
  })
})
