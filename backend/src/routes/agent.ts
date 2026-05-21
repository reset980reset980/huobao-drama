/**
 * Agent 채팅 라우트 - 비스트리밍 버전
 */
import { Hono } from 'hono'
import { createAgent, validAgentTypes } from '../agents/index.js'
import { runCodexAgent } from '../services/codex-agent.js'
import { shouldUseCodexTextAgent } from '../services/ai.js'
import { success, badRequest } from '../utils/response.js'
import { logTaskError, logTaskPayload, logTaskProgress, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'

const app = new Hono()

function normalizeToolName(entry: any) {
  return entry?.toolName
    || entry?.tool?.toolName
    || entry?.tool?.id
    || entry?.name
    || entry?.type
    || null
}

function normalizeToolResult(entry: any) {
  const result = entry?.result ?? entry?.output ?? entry?.data ?? null
  return typeof result === 'string' ? result : JSON.stringify(result)
}

function localizeAgentError(message?: string) {
  const text = message || 'Agent execution failed'
  if (/无效的\s*API\s*Key|invalid\s*api\s*key|invalid_api_key/i.test(text)) {
    return '텍스트 AI API 키가 유효하지 않습니다. 스토리보드 분해가 API provider로 실행된 상태라면, 설정 > AI 서비스 > 텍스트를 Codex CLI로 바꾸거나 해당 provider에 맞는 API 키를 저장하세요.'
  }
  return text
    .replace(/无效的\s*API\s*Key/gi, 'API 키가 유효하지 않습니다')
    .replace(/Agent execution failed/g, 'Agent 실행에 실패했습니다')
}

// POST /agent/:type/chat - 비스트리밍 Agent 대화
app.post('/:type/chat', async (c) => {
  const agentType = c.req.param('type')
  if (!validAgentTypes.includes(agentType)) {
    return badRequest(c, `Invalid agent type: ${agentType}`)
  }

  const body = await c.req.json()
  const { message, drama_id, episode_id } = body

  logTaskStart('Agent', agentType, {
    dramaId: drama_id,
    episodeId: episode_id,
    message,
  })
  logTaskPayload('Agent', `${agentType} input`, body)

  if (!episode_id || !drama_id) {
    logTaskError('Agent', agentType, { reason: 'missing drama_id or episode_id' })
    return badRequest(c, 'drama_id and episode_id are required')
  }

  const startTime = performance.now()

  try {
    const useCodex = shouldUseCodexTextAgent()
    const result = useCodex
      ? await runCodexAgent({ agentType, episodeId: episode_id, dramaId: drama_id, message })
      : await (async () => {
          const agent = createAgent(agentType, episode_id, drama_id)
          if (!agent) return null
          const generated = await agent.generate(
            [{ role: 'user', content: message }],
            { maxSteps: 20 },
          )
          return generated
        })()

    if (!result) {
      logTaskError('Agent', agentType, { reason: 'agent not found' })
      return badRequest(c, 'Agent not found')
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
    logTaskSuccess('Agent', agentType, { elapsedSeconds: elapsed, provider: useCodex ? 'codex-cli' : 'api' })

    // 모든 tool call과 결과를 프론트엔드가 읽기 쉬운 형태로 정규화합니다.
    const toolCalls = result.toolCalls || []
    const toolResults = result.toolResults || []
    const normalizedToolCalls = toolCalls.map((tc: any) => ({
      toolName: normalizeToolName(tc),
      args: tc?.args ?? tc?.input ?? null,
    }))
    const normalizedToolResults = toolResults.map((tr: any) => ({
      toolName: normalizeToolName(tr),
      result: normalizeToolResult(tr),
    }))

    logTaskProgress('Agent', 'tool-summary', {
      agentType,
      toolCalls: normalizedToolCalls.map((tc: any) => tc.toolName),
      toolResults: normalizedToolResults.map((tr: any) => tr.toolName),
    })
    logTaskPayload('Agent', `${agentType} tool-results`, normalizedToolResults)

    return success(c, {
      type: 'done',
      text: result.text || '',
      toolCalls: normalizedToolCalls,
      toolResults: normalizedToolResults,
    })
  } catch (err: any) {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
    logTaskError('Agent', agentType, { elapsedSeconds: elapsed, error: err.message })
    console.error(err.stack || err)
    return badRequest(c, localizeAgentError(err.message))
  }
})

// GET /agent/:type/debug
app.get('/:type/debug', async (c) => {
  const agentType = c.req.param('type')
  if (!validAgentTypes.includes(agentType)) return badRequest(c, 'Invalid agent type')
  return success(c, { agent_type: agentType, valid: true })
})

export default app
