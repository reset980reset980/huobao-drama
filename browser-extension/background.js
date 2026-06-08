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

let flowKey = null
let tokenCapturedAt = 0

chrome.storage.local.get(['flowKey', 'tokenCapturedAt'], (data) => {
  flowKey = data.flowKey || null
  tokenCapturedAt = data.tokenCapturedAt || 0
})

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!details?.requestHeaders?.length) return
    const authHeader = details.requestHeaders.find((header) => header.name?.toLowerCase() === 'authorization')
    const value = authHeader?.value || ''
    if (!value.startsWith('Bearer ya29.')) return

    flowKey = value.replace(/^Bearer\s+/i, '').trim()
    tokenCapturedAt = Date.now()
    chrome.storage.local.set({ flowKey, tokenCapturedAt })
    notifyLocalFlowBridge().catch(() => {})
  },
  { urls: ['https://aisandbox-pa.googleapis.com/*', 'https://labs.google/*'] },
  ['requestHeaders', 'extraHeaders'],
)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false

  if (message.type === 'HUOBAO_FLOW_STATUS') {
    sendResponse(getFlowStatus())
    return false
  }

  if (message.type === 'HUOBAO_FLOW_CREATE_PROJECT') {
    createFlowProject(message.title || 'Huobao Drama Project')
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ ok: false, error: error?.message || 'Flow 프로젝트 생성 실패' }))
    return true
  }

  if (message.type !== 'HUOBAO_OPEN_GENERATOR') return false

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

function getFlowStatus() {
  return {
    ok: true,
    flowKeyPresent: !!flowKey,
    tokenAgeMs: tokenCapturedAt ? Date.now() - tokenCapturedAt : null,
  }
}

async function notifyLocalFlowBridge() {
  await fetch('http://127.0.0.1:5679/api/v1/browser-bridge/flow-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token_present: !!flowKey,
      token_age_ms: tokenCapturedAt ? Date.now() - tokenCapturedAt : null,
      captured_at: tokenCapturedAt,
    }),
  })
}

async function createFlowProject(title) {
  const body = { json: { projectTitle: String(title || 'Huobao Drama Project').slice(0, 120), toolName: 'PINHOLE' } }
  const headers = {
    'content-type': 'application/json',
    'accept': '*/*',
  }
  if (flowKey) headers.authorization = `Bearer ${flowKey}`

  const response = await fetch('https://labs.google/fx/api/trpc/project.createProject', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let data = text
  try {
    data = JSON.parse(text)
  } catch {}

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      flowKeyPresent: !!flowKey,
      error: summarizeFlowResponse(data) || `Flow 프로젝트 생성 API 오류 ${response.status}`,
      raw: data,
    }
  }

  const projectId = extractProjectId(data)
  if (projectId) {
    await chrome.tabs.create({ url: `https://labs.google/fx/tools/flow/project/${projectId}`, active: true }).catch(() => {})
  }

  return {
    ok: true,
    status: response.status,
    flowKeyPresent: !!flowKey,
    projectId,
    rawSummary: summarizeFlowResponse(data),
  }
}

function extractProjectId(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    const match = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    return match?.[0] || ''
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractProjectId(item)
      if (found) return found
    }
    return ''
  }
  if (typeof value === 'object') {
    if (typeof value.projectId === 'string') return value.projectId
    if (typeof value.project_id === 'string') return value.project_id
    for (const nested of Object.values(value)) {
      const found = extractProjectId(nested)
      if (found) return found
    }
  }
  return ''
}

function summarizeFlowResponse(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text ? text.slice(0, 320) : ''
}

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
