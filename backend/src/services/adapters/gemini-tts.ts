import type { TTSProviderAdapter } from './types'
import { joinProviderUrl } from './url'

export interface GeminiTTSParams {
  text: string
  voice: string
  model?: string
  speed?: number
  emotion?: string
}

export class GeminiTTSAdapter implements TTSProviderAdapter {
  readonly provider = 'gemini'

  buildGenerateRequest(config: any, params: GeminiTTSParams): {
    url: string
    method: string
    headers: Record<string, string>
    body: any
  } {
    const model = params.model || config.model || 'gemini-3.1-flash-tts-preview'
    const modelName = model.startsWith('models/') ? model.slice('models/'.length) : model
    const url = joinProviderUrl(config.baseUrl || 'https://generativelanguage.googleapis.com', '/v1beta', `/models/${modelName}:generateContent`)
    const voiceName = normalizeGeminiVoice(params.voice)
    const prompt = buildGeminiPrompt(params)

    return {
      url,
      method: 'POST',
      headers: {
        'x-goog-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: {
        contents: [{
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      },
    }
  }

  parseResponse(result: any) {
    const inlineData = result?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData || part?.inline_data)
    const data = inlineData?.inlineData?.data || inlineData?.inline_data?.data
    if (!data) {
      const message = result?.error?.message || 'No Gemini TTS audio data in response'
      throw new Error(message)
    }

    const pcm = Buffer.from(data, 'base64')
    const wav = addWavHeader(pcm, 24000, 1, 16)

    return {
      audioHex: wav.toString('hex'),
      audioLength: Math.round((pcm.length / 2 / 24000) * 1000),
      sampleRate: 24000,
      bitrate: 384000,
      format: 'wav',
      channel: 1,
    }
  }
}

function buildGeminiPrompt(params: GeminiTTSParams) {
  const text = params.text.trim()
  const style = params.emotion ? `${params.emotion} tone` : 'natural Korean drama performance'
  const speed = params.speed && params.speed !== 1 ? `, speed ${params.speed}` : ''
  return `Read the following Korean line aloud with ${style}${speed}. Preserve the exact wording:\n\n${text}`
}

function normalizeGeminiVoice(voice?: string) {
  const value = String(voice || '').trim()
  if (GEMINI_VOICES.has(value)) return value
  const mapped = OPENAI_TO_GEMINI_VOICE[value.toLowerCase()]
  return mapped || 'Kore'
}

function addWavHeader(pcm: Buffer, sampleRate: number, channels: number, bitsPerSample: number) {
  const header = Buffer.alloc(44)
  const byteRate = sampleRate * channels * bitsPerSample / 8
  const blockAlign = channels * bitsPerSample / 8

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)

  return Buffer.concat([header, pcm])
}

const GEMINI_VOICES = new Set([
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda',
  'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus',
  'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi',
  'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima',
  'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
])

const OPENAI_TO_GEMINI_VOICE: Record<string, string> = {
  alloy: 'Kore',
  echo: 'Charon',
  fable: 'Puck',
  onyx: 'Fenrir',
  nova: 'Aoede',
  shimmer: 'Leda',
}
