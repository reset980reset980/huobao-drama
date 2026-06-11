$ErrorActionPreference = 'Stop'

$checks = @(
  @{ Name = '프론트엔드'; Port = 3013; Url = 'http://127.0.0.1:3013' },
  @{ Name = '백엔드'; Port = 5679; Url = 'http://127.0.0.1:5679/api/v1/health' },
  @{ Name = 'Voicebox'; Port = 17493; Url = 'http://127.0.0.1:17493/health' }
)

function Test-ListeningPort {
  param([int]$Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $connection
}

function Test-HttpEndpoint {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    return @{ Ok = $true; Status = [int]$response.StatusCode }
  } catch {
    return @{ Ok = $false; Status = $null }
  }
}

Write-Host '화보 드라마 로컬 실행 상태'
Write-Host '----------------------------'

foreach ($check in $checks) {
  $portOpen = Test-ListeningPort -Port $check.Port
  $http = Test-HttpEndpoint -Url $check.Url
  $state = if ($http.Ok) { '정상' } elseif ($portOpen) { '포트 열림' } else { '중지' }
  $statusCode = if ($http.Status) { " HTTP $($http.Status)" } else { '' }
  Write-Host ("{0,-12} : {1} (포트 {2}){3}" -f $check.Name, $state, $check.Port, $statusCode)
}

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
$ffprobe = Get-Command ffprobe -ErrorAction SilentlyContinue
Write-Host ("{0,-12} : {1}" -f 'FFmpeg', $(if ($ffmpeg) { '사용 가능' } else { 'PATH에서 찾을 수 없음' }))
Write-Host ("{0,-12} : {1}" -f 'FFprobe', $(if ($ffprobe) { '사용 가능' } else { 'PATH에서 찾을 수 없음' }))

try {
  $system = Invoke-RestMethod -Uri 'http://127.0.0.1:5679/api/v1/system/status' -TimeoutSec 4
  if ($system.data.services.flowBridge.ok) {
    Write-Host ("{0,-12} : {1}" -f 'Flow 연결', '토큰 수신됨')
  } else {
    Write-Host ("{0,-12} : {1}" -f 'Flow 연결', '토큰 대기 중')
  }
} catch {
  Write-Host ("{0,-12} : {1}" -f 'Flow 연결', '백엔드 상태 API 확인 불가')
}
