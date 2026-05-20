/**
 * 캐릭터/장면 추출 Agent 도구
 * 팩토리 함수 패턴 - episodeId + dramaId를 주입합니다.
 *
 * 단일 Agent 처리 흐름:
 * 1. 극본 내용을 읽습니다.
 * 2. 프로젝트에 이미 존재하는 캐릭터/장면을 읽어 중복 제거에 사용합니다.
 * 3. 캐릭터/장면을 추출하고 중복 제거 후 바로 저장합니다.
 */
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db, schema } from '../../db/index.js'
import { eq, and } from 'drizzle-orm'
import { now } from '../../utils/response.js'
import { logTaskProgress, logTaskSuccess } from '../../utils/task-logger.js'

// ─── 연결 보조 함수 ────────────────────────────────────────────────
function linkCharToEpisode(episodeId: number, characterId: number) {
  const ts = now()
  const existing = db.select().from(schema.episodeCharacters)
    .where(and(eq(schema.episodeCharacters.episodeId, episodeId), eq(schema.episodeCharacters.characterId, characterId)))
    .all()
  if (!existing.length) {
    db.insert(schema.episodeCharacters).values({ episodeId, characterId, createdAt: ts }).run()
  }
}

function linkSceneToEpisode(episodeId: number, sceneId: number) {
  const ts = now()
  const existing = db.select().from(schema.episodeScenes)
    .where(and(eq(schema.episodeScenes.episodeId, episodeId), eq(schema.episodeScenes.sceneId, sceneId)))
    .all()
  if (!existing.length) {
    db.insert(schema.episodeScenes).values({ episodeId, sceneId, createdAt: ts }).run()
  }
}

