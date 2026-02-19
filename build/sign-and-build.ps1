# Tauri signed build script
# Usage: powershell -ExecutionPolicy Bypass -File .\build\sign-and-build.ps1

param(
    [SecureString]$Password = $null
)

# Set UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Stop on error
$ErrorActionPreference = "Stop"

# Import security module if available (for local development)
try {
    Import-Module Microsoft.PowerShell.Security -ErrorAction SilentlyContinue
} catch {
    Write-Host "[*] Could not load security module - continuing anyway" -ForegroundColor Yellow
}

Write-Host "[*] Starting Tauri signed build..." -ForegroundColor Cyan

# Get root directory and paths correctly
$rootDir = Split-Path -Parent $PSScriptRoot
Write-Host "[*] Root directory: $rootDir" -ForegroundColor Cyan

# Check for signing key file
$keyPaths = @(
    (Join-Path $PSScriptRoot "..\~\TAURI_KEY_PASSWORD.sh"),
    (Join-Path $env:USERPROFILE "TAURI_KEY_PASSWORD.sh"),
    (Join-Path $env:USERPROFILE ".ssh\TAURI_KEY_PASSWORD.sh")
)

$keyPath = $null
foreach ($path in $keyPaths) {
    if (Test-Path $path) {
        $keyPath = $path
        break
    }
}

if (-not $keyPath) {
    Write-Host "[!] Error: Private key not found" -ForegroundColor Red
    exit 1
}

Write-Host "[+] Found private key: $keyPath" -ForegroundColor Green

