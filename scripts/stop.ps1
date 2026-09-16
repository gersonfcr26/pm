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

$containerName = "pm-mvp"
$existing = (& docker ps -a --format "{{.Names}}") | Where-Object { $_ -eq $containerName }
if ($LASTEXITCODE -ne 0) {
    throw "Docker command failed: docker ps -a --format {{.Names}}"
}

if ($existing) {
    Write-Host "Stopping and removing $containerName..."
    Invoke-Docker -Args @("rm", "-f", $containerName)
    Write-Host "Done."
} else {
    Write-Host "Container $containerName is not present."
}
