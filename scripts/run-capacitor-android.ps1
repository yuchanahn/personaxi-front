param(
    [string]$AvdName = "Pixel_8a_API_35",
    [string]$AppId = "com.personaxi.app",
    [string]$ActivityName = ".MainActivity"
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

$projectRoot = Split-Path -Parent $PSScriptRoot
$sdkRoot = Get-AndroidSdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot

$adbPath = Join-Path $sdkRoot "platform-tools\adb.exe"
$gradleWrapperPath = Join-Path $projectRoot "android\gradlew.bat"
$apkPath = Join-Path $projectRoot "android\app\build\outputs\apk\debug\app-debug.apk"
$startScriptPath = Join-Path $PSScriptRoot "start-android-emulator.ps1"
$externalServerUrl = $env:CAP_SERVER_URL

if (-not (Test-Path $adbPath)) {
    throw "adb.exe not found at $adbPath"
}

if (-not (Test-Path $gradleWrapperPath)) {
    throw "Gradle wrapper not found at $gradleWrapperPath"
}

$serial = Get-RunningEmulatorSerial -AdbPath $adbPath
if (-not $serial) {
    & $startScriptPath -AvdName $AvdName
    $serial = Get-RunningEmulatorSerial -AdbPath $adbPath
}

if (-not $serial) {
    throw "No running emulator detected."
}

Push-Location $projectRoot
try {
    if ([string]::IsNullOrWhiteSpace($externalServerUrl)) {
        pnpm build:android
    } else {
        Write-Output "Using external server: $externalServerUrl"
    }

    npx cap sync android

    Push-Location (Join-Path $projectRoot "android")
    try {
        & $gradleWrapperPath assembleDebug
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path $apkPath)) {
    throw "Debug APK not found at $apkPath"
}

& $adbPath -s $serial install -r $apkPath
& $adbPath -s $serial shell am start -n "$AppId/$ActivityName" | Out-Null

Write-Output "Installed and launched $AppId on $serial"
Write-Output "APK: $apkPath"
