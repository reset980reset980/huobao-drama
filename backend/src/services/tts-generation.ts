/**
 * TTS 음성 합성 서비스
 * MiniMax TTS(hex 오디오 응답)와 OpenAI 호환 /audio/speech를 지원합니다.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuid } from 'uuid'
import { getAudioConfigById } from './ai.js'
import { getTTSAdapter } from './adapters/registry.js'
import { logTaskError, logTaskPayload, logTaskProgress, logTaskStart, logTaskSuccess, redactUrl } from '../utils/task-logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_ROOT = process.env.STORAGE_PATH || path.resolve(__dirname, '../../../data/static')
const MAX_TTS_RETRIES = 2
const VOICEBOX_DEFAULT_PROFILE_ID = process.env.VOICEBOX_PROFILE_ID || ''

interface TTSParams {
  text: string
  voice: string
  model?: string
  speed?: number
  emotion?: string
  configId?: number | null
}

/**
 * TTS 오디오를 생성하고 로컬 파일 경로를 반환합니다.
 */
export async function generateTTS(params: TTSParams): Promise<string> {
  const config = getAudioConfigById(params.configId)
  if (config.provider.toLowerCase() === 'voicebox') {
    return generateVoiceboxTTS(config, params)
  }

  const adapter = getTTSAdapter(config.provider)

  logTaskStart('AudioTask', 'tts-generate', {
    provider: config.provider,
    voice: params.voice,
    model: params.model || config.model,
    textPreview: params.text.slice(0, 50),
    textLength: params.text.length,
  })
  logTaskPayload('AudioTask', 'tts params', {
    config: {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
    },
    params,
  })

  const { url, method, headers, body } = adapter.buildGenerateRequest(config, params)
  logTaskProgress('AudioTask', 'request', {
    provider: config.provider,
    voice: params.voice,
    method,
    url: redactUrl(url),
    model: params.model || config.model,
  })
  logTaskPayload('AudioTask', 'request payload', {
    method,
    url,
    headers,
    body,
  })

  const result = await requestTTSWithRetry({
    provider: config.provider,
    voice: params.voice,
    method,
    url,
    headers,
    body,
  })
  const parsed = adapter.parseResponse(result)

  // hex 응답을 바이너리 오디오로 디코딩합니다.
  const buffer = Buffer.from(parsed.audioHex, 'hex')

  // 로컬 저장소에 기록합니다.
  const audioDir = path.join(STORAGE_ROOT, 'audio')
  fs.mkdirSync(audioDir, { recursive: true })
  const filename = `${uuid()}.${parsed.format || 'mp3'}`
  const filePath = path.join(audioDir, filename)
  fs.writeFileSync(filePath, buffer)

  const relativePath = `static/audio/${filename}`
  logTaskSuccess('AudioTask', 'tts-saved', {
    provider: config.provider,
    voice: params.voice,
    path: relativePath,
    bytes: buffer.length,
    audioMs: parsed.audioLength,
  })
  return relativePath
}

async function generateVoiceboxTTS(config: any, params: TTSParams): Promise<string> {
  const options = parseVoiceboxModel(config.model)
  const baseUrl = (config.baseUrl || 'http://localhost:17493').replace(/\/+$/, '')
  const voiceStyle = String(params.voice || '').trim()
  const stylePrompt = isVoiceboxProfileIdLike(voiceStyle) ? '' : voiceStyle
  const profileId = await resolveVoiceboxProfileId(baseUrl, voiceStyle, options.profileId)
    || (stylePrompt ? await ensureVoiceboxStyleProfile(baseUrl, stylePrompt) : '')
    || await fetchDefaultVoiceboxProfileId(baseUrl)
  if (!profileId) {
    throw new Error('Voicebox 음성 프로필을 준비하지 못했습니다. Voicebox 서버 연결과 preset 프로필 생성 권한을 확인해 주세요.')
  }

  const url = `${baseUrl}/generate/stream`
  const body = {
    profile_id: profileId,
    text: params.text,
    language: options.language,
    engine: options.engine,
    model_size: options.modelSize,
    instruct: params.emotion || stylePrompt || options.instruct,
    normalize: true,
    max_chunk_chars: 800,
    crossfade_ms: 50,
  }

  logTaskStart('AudioTask', 'voicebox-generate', {
    provider: config.provider,
    engine: body.engine,
    modelSize: body.model_size,
    language: body.language,
    profileId: redactProfileId(profileId),
    textPreview: params.text.slice(0, 50),
    textLength: params.text.length,
  })
  logTaskPayload('AudioTask', 'voicebox request payload', {
    method: 'POST',
    url: redactUrl(url),
    body: { ...body, profile_id: redactProfileId(profileId) },
  })

  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err: any) {
    const message = localizeVoiceboxError(0, err.message || 'fetch failed')
    logTaskError('AudioTask', 'voicebox-generate', {
      provider: config.provider,
      error: message,
    })
    throw new Error(message)
  }

  if (!resp.ok) {
    const errorText = await resp.text()
    const message = localizeVoiceboxError(resp.status, errorText)
    logTaskError('AudioTask', 'voicebox-generate', {
      provider: config.provider,
      status: resp.status,
      error: message,
    })
    throw new Error(message)
  }

  const arrayBuffer = await resp.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (!buffer.length) throw new Error('Voicebox가 빈 오디오 응답을 반환했습니다')

  const audioDir = path.join(STORAGE_ROOT, 'audio')
  fs.mkdirSync(audioDir, { recursive: true })
  const filename = `${uuid()}.wav`
  const filePath = path.join(audioDir, filename)
  fs.writeFileSync(filePath, buffer)

  const relativePath = `static/audio/${filename}`
  logTaskSuccess('AudioTask', 'voicebox-saved', {
    provider: config.provider,
    path: relativePath,
    bytes: buffer.length,
    profileId: redactProfileId(profileId),
  })
  return relativePath
}

