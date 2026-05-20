/**
 * 극본 수정 Agent 도구
 * 팩토리 함수 패턴 - episodeId를 주입하므로 LLM이 ID를 전달할 필요가 없습니다.
 */
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db, schema } from '../../db/index.js'
import { eq } from 'drizzle-orm'
import { now } from '../../utils/response.js'

export function createScriptTools(episodeId: number) {
  const readEpisodeScript = createTool({
    id: 'read_episode_script',
    description: '현재 회차의 원본 내용을 읽습니다.',
    inputSchema: z.object({}),
    execute: async () => {
      const [ep] = db.select().from(schema.episodes)
        .where(eq(schema.episodes.id, episodeId)).all()
      if (!ep) return { error: `Episode not found (id=${episodeId})` }
      const content = ep.content || ep.scriptContent
      if (!content) return { error: `Episode has no content (id=${episodeId})` }
      return { content, word_count: content.length, episode_id: episodeId }
    },
  })

  const rewriteToScreenplay = createTool({
    id: 'rewrite_to_screenplay',
    description: 'AI 각색을 위해 원본 내용과 형식 지침을 함께 반환합니다.',
    inputSchema: z.object({
      instructions: z.string().optional().describe('Additional rewrite instructions'),
    }),
    execute: async ({ instructions }) => {
      const [ep] = db.select().from(schema.episodes)
        .where(eq(schema.episodes.id, episodeId)).all()
      if (!ep) return { error: `Episode not found` }
      const source = ep.content || ep.scriptContent
      if (!source) return { error: `Episode has no content to rewrite` }

      return {
        source_content: source,
        instruction: `아래 내용을 형식화된 극본으로 수정하세요.

형식 규칙:
- 장면 헤더: ## S번호 | 실내/실외 · 장소 | 시간대
- 동작 묘사：자연스러운 문단, 카메라 언어 제외
- 대사: 캐릭터명: (상태/표정) 대사 내용
- 각 장면은 30-60초 분량

${instructions || ''}

【원본 내용】
${source}`,
      }
    },
  })

  const saveScript = createTool({
    id: 'save_script',
    description: '수정된 전체 극본을 현재 회차에 저장합니다.',
    inputSchema: z.object({
      content: z.string().describe('The formatted screenplay content to save'),
    }),
    execute: async ({ content }) => {
      db.update(schema.episodes)
        .set({ scriptContent: content, updatedAt: now() })
        .where(eq(schema.episodes.id, episodeId))
        .run()
      return { message: `Script saved`, word_count: content.length }
    },
  })

  return { readEpisodeScript, rewriteToScreenplay, saveScript }
}
