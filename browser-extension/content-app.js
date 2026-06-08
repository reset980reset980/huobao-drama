window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const message = event.data
  if (!message || message.type !== 'HUOBAO_AUTOMATION_REQUEST') return

  const fail = (error) => {
    window.postMessage({
      type: 'HUOBAO_AUTOMATION_RESPONSE',
      requestId: message.requestId,
      response: {
        ok: false,
        error: error || '확장 프로그램 연결이 끊겼습니다. chrome://extensions 에서 확장을 다시 로드한 뒤 이 페이지도 새로고침하세요.',
      },
    }, '*')
  }

  try {
    if (!chrome?.runtime?.id) {
      fail('확장 프로그램 컨텍스트가 만료되었습니다. 확장을 다시 로드한 뒤 이 페이지도 새로고침하세요.')
      return
    }

    chrome.runtime.sendMessage({
      type: 'HUOBAO_OPEN_GENERATOR',
      target: message.target,
      title: message.title,
      prompt: message.prompt,
    }, (response) => {
      const lastError = chrome.runtime.lastError?.message
      if (lastError) {
        fail(lastError.includes('Extension context invalidated')
          ? '확장 프로그램 컨텍스트가 만료되었습니다. 확장을 다시 로드한 뒤 이 페이지도 새로고침하세요.'
          : lastError)
        return
      }

      window.postMessage({
        type: 'HUOBAO_AUTOMATION_RESPONSE',
        requestId: message.requestId,
        response: response || { ok: false, error: '확장 프로그램 응답이 없습니다.' },
      }, '*')
    })
  } catch (error) {
    const messageText = error?.message || String(error || '')
    fail(messageText.includes('Extension context invalidated')
      ? '확장 프로그램 컨텍스트가 만료되었습니다. 확장을 다시 로드한 뒤 이 페이지도 새로고침하세요.'
      : messageText)
  }
})
