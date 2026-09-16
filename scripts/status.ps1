$ErrorActionPreference = "Stop"

$containerName = "pm-mvp"
$port = if ($env:PM_MVP_PORT) { [int]$env:PM_MVP_PORT } else { 8000 }
$healthUrl = "http://localhost:$port/api/health"

$runningOutput = & docker ps --format "{{.Names}}"
if ($LASTEXITCODE -ne 0) {
    throw "Docker command failed: docker ps --format {{.Names}}"
}

$running = $runningOutput | Where-Object { $_ -eq $containerName }
if ($running) {
    Write-Host "Container $containerName is running."
} else {
    Write-Host "Container $containerName is not running."
}

Write-Host "Health endpoint: $healthUrl"
if ($running) {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 5
        $response | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "Health check request failed."
    }
}
