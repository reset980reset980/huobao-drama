/**
 * 캐릭터 음색 배정 Agent 도구
 */
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db, schema } from '../../db/index.js'
import { eq } from 'drizzle-orm'
import { now } from '../../utils/response.js'
import { logTaskProgress, logTaskSuccess } from '../../utils/task-logger.js'

export function createVoiceTools(episodeId: number, dramaId: number) {
  function getEpisodeAudioProvider() {
    const [episode] = db.select().from(schema.episodes).where(eq(schema.episodes.id, episodeId)).all()
    if (!episode?.audioConfigId) return null
    const [config] = db.select().from(schema.aiServiceConfigs).where(eq(schema.aiServiceConfigs.id, episode.audioConfigId)).all()
    return config?.provider || null
  }

  const getCharacters = createTool({
    id: 'get_characters',
    description: '현재 드라마의 모든 캐릭터와 각 캐릭터의 현재 음색 배정 상태를 가져옵니다.',
    inputSchema: z.object({}),
    execute: async () => {
      const chars = db.select().from(schema.characters)
        .where(eq(schema.characters.dramaId, dramaId)).all()
      const payload = {
        characters: chars.map(c => ({
          id: c.id,
          name: c.name,
          role: c.role,
          personality: c.personality,
          description: c.description,
          current_voice: c.voiceStyle || '미배정',
        })),
      }
      logTaskSuccess('VoiceTool', 'get-characters', { episodeId, dramaId, count: payload.characters.length })
      return payload
    },
  })

  const listVoices = createTool({
    id: 'list_voices',
    description: 'TTS에 사용할 수 있는 모든 음색 옵션을 나열합니다.',
    inputSchema: z.object({}),
    execute: async () => {
      const provider = getEpisodeAudioProvider() || 'minimax'
      const rows = db.select().from(schema.aiVoices).where(eq(schema.aiVoices.provider, provider)).all()
      const voices = rows.length ? rows.map(v => {
        const desc = v.description ? JSON.parse(v.description) : []
        return {
          id: v.voiceId,
          name: v.voiceName,
          gender: inferGender(v.voiceName, desc),
          traits: Array.isArray(desc) && desc.length ? desc.slice(0, 2).join('、') : `${v.language || '다국어'}음색`,
          suitable_for: Array.isArray(desc) && desc.length > 2 ? desc.slice(2).join('、') : `${v.language || '범용'}캐릭터`,
          language: v.language,
          provider,
        }
      }) : [
        { id: 'alloy', name: 'Alloy', gender: '중성', traits: '균형감 있고 자연스러움', suitable_for: '내레이션、범용', language: '다국어', provider },
        { id: 'echo', name: 'Echo', gender: '남성 음성', traits: '낮고 안정적임', suitable_for: '성숙한 남성、내레이션', language: '다국어', provider },
        { id: 'fable', name: 'Fable', gender: '남성 음성', traits: '따뜻하고 표현력이 풍부함', suitable_for: '젊은 남성、스토리텔링', language: '다국어', provider },
        { id: 'onyx', name: 'Onyx', gender: '남성 음성', traits: '깊고 힘 있음', suitable_for: '권위 있는 캐릭터、악역', language: '다국어', provider },
        { id: 'nova', name: 'Nova', gender: '여성 음성', traits: '부드럽고 달콤함', suitable_for: '젊은 여성、여자 주인공', language: '다국어', provider },
        { id: 'shimmer', name: 'Shimmer', gender: '여성 음성', traits: '밝고 활발함', suitable_for: '활발한 여성、소녀', language: '다국어', provider },
      ]

      const payload = {
        provider,
        voices,
        instruction: '캐릭터의 성별, 성격, 나이에 맞는 가장 적절한 음색을 고르고 현재 회차의 오디오 설정에서 사용 가능한 음색 목록 중에서만 선택하세요.',
      }
      logTaskSuccess('VoiceTool', 'list-voices', { episodeId, provider, count: payload.voices.length })
      return payload
    },
  })

  const assignVoice = createTool({
    id: 'assign_voice',
    description: '캐릭터에 음색을 배정합니다.',
    inputSchema: z.object({
      character_id: z.number().describe('Character ID'),
      voice_id: z.string().describe('Voice ID from list_voices'),
      reason: z.string().optional().describe('Why this voice fits'),
    }),
    execute: async ({ character_id, voice_id, reason }) => {
      const provider = getEpisodeAudioProvider() || 'minimax'
      logTaskProgress('VoiceTool', 'assign-begin', { episodeId, dramaId, characterId: character_id, voiceId: voice_id, provider, reason })
      db.update(schema.characters)
        .set({ voiceStyle: voice_id, voiceProvider: provider, voiceSampleUrl: null, updatedAt: now() })
        .where(eq(schema.characters.id, character_id))
        .run()
      logTaskSuccess('VoiceTool', 'assign-complete', { episodeId, characterId: character_id, voiceId: voice_id, provider })
      return { message: `Assigned voice "${voice_id}" to character ${character_id}`, reason }
    },
  })

  return { getCharacters, listVoices, assignVoice }
}

function inferGender(name: string, desc: unknown) {
  const description = Array.isArray(desc) ? desc.join(' ') : ''
  const text = `${name} ${description}`
  if (/[男|青年|大爷|学长|boy|man|male]/i.test(text)) return '남성 음성'
  if (/[女|소녀|御姐|奶奶|girl|woman|female]/i.test(text)) return '여성 음성'
  return '중성'
}
