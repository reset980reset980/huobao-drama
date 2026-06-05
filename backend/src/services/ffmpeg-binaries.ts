import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import ffmpeg from 'fluent-ffmpeg'

let configured = false
let ffmpegPathCache = ''
let ffprobePathCache = ''

export function configureFfmpegBinaries() {
  if (configured) return
  ffmpegPathCache = resolveBinaryPath('ffmpeg')
  ffprobePathCache = resolveBinaryPath('ffprobe')

  if (ffmpegPathCache) ffmpeg.setFfmpegPath(ffmpegPathCache)
  if (ffprobePathCache) ffmpeg.setFfprobePath(ffprobePathCache)
  configured = true
}

export function getFfmpegPath() {
  configureFfmpegBinaries()
  return ffmpegPathCache || 'ffmpeg'
}

export function getFfprobePath() {
  configureFfmpegBinaries()
  return ffprobePathCache || 'ffprobe'
}

function resolveBinaryPath(name: 'ffmpeg' | 'ffprobe') {
  const envKey = name === 'ffmpeg' ? 'FFMPEG_PATH' : 'FFPROBE_PATH'
  const explicit = process.env[envKey]
  if (explicit && fs.existsSync(explicit)) return explicit

  const fromPath = findOnPath(name)
  if (fromPath) return fromPath

  if (process.platform === 'win32') {
    const fromWinget = findInWingetPackages(name)
    if (fromWinget) return fromWinget
  }

  return ''
}

function findOnPath(name: string) {
  const command = process.platform === 'win32' ? 'where.exe' : 'which'
  const result = spawnSync(command, [name], { encoding: 'utf8' })
  if (result.status !== 0) return ''
  return result.stdout.split(/\r?\n/).map(line => line.trim()).find(Boolean) || ''
}

function findInWingetPackages(name: string) {
  const root = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages')
    : ''
  if (!root || !fs.existsSync(root)) return ''
  return findFile(root, `${name}.exe`)
}

function findFile(dir: string, filename: string): string {
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()!
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) return fullPath
      if (entry.isDirectory()) stack.push(fullPath)
    }
  }
  return ''
}
