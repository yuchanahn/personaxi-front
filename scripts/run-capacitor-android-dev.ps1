param(
    [string]$AvdName = "Pixel_8a_API_35",
    [string]$DevServerUrl = "http://10.0.2.2:5173",
    [string]$HostCheckUrl = "http://127.0.0.1:5173"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runScriptPath = Join-Path $PSScriptRoot "run-capacitor-android.ps1"

try {
    Invoke-WebRequest -Uri $HostCheckUrl -Method Head -TimeoutSec 5 | Out-Null
} catch {
    throw "Vite dev server is not reachable at $HostCheckUrl. Start 'pnpm dev' first."
}

$env:CAP_SERVER_URL = $DevServerUrl

try {
    & $runScriptPath -AvdName $AvdName
}
finally {
    Remove-Item Env:CAP_SERVER_URL -ErrorAction SilentlyContinue
}