# Get password
if (-not $Password) {
    # Check for password from GitHub Actions environment variables
    $userPassword = [Environment]::GetEnvironmentVariable('TAURI_SIGNING_PRIVATE_KEY_PASSWORD')
    
    # Fallback to user-level environment variable
    if (-not $userPassword) {
        $userPassword = [Environment]::GetEnvironmentVariable('TAURI_SIGNING_PASSWORD_OVERRIDE', 'User')
    }
    
    if ($userPassword) {
        # Use password directly from environment variable
        # (GitHub Actions provides it as plain text in secure env var)
        $plainPassword = $userPassword
        Write-Host "[+] Using password from environment variable" -ForegroundColor Green
    } else {
        Write-Host "[?] Enter private key password:" -ForegroundColor Yellow
        $securePassword = Read-Host -AsSecureString
        
        # Convert SecureString to plain text for Tauri
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

# Set environment variables
$keyContent = Get-Content $keyPath -Raw
$env:TAURI_SIGNING_PRIVATE_KEY = $keyContent
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $plainPassword

# Clear sensitive data from memory
$plainPassword = $null

Write-Host "[+] Environment variables set" -ForegroundColor Green

# Aggressive cleanup
Write-Host "[*] Aggressive cleanup of previous build artifacts..." -ForegroundColor Cyan

Get-Process rustc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process cargo -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Milliseconds 2000

$releaseTargetDir = Join-Path $rootDir "src-tauri\target\release"
if (Test-Path $releaseTargetDir) {
    Write-Host "[*] Removing entire release target directory..." -ForegroundColor Yellow
    $ErrorActionPreference = "SilentlyContinue"
    Remove-Item $releaseTargetDir -Recurse -Force
    $ErrorActionPreference = "Stop"
    Start-Sleep -Milliseconds 3000
}

$srcTauriDir = Join-Path $rootDir "src-tauri"
Push-Location $srcTauriDir
$ErrorActionPreference = "SilentlyContinue"
cargo clean
$ErrorActionPreference = "Stop"
Pop-Location
Start-Sleep -Milliseconds 3000

# Run build
Write-Host "[*] Starting build..." -ForegroundColor Cyan
npm run tauri:build

if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "[+] Build completed successfully!" -ForegroundColor Green

# Setup directories
$releaseDir = Join-Path $rootDir "release"
$bundleDir = Join-Path $rootDir "src-tauri\target\release\bundle"

# Get version from tauri.conf.json early
$tauriConfPath = Join-Path $rootDir "src-tauri\tauri.conf.json"
$tauriConf = Get-Content $tauriConfPath -Raw | ConvertFrom-Json
$version = $tauriConf.version
$identifier = $tauriConf.identifier
$publisher = $tauriConf.bundle.publisher
$copyright = $tauriConf.bundle.copyright

Write-Host "[*] Application identifier: $identifier" -ForegroundColor Cyan
Write-Host "[*] Version: $version" -ForegroundColor Cyan
Write-Host "[*] Publisher: $publisher" -ForegroundColor Cyan
Write-Host "[*] Copyright: $copyright" -ForegroundColor Cyan

# Create release directory if not exists
if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir | Out-Null
}

# Find installer files
$exeFile = $null
$msiFile = $null

if (Test-Path $bundleDir) {
    $exeFile = Get-ChildItem $bundleDir -Filter "*-setup.exe" -Recurse | Select-Object -First 1
    $msiFile = Get-ChildItem $bundleDir -Filter "*.msi" -Recurse | Select-Object -First 1
}

# Generate signatures
Write-Host "[*] Generating signature files..." -ForegroundColor Cyan

# Define renamed file names early
$exeNewName = "GrainLinkSetup-x64-$version.exe"
$msiNewName = "GrainLinkSetup-x64-$version-en-US.msi"

if ($exeFile) {
    Write-Host "[*] Processing EXE: $($exeFile.FullName)" -ForegroundColor Cyan
    $sigFile = "$($exeFile.FullName).sig"
    
    # Sign with Tauri CLI
    npx @tauri-apps/cli signer sign "$($exeFile.FullName)" 2>&1 | Out-Null
    
    if (Test-Path $sigFile) {
        Write-Host "[+] EXE signature created" -ForegroundColor Green
        # Copy and rename signature to match new installer name
        $exeNewSigName = "$exeNewName.sig"
        $exeNewSigPath = Join-Path $releaseDir $exeNewSigName
        Copy-Item $sigFile -Destination $exeNewSigPath -Force
    } else {
        Write-Host "[!] Warning: EXE signature not created" -ForegroundColor Yellow
    }
}

if ($msiFile) {
    Write-Host "[*] Processing MSI: $($msiFile.FullName)" -ForegroundColor Cyan
    $sigFile = "$($msiFile.FullName).sig"
    
    # Sign with Tauri CLI
    npx @tauri-apps/cli signer sign "$($msiFile.FullName)" 2>&1 | Out-Null
    
    if (Test-Path $sigFile) {
        Write-Host "[+] MSI signature created" -ForegroundColor Green
        # Copy and rename signature to match new installer name
        $msiNewSigName = "$msiNewName.sig"
        $msiNewSigPath = Join-Path $releaseDir $msiNewSigName
        Copy-Item $sigFile -Destination $msiNewSigPath -Force
    } else {
        Write-Host "[!] Warning: MSI signature not created" -ForegroundColor Yellow
    }
}

# Copy installer files to release with new names
if ($exeFile) {
    $exeNewPath = Join-Path $releaseDir $exeNewName
    Copy-Item $exeFile.FullName -Destination $exeNewPath -Force
    Write-Host "[+] EXE file copied and renamed to: $exeNewName" -ForegroundColor Green
}

if ($msiFile) {
    $msiNewPath = Join-Path $releaseDir $msiNewName
    Copy-Item $msiFile.FullName -Destination $msiNewPath -Force
    Write-Host "[+] MSI file copied and renamed to: $msiNewName" -ForegroundColor Green
}

# --- REMOVED: latest.yml generation logic was here ---

# Clean up old unrenamed files from previous builds
Write-Host "[*] Cleaning up old unrenamed installer files from previous builds..." -ForegroundColor Yellow

# Remove all non-standardized setup files (not starting with GrainLinkSetup)
Get-ChildItem -Path "$releaseDir\*.exe" -ErrorAction SilentlyContinue | Where-Object {
    -not ($_.Name -like "GrainLinkSetup-*")
} | ForEach-Object {
    Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
    Write-Host "[+] Removed: $($_.Name)" -ForegroundColor Green
}

# Remove all non-standardized MSI files
Get-ChildItem -Path "$releaseDir\*.msi" -ErrorAction SilentlyContinue | Where-Object {
    -not ($_.Name -like "GrainLinkSetup-*")
} | ForEach-Object {
    Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
    Write-Host "[+] Removed: $($_.Name)" -ForegroundColor Green
}

# Remove orphaned signature files for non-standardized installers
Get-ChildItem -Path "$releaseDir\*.sig" -ErrorAction SilentlyContinue | ForEach-Object {
    $baseName = $_.BaseName
    $exe = Get-ChildItem -Path "$releaseDir\$baseName" -ErrorAction SilentlyContinue
    if (-not $exe) {
        Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
        Write-Host "[+] Removed orphaned signature: $($_.Name)" -ForegroundColor Green
    }
}

Write-Host "[+] Final release directory contents:" -ForegroundColor Green
Get-ChildItem -Path $releaseDir -File | ForEach-Object { Write-Host "  $($_.Name) ($([math]::Round($_.Length / 1MB, 2)) MB)" -ForegroundColor Green }

Write-Host "[+] Signed build completed successfully!" -ForegroundColor Green
Write-Host "[*] Release files: $releaseDir" -ForegroundColor Green