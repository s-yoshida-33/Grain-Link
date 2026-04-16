# build/optimize-media.ps1
# Local media video optimization script
# Optimizes .mp4 files in medias/videos/{mallId}/{hostName}/ using ffmpeg and saves to optimized/
#
# Usage: powershell -ExecutionPolicy Bypass -File .\build\optimize-media.ps1 -MallId "sakaikitahanada" [-HostName "3-WMT-55-01"]
# Omit -HostName to process all host directories under the specified mall.

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

# Require MallId
if ([string]::IsNullOrWhiteSpace($MallId)) {
    Write-Host "Mall ID (e.g. sakaikitahanada): " -NoNewline
    $MallId = Read-Host
    if ([string]::IsNullOrWhiteSpace($MallId)) {
        Write-Host "Error: Mall ID is required." -ForegroundColor Red
        exit 1
    }
}

# HostName is optional — prompt but allow blank to process all hosts
if ([string]::IsNullOrWhiteSpace($HostName)) {
    Write-Host "Host Name (leave blank to process all hosts, e.g. 3-WMT-55-01): " -NoNewline
    $HostName = Read-Host
}

# Resolve mall directory
$mallPath = Join-Path $mediasVideosRoot $MallId
if (-not (Test-Path $mallPath)) {
    Write-Host "Mall directory not found: $mallPath" -ForegroundColor Red
    exit 1
}

# Resolve target host directories
if (-not [string]::IsNullOrWhiteSpace($HostName)) {
    $hostPath = Join-Path $mallPath $HostName
    if (-not (Test-Path $hostPath)) {
        Write-Host "Host directory not found: $hostPath" -ForegroundColor Red
        exit 1
    }
    $hostDirs = @(Get-Item $hostPath)
} else {
    $hostDirs = Get-ChildItem -Path $mallPath -Directory | Where-Object { -not $_.Name.StartsWith('.') }
}

if ($hostDirs.Count -eq 0) {
    Write-Host "No host directories found under: $mallPath" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Local Media Video Optimization ===" -ForegroundColor Cyan
Write-Host "Mall  : $MallId" -ForegroundColor Gray
Write-Host "Hosts : $($hostDirs.Name -join ', ')`n" -ForegroundColor Gray

foreach ($hostDir in $hostDirs) {
    $videosDir = $hostDir.FullName
    $label = "$MallId/$($hostDir.Name)"

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

Write-Host "=== Optimization complete! ===" -ForegroundColor Green
