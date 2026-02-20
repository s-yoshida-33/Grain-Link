# Media compression script
# Usage: powershell -ExecutionPolicy Bypass -File .\build\compress-media.ps1 -MallId "sakaikitahanada"

param(
    [string]$MallId = "sakaikitahanada"
)

# UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Stop on error
$ErrorActionPreference = "Stop"

Write-Host "Compressing media for mall: $MallId" -ForegroundColor Cyan

# Source and destination paths
$sourceDir = Join-Path $PSScriptRoot "..\tmp\$MallId\assets\videos"
$outputDir = Join-Path $PSScriptRoot "..\release"
$zipFileName = "$MallId-media.zip"
$zipPath = Join-Path $outputDir $zipFileName

# Verify source directory exists
if (-not (Test-Path $sourceDir)) {
    Write-Host "Error: Source directory not found: $sourceDir" -ForegroundColor Red
    exit 1
}

# Create output directory if it doesn't exist
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    Write-Host "Created output directory: $outputDir" -ForegroundColor Green
}

# Check if zip file already exists
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
    
    # Using Compress-Archive cmdlet (PowerShell 5.0+)
    Compress-Archive -Path "$sourceDir\*" -DestinationPath $zipPath -Force
    
    Write-Host "Compression completed successfully!" -ForegroundColor Green
    
    # Get file size
    $fileSize = (Get-Item $zipPath).Length
    $fileSizeMB = [Math]::Round($fileSize / 1MB, 2)
    
    Write-Host "Output file: $zipPath" -ForegroundColor Green
    Write-Host "File size: $fileSizeMB MB" -ForegroundColor Green
    
} catch {
    Write-Host "Error during compression: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Done!" -ForegroundColor Green
