# Media compression and S3 upload script
# Usage: powershell -ExecutionPolicy Bypass -File .\build\compress-media.ps1 -MallId "sakaikitahanada" [-HostName "3-WMT-55-01"]
# Omit -HostName to compress and upload all host directories under the specified mall.
#
# Source layout  : medias/videos/{mallId}/{hostName}/optimized/  (fallback: medias/videos/{mallId}/{hostName}/)
# Release output : release/{mallId}/{hostName}/video-{timestamp}.zip + latest.json
# S3 path        : s3://tti-distribution/public/grain-link/medias/videos/{mallId}/{hostName}/

param(
    [string]$MallId = "",
    [string]$HostName = "",
    [string]$CloudFrontDistributionId = ""
)

# Set console code page to UTF-8
chcp 65001 | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot

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

# Resolve target host directories
$mallVideosPath = Join-Path $rootDir "medias\videos\$MallId"
if (-not (Test-Path $mallVideosPath)) {
    Write-Host "Error: Mall directory not found: $mallVideosPath" -ForegroundColor Red
    exit 1
}

if (-not [string]::IsNullOrWhiteSpace($HostName)) {
    $hostPath = Join-Path $mallVideosPath $HostName
    if (-not (Test-Path $hostPath)) {
        Write-Host "Error: Host directory not found: $hostPath" -ForegroundColor Red
        exit 1
    }
    $hostDirs = @(Get-Item $hostPath)
} else {
    $hostDirs = Get-ChildItem -Path $mallVideosPath -Directory | Where-Object { -not $_.Name.StartsWith('.') }
}

if ($hostDirs.Count -eq 0) {
    Write-Host "Error: No host directories found under: $mallVideosPath" -ForegroundColor Red
    exit 1
}

Write-Host "`nCompressing media for mall: $MallId" -ForegroundColor Cyan
Write-Host "Hosts : $($hostDirs.Name -join ', ')`n" -ForegroundColor Gray

$today = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"

