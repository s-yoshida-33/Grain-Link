param(
    [string]$Version = ""
)

# Set UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Stop on error
$ErrorActionPreference = "Stop"

Write-Host "[*] Release file management script starting..." -ForegroundColor Cyan

# Setup directories - correctly get root directory
$rootDir = Split-Path -Parent $PSScriptRoot
$releaseDir = Join-Path $rootDir "release"
$bundleDir = Join-Path $rootDir "src-tauri\target\release\bundle"

# Get configuration info from tauri.conf.json
$tauriConfPath = Join-Path $rootDir "src-tauri\tauri.conf.json"
if (Test-Path $tauriConfPath) {
    $tauriConf = Get-Content $tauriConfPath -Raw | ConvertFrom-Json
    $version = $tauriConf.version
    $identifier = $tauriConf.identifier
    $publisher = $tauriConf.bundle.publisher
    $copyright = $tauriConf.bundle.copyright
    
    Write-Host "[*] Application identifier: $identifier" -ForegroundColor Cyan
    Write-Host "[*] Version: $version" -ForegroundColor Cyan
    Write-Host "[*] Publisher: $publisher" -ForegroundColor Cyan
    Write-Host "[*] Copyright: $copyright" -ForegroundColor Cyan
}

# Check if bundle directory exists
if (-not (Test-Path $bundleDir)) {
    Write-Host "[!] Error: Bundle directory not found: $bundleDir" -ForegroundColor Red
    exit 1
}

Write-Host "[*] Release directory: $releaseDir" -ForegroundColor Cyan
Write-Host "[*] Bundle directory: $bundleDir" -ForegroundColor Cyan

# Detect installer files
$setupExe = Get-ChildItem $bundleDir -Filter "*-setup.exe" -Recurse | Select-Object -First 1
$msiFile = Get-ChildItem $bundleDir -Filter "*.msi" -Recurse | Select-Object -First 1

if (-not $setupExe -and -not $msiFile) {
    Write-Host "[!] Error: No setup files found" -ForegroundColor Red
    exit 1
}

Write-Host "[+] Installer files detected" -ForegroundColor Green

# Create release directory
if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir | Out-Null
    Write-Host "[+] Release directory created" -ForegroundColor Green
}

# Copy setup files and signatures to release directory
if ($setupExe) {
    $setupName = Split-Path -Leaf $setupExe.FullName
    Write-Host "[*] Setup file: $setupName" -ForegroundColor Cyan
    
    # Copy setup file
    Copy-Item $setupExe.FullName -Destination $releaseDir -Force
    Write-Host "[+] $setupName copied" -ForegroundColor Green
    
    # Copy signature file
    $sigFile = "$($setupExe.FullName).sig"
    if (Test-Path $sigFile) {
        $sigName = Split-Path -Leaf $sigFile
        Copy-Item $sigFile -Destination $releaseDir -Force
        Write-Host "[+] $sigName copied" -ForegroundColor Green
    } else {
        Write-Host "[!] Signature file not found: $sigFile" -ForegroundColor Yellow
    }
}

if ($msiFile) {
    $msiName = Split-Path -Leaf $msiFile.FullName
    Write-Host "[*] MSI file: $msiName" -ForegroundColor Cyan
    
    # Copy MSI file
    Copy-Item $msiFile.FullName -Destination $releaseDir -Force
    Write-Host "[+] $msiName copied" -ForegroundColor Green
    
    # Copy MSI signature file
    $sigFile = "$($msiFile.FullName).sig"
    if (Test-Path $sigFile) {
        $sigName = Split-Path -Leaf $sigFile
        Copy-Item $sigFile -Destination $releaseDir -Force
        Write-Host "[+] $sigName copied" -ForegroundColor Green
    } else {
        Write-Host "[!] Signature file not found: $sigFile" -ForegroundColor Yellow
    }
}

# Check latest.yml (if not already copied by sign-and-build.ps1)
$latestYml = Join-Path $releaseDir "latest.yml"
if (-not (Test-Path $latestYml)) {
    Write-Host "[*] latest.yml not in release dir, searching in bundle..." -ForegroundColor Yellow
    
    $possibleLocations = @(
        (Join-Path $bundleDir "latest.yml"),
        (Join-Path $bundleDir "msi\latest.yml"),
        (Join-Path $bundleDir "nsis\latest.yml")
    )
    
    foreach ($location in $possibleLocations) {
        if (Test-Path $location) {
            Write-Host "[+] Found latest.yml at: $location" -ForegroundColor Green
            Copy-Item $location -Destination $releaseDir -Force
            Write-Host "[+] Copied to release directory" -ForegroundColor Green
            break
        }
    }
}

if (Test-Path $latestYml) {
    Write-Host "[*] latest.yml content:" -ForegroundColor Cyan
    Write-Host ("=" * 60)
    Get-Content $latestYml | Write-Host
    Write-Host ("=" * 60)
    
    # Check for signature info
    $ymlContent = Get-Content $latestYml -Raw
    if ($ymlContent -match "signature") {
        Write-Host "[+] Signature info found" -ForegroundColor Green
    } else {
        Write-Host "[!] Signature info not found" -ForegroundColor Yellow
    }
} else {
    Write-Host "[!] latest.yml not found" -ForegroundColor Yellow
}

# List release directory files
Write-Host ""
Write-Host "[*] Files in release directory:" -ForegroundColor Cyan
Get-ChildItem $releaseDir -File | ForEach-Object {
    $size = "{0:N0}" -f $_.Length
    Write-Host "  - $($_.Name) ($size bytes)" -ForegroundColor Green
}

Write-Host ""
Write-Host "[+] Release file management completed!" -ForegroundColor Green
Write-Host "[*] Release directory: $releaseDir" -ForegroundColor Green
