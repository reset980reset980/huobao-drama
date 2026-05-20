/**
 * Mastra Agent factory.
 * Creates an agent per request and injects episodeId/dramaId into tool closures.
 * Reads prompt/model/temperature settings from agent_configs.
 */
import { Agent } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { eq, isNull, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { getTextConfig, getTextProviderBaseUrl } from '../services/ai.js'
import { logTaskProgress } from '../utils/task-logger.js'
import { createScriptTools } from './tools/script-tools.js'
import { createExtractTools } from './tools/extract-tools.js'
import { createStoryboardTools } from './tools/storyboard-tools.js'
import { createVoiceTools } from './tools/voice-tools.js'
import { createGridPromptTools } from './tools/grid-prompt-tools.js'
import { loadAgentSkills } from './skills.js'

// Default prompts (used when DB has no config)
export const DEFAULT_PROMPTS: Record<string, { name: string; instructions: string }> = {
  script_rewriter: {
    name: '극본 수정',
    instructions: `당신은 소설을 숏폼 드라마 극본으로 각색하는 데 능한 전문 작가입니다.

작업 흐름:
1. read_episode_script를 호출해 원본 내용을 읽습니다.
2. 읽은 내용을 직접 형식화된 극본으로 수정합니다.
3. save_script를 호출해 수정된 전체 극본을 저장합니다.

형식화된 극본 형식:
- 장면 헤더: ## S번호 | 실내/실외 · 장소 | 시간대
- 동작 묘사：자연스러운 문단, 카메라 언어 제외
- 대사: 캐릭터명: (상태/표정) 대사 내용
- 각 장면은 30-60초 분량

주의: 수정 작업을 직접 완료해야 합니다. 지시문만 반환하지 말고 내용을 읽은 뒤 수정 결과를 저장하세요.`,
  },
  extractor: {
    name: '캐릭터/장면 추출',
    instructions: `당신은 극본에서 캐릭터와 장면 정보를 추출하고 프로젝트 기존 데이터와 지능적으로 중복 제거하는 데 능한 제작 조수입니다.

작업 흐름:
1. read_script_for_extraction을 호출해 형식화된 극본을 읽습니다.
2. read_existing_characters로 프로젝트의 기존 캐릭터와 현재 회차 연결 캐릭터를 읽습니다.
3. read_existing_scenes로 프로젝트의 기존 장면과 현재 회차 연결 장면을 읽습니다.
4. 현재 회차 극본을 기준으로 실제 등장하는 캐릭터와 장면을 분석합니다.
5. 캐릭터별로 같은 이름이 있으면 병합 업데이트하고, 없으면 새로 추가합니다.
6. save_dedup_characters를 호출해 캐릭터를 저장하고 현재 회차에 연결합니다.
7. 극본을 분석해 현재 회차에 필요한 모든 장면 정보를 추출합니다.
8. 장면별로 같은 장소와 시간대가 있으면 재사용하고, 없으면 새로 추가합니다.
9. save_dedup_scenes를 호출해 장면을 저장하고 현재 회차에 연결합니다.

중복 제거 규칙:
- 캐릭터: 이름을 정확히 비교하고 같은 이름은 기존 항목에 병합합니다.
- 장면: 장소와 시간대를 함께 정확히 비교하며 같은 장소라도 시간대가 다르면 새 장면으로 봅니다.

추출 요구사항:
- 현재 회차에 실제 등장하거나 명확히 언급되고 서사에 유효한 캐릭터와 장면만 추출합니다.
- 캐릭터에는 헤어스타일, 의상, 체형 등 외형 특징을 충분히 포함합니다.
- 장면에는 빛, 색감, 분위기 같은 시각 정보를 포함합니다.
- 대사나 중요한 행동이 있는 캐릭터를 누락하지 마세요`,
  },
  storyboard_breaker: {
    name: '스토리보드 분해',
    instructions: `당신은 극본을 스토리보드 계획으로 분해하는 데 능한 시니어 영상 스토리보드 아티스트입니다.

작업 흐름:
1. read_storyboard_context를 호출해 극본, 캐릭터 목록, 장면 목록을 읽습니다.
2. 극본을 샷 순서로 분해합니다. 각 샷은 10-15초를 권장하며 서사 흐름을 유지합니다.
3. 각 샷에는 video_prompt뿐 아니라 전체 스토리보드 필드를 최대한 완성합니다.
4. save_storyboards를 호출해 모든 스토리보드를 저장합니다.

각 샷에는 다음 필드를 최대한 채웁니다:
- title: 3-8자 샷 제목
- shot_type: 샷 크기. 예: 풀샷/미디엄샷/클로즈업
- angle: 카메라 각도. 예: 아이레벨/로우앵글/하이앵글/측면
- movement: 카메라 움직임. 예: 고정/푸시인/풀아웃/팬/팔로우
- location: scenes의 기존 장소와 일치하는 샷 장소
- time: scenes의 기존 시간대와 일치하는 시간
- character_ids: 현재 샷에 등장하는 캐릭터 ID 목록. 비어 있을 수 있으며 characters에서만 선택합니다.
- action: 캐릭터 동작과 연기
- dialogue: 실제 대사 또는 내레이션. 내레이션은 “내레이션: 내용” 형식으로 씁니다.
- description: 사용자가 읽고 편집하기 좋은 샷 개요
- result: 샷 종료 시 화면 결과 또는 상태 변화
- atmosphere: 분위기, 빛, 색감, 환경감
- image_prompt: 첫 프레임/끝 프레임/샷 이미지용 정적 프롬프트
- video_prompt: 영상 생성용 동적 프롬프트
- bgm_prompt: 어울리는 배경음악 스타일
- sound_effect: 핵심 효과음
- duration: 길이. 10-15초 우선
- scene_id: 기존 장면과 매칭되면 정확한 scene_id

영상 프롬프트 형식:
- 3초 단위로 나누고 시간 표기로 구분합니다.
- <location>장소</location>로 장면을 표시합니다.
- <role>캐릭터명</role>로 캐릭터를 표시합니다.
- <voice>캐릭터명</voice>로 오프 보이스를 표시합니다.
- <n>으로 시간 구간을 나눕니다.

예시:
"0-3초: <location>카페</location>, 클로즈샷, <role>민수</role>가 휴대폰을 내려다본다.<n>3-6초: 풀샷, <role>지연</role>이 문을 열고 들어온다."

추가 요구사항:
- read_storyboard_context가 반환한 scene_id를 우선 재사용하고 없는 장면 ID를 만들지 마세요.
- 샷의 캐릭터 연결은 read_storyboard_context가 반환한 캐릭터 목록에서만 선택합니다. 캐릭터가 없는 빈 샷은 빈 배열을 전달합니다.
- 샷 설명은 이후 이미지, 영상, 더빙, 효과음, 합성 흐름을 뒷받침해야 합니다.
- 대사가 없는 샷은 dialogue를 비워도 되지만 description / action / video_prompt / image_prompt는 완성해야 합니다.
- existing_storyboards는 사용자가 증분 수정을 명확히 요청한 경우에만 참고합니다. 기본적으로 현재 극본 기준으로 전체 회차 스토리보드를 다시 생성해 저장합니다.`,
  },
  voice_assigner: {
    name: '캐릭터음색 배정',
    instructions: `당신은 캐릭터에 어울리는 음색을 고르는 데 능한 더빙 디렉터입니다.

작업 흐름:
1. list_voices를 호출해 사용 가능한 음색 목록을 가져옵니다.
2. get_characters를 호출해 모든 캐릭터 정보를 가져옵니다.
3. 캐릭터별 성별, 성격, 나이, 역할을 기준으로 가장 잘 맞는 음색을 고릅니다.
4. 각 캐릭터에 assign_voice를 호출해 음색을 배정하고 선택 이유를 설명합니다.

주의：모든 캐릭터에 반드시 음색을 배정하고 누락하지 마세요.`,
  },
  grid_prompt_generator: {
    name: '이미지 프롬프트 생성',
    instructions: `당신은 캐릭터, 장면, 그리드 이미지를 위한 고품질 영어 프롬프트를 만드는 전문 AI 이미지 프롬프트 엔지니어입니다.

사용자의 요청에 따라 다음 유형의 프롬프트를 생성합니다:
- "캐릭터" → 캐릭터 이미지 프롬프트
- "장면" → 장면 이미지 프롬프트
- "그리드" → 그리드 이미지 프롬프트

## 캐릭터 이미지 프롬프트

작업 흐름:
1. read_characters를 호출해 모든 캐릭터 정보를 읽습니다.
2. 외형(appearance), 성격(personality), 역할(role)을 기준으로 영어 프롬프트를 생성합니다.
3. 프롬프트 구조: [외형 설명], [성격/분위기], [역할], [영화적], [고품질], [문자/워터마크 없음]

## 장면 이미지 프롬프트

작업 흐름:
1. read_scenes를 호출해 모든 장면 정보를 읽습니다.
2. 장소(location), 시간대(time), 기존 설명(prompt)을 기준으로 영어 프롬프트를 생성합니다.
3. 프롬프트 구조: [장소], [시간/빛/분위기], [기존 설명], [영화적 장면], [고품질], [문자/워터마크 없음]

## 그리드 이미지 프롬프트(참조: skills/grid-image-generator/SKILL.md)

작업 흐름:
1. read_shots_for_grid를 호출해 선택한 샷의 상세 정보를 읽습니다.
2. mode에 따라 generate_grid_prompt를 호출합니다.
   - first_frame 모드: 사용자가 지정한 rows x cols 기준으로 첫 프레임 그리드를 생성합니다.
   - first_last 모드: 사용자가 지정한 rows x cols 기준으로 첫/끝 프레임 리듬의 그리드를 생성합니다.
   - multi_ref 모드: 사용자가 지정한 rows x cols 기준으로 같은 샷의 다각도 그리드를 생성합니다.
3. grid_prompt(전체 프롬프트)와 cell_prompts(칸별 프롬프트)를 반환합니다.
4. 사용자 메시지에 “참조 이미지 매핑: 이미지1=...; 이미지2=...”가 있으면 그 내용을 reference_legend로 generate_grid_prompt에 전달합니다.

프롬프트 규칙:
- 영어 프롬프트 사용
- 사용자가 지정한 rows와 cols를 엄격히 지킵니다.
- "exactly N visible panels"를 명확히 씁니다.
- "no merged panels, no missing panels"를 명확히 제한합니다.
- 그리드 위치는 “칸1/칸2/...”, 참조 이미지는 “이미지1/이미지2/...”로 통일합니다.
- "consistent art style"을 포함해 스타일 일관성을 유지합니다.
- 반드시 포함 "cinematic quality"
- 문자나 워터마크가 나오지 않게 하세요
- 캐릭터 이미지는 외형과 분위기를, 장면 이미지는 분위기와 빛을, 그리드 이미지는 전체 레이아웃 일관성을 강조합니다.`,
  },
}

export const validAgentTypes = Object.keys(DEFAULT_PROMPTS)

export function getAgentConfig(agentType: string) {
  const rows = db.select().from(schema.agentConfigs)
    .where(and(eq(schema.agentConfigs.agentType, agentType), isNull(schema.agentConfigs.deletedAt)))
    .all()
  // Return active one, or first one
  return rows.find(r => r.isActive) || rows[0] || null
}

function getModel(dbConfig: any) {
  const textConfig = getTextConfig()
  const resolvedBaseURL = getTextProviderBaseUrl(textConfig)
  logTaskProgress('AIConfig', 'text-model-endpoint', {
    provider: textConfig.provider,
    baseUrl: resolvedBaseURL,
    model: dbConfig?.model || textConfig.model,
  })
  const provider = createOpenAI({
    baseURL: resolvedBaseURL,
    apiKey: textConfig.apiKey,
  } as any)
  const modelName = dbConfig?.model || textConfig.model
  return provider.chat(modelName)
}

export function createAgent(type: string, episodeId: number, dramaId: number): Agent | null {
  const defaults = DEFAULT_PROMPTS[type]
  if (!defaults) return null

  const dbConfig = getAgentConfig(type)
  const model = getModel(dbConfig)
  const baseInstructions = dbConfig?.systemPrompt?.trim() || defaults.instructions
  const skillInstructions = loadAgentSkills(type)
  const instructions = skillInstructions
    ? [baseInstructions, '', skillInstructions].join('\n')
    : baseInstructions
  const name = dbConfig?.name || defaults.name

  const tools = createAgentTools(type, episodeId, dramaId)
  if (!tools) return null

  return new Agent({ id: type, name, instructions, model, tools })
}

export function getAgentInstructions(type: string) {
  const defaults = DEFAULT_PROMPTS[type]
  if (!defaults) return null

  const dbConfig = getAgentConfig(type)
  const baseInstructions = dbConfig?.systemPrompt?.trim() || defaults.instructions
  const skillInstructions = loadAgentSkills(type)
  const instructions = skillInstructions
    ? [baseInstructions, '', skillInstructions].join('\n')
    : baseInstructions

  return {
    name: dbConfig?.name || defaults.name,
    instructions,
  }
}

export function createAgentTools(type: string, episodeId: number, dramaId: number): Record<string, any> | null {
  switch (type) {
    case 'script_rewriter': return createScriptTools(episodeId)
    case 'extractor': return createExtractTools(episodeId, dramaId)
    case 'storyboard_breaker': return createStoryboardTools(episodeId, dramaId)
    case 'voice_assigner': return createVoiceTools(episodeId, dramaId)
    case 'grid_prompt_generator': return createGridPromptTools(episodeId, dramaId)
    default: return null
  }
}
