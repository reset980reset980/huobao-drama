/**
 * 이미지 프롬프트 생성 Agent 도구
 * 팩토리 함수 패턴 - episodeId + dramaId를 주입합니다.
 *
 * 세 가지 프롬프트 생성을 지원합니다:
 * 1. 캐릭터 이미지 프롬프트
 * 2. 장면 이미지 프롬프트
 * 3. 그리드 이미지 프롬프트
 */
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db, schema } from '../../db/index.js'
import { eq } from 'drizzle-orm'

export function createGridPromptTools(episodeId: number, dramaId: number) {

  // ─── 캐릭터 프롬프트 ───────────────────────────────────────

  const readCharacters = createTool({
    id: 'read_characters',
    description: '현재 드라마의 모든 캐릭터 정보를 읽어 캐릭터 이미지 프롬프트 생성에 사용합니다.',
    inputSchema: z.object({}),
    execute: async () => {
      const chars = db.select().from(schema.characters)
        .where(eq(schema.characters.dramaId, dramaId)).all()
        .filter(c => !c.deletedAt)
      return {
        characters: chars.map(c => ({
          id: c.id,
          name: c.name,
          role: c.role || '',
          description: c.description || '',
          appearance: c.appearance || '',
          personality: c.personality || '',
        })),
      }
    },
  })

  const generateCharacterPrompt = createTool({
    id: 'generate_character_prompt',
    description: '캐릭터용 AI 이미지 생성 영어 프롬프트를 만듭니다.',
    inputSchema: z.object({
      character_id: z.number(),
    }),
    execute: async ({ character_id }) => {
      const [c] = db.select().from(schema.characters)
        .where(eq(schema.characters.id, character_id)).all()
      if (!c) return { error: 'Character not found' }

      const parts: string[] = []
      if (c.appearance) parts.push(c.appearance)
      if (c.description) parts.push(c.description)
      if (c.role) parts.push(`role: ${c.role}`)
      if (c.personality) parts.push(`personality: ${c.personality}`)

      const base = parts.join(', ')
      const prompt = `${base}, cinematic portrait, high quality, consistent art style, no text, no watermark`

      return {
        character_id: c.id,
        character_name: c.name,
        prompt,
      }
    },
  })

  // ─── 장면 프롬프트 ───────────────────────────────────────

  const readScenes = createTool({
    id: 'read_scenes',
    description: '현재 드라마의 모든 장면 정보를 읽어 장면 이미지 프롬프트 생성에 사용합니다.',
    inputSchema: z.object({}),
    execute: async () => {
      const scenes = db.select().from(schema.scenes)
        .where(eq(schema.scenes.dramaId, dramaId)).all()
        .filter(s => !s.deletedAt)
      return {
        scenes: scenes.map(s => ({
          id: s.id,
          location: s.location,
          time: s.time || '',
          prompt: s.prompt || '',
        })),
      }
    },
  })

  const generateScenePrompt = createTool({
    id: 'generate_scene_prompt',
    description: '장면용 AI 이미지 생성 영어 프롬프트를 만듭니다.',
    inputSchema: z.object({
      scene_id: z.number(),
    }),
    execute: async ({ scene_id }) => {
      const [s] = db.select().from(schema.scenes)
        .where(eq(schema.scenes.id, scene_id)).all()
      if (!s) return { error: 'Scene not found' }

      const parts: string[] = []
      if (s.location) parts.push(s.location)
      if (s.time) parts.push(s.time)
      if (s.prompt) parts.push(s.prompt)

      const base = parts.join(', ')
      const prompt = `${base}, cinematic scene, atmospheric lighting, high quality, consistent art style, no text, no watermark`

      return {
        scene_id: s.id,
        location: s.location,
        prompt,
      }
    },
  })

  // ─── 그리드 이미지 프롬프트 ───────────────────────────────────────

  const readShotsForGrid = createTool({
    id: 'read_shots_for_grid',
    description: '선택한 샷의 상세 정보를 읽어 그리드 이미지 프롬프트 생성에 사용합니다.',
    inputSchema: z.object({
      shot_ids: z.array(z.number()),
    }),
    execute: async ({ shot_ids }) => {
      if (!shot_ids.length) return { shots: [] }
      const shots = db.select().from(schema.storyboards)
        .where(eq(schema.storyboards.episodeId, episodeId)).all()
        .filter(sb => shot_ids.includes(sb.id))
        .map(sb => ({
          shot_number: sb.storyboardNumber,
          description: sb.description || sb.title || '',
          shot_type: sb.shotType || '',
          dialogue: sb.dialogue || '',
          location: sb.location || '',
          time: sb.time || '',
        }))
      return { shots }
    },
  })

  const generateGridPrompt = createTool({
    id: 'generate_grid_prompt',
    description: '그리드 이미지의 전체 화면 설명과 각 칸의 독립 프롬프트를 만듭니다. grid-image-generator SKILL.md의 세 가지 모드 규칙을 따릅니다.',
    inputSchema: z.object({
      shots: z.array(z.object({
        shot_number: z.number(),
        description: z.string(),
        shot_type: z.string().optional(),
        dialogue: z.string().optional(),
        location: z.string().optional(),
        time: z.string().optional(),
      })),
      rows: z.number(),
      cols: z.number(),
      mode: z.string(), // 'first_frame' | 'first_last' | 'multi_ref'
      reference_legend: z.string().optional(),
    }),
    execute: async ({ shots, rows, cols, mode, reference_legend }) => {
      if (!shots.length) return { error: 'No shots provided', grid_prompt: '', cell_prompts: [] }
      const totalCells = rows * cols
      const legendPrefix = reference_legend ? `참조 이미지 매핑: ${reference_legend}, ` : ''

      if (mode === 'multi_ref') {
        const sb = shots[0]
        const gridPrompt = `${rows}x${cols} grid layout, exactly ${totalCells} visible panels, consistent art style, cinematic quality, ${legendPrefix}${sb.description}, all cells with identical lighting and color palette, no merged panels, no missing panels, no text, no watermark`
        const cellPrompts = Array.from({ length: totalCells }, (_, i) => ({
          shot_number: sb.shot_number,
          frame_type: 'reference',
          prompt: `칸${i + 1}: ${reference_legend ? `참조 ${reference_legend}, ` : ''}${sb.description}, cinematic lighting, consistent with other cells in the ${rows}x${cols} grid`,
        }))
        return { grid_prompt: gridPrompt, cell_prompts: cellPrompts }
      }

      if (mode === 'first_last') {
        const cellPrompts = []
        for (let i = 0; i < totalCells; i++) {
          const s = shots[i % shots.length]
          const isFirst = i % 2 === 0
          cellPrompts.push({
            shot_number: s.shot_number,
            frame_type: isFirst ? 'first_frame' : 'last_frame',
            prompt: isFirst
              ? `칸${i + 1}: ${reference_legend ? `참조 ${reference_legend}, ` : ''}${s.description}${s.location ? `, ${s.location}` : ''}${s.shot_type ? `, ${s.shot_type}` : ''}, opening scene`
              : `칸${i + 1}: ${reference_legend ? `참조 ${reference_legend}, ` : ''}${s.description}${s.location ? `, ${s.location}` : ''}${s.shot_type ? `, ${s.shot_type}` : ''}, ending scene, continuous motion`,
          })
        }
        const gridPrompt = `${rows}x${cols} grid layout, exactly ${totalCells} visible panels, consistent art style, cinematic quality, ${legendPrefix}${shots.map(s => s.description).join(' | ')}, no merged panels, no missing panels, no text, no watermark`
        return { grid_prompt: gridPrompt, cell_prompts: cellPrompts }
      }

      // first_frame mode
      const cellPrompts = Array.from({ length: totalCells }, (_, i) => {
        const s = shots[i % shots.length]
        return {
          shot_number: s.shot_number,
          frame_type: 'first_frame',
          prompt: `칸${i + 1}: ${reference_legend ? `참조 ${reference_legend}, ` : ''}${s.description}${s.location ? `, ${s.location}` : ''}${s.shot_type ? `, ${s.shot_type}` : ''}, opening scene`,
        }
      })
      const gridPrompt = `${rows}x${cols} grid layout, exactly ${totalCells} visible panels, consistent art style, cinematic quality, ${legendPrefix}${shots.map(s => s.description).join(' | ')}, no merged panels, no missing panels, no text, no watermark`
      return { grid_prompt: gridPrompt, cell_prompts: cellPrompts }
    },
  })

  return {
    readCharacters,
    generateCharacterPrompt,
    readScenes,
    generateScenePrompt,
    readShotsForGrid,
    generateGridPrompt,
  }
}
