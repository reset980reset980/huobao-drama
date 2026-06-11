$ErrorActionPreference = 'Stop'

$ports = @(
  @{ Name = '프론트엔드'; Port = 3013 },
  @{ Name = '백엔드'; Port = 5679 },
  @{ Name = 'Voicebox'; Port = 17493 }
)

foreach ($entry in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $entry.Port -State Listen -ErrorAction SilentlyContinue
  if (!$connections) {
    Write-Host "$($entry.Name): 실행 중인 포트를 찾지 못했습니다."
    continue
  }
  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    try {
      $process = Get-Process -Id $processId -ErrorAction Stop
      Stop-Process -Id $processId -Force
      Write-Host "$($entry.Name): 종료됨 (PID $processId, $($process.ProcessName))"
    } catch {
      Write-Host "$($entry.Name): PID $processId 종료 실패"
    }
  }
}
