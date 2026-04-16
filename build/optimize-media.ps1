# build/optimize-media.ps1
# Local media video optimization script
# Optimizes .mp4 files in medias/videos/{mallId}/{hostName}/ using ffmpeg and saves to optimized/
#
# Usage: powershell -ExecutionPolicy Bypass -File .\build\optimize-media.ps1 [-MallId "sakaikitahanada"] [-HostName "3-WMT-55-01"]
# Omit -MallId / -HostName to process all malls / all hosts interactively.

param(
    [string]$MallId = "",
    [string]$HostName = ""
)

# Set console code page to UTF-8
chcp 65001 | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$mediasVideosRoot = Join-Path $rootDir "medias\videos"

if (-not (Test-Path $mediasVideosRoot)) {
    Write-Host "medias/videos directory not found: $mediasVideosRoot" -ForegroundColor Red
    exit 1
}

# Prompt for MallId if not specified (empty = all malls)
if ([string]::IsNullOrWhiteSpace($MallId)) {
    Write-Host "Mall ID (leave blank to process all, e.g. sakaikitahanada): " -NoNewline
    $MallId = Read-Host
}

# Prompt for HostName if not specified (empty = all hosts under the mall)
if ([string]::IsNullOrWhiteSpace($HostName)) {
    Write-Host "Host Name (leave blank to process all, e.g. 3-WMT-55-01): " -NoNewline
    $HostName = Read-Host
}

# Resolve target mall directories
if (-not [string]::IsNullOrWhiteSpace($MallId)) {
    $mallPath = Join-Path $mediasVideosRoot $MallId
    if (-not (Test-Path $mallPath)) {
        Write-Host "Mall directory not found: $mallPath" -ForegroundColor Red
        exit 1
    }
    $mallDirs = @(Get-Item $mallPath)
} else {
    $mallDirs = Get-ChildItem -Path $mediasVideosRoot -Directory | Where-Object { -not $_.Name.StartsWith('.') }
}

if ($mallDirs.Count -eq 0) {
    Write-Host "No mall directories found under medias/videos/." -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Local Media Video Optimization ===" -ForegroundColor Cyan

foreach ($mallDir in $mallDirs) {
    # Resolve target host directories under this mall
    if (-not [string]::IsNullOrWhiteSpace($HostName)) {
        $hostPath = Join-Path $mallDir.FullName $HostName
        if (-not (Test-Path $hostPath)) {
            Write-Host "[$($mallDir.Name)] Host directory not found: $hostPath - skipping" -ForegroundColor Yellow
            continue
        }
        $hostDirs = @(Get-Item $hostPath)
    } else {
        $hostDirs = Get-ChildItem -Path $mallDir.FullName -Directory | Where-Object { -not $_.Name.StartsWith('.') }
    }

    if ($hostDirs.Count -eq 0) {
        Write-Host "[$($mallDir.Name)] No host directories found - skipping" -ForegroundColor DarkGray
        continue
    }

    foreach ($hostDir in $hostDirs) {
        $videosDir = $hostDir.FullName
        $label = "$($mallDir.Name)/$($hostDir.Name)"

        $mp4Files = Get-ChildItem -Path $videosDir -Filter *.mp4 -File -ErrorAction SilentlyContinue
        if ($mp4Files.Count -eq 0) {
            Write-Host "[$label] No .mp4 files found - skipping" -ForegroundColor DarkGray
            continue
        }

        $optimizedDir = Join-Path $videosDir "optimized"
        if (-not (Test-Path $optimizedDir)) {
            New-Item -ItemType Directory -Path $optimizedDir | Out-Null
        }

        Write-Host "[$label] Optimizing $($mp4Files.Count) video(s)..." -ForegroundColor Cyan

        Push-Location $videosDir
        try {
            foreach ($file in $mp4Files) {
                Write-Host "  Converting $($file.Name)..." -ForegroundColor Yellow
                $outputPath = Join-Path "optimized" $file.Name
                ffmpeg -i $file.FullName -c:v libx264 -b:v 3000k -maxrate 3000k -bufsize 6000k -profile:v main -c:a aac -b:a 128k $outputPath -y
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "  Failed to convert $($file.Name)" -ForegroundColor Red
                }
            }
        }
        finally {
            Pop-Location
        }

        Write-Host "[$label] Done`n" -ForegroundColor Green
    }
}

Write-Host "=== Optimization complete! ===" -ForegroundColor Green
