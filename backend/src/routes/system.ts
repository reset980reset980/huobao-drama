import { spawnSync } from 'child_process'
import net from 'net'
import { Hono } from 'hono'
import { success } from '../utils/response.js'
import { getFfmpegPath, getFfprobePath } from '../services/ffmpeg-binaries.js'
import { getFlowBridgeStatus } from './browserBridge.js'

type CheckResult = {
  ok: boolean
  label: string
  message: string
  detail?: Record<string, unknown>
}

const app = new Hono()

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timer))
  })
}

async function portOpen(host: string, port: number, timeoutMs = 700): Promise<boolean> {
  return withTimeout(new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  }), timeoutMs).catch(() => false)
}

async function httpCheck(label: string, url: string): Promise<CheckResult> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1500)
    const response = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))
    return {
      ok: response.ok,
      label,
      message: response.ok ? '연결됨' : `응답 오류 ${response.status}`,
      detail: { url, status: response.status },
    }
  } catch (error: any) {
    return {
      ok: false,
      label,
      message: error?.name === 'AbortError' ? '응답 시간 초과' : '연결 안 됨',
      detail: { url },
    }
  }
}

function commandCheck(label: string, commandPath: string): CheckResult {
  try {
    const result = spawnSync(commandPath, ['-version'], { encoding: 'utf8', timeout: 2500 })
    const firstLine = (result.stdout || result.stderr || '').split(/\r?\n/).find(Boolean) || ''
    return {
      ok: result.status === 0,
      label,
      message: result.status === 0 ? '사용 가능' : '실행 실패',
      detail: { path: commandPath, version: firstLine },
    }
  } catch (error: any) {
    return {
      ok: false,
      label,
      message: '찾을 수 없음',
      detail: { path: commandPath, error: error?.message },
    }
  }
}

app.get('/status', async (c) => {
  const [frontend, voiceboxPort, voiceboxHealth] = await Promise.all([
    httpCheck('프론트엔드', 'http://127.0.0.1:3013'),
    portOpen('127.0.0.1', 17493),
    httpCheck('Voicebox', 'http://127.0.0.1:17493/health'),
  ])

  const flowBridge = getFlowBridgeStatus()
  const services = {
    backend: {
      ok: true,
      label: '백엔드',
      message: '연결됨',
      detail: { url: 'http://127.0.0.1:5679' },
    } satisfies CheckResult,
    frontend,
    voicebox: voiceboxHealth.ok ? voiceboxHealth : {
      ...voiceboxHealth,
      ok: voiceboxPort,
      message: voiceboxPort ? '포트는 열렸지만 health 응답 없음' : voiceboxHealth.message,
    },
    ffmpeg: commandCheck('FFmpeg', getFfmpegPath()),
    ffprobe: commandCheck('FFprobe', getFfprobePath()),
    flowBridge: {
      ok: flowBridge.tokenPresent,
      label: 'Flow 브라우저 연결',
      message: flowBridge.tokenPresent ? '토큰 수신됨' : '토큰 대기 중',
      detail: {
        updatedAt: flowBridge.updatedAt,
        tokenAgeMs: flowBridge.tokenAgeMs,
      },
    } satisfies CheckResult,
  }

  return success(c, {
    checkedAt: new Date().toISOString(),
    services,
  })
})

export default app
