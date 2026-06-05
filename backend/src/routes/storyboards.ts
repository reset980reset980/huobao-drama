import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, created, now, badRequest } from '../utils/response.js'
import { toSnakeCase } from '../utils/transform.js'
import { concatenateWavFiles, generateTTS } from '../services/tts-generation.js'
import { logTaskError, logTaskPayload, logTaskProgress, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'

const app = new Hono()

const IGNORE_TTS_SPEAKERS = /^(환경음|환경소리|효과음|sfx|sound ?effect|bgm|배경음|배경음악|ambient)$/i
const IGNORE_TTS_TEXT = /^(없음|대사 없음|내레이션 없음|더빙 필요 없음|대사 필요 없음|none|null|n\/a|na|환경음|환경소리|효과음|순수 효과음|순수 환경음|배경음|배경음악|bgm|sfx|ambient)$/i

function parseDialogueForTTS(dialogue?: string | null) {
  const raw = dialogue?.trim() || ''
  if (!raw) return { speaker: '', pureText: '', ignorable: true }
  const speakerMatch = raw.match(/^(.+?)[:：]/)
  const speaker = speakerMatch ? speakerMatch[1].replace(/[（(].+?[)）]/g, '').trim() : ''
  const pureText = raw.replace(/^.+?[:：]\s*/, '').replace(/[（(].+?[)）]/g, '').trim()
  const ignorable = (!!speaker && IGNORE_TTS_SPEAKERS.test(speaker)) || !pureText || IGNORE_TTS_TEXT.test(pureText)
  return { speaker, pureText, ignorable }
}

function parseDialogueSegments(dialogue?: string | null) {
  const raw = dialogue?.trim() || ''
  if (!raw) return []

  const segments: Array<{ speaker: string, text: string }> = []
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const speakerMatch = trimmed.match(/^(.+?)[:：]\s*(.*)$/)
    const speaker = speakerMatch ? cleanSpeaker(speakerMatch[1]) : ''
    const text = cleanDialogueText(speakerMatch ? speakerMatch[2] : trimmed)
    if (!text) continue
    if (speaker && IGNORE_TTS_SPEAKERS.test(speaker)) continue
    if (IGNORE_TTS_TEXT.test(text)) continue
    segments.push({ speaker, text })
  }

  if (segments.length) return segments
  const parsed = parseDialogueForTTS(raw)
  return parsed.ignorable ? [] : [{ speaker: parsed.speaker, text: parsed.pureText }]
}

function cleanSpeaker(value: string) {
  return value.replace(/[（(].+?[)）]/g, '').trim()
}

function cleanDialogueText(value: string) {
  return value
    .replace(/[（(].+?[)）]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveVoiceForSpeaker(speaker: string, characters: Array<{ name: string, voiceStyle: string | null }>) {
  if (!speaker || /^(내레이션|화면 밖 목소리|narrator)$/i.test(speaker)) return 'alloy'
  const found = characters.find((char) => char.name === speaker)
  return found?.voiceStyle || 'alloy'
}

function syncStoryboardCharacters(storyboardId: number, characterIds: number[]) {
  db.delete(schema.storyboardCharacters)
    .where(eq(schema.storyboardCharacters.storyboardId, storyboardId))
    .run()

  const uniqueIds = [...new Set((characterIds || []).filter(Boolean))]
  if (!uniqueIds.length) return

  for (const characterId of uniqueIds) {
    db.insert(schema.storyboardCharacters).values({
      storyboardId,
      characterId,
    }).run()
  }
}

function getStoryboardCharacterIds(storyboardId: number) {
  return db.select().from(schema.storyboardCharacters)
    .where(eq(schema.storyboardCharacters.storyboardId, storyboardId)).all()
    .map(link => link.characterId)
}

function validateStoryboardBindings(episodeId: number, sceneId: number | null | undefined, characterIds: number[] | undefined) {
  const episodeSceneIds = new Set(
    db.select().from(schema.episodeScenes)
      .where(eq(schema.episodeScenes.episodeId, episodeId)).all()
      .map(link => link.sceneId),
  )
  const episodeCharacterIds = new Set(
    db.select().from(schema.episodeCharacters)
      .where(eq(schema.episodeCharacters.episodeId, episodeId)).all()
      .map(link => link.characterId),
  )

  if (sceneId != null && !episodeSceneIds.has(sceneId)) {
    throw new Error('scene_id는 현재 회차에 연결된 장면이어야 합니다')
  }

  const invalidCharacterIds = (characterIds || []).filter(id => !episodeCharacterIds.has(id))
  if (invalidCharacterIds.length) {
    throw new Error('character_ids는 현재 회차에 연결된 캐릭터여야 합니다')
  }
}

// POST /storyboards
app.post('/', async (c) => {
  const body = await c.req.json()
  const ts = now()
  logTaskStart('StoryboardAPI', 'create', {
    episodeId: body.episode_id,
    shotNumber: body.storyboard_number || 1,
    sceneId: body.scene_id,
    characterIds: body.character_ids,
  })
  logTaskPayload('StoryboardAPI', 'create body', body)
  validateStoryboardBindings(body.episode_id, body.scene_id, body.character_ids)
  const res = db.insert(schema.storyboards).values({
    episodeId: body.episode_id,
    storyboardNumber: body.storyboard_number || 1,
    title: body.title,
    description: body.description,
    action: body.action,
    dialogue: body.dialogue,
    sceneId: body.scene_id,
    duration: body.duration || 10,
    createdAt: ts,
    updatedAt: ts,
  }).run()
  syncStoryboardCharacters(Number(res.lastInsertRowid), body.character_ids || [])
  const [result] = db.select().from(schema.storyboards)
    .where(eq(schema.storyboards.id, Number(res.lastInsertRowid))).all()
  logTaskSuccess('StoryboardAPI', 'create', {
    storyboardId: result.id,
    episodeId: result.episodeId,
    shotNumber: result.storyboardNumber,
  })
  return created(c, {
    ...toSnakeCase(result),
    character_ids: getStoryboardCharacterIds(result.id),
  })
})

// PUT /storyboards/:id
app.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const [storyboard] = db.select().from(schema.storyboards).where(eq(schema.storyboards.id, id)).all()
  if (!storyboard) return badRequest(c, '샷을 찾을 수 없습니다')
  logTaskStart('StoryboardAPI', 'update', {
    storyboardId: id,
    episodeId: storyboard.episodeId,
    fields: Object.keys(body),
  })
  logTaskPayload('StoryboardAPI', 'update body', body)

  const fieldMap: Record<string, string> = {
    title: 'title', description: 'description', shot_type: 'shotType',
    angle: 'angle', movement: 'movement', action: 'action',
    dialogue: 'dialogue', duration: 'duration', video_prompt: 'videoPrompt',
    image_prompt: 'imagePrompt', scene_id: 'sceneId', location: 'location',
    time: 'time', atmosphere: 'atmosphere', result: 'result',
    bgm_prompt: 'bgmPrompt', sound_effect: 'soundEffect',
    composed_image: 'composedImage', first_frame_image: 'firstFrameImage',
    last_frame_image: 'lastFrameImage', video_url: 'videoUrl',
    tts_audio_url: 'ttsAudioUrl', subtitle_url: 'subtitleUrl',
    bgm_audio_url: 'bgmAudioUrl',
    composed_video_url: 'composedVideoUrl',
  }

  const updates: Record<string, any> = { updatedAt: now() }
  for (const [snakeKey, camelKey] of Object.entries(fieldMap)) {
    if (snakeKey in body) updates[camelKey] = body[snakeKey]
  }

  if ('dialogue' in body) {
    updates.ttsAudioUrl = null
    updates.subtitleUrl = null
  }

  validateStoryboardBindings(
    storyboard.episodeId,
    'scene_id' in body ? body.scene_id : storyboard.sceneId,
    'character_ids' in body ? body.character_ids : getStoryboardCharacterIds(id),
  )

  db.update(schema.storyboards).set(updates).where(eq(schema.storyboards.id, id)).run()
  if ('character_ids' in body) syncStoryboardCharacters(id, body.character_ids || [])
  logTaskSuccess('StoryboardAPI', 'update', {
    storyboardId: id,
    updatedFields: Object.keys(updates),
    characterIds: body.character_ids,
  })
  return success(c)
})

