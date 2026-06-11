param(
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $Root 'backend'
$FrontendDir = Join-Path $Root 'frontend'
$VoiceboxDir = 'D:\Project\voicebox'

function Test-ListeningPort {
  param([int]$Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $connection
}

function Wait-HttpEndpoint {
  param(
    [string]$Url,
    [int]$Seconds = 30
  )
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
      return $true
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  return $false
}

function Start-HiddenPowerShell {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$Command,
    [string]$LogPath
  )
  if (!(Test-Path -LiteralPath $WorkingDirectory)) {
    Write-Host "$Name 디렉터리를 찾을 수 없습니다: $WorkingDirectory"
    return
  }
  $escapedWorkingDirectory = $WorkingDirectory.Replace("'", "''")
  $escapedLogPath = $LogPath.Replace("'", "''")
  $script = "Set-Location -LiteralPath '$escapedWorkingDirectory'; $Command *> '$escapedLogPath'"
  Start-Process -FilePath 'powershell' -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $script) | Out-Null
  Write-Host "$Name 실행 요청됨"
}

if (Test-ListeningPort -Port 5679) {
  Write-Host '백엔드가 이미 실행 중입니다.'
} else {
  Start-HiddenPowerShell -Name '백엔드' -WorkingDirectory $BackendDir -Command 'npm run dev' -LogPath (Join-Path $Root 'backend-dev.log')
}

if (Test-ListeningPort -Port 3013) {
  Write-Host '프론트엔드가 이미 실행 중입니다.'
} else {
  Start-HiddenPowerShell -Name '프론트엔드' -WorkingDirectory $FrontendDir -Command '$env:NODE_OPTIONS="--max-old-space-size=12288"; npm run dev -- --host 127.0.0.1 --port 3013' -LogPath (Join-Path $Root 'frontend-dev.log')
}

Wait-HttpEndpoint -Url 'http://127.0.0.1:5679/api/v1/health' -Seconds 20 | Out-Null
Start-Sleep -Seconds 2

if (!(Test-ListeningPort -Port 17493) -and (Test-Path -LiteralPath $VoiceboxDir)) {
  $python = Join-Path $VoiceboxDir '.venv\Scripts\python.exe'
  $voiceboxCommand = if (Test-Path -LiteralPath $python) { ".\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 17493" } else { "python -m uvicorn app.main:app --host 127.0.0.1 --port 17493" }
  Start-HiddenPowerShell -Name 'Voicebox' -WorkingDirectory $VoiceboxDir -Command $voiceboxCommand -LogPath (Join-Path $Root 'voicebox-dev.log')
}

Write-Host ''
& (Join-Path $PSScriptRoot 'status-huobao.ps1')
Write-Host ''
Write-Host '접속 주소: http://127.0.0.1:3013'

if ($OpenBrowser) {
  Start-Process 'http://127.0.0.1:3013' | Out-Null
}
