# Media compression script
# Usage: powershell -ExecutionPolicy Bypass -File .\build\compress-media.ps1 -MallId "sakaikitahanada" -CloudFrontDistributionId "EXXXXXXXXXX"

param(
    [string]$MallId = "",
    [string]$CloudFrontDistributionId = ""
)

# UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Stop on error
$ErrorActionPreference = "Stop"

# Require MallId
if ([string]::IsNullOrWhiteSpace($MallId)) {
    $MallId = Read-Host "モールIDを入力してください (例: sakaikitahanada)"
    if ([string]::IsNullOrWhiteSpace($MallId)) {
        Write-Host "Error: モールIDが入力されていません。" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Compressing media for mall: $MallId" -ForegroundColor Cyan

# Source paths
$sourceDir = Join-Path $PSScriptRoot "..\tmp\$MallId\assets\videos\optimized"
$fallbackDir = Join-Path $PSScriptRoot "..\tmp\$MallId\assets\videos"

# Output paths: release/{mallId}/video-{yyyy-MM-dd}.zip
$today = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
$zipFileName = "video-$today.zip"
$outputDir = Join-Path $PSScriptRoot "..\release\$MallId"
$zipPath = Join-Path $outputDir $zipFileName
$versionPath = Join-Path $outputDir "latest.json"

# Use optimized/ if it exists and has files, otherwise fall back to raw videos
if ((Test-Path $sourceDir) -and (Get-ChildItem -Path $sourceDir -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -match '\.(mp4|webm|mov)$' }).Count -gt 0) {
    Write-Host "Using optimized videos from: $sourceDir" -ForegroundColor Green
} elseif (Test-Path $fallbackDir) {
    Write-Host "Optimized directory not found or empty, falling back to: $fallbackDir" -ForegroundColor Yellow
    $sourceDir = $fallbackDir
} else {
    Write-Host "Error: Source directory not found: $fallbackDir" -ForegroundColor Red
    exit 1
}

# Create output directory if it doesn't exist
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    Write-Host "Created output directory: $outputDir" -ForegroundColor Green
}

# Remove existing zip if present
if (Test-Path $zipPath) {
    Write-Host "Removing existing zip file: $zipPath" -ForegroundColor Yellow
    Remove-Item $zipPath -Force
}

# Get video files
$videoFiles = Get-ChildItem -Path $sourceDir -File | Where-Object { $_.Extension -match '\.(mp4|webm|mov)$' }

if ($videoFiles.Count -eq 0) {
    Write-Host "Error: No video files found in $sourceDir" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($videoFiles.Count) video file(s)" -ForegroundColor Green
$videoFiles | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Gray }

# Compress to zip
try {
    Write-Host "Compressing to ZIP file..." -ForegroundColor Cyan
    Compress-Archive -Path "$sourceDir\*" -DestinationPath $zipPath -Force

    $fileSize = (Get-Item $zipPath).Length
    $fileSizeMB = [Math]::Round($fileSize / 1MB, 2)

    Write-Host "Compression completed successfully!" -ForegroundColor Green
    Write-Host "Output file: $zipPath" -ForegroundColor Green
    Write-Host "File size: $fileSizeMB MB" -ForegroundColor Green
} catch {
    Write-Host "Error during compression: $_" -ForegroundColor Red
    exit 1
}

# Generate version.json
$updatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$versionJson = @{
    zip        = $zipFileName
    updated_at = $updatedAt
} | ConvertTo-Json -Compress

[System.IO.File]::WriteAllText($versionPath, $versionJson, [System.Text.Encoding]::UTF8)

Write-Host "Generated latest.json: $versionPath" -ForegroundColor Green
Write-Host "  zip        : $zipFileName" -ForegroundColor Gray
Write-Host "  updated_at : $updatedAt" -ForegroundColor Gray

Write-Host "`nDone! Upload the following files to S3:" -ForegroundColor Cyan
Write-Host "  $zipPath" -ForegroundColor White
Write-Host "  $versionPath" -ForegroundColor White
Write-Host "  -> https://dl.tti.ninja/public/grain-link/medias/videos/$MallId/" -ForegroundColor Gray

# Auto-upload via AWS CLI if available
$s3Base = "s3://tti-distribution/public/grain-link/medias/videos/$MallId"

if (Get-Command aws -ErrorAction SilentlyContinue) {
    Write-Host "`nAWS CLI detected. Uploading to S3..." -ForegroundColor Cyan

    try {
        # Upload ZIP (with cache allowed)
        aws s3 cp $zipPath "$s3Base/$zipFileName" --content-type "application/zip"
        Write-Host "Uploaded: $zipFileName" -ForegroundColor Green

        # Upload latest.json with no-cache to prevent CDN from serving stale data
        aws s3 cp $versionPath "$s3Base/latest.json" `
            --content-type "application/json" `
            --cache-control "no-cache, no-store"
        Write-Host "Uploaded: latest.json (Cache-Control: no-cache)" -ForegroundColor Green

        # CloudFront Invalidation (コメントアウト中: s3-uploaderユーザーに cloudfront:CreateInvalidation 権限が付与されるまで無効)
        # latest.json はパスが変わったため既存キャッシュの影響を受けないので、現時点では不要
        # 権限付与後に有効化する場合は以下のコメントを外す:
        # $invalidationPath = "/public/grain-link/medias/videos/$MallId/latest.json"
        # Write-Host "Creating CloudFront invalidation..." -ForegroundColor Cyan
        # aws cloudfront create-invalidation `
        #     --distribution-id $CloudFrontDistributionId `
        #     --paths $invalidationPath
        # if ($LASTEXITCODE -ne 0) {
        #     throw "CloudFront invalidation failed (exit code: $LASTEXITCODE)"
        # }
        # Write-Host "CloudFront invalidation created: $invalidationPath" -ForegroundColor Green

        Write-Host "`nUpload complete!" -ForegroundColor Green
    } catch {
        Write-Host "Upload failed: $_" -ForegroundColor Red
        Write-Host "Please upload manually using the paths above." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[INFO] AWS CLI not found. Please upload manually." -ForegroundColor Yellow
    Write-Host "IMPORTANT: Upload version.json with Cache-Control: no-cache, no-store" -ForegroundColor Yellow
    Write-Host "  aws s3 cp `"$versionPath`" `"$s3Base/version.json`" --cache-control `"no-cache, no-store`"" -ForegroundColor Gray
}