# ---------------------------------------------------------------------------
# Process a single host directory
# ---------------------------------------------------------------------------
function Compress-Host {
    param([System.IO.DirectoryInfo]$HostDir)

    $hn    = $HostDir.Name
    $label = "$MallId/$hn"

    Write-Host "[$label] Processing..." -ForegroundColor Cyan

    $sourceDir   = Join-Path $HostDir.FullName "optimized"
    $fallbackDir = $HostDir.FullName
    $outputDir   = Join-Path $rootDir "release\$MallId\$hn"
    $zipFileName = "video-$today.zip"
    $zipPath     = Join-Path $outputDir $zipFileName
    $versionPath = Join-Path $outputDir "latest.json"
    $s3Base      = "s3://tti-distribution/public/grain-link/medias/videos/$MallId/$hn"

    # Select source: optimized/ if it has video files, otherwise fallback
    if ((Test-Path $sourceDir) -and (Get-ChildItem -Path $sourceDir -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -match '\.(mp4|webm|mov)$' }).Count -gt 0) {
        Write-Host "  Using optimized videos from: $sourceDir" -ForegroundColor Green
    } elseif (Test-Path $fallbackDir) {
        Write-Host "  Optimized directory not found or empty, falling back to: $fallbackDir" -ForegroundColor Yellow
        $sourceDir = $fallbackDir
    } else {
        Write-Host "  Error: Source directory not found: $fallbackDir" -ForegroundColor Red
        return
    }

    # Create output directory
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
        Write-Host "  Created output directory: $outputDir" -ForegroundColor Green
    }

    # Remove existing zip if present
    if (Test-Path $zipPath) {
        Write-Host "  Removing existing zip: $zipPath" -ForegroundColor Yellow
        Remove-Item $zipPath -Force
    }

    # Get video files
    $videoFiles = Get-ChildItem -Path $sourceDir -File | Where-Object { $_.Extension -match '\.(mp4|webm|mov)$' }
    if ($videoFiles.Count -eq 0) {
        Write-Host "  Error: No video files found in $sourceDir" -ForegroundColor Red
        return
    }

    Write-Host "  Found $($videoFiles.Count) video file(s):" -ForegroundColor Green
    $videoFiles | ForEach-Object { Write-Host "    - $($_.Name)" -ForegroundColor Gray }

    # Compress
    try {
        Write-Host "  Compressing to ZIP..." -ForegroundColor Cyan
        Compress-Archive -Path "$sourceDir\*" -DestinationPath $zipPath -Force

        $fileSizeMB = [Math]::Round((Get-Item $zipPath).Length / 1MB, 2)
        Write-Host "  Compressed: $zipFileName ($fileSizeMB MB)" -ForegroundColor Green
    } catch {
        Write-Host "  Error during compression: $_" -ForegroundColor Red
        return
    }

    # Generate latest.json
    $updatedAt   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $versionJson = @{ zip = $zipFileName; updated_at = $updatedAt } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($versionPath, $versionJson, [System.Text.Encoding]::UTF8)

    Write-Host "  Generated latest.json: zip=$zipFileName, updated_at=$updatedAt" -ForegroundColor Green
    Write-Host "  -> https://dl.tti.ninja/public/grain-link/medias/videos/$MallId/$hn/" -ForegroundColor Gray

    # Auto-upload via AWS CLI if available
    if (Get-Command aws -ErrorAction SilentlyContinue) {
        $archiveDir = Join-Path $outputDir "archive"
        Write-Host "  Checking for existing S3 ZIPs to archive..." -ForegroundColor Cyan

        if (-not (Test-Path $archiveDir)) {
            New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
        }

        aws s3 sync "$s3Base/" $archiveDir --exclude "latest.json" 2>&1 | Out-Null

        $archivedFiles = Get-ChildItem -Path $archiveDir -File -ErrorAction SilentlyContinue
        if ($archivedFiles.Count -gt 0) {
            Write-Host "  Archived $($archivedFiles.Count) existing ZIP(s) to: $archiveDir" -ForegroundColor Green
            $archivedFiles | ForEach-Object { Write-Host "    - $($_.Name)" -ForegroundColor Gray }

            Write-Host "  Cleaning up old ZIPs from S3..." -ForegroundColor Cyan
            aws s3 rm "$s3Base/" --recursive --exclude "latest.json"
            Write-Host "  S3 cleanup complete." -ForegroundColor Green
        } else {
            Write-Host "  No existing ZIPs on S3 (first upload)." -ForegroundColor Gray
            Remove-Item $archiveDir -Force -Recurse -ErrorAction SilentlyContinue
        }

        try {
            aws s3 cp $zipPath "$s3Base/$zipFileName" --content-type "application/zip"
            Write-Host "  Uploaded: $zipFileName" -ForegroundColor Green

            aws s3 cp $versionPath "$s3Base/latest.json" `
                --content-type "application/json" `
                --cache-control "no-cache, no-store"
            Write-Host "  Uploaded: latest.json (Cache-Control: no-cache)" -ForegroundColor Green
        } catch {
            Write-Host "  Upload failed: $_" -ForegroundColor Red
            Write-Host "  Please upload manually:" -ForegroundColor Yellow
            Write-Host "    aws s3 cp `"$zipPath`" `"$s3Base/$zipFileName`"" -ForegroundColor Gray
            Write-Host "    aws s3 cp `"$versionPath`" `"$s3Base/latest.json`" --cache-control no-cache,no-store" -ForegroundColor Gray
        }
    } else {
        Write-Host "  [INFO] AWS CLI not found. Please upload manually:" -ForegroundColor Yellow
        Write-Host "    aws s3 cp `"$zipPath`" `"$s3Base/$zipFileName`" --content-type application/zip" -ForegroundColor Gray
        Write-Host "    aws s3 cp `"$versionPath`" `"$s3Base/latest.json`" --content-type application/json --cache-control no-cache,no-store" -ForegroundColor Gray
    }

    Write-Host "[$label] Done`n" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Run for each resolved host
# ---------------------------------------------------------------------------
foreach ($hostDir in $hostDirs) {
    Compress-Host -HostDir $hostDir
}

Write-Host "=== All done! ===" -ForegroundColor Green