// POST /storyboards/:id/generate-tts
app.post('/:id/generate-tts', async (c) => {
  const id = Number(c.req.param('id'))
  const [sb] = db.select().from(schema.storyboards).where(eq(schema.storyboards.id, id)).all()
  if (!sb) return badRequest(c, '샷을 찾을 수 없습니다')
  const segments = parseDialogueSegments(sb.dialogue)
  if (!segments.length) return badRequest(c, '이 샷에는 생성할 대사나 내레이션이 없습니다')
  logTaskStart('StoryboardAPI', 'generate-tts', {
    storyboardId: id,
    episodeId: sb.episodeId,
    dialoguePreview: (sb.dialogue || '').slice(0, 40),
  })
  logTaskPayload('StoryboardAPI', 'generate-tts input', {
    storyboardId: id,
    episodeId: sb.episodeId,
    dialogue: sb.dialogue,
  })

  const [ep] = db.select().from(schema.episodes).where(eq(schema.episodes.id, sb.episodeId)).all()
  const characters = ep
    ? db.select().from(schema.characters).where(eq(schema.characters.dramaId, ep.dramaId)).all()
    : []
  const segmentVoices = segments.map(segment => ({
    ...segment,
    voiceId: resolveVoiceForSpeaker(segment.speaker, characters),
  }))

  try {
    const audioPaths = []
    for (const segment of segmentVoices) {
      audioPaths.push(await generateTTS({ text: segment.text, voice: segment.voiceId, configId: ep?.audioConfigId || null }))
    }
    const audioPath = concatenateWavFiles(audioPaths)
    db.update(schema.storyboards)
      .set({ ttsAudioUrl: audioPath, updatedAt: now() })
      .where(eq(schema.storyboards.id, id))
      .run()

    logTaskSuccess('StoryboardAPI', 'generate-tts', {
      storyboardId: id,
      voiceId: segmentVoices.map(segment => `${segment.speaker || '내레이션'}=${segment.voiceId}`).join(', '),
      path: audioPath,
      textLength: segmentVoices.reduce((sum, segment) => sum + segment.text.length, 0),
    })
    return success(c, { tts_audio_url: audioPath, segments: segmentVoices.map(segment => ({ speaker: segment.speaker, voice_id: segment.voiceId, text: segment.text })) })
  } catch (err: any) {
    logTaskError('StoryboardAPI', 'generate-tts', {
      storyboardId: id,
      voiceId: segmentVoices.map(segment => `${segment.speaker || '내레이션'}=${segment.voiceId}`).join(', '),
      error: err.message,
    })
    return badRequest(c, err.message)
  }
})

// DELETE /storyboards/:id
app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  logTaskStart('StoryboardAPI', 'delete', { storyboardId: id })
  db.delete(schema.storyboardCharacters).where(eq(schema.storyboardCharacters.storyboardId, id)).run()
  db.delete(schema.storyboards).where(eq(schema.storyboards.id, id)).run()
  logTaskSuccess('StoryboardAPI', 'delete', { storyboardId: id })
  return success(c)
})

export default app
