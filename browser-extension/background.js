const TARGETS = {
  flow: {
    label: 'Google Flow',
    url: 'https://labs.google/fx/tools/flow',
  },
  suno: {
    label: 'Suno',
    url: 'https://suno.com/create',
  },
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'HUOBAO_OPEN_GENERATOR') return false

  const target = TARGETS[message.target] || TARGETS.flow
  const job = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    target: message.target || 'flow',
    prompt: String(message.prompt || '').trim(),
    title: String(message.title || ''),
    createdAt: Date.now(),
  }

  if (!job.prompt) {
    sendResponse({ ok: false, error: '프롬프트가 비어 있습니다.' })
    return false
  }

  chrome.tabs.create({ url: target.url, active: true }, async (tab) => {
    if (!tab.id) {
      sendResponse({ ok: false, error: '탭을 열 수 없습니다.' })
      return
    }
    await chrome.storage.session.set({ [`huobao_job_${tab.id}`]: job })
    sendResponse({ ok: true, tabId: tab.id, label: target.label })
  })

  return true
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return
  const key = `huobao_job_${tabId}`
  const saved = await chrome.storage.session.get(key)
  const job = saved[key]
  if (!job) return

  chrome.tabs.sendMessage(tabId, { type: 'HUOBAO_FILL_PROMPT', job }, () => {
    if (chrome.runtime.lastError) {
      return
    }
    chrome.storage.session.remove(key)
  })
})
