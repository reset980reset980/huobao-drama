import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAgentTools, getAgentInstructions } from '../agents/index.js'
import { logTaskProgress } from '../utils/task-logger.js'

type CodexAction = {
  tool?: string | null
  args?: Record<string, unknown>
  args_json?: string | null
  final?: string | null
}

type CodexToolCall = {
  toolName: string
  args: Record<string, unknown>
}

type CodexToolResult = {
  toolName: string
  result: string
}

export type CodexAgentResult = {
  text: string
  toolCalls: CodexToolCall[]
  toolResults: CodexToolResult[]
}

const CODEX_TIMEOUT_MS = Number(process.env.CODEX_AGENT_TIMEOUT_MS || 600_000)
const CODEX_MAX_STEPS = Number(process.env.CODEX_AGENT_MAX_STEPS || 20)
const CODEX_AGENT_MODEL = process.env.CODEX_AGENT_MODEL?.trim()
const CODEX_ACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tool', 'args_json', 'final'],
  properties: {
    tool: { type: ['string', 'null'] },
    args_json: { type: ['string', 'null'] },
    final: { type: ['string', 'null'] },
  },
}

const TOOL_ARG_HINTS: Record<string, string> = {
  read_episode_script: '{}',
  rewrite_to_screenplay: '{"instructions":"추가 수정 지시"}',
  save_script: '{"content":"저장할 전체 극본"}',
  read_script_for_extraction: '{}',
  read_existing_characters: '{}',
  read_existing_scenes: '{}',
  save_dedup_characters: '{"characters":[{"name":"이름","role":"역할","description":"설명","appearance":"외형","personality":"성격"}]}',
  save_dedup_scenes: '{"scenes":[{"location":"장소","time":"시간대","prompt":"시각 설명"}]}',
  read_storyboard_context: '{}',
  save_storyboards: '{"storyboards":[{"shot_number":1,"title":"샷 제목","shot_type":"미디엄샷","angle":"아이레벨","movement":"고정","location":"장소","time":"시간대","character_ids":[],"action":"동작","dialogue":"대사","description":"설명","result":"결과","atmosphere":"분위기","image_prompt":"이미지 프롬프트","video_prompt":"영상 프롬프트","bgm_prompt":"음악","sound_effect":"효과음","duration":10,"scene_id":null}]}',
  update_storyboard: '{"storyboard_id":1,"updates":{"title":"수정 제목"}}',
  generate_grid_prompt: '{"shots":[{"shot_number":1,"description":"샷 설명","shot_type":"미디엄샷","dialogue":"","location":"장소","time":"시간대"}],"rows":2,"cols":2,"mode":"first_frame","reference_legend":"이미지1=캐릭터 A"}',
  get_characters: '{}',
  list_voices: '{}',
  assign_voice: '{"character_id":1,"voice_id":"voice-id","reason":"선택 이유"}',
  read_characters: '{}',
  generate_character_prompt: '{"character_id":1}',
  read_scenes: '{}',
  generate_scene_prompt: '{"scene_id":1}',
  read_shots_for_grid: '{"shot_ids":[1,2]}',
}

function asJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function normalizeResult(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function extractJsonObject(text: string): CodexAction | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = fenced ? [fenced[1], trimmed] : [trimmed]

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as CodexAction
    } catch {
      // Try balanced object extraction below.
    }
  }

  for (let start = 0; start < trimmed.length; start += 1) {
    if (trimmed[start] !== '{') continue
    let depth = 0
    let inString = false
    let escaped = false
    for (let end = start; end < trimmed.length; end += 1) {
      const ch = trimmed[end]
      if (inString) {
        escaped = ch === '\\' && !escaped
        if (ch === '"' && !escaped) inString = false
        if (ch !== '\\') escaped = false
        continue
      }
      if (ch === '"') inString = true
      if (ch === '{') depth += 1
      if (ch === '}') depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(trimmed.slice(start, end + 1)) as CodexAction
        } catch {
          break
        }
      }
    }
  }

  return null
}

function buildToolList(tools: Record<string, any>) {
  return Object.values(tools).map((tool: any) => {
    const name = String(tool.id)
    const hint = TOOL_ARG_HINTS[name] || '{}'
    return `- ${name}: ${tool.description || '설명 없음'}\n  args 예시: ${hint}`
  }).join('\n')
}

function buildPrompt(params: {
  name: string
  instructions: string
  message: string
  tools: Record<string, any>
  toolCalls: CodexToolCall[]
  toolResults: CodexToolResult[]
}) {
  return [
    '당신은 화보 드라마 backend의 로컬 Codex CLI 텍스트 Agent입니다.',
    '서버 도구는 직접 실행할 수 없으며, 아래 JSON 계약으로 다음 행동 하나만 선택해야 합니다.',
    '',
    `Agent 이름: ${params.name}`,
    '',
    'Agent 지시문:',
    params.instructions,
    '',
    '사용 가능한 도구:',
    buildToolList(params.tools),
    '',
    '출력 규칙:',
    '- 반드시 유효한 JSON 객체 하나만 출력하세요. 마크다운, 설명문, 코드블록은 쓰지 마세요.',
    '- 도구가 필요하면 {"tool":"도구명","args_json":"{\\"필드\\":\\"값\\"}","final":null} 형식으로 출력하세요.',
    '- 작업이 완료되면 {"tool":null,"args_json":null,"final":"사용자에게 보여줄 한국어 완료 메시지"} 형식으로 출력하세요.',
    '- args_json은 반드시 JSON.stringify된 객체 문자열이어야 합니다.',
    '- 도구 결과에 오류가 있으면 가능한 다음 도구 호출로 복구하고, 복구할 수 없을 때만 final에 오류를 설명하세요.',
    '',
    '사용자 요청:',
    params.message,
    '',
    '이미 실행한 도구 호출:',
    asJson(params.toolCalls),
    '',
    '이미 받은 도구 결과:',
    asJson(params.toolResults),
  ].join('\n')
}

