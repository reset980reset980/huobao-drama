const TARGETS = {
  flow: {
    label: 'Google Flow',
    url: 'https://labs.google/fx/tools/flow',
    match: ['https://labs.google/*', 'https://labs.google.com/*', 'https://flow.google/*', 'https://flow.google.com/*'],
  },
  suno: {
    label: 'Suno',
    url: 'https://suno.com/create',
    match: ['https://suno.com/*', 'https://app.suno.ai/*'],
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

  openOrReuseGeneratorTab(target, job, sendResponse).catch((error) => {
    sendResponse({ ok: false, error: error?.message || '브라우저 자동화 탭을 준비하지 못했습니다.' })
  })
  return true
})

async function openOrReuseGeneratorTab(target, job, sendResponse) {
  const existing = await findExistingTargetTab(target)
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true })
    await chrome.windows.update(existing.windowId, { focused: true }).catch(() => {})
    await queueJobForTab(existing.id, job)
    sendResponse({ ok: true, tabId: existing.id, label: target.label, reused: true })
    return
  }

  chrome.tabs.create({ url: target.url, active: true }, async (tab) => {
    if (!tab.id) {
      sendResponse({ ok: false, error: '탭을 열 수 없습니다.' })
      return
    }
    try {
      await queueJobForTab(tab.id, job)
      sendResponse({ ok: true, tabId: tab.id, label: target.label, reused: false })
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || '브라우저 자동화 탭을 준비하지 못했습니다.' })
    }
  })
}

async function findExistingTargetTab(target) {
  const tabs = await chrome.tabs.query({})
  return tabs.find((tab) => {
    const url = tab.url || ''
    return target.match.some((pattern) => matchesUrlPattern(url, pattern))
  }) || null
}

function matchesUrlPattern(url, pattern) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(url)
}

async function queueJobForTab(tabId, job) {
  await chrome.storage.session.set({ [`huobao_job_${tabId}`]: job })
  await tryDeliverJob(tabId, job)
}

async function tryDeliverJob(tabId, job) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-service.js'],
  }).catch(() => {})

  chrome.tabs.sendMessage(tabId, { type: 'HUOBAO_FILL_PROMPT', job }, () => {
    if (chrome.runtime.lastError) return
    chrome.storage.session.remove(`huobao_job_${tabId}`)
  })
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return
  const key = `huobao_job_${tabId}`
  const saved = await chrome.storage.session.get(key)
  const job = saved[key]
  if (!job) return

  await tryDeliverJob(tabId, job)
})
