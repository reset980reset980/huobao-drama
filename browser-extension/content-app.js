window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const message = event.data
  if (!message || message.type !== 'HUOBAO_AUTOMATION_REQUEST') return

  chrome.runtime.sendMessage({
    type: 'HUOBAO_OPEN_GENERATOR',
    target: message.target,
    title: message.title,
    prompt: message.prompt,
  }, (response) => {
    window.postMessage({
      type: 'HUOBAO_AUTOMATION_RESPONSE',
      requestId: message.requestId,
      response: response || { ok: false, error: chrome.runtime.lastError?.message || '확장 프로그램 응답이 없습니다.' },
    }, '*')
  })
})