export function createExtractTools(episodeId: number, dramaId: number) {

  // 1. 극본 내용 읽기
  const readScriptForExtraction = createTool({
    id: 'read_script_for_extraction',
    description: '캐릭터와 장면 추출을 위해 형식화된 극본을 읽습니다.',
    inputSchema: z.object({}),
    execute: async () => {
      const [ep] = db.select().from(schema.episodes)
        .where(eq(schema.episodes.id, episodeId)).all()
      if (!ep) return { error: 'Episode not found' }
      const content = ep.scriptContent || ep.content
      if (!content) return { error: 'Episode has no script content' }
      logTaskSuccess('ExtractTool', 'read-script', { episodeId, dramaId, scriptLength: content.length })
      return { script: content }
    },
  })

  // 2. 프로젝트에 이미 존재하는 캐릭터 읽기
  const readExistingCharacters = createTool({
    id: 'read_existing_characters',
    description: '중복 제거를 위해 이 드라마 프로젝트에 이미 존재하는 모든 캐릭터를 읽습니다.',
    inputSchema: z.object({}),
    execute: async () => {
      const linkedIds = new Set(
        db.select().from(schema.episodeCharacters)
          .where(eq(schema.episodeCharacters.episodeId, episodeId)).all()
          .map(link => link.characterId),
      )
      const chars = db.select().from(schema.characters)
        .where(eq(schema.characters.dramaId, dramaId)).all()
        .filter(c => !c.deletedAt)
      const payload = {
        count: chars.length,
        characters: chars,
        current_episode_characters: chars.filter(c => linkedIds.has(c.id)),
      }
      logTaskSuccess('ExtractTool', 'read-characters', {
        episodeId,
        dramaId,
        projectCharacters: payload.count,
        episodeCharacters: payload.current_episode_characters.length,
      })
      return payload
    },
  })

  // 3. 프로젝트에 이미 존재하는 장면 읽기
  const readExistingScenes = createTool({
    id: 'read_existing_scenes',
    description: '중복 제거를 위해 이 드라마 프로젝트에 이미 존재하는 모든 장면을 읽습니다.',
    inputSchema: z.object({}),
    execute: async () => {
      const linkedIds = new Set(
        db.select().from(schema.episodeScenes)
          .where(eq(schema.episodeScenes.episodeId, episodeId)).all()
          .map(link => link.sceneId),
      )
      const scenes = db.select().from(schema.scenes)
        .where(eq(schema.scenes.dramaId, dramaId)).all()
        .filter(s => !s.deletedAt)
      const payload = {
        count: scenes.length,
        scenes,
        current_episode_scenes: scenes.filter(s => linkedIds.has(s.id)),
      }
      logTaskSuccess('ExtractTool', 'read-scenes', {
        episodeId,
        dramaId,
        projectScenes: payload.count,
        episodeScenes: payload.current_episode_scenes.length,
      })
      return payload
    },
  })

  // 4. 캐릭터 저장 및 이름 기준 중복 병합
  const saveDedupCharacters = createTool({
    id: 'save_dedup_characters',
    description: '추출한 캐릭터를 중복 제거해 저장합니다. 같은 이름의 기존 캐릭터는 병합/업데이트하고 새 캐릭터는 생성한 뒤 현재 회차에 연결합니다.',
    inputSchema: z.object({
      characters: z.array(z.object({
        name: z.string(),
        role: z.string().optional(),
        description: z.string().optional(),
        appearance: z.string().optional(),
        personality: z.string().optional(),
      })),
    }),
    execute: async ({ characters }) => {
      const ts = now()
      const results = { created: 0, merged: 0 }
      logTaskProgress('ExtractTool', 'save-characters-begin', {
        episodeId,
        dramaId,
        names: characters.map(char => char.name).join(','),
      })

      for (const char of characters) {
        const existing = db.select().from(schema.characters)
          .where(eq(schema.characters.dramaId, dramaId)).all()
          .filter(c => !c.deletedAt)
          .find(c => c.name === char.name)

        if (existing) {
            // 기존 캐릭터: 정보를 병합하고 ID를 유지합니다.
          db.update(schema.characters).set({
            role: char.role || existing.role,
            description: char.description || existing.description,
            appearance: char.appearance || existing.appearance,
            personality: char.personality || existing.personality,
            updatedAt: ts,
          }).where(eq(schema.characters.id, existing.id)).run()
          linkCharToEpisode(episodeId, existing.id)
          results.merged++
        } else {
            // 새 캐릭터
          const res = db.insert(schema.characters).values({
            name: char.name,
            role: char.role || '',
            description: char.description || '',
            appearance: char.appearance || '',
            personality: char.personality || '',
            dramaId,
            createdAt: ts,
            updatedAt: ts,
          }).run()
          const charId = Number(res.lastInsertRowid)
          linkCharToEpisode(episodeId, charId)
          results.created++
        }
      }

      const payload = {
        message: `캐릭터 저장 완료: 신규 ${results.created}개, 병합 업데이트 ${results.merged}개`,
        ...results,
      }
      logTaskSuccess('ExtractTool', 'save-characters-complete', { episodeId, ...results })
      return payload
    },
  })

  // 5. 장면 저장 및 장소+시간대 기준 중복 병합
  const saveDedupScenes = createTool({
    id: 'save_dedup_scenes',
    description: '추출한 장면을 중복 제거해 저장합니다. 같은 장소+시간대의 기존 장면은 재사용하고 새 장면은 생성한 뒤 현재 회차에 연결합니다.',
    inputSchema: z.object({
      scenes: z.array(z.object({
        location: z.string(),
        time: z.string().optional(),
        prompt: z.string().optional(),
      })),
    }),
    execute: async ({ scenes }) => {
      const ts = now()
      const results = { created: 0, reused: 0 }
      logTaskProgress('ExtractTool', 'save-scenes-begin', {
        episodeId,
        dramaId,
        scenes: scenes.map(scene => `${scene.location}@${scene.time || ''}`).join(','),
      })

      for (const scene of scenes) {
        // 장소+시간대를 정확히 비교합니다.
        const existing = db.select().from(schema.scenes)
          .where(eq(schema.scenes.dramaId, dramaId)).all()
          .filter(s => !s.deletedAt)
          .find(s => s.location === scene.location && s.time === (scene.time || ''))

        if (existing) {
          // 완전히 일치하는 장면: 바로 연결합니다.
          linkSceneToEpisode(episodeId, existing.id)
          results.reused++
        } else {
          // 같은 장소라도 시간대가 다르면 별도 장면으로 생성합니다.
          const sameLocation = db.select().from(schema.scenes)
            .where(eq(schema.scenes.dramaId, dramaId)).all()
            .filter(s => !s.deletedAt)
            .find(s => s.location === scene.location)

          const res = db.insert(schema.scenes).values({
            dramaId,
            location: scene.location,
            time: scene.time || '',
            prompt: scene.prompt || scene.location,
            createdAt: ts,
            updatedAt: ts,
          }).run()
          const sceneId = Number(res.lastInsertRowid)
          linkSceneToEpisode(episodeId, sceneId)
          results.created++
        }
      }

      const payload = {
        message: `장면 저장 완료: 신규 ${results.created}개, 기존 재사용 ${results.reused}개`,
        ...results,
      }
      logTaskSuccess('ExtractTool', 'save-scenes-complete', { episodeId, ...results })
      return payload
    },
  })

  return {
    readScriptForExtraction,
    readExistingCharacters,
    readExistingScenes,
    saveDedupCharacters,
    saveDedupScenes,
  }
}
