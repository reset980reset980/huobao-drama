const PANEL_ID = 'huobao-helper-panel'

function isVisible(element) {
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
}

function textOf(element) {
  return [
    element.innerText,
    element.textContent,
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.getAttribute('placeholder'),
    element.getAttribute('data-placeholder'),
  ].filter(Boolean).join(' ').trim()
}

function findPromptTarget() {
  const selectors = [
    'textarea',
    '[contenteditable="true"]',
    'input[type="text"]',
    'input:not([type])',
  ]
  const candidates = selectors
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .filter(isVisible)

  return candidates.find((el) => {
    const text = textOf(el).toLowerCase()
    return /prompt|describe|lyrics|style|프롬프트|설명|묘사|가사|스타일/.test(text)
  }) || candidates[0] || null
}

function findClickable(patterns) {
  const selectors = [
    'button',
    '[role="button"]',
    'a',
    'input[type="button"]',
    'input[type="submit"]',
  ]
  const candidates = selectors
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .filter(isVisible)
    .filter((el) => !el.disabled && el.getAttribute('aria-disabled') !== 'true')

  return candidates.find((el) => {
    const text = textOf(el).toLowerCase()
    return patterns.some((pattern) => pattern.test(text))
  }) || null
}

function findGenerateButton() {
  return findClickable([
    /generate|create|submit|send|go|run|make/,
    /생성|만들기|제작|전송|시작/,
  ])
}

function findDownloadButton() {
  return findClickable([
    /download|export|save/,
    /다운로드|내보내기|저장/,
  ])
}

function setPromptValue(target, prompt) {
  target.focus()
  if (target.isContentEditable) {
    target.textContent = prompt
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }))
    return
  }
  target.value = prompt
  target.dispatchEvent(new Event('input', { bubbles: true }))
  target.dispatchEvent(new Event('change', { bubbles: true }))
}

function button(label, onClick, primary = false) {
  const el = document.createElement('button')
  el.type = 'button'
  el.textContent = label
  el.style.cssText = [
    'border:1px solid rgba(255,255,255,.22)',
    `background:${primary ? '#4c7dff' : 'rgba(255,255,255,.12)'}`,
    'color:#fff',
    'border-radius:8px',
    'padding:7px 9px',
    'font:12px system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    'cursor:pointer',
  ].join(';')
  el.addEventListener('click', onClick)
  return el
}

function renderPanel(job, state) {
  document.getElementById(PANEL_ID)?.remove()
  const panel = document.createElement('div')
  panel.id = PANEL_ID
  panel.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:16px',
    'z-index:2147483647',
    'width:340px',
    'max-width:calc(100vw - 32px)',
    'padding:14px',
    'border-radius:12px',
    'box-shadow:0 18px 42px rgba(0,0,0,.32)',
    'font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    'background:#142033',
    'color:#fff',
  ].join(';')

  const title = document.createElement('div')
  title.textContent = '화보 드라마 자동화'
  title.style.cssText = 'font-weight:700;font-size:14px;margin-bottom:6px'
  panel.appendChild(title)

  const body = document.createElement('div')
  body.textContent = state.message
  body.style.cssText = 'color:rgba(255,255,255,.78);margin-bottom:10px'
  panel.appendChild(body)

  const meta = document.createElement('div')
  meta.textContent = job?.title || ''
  meta.style.cssText = 'color:rgba(255,255,255,.52);font-size:11px;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
  panel.appendChild(meta)

  const actions = document.createElement('div')
  actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:7px'

  if (state.generateButton) {
    actions.appendChild(button('생성 버튼 클릭', () => {
      state.generateButton.click()
      renderPanel(job, {
        ...state,
        message: '생성 버튼을 클릭했습니다. 완료되면 다운로드 버튼 후보를 다시 찾아 주세요.',
        generateButton: null,
      })
    }, true))
  }

  actions.appendChild(button('버튼 다시 찾기', () => {
    const generateButton = findGenerateButton()
    const downloadButton = findDownloadButton()
    renderPanel(job, {
      message: [
        generateButton ? '생성 버튼 후보를 찾았습니다.' : '생성 버튼 후보를 찾지 못했습니다.',
        downloadButton ? '다운로드 버튼 후보도 찾았습니다.' : '',
      ].filter(Boolean).join(' '),
      generateButton,
      downloadButton,
    })
  }))

  if (state.downloadButton) {
    actions.appendChild(button('다운로드 클릭', () => {
      state.downloadButton.click()
      renderPanel(job, {
        ...state,
        message: '다운로드 버튼을 클릭했습니다. 내려받은 파일을 화보 드라마 결과 등록 창에 연결하세요.',
        downloadButton: null,
      })
    }))
  }

  actions.appendChild(button('닫기', () => panel.remove()))
  panel.appendChild(actions)
  document.body.appendChild(panel)
}

async function fillWhenReady(job, attempt = 0) {
  const prompt = String(job?.prompt || '')
  const target = findPromptTarget()
  if (target) {
    setPromptValue(target, prompt)
    const generateButton = findGenerateButton()
    renderPanel(job, {
      message: generateButton
        ? '프롬프트를 입력했고 생성 버튼 후보를 찾았습니다. 화면 내용을 확인한 뒤 승인하면 클릭합니다.'
        : '프롬프트를 입력했습니다. 생성 버튼 후보는 찾지 못했습니다.',
      generateButton,
      downloadButton: findDownloadButton(),
    })
    return true
  }
  if (attempt >= 20) {
    renderPanel(job, {
      message: '입력창을 찾지 못했습니다. 서비스 화면이 바뀌었거나 로그인이 필요할 수 있습니다.',
      generateButton: null,
      downloadButton: null,
    })
    return false
  }
  await new Promise((resolve) => window.setTimeout(resolve, 500))
  return fillWhenReady(job, attempt + 1)
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== 'HUOBAO_FILL_PROMPT') return
  fillWhenReady(message.job || {})
})
