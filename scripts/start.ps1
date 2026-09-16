$ErrorActionPreference = "Stop"

function Invoke-Docker {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    & docker @Args
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed: docker $($Args -join ' ')"
    }
}

$imageName = "pm-mvp:local"
$containerName = "pm-mvp"
$port = if ($env:PM_MVP_PORT) { [int]$env:PM_MVP_PORT } else { 8000 }
$repoRoot = Split-Path -Parent $PSScriptRoot
$envFilePath = Join-Path $repoRoot ".env"

Write-Host "Building Docker image $imageName..."
Invoke-Docker -Args @("build", "-t", $imageName, ".")

$existing = (& docker ps -a --format "{{.Names}}") | Where-Object { $_ -eq $containerName }
if ($LASTEXITCODE -ne 0) {
    throw "Docker command failed: docker ps -a --format {{.Names}}"
}
if ($existing) {
    Write-Host "Removing existing container $containerName..."
    Invoke-Docker -Args @("rm", "-f", $containerName)
}

Write-Host "Starting container $containerName on http://localhost:$port..."
$runArgs = @("run", "-d", "--name", $containerName, "-p", "${port}:8000")

if (Test-Path $envFilePath) {
    $runArgs += @("--env-file", $envFilePath)
} else {
    Write-Host "Warning: .env file not found at $envFilePath. OPENROUTER_API_KEY will be unavailable unless provided by other environment settings."
}

$runArgs += $imageName
Invoke-Docker -Args $runArgs

Write-Host "Done."
Write-Host "- App:    http://localhost:$port/"
Write-Host "- Health: http://localhost:$port/api/health"
