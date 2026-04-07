param(
    [string]$SourcePath = "..\\static\\web-app-manifest-512x512.png",
    [double]$LauncherScale = 0.84,
    [double]$ForegroundScale = 0.76
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Resolve-InputPath {
    param([string]$PathValue)

    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $PathValue))
}

function Save-InsetPng {
    param(
        [System.Drawing.Image]$SourceImage,
        [string]$DestinationPath,
        [int]$CanvasSize,
        [double]$Scale,
        [bool]$TransparentBackground
    )

    $bitmap = New-Object System.Drawing.Bitmap($CanvasSize, $CanvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

        if ($TransparentBackground) {
            $graphics.Clear([System.Drawing.Color]::Transparent)
        }
        else {
            $graphics.Clear([System.Drawing.Color]::White)
        }

        $innerSize = [Math]::Round($CanvasSize * $Scale)
        $offset = [Math]::Floor(($CanvasSize - $innerSize) / 2)
        $destinationRect = New-Object System.Drawing.Rectangle($offset, $offset, $innerSize, $innerSize)

        $graphics.DrawImage($SourceImage, $destinationRect)
        $bitmap.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

if ($LauncherScale -le 0 -or $LauncherScale -gt 1) {
    throw "LauncherScale must be between 0 and 1."
}

if ($ForegroundScale -le 0 -or $ForegroundScale -gt 1) {
    throw "ForegroundScale must be between 0 and 1."
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceFullPath = Resolve-InputPath -PathValue $SourcePath
$resRoot = Join-Path $projectRoot "android\\app\\src\\main\\res"

if (-not (Test-Path $sourceFullPath)) {
    throw "Source icon not found at $sourceFullPath"
}

$targets = @(
    @{ Directory = "mipmap-mdpi"; LegacySize = 48; ForegroundSize = 108 },
    @{ Directory = "mipmap-hdpi"; LegacySize = 72; ForegroundSize = 162 },
    @{ Directory = "mipmap-xhdpi"; LegacySize = 96; ForegroundSize = 216 },
    @{ Directory = "mipmap-xxhdpi"; LegacySize = 144; ForegroundSize = 324 },
    @{ Directory = "mipmap-xxxhdpi"; LegacySize = 192; ForegroundSize = 432 }
)

$sourceImage = [System.Drawing.Image]::FromFile($sourceFullPath)

try {
    foreach ($target in $targets) {
        $targetDir = Join-Path $resRoot $target.Directory
        if (-not (Test-Path $targetDir)) {
            throw "Resource directory not found: $targetDir"
        }

        Save-InsetPng -SourceImage $sourceImage -DestinationPath (Join-Path $targetDir "ic_launcher.png") -CanvasSize $target.LegacySize -Scale $LauncherScale -TransparentBackground:$false
        Save-InsetPng -SourceImage $sourceImage -DestinationPath (Join-Path $targetDir "ic_launcher_round.png") -CanvasSize $target.LegacySize -Scale $LauncherScale -TransparentBackground:$false
        Save-InsetPng -SourceImage $sourceImage -DestinationPath (Join-Path $targetDir "ic_launcher_foreground.png") -CanvasSize $target.ForegroundSize -Scale $ForegroundScale -TransparentBackground:$true
    }
}
finally {
    $sourceImage.Dispose()
}

Write-Output "Updated Android launcher icons from $sourceFullPath"
Write-Output "Launcher scale: $LauncherScale"
Write-Output "Foreground scale: $ForegroundScale"
