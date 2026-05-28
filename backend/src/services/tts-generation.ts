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
