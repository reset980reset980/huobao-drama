(() => {
  if (window.__HUOBAO_HELPER_SERVICE_LOADED__) return
  window.__HUOBAO_HELPER_SERVICE_LOADED__ = true

  const PANEL_ID = 'huobao-helper-panel'

  function collectElements(root = document, output = []) {
    const children = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : []
    for (const element of children) {
      output.push(element)
      if (element.shadowRoot) collectElements(element.shadowRoot, output)
    }
    return output
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0'
  }

  function textOf(element) {
    return [
      element.innerText,
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('placeholder'),
      element.getAttribute('data-placeholder'),
      element.getAttribute('data-testid'),
      element.getAttribute('name'),
    ].filter(Boolean).join(' ').trim()
  }

  function scorePromptTarget(element) {
    const tag = element.tagName.toLowerCase()
    const text = textOf(element).toLowerCase()
    const rect = element.getBoundingClientRect()
    let score = 0

    if (tag === 'textarea') score += 80
    if (element.isContentEditable) score += 70
    if (tag === 'input') score += 35
    if (element.getAttribute('role') === 'textbox') score += 55
    if (/prompt|describe|description|lyrics|style|idea|message|프롬프트|설명|묘사|가사|스타일/.test(text)) score += 45
    if (/flow|video|image|scene|shot|영상|이미지|장면|샷/.test(text)) score += 10
    if (rect.width > 240) score += 12
    if (rect.height > 48) score += 12
    if (element.disabled || element.readOnly || element.getAttribute('aria-disabled') === 'true') score -= 90

    return score
  }

  function findPromptTarget() {
    const candidates = collectElements()
      .filter((el) => {
        const tag = el.tagName.toLowerCase()
        return tag === 'textarea'
          || tag === 'input'
          || el.isContentEditable
          || el.getAttribute('role') === 'textbox'
      })
      .filter(isVisible)
      .map((el) => ({ el, score: scorePromptTarget(el) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)

    return candidates[0]?.el || null
  }

  function findClickable(patterns) {
    const candidates = collectElements()
      .filter((el) => {
        const tag = el.tagName.toLowerCase()
        return tag === 'button'
          || tag === 'a'
          || tag === 'input'
          || el.getAttribute('role') === 'button'
      })
      .filter(isVisible)
      .filter((el) => !el.disabled && el.getAttribute('aria-disabled') !== 'true')

    return candidates.find((el) => {
      const text = textOf(el).toLowerCase()
      return patterns.some((pattern) => pattern.test(text))
    }) || null
  }

  function findGenerateButton() {
    return findClickable([
      /generate|create|submit|send|go|run|make|start/,
      /생성|만들기|제작|전송|시작/,
    ])
  }

  function findDownloadButton() {
    return findClickable([
      /download|export|save/,
      /다운로드|내보내기|저장/,
    ])
  }

  function findFlowNewProjectButton() {
    if (!isFlowPage()) return null
    return findClickable([
      /새\s*프로젝트/,
      /new\s*project/,
      /add_2.*새\s*프로젝트|새\s*프로젝트.*add_2/,
    ])
  }

  function findFlowOptionalGateButton() {
    if (!isFlowPage()) return null
    return findClickable([
      /나중에|건너뛰기|닫기|계속|확인/,
      /not\s*now|skip|continue|close|got\s*it|dismiss/,
    ])
  }

  function isFlowPage() {
    return /(^|\.)labs\.google|(^|\.)flow\.google/.test(location.hostname)
  }

  function setNativeValue(target, prompt) {
    const proto = Object.getPrototypeOf(target)
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
    if (descriptor?.set) descriptor.set.call(target, prompt)
    else target.value = prompt
  }

  function setPromptValue(target, prompt) {
    target.scrollIntoView({ block: 'center', inline: 'nearest' })
    target.focus()

    if (target.isContentEditable) {
      document.execCommand?.('selectAll', false)
      document.execCommand?.('insertText', false, prompt)
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }))
      return
    }

    setNativeValue(target, prompt)
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }))
    target.dispatchEvent(new Event('change', { bubbles: true }))
    target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }))
  }

  function makeDiagnostics() {
    const all = collectElements()
    const visibleTextboxes = all.filter((el) => {
      const tag = el.tagName.toLowerCase()
      return (tag === 'textarea' || tag === 'input' || el.isContentEditable || el.getAttribute('role') === 'textbox') && isVisible(el)
    })
    const visibleButtons = all.filter((el) => {
      const tag = el.tagName.toLowerCase()
      return (tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button') && isVisible(el)
    })

    return {
      url: location.href,
      textboxes: visibleTextboxes.length,
      buttons: visibleButtons.length,
      title: document.title,
    }
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
      'width:360px',
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

    const diagnostics = state.diagnostics || makeDiagnostics()
    const meta = document.createElement('div')
    meta.textContent = `${job?.title || ''} | 입력 후보 ${diagnostics.textboxes}개, 버튼 후보 ${diagnostics.buttons}개`
    meta.title = diagnostics.url
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

    if (state.flowNewProjectButton) {
      actions.appendChild(button('새 프로젝트 클릭', () => {
        state.flowNewProjectButton.click()
        renderPanel(job, {
          ...state,
          message: '새 프로젝트 버튼을 클릭했습니다. 입력 화면이 열리면 프롬프트를 다시 입력합니다.',
          flowNewProjectButton: null,
        })
        window.setTimeout(() => fillWhenReady(job || {}, 0), 1200)
      }, true))
    }

    if (isFlowPage()) {
      actions.appendChild(button('Flow API 프로젝트 생성', () => {
        createFlowProjectFromPanel(job || {})
      }))
    }

    if (state.flowOptionalGateButton) {
      actions.appendChild(button('Flow 팝업 진행', () => {
        state.flowOptionalGateButton.click()
        renderPanel(job, {
          ...state,
          message: 'Flow의 선택 화면 버튼을 클릭했습니다. 다음 화면에서 프롬프트를 다시 입력합니다.',
          flowOptionalGateButton: null,
        })
        window.setTimeout(() => fillWhenReady(job || {}, 0), 1200)
      }))
    }

    actions.appendChild(button('프롬프트 다시 입력', () => {
      fillWhenReady(job || {}, 0)
    }))

    actions.appendChild(button('버튼 다시 찾기', () => {
      const generateButton = findGenerateButton()
      const downloadButton = findDownloadButton()
      const flowNewProjectButton = findFlowNewProjectButton()
      const flowOptionalGateButton = findFlowOptionalGateButton()
      renderPanel(job, {
        message: [
          generateButton ? '생성 버튼 후보를 찾았습니다.' : '생성 버튼 후보를 찾지 못했습니다.',
          flowNewProjectButton ? 'Flow 새 프로젝트 버튼을 찾았습니다.' : '',
          flowOptionalGateButton ? 'Flow 선택 화면 버튼 후보를 찾았습니다.' : '',
          downloadButton ? '다운로드 버튼 후보도 찾았습니다.' : '',
        ].filter(Boolean).join(' '),
        generateButton,
        flowNewProjectButton,
        flowOptionalGateButton,
        downloadButton,
        diagnostics: makeDiagnostics(),
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
        flowNewProjectButton: findFlowNewProjectButton(),
        flowOptionalGateButton: findFlowOptionalGateButton(),
        downloadButton: findDownloadButton(),
        diagnostics: makeDiagnostics(),
      })
      return true
    }

    if (attempt >= 30) {
      renderPanel(job, {
        message: findFlowNewProjectButton()
          ? '입력창은 아직 없지만 Flow 새 프로젝트 버튼을 찾았습니다. 새 프로젝트를 열고 다시 입력할 수 있습니다.'
          : '입력창을 찾지 못했습니다. 로그인, 프로젝트 선택, 정책 확인 화면을 지나 프롬프트 입력 화면을 연 뒤 다시 시도하세요.',
        generateButton: null,
        flowNewProjectButton: findFlowNewProjectButton(),
        flowOptionalGateButton: findFlowOptionalGateButton(),
        downloadButton: null,
        diagnostics: makeDiagnostics(),
      })
      return false
    }

    await new Promise((resolve) => window.setTimeout(resolve, 600))
    return fillWhenReady(job, attempt + 1)
  }

  function createFlowProjectFromPanel(job) {
    renderPanel(job, {
      message: 'Flow API로 새 프로젝트 생성을 시도합니다. 로그인 토큰이 아직 캡처되지 않았다면 실패할 수 있습니다.',
      generateButton: null,
      flowNewProjectButton: null,
      flowOptionalGateButton: null,
      downloadButton: null,
      diagnostics: makeDiagnostics(),
    })

    chrome.runtime.sendMessage({
      type: 'HUOBAO_FLOW_CREATE_PROJECT',
      title: job?.title || 'Huobao Drama Project',
    }, (response) => {
      const lastError = chrome.runtime.lastError?.message
      if (lastError) {
        renderPanel(job, {
          message: `Flow API 프로젝트 생성 실패: ${lastError}`,
          generateButton: null,
          flowNewProjectButton: findFlowNewProjectButton(),
          flowOptionalGateButton: findFlowOptionalGateButton(),
          downloadButton: null,
          diagnostics: makeDiagnostics(),
        })
        return
      }

      if (response?.ok) {
        renderPanel(job, {
          message: response.projectId
            ? `Flow 프로젝트를 생성했습니다: ${response.projectId}. 프로젝트 탭이 열리면 프롬프트를 다시 입력하세요.`
            : `Flow 프로젝트 생성 요청은 성공했지만 projectId를 찾지 못했습니다. 응답: ${response.rawSummary || '요약 없음'}`,
          generateButton: null,
          flowNewProjectButton: null,
          flowOptionalGateButton: null,
          downloadButton: null,
          diagnostics: makeDiagnostics(),
        })
        window.setTimeout(() => fillWhenReady(job || {}, 0), 1800)
        return
      }

      renderPanel(job, {
        message: `Flow API 프로젝트 생성 실패: ${response?.error || '알 수 없는 오류'}${response?.flowKeyPresent === false ? ' (Flow 로그인 토큰 없음)' : ''}`,
        generateButton: null,
        flowNewProjectButton: findFlowNewProjectButton(),
        flowOptionalGateButton: findFlowOptionalGateButton(),
        downloadButton: null,
        diagnostics: makeDiagnostics(),
      })
    })
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'HUOBAO_FILL_PROMPT') return
    fillWhenReady(message.job || {})
  })
})()