function parseVoiceboxModel(model?: string) {
  const raw = String(model || '').trim()
  const [engineRaw, modelSizeRaw, profileIdRaw, languageRaw, ...instructParts] = raw.split(':')
  const engine = engineRaw || 'qwen_custom_voice'
  const modelSize = modelSizeRaw || (engine === 'qwen' ? '1.7B' : undefined)
  return {
    engine,
    modelSize,
    profileId: profileIdRaw || VOICEBOX_DEFAULT_PROFILE_ID,
    language: languageRaw || 'ko',
    instruct: instructParts.join(':') || '차분하고 감정적인 한국어 드라마 톤',
  }
}

async function resolveVoiceboxProfileId(baseUrl: string, voice?: string, fallback?: string) {
  const value = String(voice || '').trim()
  if (value && !GEMINI_VOICE_NAMES.has(value) && !isVoiceboxStylePrompt(value)) {
    const profileId = await findVoiceboxProfileId(baseUrl, value)
    if (profileId) return profileId
  }
  const fallbackValue = String(fallback || '').trim()
  if (fallbackValue) {
    const profileId = await findVoiceboxProfileId(baseUrl, fallbackValue)
    return profileId || fallbackValue
  }
  return ''
}

async function fetchDefaultVoiceboxProfileId(baseUrl: string) {
  try {
    const resp = await fetch(`${baseUrl}/profiles`)
    if (!resp.ok) return ''
    const profiles = await resp.json() as Array<{ id?: string }>
    return String(profiles?.[0]?.id || '').trim()
  } catch {
    return ''
  }
}

async function findVoiceboxProfileId(baseUrl: string, value: string) {
  try {
    const resp = await fetch(`${baseUrl}/profiles`)
    if (!resp.ok) return ''
    const profiles = await resp.json() as Array<{ id?: string, name?: string, description?: string }>
    const found = profiles.find(profile => profile.id === value || profile.name === value)
    return String(found?.id || '').trim()
  } catch {
    return ''
  }
}

async function ensureVoiceboxStyleProfile(baseUrl: string, stylePrompt: string) {
  const presetVoiceId = chooseQwenCustomPreset(stylePrompt)
  const profileName = `Huobao ${presetVoiceId} ${hashStylePrompt(stylePrompt)}`
  const existing = await findVoiceboxProfileId(baseUrl, profileName)
  if (existing) return existing

  const body = {
    name: profileName,
    description: `Huobao 자동 생성 음색: ${stylePrompt}`,
    language: 'ko',
    voice_type: 'preset',
    preset_engine: 'qwen_custom_voice',
    preset_voice_id: presetVoiceId,
    default_engine: 'qwen_custom_voice',
    personality: stylePrompt,
  }

  const resp = await fetch(`${baseUrl}/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Voicebox 음색 프로필 자동 생성 실패: ${text}`)
  }
  const profile = await resp.json() as { id?: string }
  return String(profile.id || '').trim()
}

function isVoiceboxStylePrompt(value: string) {
  if (!value) return false
  if (isVoiceboxProfileIdLike(value)) return false
  if (/^[A-Za-z_][A-Za-z0-9_ -]{1,40}$/.test(value) && !/[가-힣,，.]/.test(value)) return false
  return value.length > 12 || /[가-힣]/.test(value)
}

function isVoiceboxProfileIdLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function chooseQwenCustomPreset(stylePrompt: string) {
  const text = stylePrompt.toLowerCase()
  if (/윤서|여|여성|여자|소녀|sohee|nova/.test(text)) return 'Sohee'
  if (/하준|fable|따뜻|밝|맑|청년|젊|서사감/.test(text)) return 'Aiden'
  if (/echo|onyx|낮|중후|무거|노련|차분|진중|서사|아버지|삼촌/.test(text)) return 'Uncle_Fu'
  if (/부드|감정|서정|침착|안정/.test(text)) return 'Sohee'
  if (/거칠|허스키|강한|긴장|분노/.test(text)) return 'Eric'
  return 'Sohee'
}

function hashStylePrompt(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

function localizeVoiceboxError(status: number, text: string) {
  if (/Profile not found/i.test(text)) {
    return 'Voicebox 음성 프로필을 찾지 못했습니다. 캐릭터 음색 값 또는 오디오 설정 모델의 profile_id를 확인하세요.'
  }
  if (/Connection refused|ECONNREFUSED|fetch failed/i.test(text)) {
    return 'Voicebox 로컬 서버에 연결하지 못했습니다. D:\\Project\\voicebox에서 npm run dev:server로 서버를 실행하세요.'
  }
  return `Voicebox TTS API 오류 ${status}: ${text}`
}

function redactProfileId(profileId: string) {
  if (profileId.length <= 8) return profileId ? '***' : ''
  return `${profileId.slice(0, 4)}...${profileId.slice(-4)}`
}

/**
 * 캐릭터 음성 미리듣기 오디오를 생성합니다.
 */
export async function generateVoiceSample(characterName: string, voiceId: string, configId?: number | null): Promise<string> {
  const sampleText = `안녕하세요, 저는 ${characterName}입니다. 만나서 반가워요. 이것은 제 음성 미리듣기입니다.`
  return generateTTS({ text: sampleText, voice: voiceId, configId })
}

async function requestTTSWithRetry(args: {
  provider: string
  voice: string
  method: string
  url: string
  headers: Record<string, string>
  body: any
}) {
  let lastError = ''

  for (let attempt = 0; attempt <= MAX_TTS_RETRIES; attempt++) {
    const resp = await fetch(args.url, {
      method: args.method,
      headers: args.headers,
      body: JSON.stringify(args.body),
    })

    if (resp.ok) return resp.json()

    const errText = await resp.text()
    lastError = errText
    const retryMs = resp.status === 429 ? extractRetryDelayMs(errText) : 0
    const canRetry = retryMs > 0 && attempt < MAX_TTS_RETRIES

    logTaskError('AudioTask', canRetry ? 'tts-rate-limited' : 'tts-generate', {
      provider: args.provider,
      voice: args.voice,
      status: resp.status,
      retryMs,
      attempt: attempt + 1,
      error: errText,
    })

    if (!canRetry) {
      throw new Error(formatTTSError(resp.status, errText))
    }

    await sleep(retryMs)
  }

  throw new Error(`TTS 생성 실패: ${lastError}`)
}

function extractRetryDelayMs(errText: string) {
  try {
    const payload = JSON.parse(errText)
    const retryInfo = payload?.error?.details?.find((item: any) => String(item?.['@type'] || '').includes('RetryInfo'))
    const retryDelay = retryInfo?.retryDelay || payload?.error?.message?.match(/retry in ([\d.]+)s/i)?.[1]
    if (typeof retryDelay === 'string') {
      const seconds = Number(retryDelay.replace(/s$/, ''))
      if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000) + 1000
    }
  } catch {}
  const match = errText.match(/retry in ([\d.]+)s/i)
  if (match) {
    const seconds = Number(match[1])
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000) + 1000
  }
  return 0
}

function formatTTSError(status: number, errText: string) {
  if (status !== 429) return `TTS API error ${status}: ${errText}`

  try {
    const payload = JSON.parse(errText)
    const message = payload?.error?.message || errText
    const retryMs = extractRetryDelayMs(errText)
    const retryText = retryMs ? ` ${Math.ceil(retryMs / 1000)}초 뒤 다시 시도하세요.` : ''
    return `TTS 요청 한도를 초과했습니다.${retryText} 원문: ${message}`
  } catch {
    return `TTS 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요. 원문: ${errText}`
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const GEMINI_VOICE_NAMES = new Set([
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda',
  'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus',
  'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi',
  'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima',
  'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
])
