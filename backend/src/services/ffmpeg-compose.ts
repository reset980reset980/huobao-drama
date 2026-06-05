/**
 * FFmpeg 단일 샷 합성
 */
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import { v4 as uuid } from 'uuid'
import { db, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { now } from '../utils/response.js'
import { generateTTS } from './tts-generation.js'
import { configureFfmpegBinaries, getFfmpegPath, getFfprobePath } from './ffmpeg-binaries.js'
import { logTaskError, logTaskProgress, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'

configureFfmpegBinaries()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_ROOT = process.env.STORAGE_PATH || path.resolve(__dirname, '../../../data/static')
const DATA_ROOT = path.resolve(__dirname, '../../../data')
let subtitleFilterSupport: boolean | null = null
const IGNORE_TTS_SPEAKERS = /^(환경음|환경소리|효과음|sfx|sound ?effect|bgm|배경음|배경음악|ambient)$/i
const IGNORE_TTS_TEXT = /^(없음|대사 없음|내레이션 없음|더빙 필요 없음|대사 필요 없음|none|null|n\/a|na|환경음|환경소리|효과음|순수 효과음|순수 환경음|배경음|배경음악|bgm|sfx|ambient)$/i

export interface ComposeOptions {
  audioMode?: 'tts' | 'source'
  bgmMode?: 'none' | 'mix'
  bgmVolume?: number
}

function toAbsPath(relativePath: string): string {
  if (path.isAbsolute(relativePath)) return relativePath
  if (relativePath.startsWith('static/')) return path.join(DATA_ROOT, relativePath)
  return path.join(STORAGE_ROOT, relativePath)
}

function supportsSubtitleFilter(): boolean {
  if (subtitleFilterSupport != null) return subtitleFilterSupport
  try {
    const output = execFileSync(getFfmpegPath(), ['-hide_banner', '-filters'], { encoding: 'utf8' })
    subtitleFilterSupport = /\bsubtitles\b/.test(output)
  } catch {
    subtitleFilterSupport = false
  }
  return subtitleFilterSupport
}

function parseDialogueForTTS(dialogue?: string | null) {
  const raw = dialogue?.trim() || ''
  if (!raw) return { speaker: '', pureText: '', ignorable: true }
  const speakerMatch = raw.match(/^(.+?)[:：]/)
  const speaker = speakerMatch ? speakerMatch[1].replace(/[（(].+?[)）]/g, '').trim() : ''
  const pureText = raw.replace(/^.+?[:：]\s*/, '').replace(/[（(].+?[)）]/g, '').trim()
  const ignorable = (!!speaker && IGNORE_TTS_SPEAKERS.test(speaker)) || !pureText || IGNORE_TTS_TEXT.test(pureText)
  return { speaker, pureText, ignorable }
}

function hasAudioTrack(filePath: string): boolean {
  try {
    const output = execFileSync(getFfprobePath(), [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=index',
      '-of', 'csv=p=0',
      filePath,
    ], { encoding: 'utf8' })
    return !!output.trim()
  } catch {
    return false
  }
}

function normalizeVolume(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0.18
  return Math.min(1, Math.max(0, Number(value)))
}

/**
 * 단일 샷을 합성한다.
 * - tts: TTS 더빙 오디오를 입히고 자막을 굽는다.
 * - source: 원본 영상의 음성을 유지하고 더빙/자막 생성을 건너뛴다.
 */
export async function composeStoryboard(storyboardId: number, options: ComposeOptions = {}): Promise<string> {
  const audioMode = options.audioMode === 'source' ? 'source' : 'tts'
  const bgmMode = options.bgmMode === 'mix' ? 'mix' : 'none'
  const bgmVolume = normalizeVolume(options.bgmVolume)
  const [sb] = db.select().from(schema.storyboards).where(eq(schema.storyboards.id, storyboardId)).all()
  if (!sb) throw new Error(`Storyboard ${storyboardId} not found`)
  if (!sb.videoUrl) throw new Error(`Storyboard ${storyboardId} has no video`)
  db.update(schema.storyboards)
    .set({ status: 'compose_processing', composedVideoUrl: null, updatedAt: now() })
    .where(eq(schema.storyboards.id, storyboardId))
    .run()

  logTaskStart('ComposeTask', 'storyboard-compose', {
    storyboardId,
    storyboardNumber: sb.storyboardNumber,
    episodeId: sb.episodeId,
    audioMode,
    bgmMode,
    bgmVolume,
  })

  const videoPath = toAbsPath(sb.videoUrl)
  let audioPath: string | null = null
  let subtitlePath: string | null = null
  let subtitleRelative: string | null = sb.subtitleUrl || null
  let bgmPath: string | null = null
  const parsedDialogue = parseDialogueForTTS(sb.dialogue)
  const useTtsAudio = audioMode === 'tts'

  // 1. 더빙 합성 모드에서는 대사가 있을 때 TTS 오디오를 준비한다.
  try {
    if (useTtsAudio && !parsedDialogue.ignorable) {
      if (sb.ttsAudioUrl) {
        const existingAudioPath = toAbsPath(sb.ttsAudioUrl)
        if (fs.existsSync(existingAudioPath)) {
          audioPath = existingAudioPath
        }
      }

      if (!audioPath) {
        let voiceId = 'alloy'
        const [ep] = db.select().from(schema.episodes).where(eq(schema.episodes.id, sb.episodeId)).all()
        if (parsedDialogue.speaker) {
          const charName = parsedDialogue.speaker
          if (ep) {
            const chars = db.select().from(schema.characters)
              .where(eq(schema.characters.dramaId, ep.dramaId)).all()
            const found = chars.find(c => c.name === charName)
            if (found?.voiceStyle) voiceId = found.voiceStyle
          }
        }

        const pureDialogue = parsedDialogue.pureText
        if (pureDialogue) {
          logTaskProgress('ComposeTask', 'generate-inline-tts', { storyboardId, voiceId, textPreview: pureDialogue.slice(0, 40) })
          const ttsPath = await generateTTS({ text: pureDialogue, voice: voiceId, configId: ep?.audioConfigId ?? undefined })
          audioPath = toAbsPath(ttsPath)
          db.update(schema.storyboards).set({ ttsAudioUrl: ttsPath, updatedAt: now() })
            .where(eq(schema.storyboards.id, storyboardId)).run()
        }
      }
    }

    if (bgmMode === 'mix' && sb.bgmAudioUrl) {
      const candidate = toAbsPath(sb.bgmAudioUrl)
      if (fs.existsSync(candidate)) {
        bgmPath = candidate
      } else {
        logTaskProgress('ComposeTask', 'bgm-file-missing', { storyboardId, bgmAudioUrl: sb.bgmAudioUrl })
      }
    }

    // 2. 더빙 합성 모드에서는 자막 파일을 생성한다.
    if (useTtsAudio && !parsedDialogue.ignorable) {
      const srtDir = path.join(STORAGE_ROOT, 'subtitles')
      fs.mkdirSync(srtDir, { recursive: true })
      const srtFilename = `${uuid()}.srt`
      subtitlePath = path.join(srtDir, srtFilename)

      const duration = sb.duration || 10
      const pureText = parsedDialogue.pureText
      const srtContent = `1\n00:00:00,500 --> 00:00:${String(Math.min(duration - 1, 59)).padStart(2, '0')},000\n${pureText}\n`
      fs.writeFileSync(subtitlePath, srtContent, 'utf-8')

      const srtRelative = `static/subtitles/${srtFilename}`
      subtitleRelative = srtRelative
      db.update(schema.storyboards).set({ subtitleUrl: srtRelative, updatedAt: now() })
        .where(eq(schema.storyboards.id, storyboardId)).run()
    }

    // 3. FFmpeg 합성
    const outputDir = path.join(STORAGE_ROOT, 'composed')
    fs.mkdirSync(outputDir, { recursive: true })
    const outputFilename = `${uuid()}.mp4`
    const outputPath = path.join(outputDir, outputFilename)

    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(videoPath)
      const inputIndexes: { tts?: number; bgm?: number } = {}
      let nextInputIndex = 1

      if (audioPath) {
        cmd = cmd.input(audioPath)
        inputIndexes.tts = nextInputIndex++
      }

      if (bgmPath) {
        cmd = cmd.input(bgmPath)
        inputIndexes.bgm = nextInputIndex++
      }

      const filters: string[] = []
      const audioFilters: string[] = []

      if (subtitlePath && supportsSubtitleFilter()) {
        const escapedPath = subtitlePath
          .replace(/\\/g, '/')
          .replace(/:/g, '\\:')
          .replace(/'/g, "\\'")
        const forceStyle = 'FontSize=20\\,PrimaryColour=&HFFFFFF&\\,OutlineColour=&H000000&\\,Outline=2'
        filters.push(`subtitles=filename='${escapedPath}':force_style='${forceStyle}'`)
      } else if (subtitlePath) {
        logTaskProgress('ComposeTask', 'subtitle-filter-unavailable', {
          storyboardId,
          subtitlePath,
        })
      }

      if (filters.length > 0) {
        cmd = cmd.videoFilter(filters)
      }

      const outputOptions = ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23']
      const videoHasAudio = audioMode === 'source' ? hasAudioTrack(videoPath) : false

      if (bgmPath && audioPath && inputIndexes.tts != null && inputIndexes.bgm != null) {
        audioFilters.push(
          `[${inputIndexes.tts}:a]volume=1[a0]`,
          `[${inputIndexes.bgm}:a]volume=${bgmVolume}[bgm]`,
          '[a0][bgm]amix=inputs=2:duration=shortest:dropout_transition=2[aout]',
        )
        cmd = cmd.complexFilter(audioFilters)
        outputOptions.push('-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-shortest')
      } else if (bgmPath && audioMode === 'source' && inputIndexes.bgm != null && videoHasAudio) {
        audioFilters.push(
          '[0:a]volume=1[a0]',
          `[${inputIndexes.bgm}:a]volume=${bgmVolume}[bgm]`,
          '[a0][bgm]amix=inputs=2:duration=shortest:dropout_transition=2[aout]',
        )
        cmd = cmd.complexFilter(audioFilters)
        outputOptions.push('-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-shortest')
      } else if (bgmPath && inputIndexes.bgm != null) {
        outputOptions.push('-map', '0:v', '-map', `${inputIndexes.bgm}:a`, '-c:a', 'aac', '-shortest')
      } else if (audioPath && inputIndexes.tts != null) {
        outputOptions.push('-map', '0:v', '-map', `${inputIndexes.tts}:a`, '-c:a', 'aac', '-shortest')
      } else if (audioMode === 'source') {
        outputOptions.push('-map', '0:v', '-map', '0:a?', '-c:a', 'aac', '-shortest')
      } else {
        outputOptions.push('-an')
      }

      cmd.outputOptions(outputOptions)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    const composedRelative = `static/composed/${outputFilename}`
    db.update(schema.storyboards).set({
      composedVideoUrl: composedRelative,
      subtitleUrl: audioMode === 'source' ? null : subtitleRelative,
      status: 'compose_completed',
      updatedAt: now(),
    })
      .where(eq(schema.storyboards.id, storyboardId)).run()

    logTaskSuccess('ComposeTask', 'storyboard-compose', {
      storyboardId,
      storyboardNumber: sb.storyboardNumber,
      output: composedRelative,
      audioMode,
      bgmMode,
      hasBgm: !!bgmPath,
    })
    return composedRelative
  } catch (err) {
    db.update(schema.storyboards)
      .set({ status: 'compose_failed', composedVideoUrl: null, updatedAt: now() })
      .where(eq(schema.storyboards.id, storyboardId))
      .run()
    throw err
  }
}
