import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

let voiceboxProcess: ChildProcess | null = null

interface VoiceboxRuntimeOptions {
  projectRoot: string
}

export async function startVoiceboxRuntime(options: VoiceboxRuntimeOptions) {
  if (process.env.VOICEBOX_AUTO_START === 'false') {
    console.log('[Voicebox] 자동 실행이 꺼져 있습니다. VOICEBOX_AUTO_START=false')
    return
  }

  const port = Number(process.env.VOICEBOX_PORT || 17493)
  const host = process.env.VOICEBOX_HOST || '127.0.0.1'
  const voiceboxRoot = process.env.VOICEBOX_PROJECT_PATH || path.resolve(options.projectRoot, '..', 'voicebox')

  if (await isPortOpen(host, port)) {
    console.log(`[Voicebox] 이미 실행 중입니다: http://${host}:${port}`)
    return
  }

  if (!fs.existsSync(voiceboxRoot)) {
    console.log(`[Voicebox] 프로젝트 폴더를 찾지 못했습니다: ${voiceboxRoot}`)
    return
  }

  const pythonPath = resolveVoiceboxPython(voiceboxRoot)
  if (!pythonPath) {
    console.log(`[Voicebox] Python 실행 파일을 찾지 못했습니다. ${voiceboxRoot}에 .venv를 준비하세요.`)
    return
  }

  const logDir = path.resolve(options.projectRoot, 'backend', 'logs')
  fs.mkdirSync(logDir, { recursive: true })
  const out = fs.openSync(path.join(logDir, `voicebox-${port}.out.log`), 'a')
  const err = fs.openSync(path.join(logDir, `voicebox-${port}.err.log`), 'a')

  voiceboxProcess = spawn(
    pythonPath,
    ['-m', 'backend.main', '--host', host, '--port', String(port)],
    {
      cwd: voiceboxRoot,
      detached: false,
      stdio: ['ignore', out, err],
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
      },
    },
  )

  voiceboxProcess.on('exit', (code, signal) => {
    if (voiceboxProcess) {
      console.log(`[Voicebox] 프로세스가 종료되었습니다. code=${code ?? 'null'} signal=${signal ?? 'null'}`)
    }
    voiceboxProcess = null
  })

  await waitForPort(host, port, 20_000)
  if (await isPortOpen(host, port)) {
    console.log(`[Voicebox] 자동 실행 완료: http://${host}:${port}`)
  } else {
    console.log(`[Voicebox] 자동 실행을 시도했지만 포트가 열리지 않았습니다. 로그: ${path.join(logDir, `voicebox-${port}.err.log`)}`)
  }
}

export function stopVoiceboxRuntime() {
  if (!voiceboxProcess || voiceboxProcess.killed) return
  voiceboxProcess.kill()
  voiceboxProcess = null
}

function resolveVoiceboxPython(voiceboxRoot: string) {
  const explicit = process.env.VOICEBOX_PYTHON
  if (explicit && fs.existsSync(explicit)) return explicit

  const candidates = process.platform === 'win32'
    ? [
        path.join(voiceboxRoot, '.venv', 'Scripts', 'python.exe'),
        path.join(voiceboxRoot, 'venv', 'Scripts', 'python.exe'),
      ]
    : [
        path.join(voiceboxRoot, '.venv', 'bin', 'python'),
        path.join(voiceboxRoot, 'venv', 'bin', 'python'),
      ]

  return candidates.find(candidate => fs.existsSync(candidate)) || null
}

async function waitForPort(host: string, port: number, timeoutMs: number) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(host, port)) return true
    await sleep(500)
  }
  return false
}

function isPortOpen(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port })
    socket.setTimeout(800)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('error', () => resolve(false))
  })
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
