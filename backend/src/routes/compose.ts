import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, badRequest } from '../utils/response.js'
import { composeStoryboard, type ComposeOptions } from '../services/ffmpeg-compose.js'
import { logTaskError, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'
import { toSnakeCase } from '../utils/transform.js'

const app = new Hono()
const COMPOSE_TASK_DELAY_MS = Number(process.env.COMPOSE_TASK_DELAY_MS || 3_000)

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function readComposeOptions(c: any): Promise<ComposeOptions> {
  try {
    const body = await c.req.json()
    const requestedMode = body?.audio_mode || body?.audioMode
    return { audioMode: requestedMode === 'source' ? 'source' : 'tts' }
  } catch {
    return { audioMode: 'tts' }
  }
}

// POST /storyboards/:id/compose — 단일 샷 합성
app.post('/storyboards/:id/compose', async (c) => {
  const id = Number(c.req.param('id'))
  const options = await readComposeOptions(c)
  try {
    logTaskStart('ComposeAPI', 'single-compose', { storyboardId: id, audioMode: options.audioMode })
    const composedUrl = await composeStoryboard(id, options)
    logTaskSuccess('ComposeAPI', 'single-compose', { storyboardId: id, output: composedUrl, audioMode: options.audioMode })
    return success(c, { id, composed_video_url: composedUrl, audio_mode: options.audioMode })
  } catch (err: any) {
    logTaskError('ComposeAPI', 'single-compose', { storyboardId: id, audioMode: options.audioMode, error: err.message })
    return badRequest(c, err.message)
  }
})

// POST /episodes/:id/compose-all — 전체 샷 일괄 합성
app.post('/episodes/:id/compose-all', async (c) => {
  const episodeId = Number(c.req.param('id'))
  const options = await readComposeOptions(c)
  const storyboards = db.select().from(schema.storyboards)
    .where(eq(schema.storyboards.episodeId, episodeId))
    .orderBy(schema.storyboards.storyboardNumber)
    .all()

  if (storyboards.length === 0) return badRequest(c, 'No storyboards found')

  const withVideo = storyboards.filter(sb => sb.videoUrl)
  if (withVideo.length === 0) return badRequest(c, 'No storyboards have video yet')

  // 백그라운드 순차 처리
  db.update(schema.storyboards)
    .set({ status: 'compose_processing' })
    .where(eq(schema.storyboards.episodeId, episodeId))
    .run()

  ;(async () => {
    for (const sb of withVideo) {
      try {
        await composeStoryboard(sb.id, options)
      } catch (err: any) {
        logTaskError('ComposeAPI', 'batch-item', { storyboardId: sb.id, episodeId, audioMode: options.audioMode, error: err.message })
      }
      if (COMPOSE_TASK_DELAY_MS > 0) await sleep(COMPOSE_TASK_DELAY_MS)
    }
    logTaskSuccess('ComposeAPI', 'batch-compose', { episodeId, total: withVideo.length, audioMode: options.audioMode })
  })()

  logTaskStart('ComposeAPI', 'batch-compose', { episodeId, total: withVideo.length, audioMode: options.audioMode })
  return success(c, {
    message: `Started composing ${withVideo.length} storyboards`,
    total: withVideo.length,
    audio_mode: options.audioMode,
  })
})

// GET /episodes/:id/compose-status — 일괄 합성 상태 조회
app.get('/episodes/:id/compose-status', async (c) => {
  const episodeId = Number(c.req.param('id'))
  const storyboards = db.select().from(schema.storyboards)
    .where(eq(schema.storyboards.episodeId, episodeId))
    .orderBy(schema.storyboards.storyboardNumber)
    .all()

  const withVideo = storyboards.filter(sb => !!sb.videoUrl)
  const completed = withVideo.filter(sb => sb.status === 'compose_completed' && !!sb.composedVideoUrl)
  const failed = withVideo.filter(sb => sb.status === 'compose_failed')
  const processing = withVideo.filter(sb => sb.status === 'compose_processing')
  const idle = withVideo.filter(sb => !sb.status || !String(sb.status).startsWith('compose_'))

  return success(c, {
    total: withVideo.length,
    completed: completed.length,
    failed: failed.length,
    processing: processing.length,
    idle: idle.length,
    items: withVideo.map((sb) => toSnakeCase({
      id: sb.id,
      storyboardNumber: sb.storyboardNumber,
      status: sb.status || 'pending',
      composedVideoUrl: sb.composedVideoUrl,
      errorMsg: sb.status === 'compose_failed' ? '영상 합성에 실패했습니다. 영상과 오디오 소재를 확인하세요' : '',
    })),
  })
})

export default app
