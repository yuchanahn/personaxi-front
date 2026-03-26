param(
    [string]$AvdName = "Pixel_8a_API_35",
    [int]$BootTimeoutSeconds = 180
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-AndroidSdkRoot {
    if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
        return $env:ANDROID_SDK_ROOT
    }

    $defaultSdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $defaultSdkRoot) {
        return $defaultSdkRoot
    }

    throw "Android SDK not found. Set ANDROID_SDK_ROOT first."
}

function Get-RunningEmulatorSerial {
    param([string]$AdbPath)

    $match = (& $AdbPath devices) |
        Select-String '^emulator-\d+\s+device' |
        Select-Object -First 1

    if ($null -eq $match) {
        return $null
    }

    return ($match.ToString() -split '\s+')[0]
}

$sdkRoot = Get-AndroidSdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot

$adbPath = Join-Path $sdkRoot "platform-tools\adb.exe"
$emulatorPath = Join-Path $sdkRoot "emulator\emulator.exe"

if (-not (Test-Path $adbPath)) {
    throw "adb.exe not found at $adbPath"
}

if (-not (Test-Path $emulatorPath)) {
    throw "emulator.exe not found at $emulatorPath"
}

$runningSerial = Get-RunningEmulatorSerial -AdbPath $adbPath
if ($runningSerial) {
    Write-Output "Emulator already running: $runningSerial"
    exit 0
}

$availableAvds = & $emulatorPath -list-avds
if ($availableAvds -notcontains $AvdName) {
    throw "AVD '$AvdName' not found. Available AVDs: $($availableAvds -join ', ')"
}

$process = Start-Process -FilePath $emulatorPath -ArgumentList @("-avd", $AvdName) -PassThru
Write-Output "Started emulator PID $($process.Id) for AVD $AvdName"

& $adbPath wait-for-device | Out-Null

$deadline = (Get-Date).AddSeconds($BootTimeoutSeconds)
$bootCompleted = $false

while ((Get-Date) -lt $deadline) {
    $bootState = (& $adbPath shell getprop sys.boot_completed 2>$null).Trim()
    if ($bootState -eq "1") {
        $bootCompleted = $true
        break
    }

    Start-Sleep -Seconds 2
}

if (-not $bootCompleted) {
    throw "Emulator boot timed out after $BootTimeoutSeconds seconds."
}

$runningSerial = Get-RunningEmulatorSerial -AdbPath $adbPath
if (-not $runningSerial) {
    throw "Emulator booted but no adb device was detected."
}

Write-Output "Emulator ready: $runningSerial"