async function runCodexExec(prompt: string) {
  const tempDir = await mkdtemp(join(tmpdir(), 'huobao-codex-'))
  const outputFile = join(tempDir, 'last-message.txt')
  const schemaFile = join(tempDir, 'action-schema.json')

  try {
    await writeFile(schemaFile, JSON.stringify(CODEX_ACTION_SCHEMA), 'utf8')
    const stdout = await new Promise<string>((resolvePromise, reject) => {
      const codexArgs = [
        'exec',
        '--skip-git-repo-check',
        '--sandbox',
        'read-only',
        '--ephemeral',
        '--ignore-rules',
        '--output-schema',
        schemaFile,
        '--output-last-message',
        outputFile,
        '-',
      ]
      if (CODEX_AGENT_MODEL) {
        codexArgs.splice(1, 0, '--model', CODEX_AGENT_MODEL)
      }
      const command = process.platform === 'win32' ? 'cmd.exe' : 'codex'
      const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'codex.cmd', ...codexArgs] : codexArgs
      const child = spawn(command, args, {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdoutText = ''
      let stderrText = ''
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error(`Codex CLI timed out after ${CODEX_TIMEOUT_MS / 1000}s`))
      }, CODEX_TIMEOUT_MS)

      child.stdout.on('data', chunk => { stdoutText += String(chunk) })
      child.stderr.on('data', chunk => { stderrText += String(chunk) })
      child.on('error', err => {
        clearTimeout(timer)
        reject(err)
      })
      child.on('close', code => {
        clearTimeout(timer)
        if (code === 0) {
          resolvePromise(stdoutText)
          return
        }
        reject(new Error(stderrText || stdoutText || `Codex CLI exited with code ${code}`))
      })
      child.stdin.end(prompt)
    })

    const lastMessage = await readFile(outputFile, 'utf8').catch(() => '')
    return lastMessage.trim() || stdout.trim()
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function executeTool(tool: any, args: Record<string, unknown>) {
  if (tool.inputSchema?.parse) {
    tool.inputSchema.parse(args)
  }
  return await tool.execute(args)
}

export async function runCodexAgent(params: {
  agentType: string
  episodeId: number
  dramaId: number
  message: string
}): Promise<CodexAgentResult | null> {
  const agentInfo = getAgentInstructions(params.agentType)
  const tools = createAgentTools(params.agentType, params.episodeId, params.dramaId)
  if (!agentInfo || !tools) return null

  const toolCalls: CodexToolCall[] = []
  const toolResults: CodexToolResult[] = []

  for (let step = 1; step <= CODEX_MAX_STEPS; step += 1) {
    logTaskProgress('CodexAgent', 'step', { agentType: params.agentType, step })
    const prompt = buildPrompt({
      name: agentInfo.name,
      instructions: agentInfo.instructions,
      message: params.message,
      tools,
      toolCalls,
      toolResults,
    })

    const output = await runCodexExec(prompt)
    const action = extractJsonObject(output)
    if (!action) {
      throw new Error(`Codex CLI가 JSON 응답을 반환하지 않았습니다: ${output.slice(0, 500)}`)
    }

    if (typeof action.final === 'string') {
      return { text: action.final, toolCalls, toolResults }
    }

    if (!action.tool) {
      throw new Error(`Codex CLI 응답에 tool 또는 final이 없습니다: ${output.slice(0, 500)}`)
    }

    const tool = Object.values(tools).find((candidate: any) => candidate.id === action.tool)
    if (!tool) {
      throw new Error(`Codex CLI가 알 수 없는 도구를 요청했습니다: ${action.tool}`)
    }

    let args: Record<string, unknown> = {}
    if (action.args && typeof action.args === 'object') {
      args = action.args
    } else if (typeof action.args_json === 'string' && action.args_json.trim()) {
      try {
        const parsedArgs = JSON.parse(action.args_json)
        args = parsedArgs && typeof parsedArgs === 'object' && !Array.isArray(parsedArgs) ? parsedArgs : {}
      } catch {
        throw new Error(`Codex CLI가 올바르지 않은 args_json을 반환했습니다: ${action.args_json.slice(0, 500)}`)
      }
    }
    toolCalls.push({ toolName: action.tool, args })
    const result = await executeTool(tool, args)
    toolResults.push({ toolName: action.tool, result: normalizeResult(result) })
  }

  return {
    text: `Codex CLI Agent가 ${CODEX_MAX_STEPS}단계 안에 작업을 완료하지 못했습니다.`,
    toolCalls,
    toolResults,
  }
}
