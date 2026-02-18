param(
    [string]$Version = ""
)

# Output setting
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host "[*] Release file management script starting..." -ForegroundColor Cyan

# --- Directory Setup ---
$rootDir = Split-Path -Parent $PSScriptRoot
$releaseDir = Join-Path $rootDir "release"
$srcTauriDir = Join-Path $rootDir "src-tauri"
$tauriConfPath = Join-Path $srcTauriDir "tauri.conf.json"

# --- 1. Get Version ---
Write-Host "[*] Step 1: Reading tauri.conf.json..." -ForegroundColor Gray
if (Test-Path $tauriConfPath) {
    try {
        $tauriConfContent = [System.IO.File]::ReadAllText($tauriConfPath, [System.Text.Encoding]::UTF8)
        $tauriConf = $tauriConfContent | ConvertFrom-Json
        $version = $tauriConf.version
        Write-Host "[*] Detected Version: $version" -ForegroundColor Cyan
    } catch {
        Write-Host "[!] Error reading config: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[!] Error: tauri.conf.json not found." -ForegroundColor Red
    exit 1
}

# --- 2. Check Release Dir ---
Write-Host "[*] Step 2: Checking release directory..." -ForegroundColor Gray
if (-not (Test-Path $releaseDir)) {
    Write-Host "[!] Error: Release directory not found: $releaseDir" -ForegroundColor Red
    exit 1
}

# --- 3. Find Installer ---
Write-Host "[*] Step 3: Finding installer for version $version..." -ForegroundColor Gray
$targetExeName = "GrainLinkSetup-x64-${version}.exe"
$exeFile = Get-ChildItem $releaseDir -Filter $targetExeName | Select-Object -First 1

if (-not $exeFile) {
    Write-Host "[!] Error: Installer ($targetExeName) not found." -ForegroundColor Red
    Write-Host "[!] Files in release dir:" 
    Get-ChildItem $releaseDir | ForEach-Object { Write-Host "   - $($_.Name)" }
    exit 1
}
Write-Host "[+] Found Installer: $($exeFile.Name)" -ForegroundColor Green

# --- 4. Find Signature ---
Write-Host "[*] Step 4: Finding signature file..." -ForegroundColor Gray
$targetSigName = "${targetExeName}.sig"
$sigFile = Get-ChildItem $releaseDir -Filter $targetSigName | Select-Object -First 1

if (-not $sigFile) {
    # Fallback search
    Write-Host "[*] Specific signature not found, checking fallback patterns..." -ForegroundColor Yellow
    $sigFile = Get-ChildItem $releaseDir -Filter "*-setup.exe.sig" | Select-Object -First 1
}

if (-not $sigFile) {
    Write-Host "[!] Error: Signature file not found." -ForegroundColor Red
    exit 1
}
Write-Host "[+] Found Signature file: $($sigFile.Name)" -ForegroundColor Green

# --- 5. Read & Decode Signature (CRITICAL FIX) ---
Write-Host "[*] Step 5: Reading and processing signature content..." -ForegroundColor Gray
try {
    # Read the raw content from file
    $rawContent = [System.IO.File]::ReadAllText($sigFile.FullName, [System.Text.Encoding]::UTF8).Trim()
    
    if ([string]::IsNullOrWhiteSpace($rawContent)) {
        throw "Signature file is empty"
    }

    # Check if decoding is needed (Does it look like Base64 and NOT start with 'untrusted')
    if (-not ($rawContent -match "^untrusted comment:")) {
        Write-Host "[*] Signature appears to be Base64 encoded. Decoding..." -ForegroundColor Yellow
        try {
            $bytes = [System.Convert]::FromBase64String($rawContent)
            $signatureContent = [System.Text.Encoding]::UTF8.GetString($bytes)
            Write-Host "[+] Successfully decoded Base64 signature." -ForegroundColor Green
        } catch {
            Write-Host "[!] Warning: Base64 decode failed. Using raw content." -ForegroundColor Yellow
            $signatureContent = $rawContent
        }
    } else {
        Write-Host "[+] Signature is already plain text." -ForegroundColor Green
        $signatureContent = $rawContent
    }

} catch {
    Write-Host "[!] Error processing signature file: $_" -ForegroundColor Red
    exit 1
}

# --- 6. Create JSON Data ---
Write-Host "[*] Step 6: Constructing JSON data..." -ForegroundColor Gray
$pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$downloadUrl = "https://github.com/s-yoshida-33/Grain-Link/releases/download/v${version}/$($exeFile.Name)"

$jsonObj = @{
    version = $version
    notes = "Update for version ${version}"
    pub_date = $pubDate
    platforms = @{
        "windows-x86_64" = @{
            signature = $signatureContent
            url = $downloadUrl
        }
    }
}

# --- 7. Write latest.json ---
Write-Host "[*] Step 7: Saving latest.json..." -ForegroundColor Gray
try {
    $jsonContent = $jsonObj | ConvertTo-Json -Depth 10
    $jsonContent = $jsonContent -replace '    ', '  ' # Pretty print
    
    $latestJsonPath = Join-Path $releaseDir "latest.json"
    [System.IO.File]::WriteAllText($latestJsonPath, $jsonContent, [System.Text.UTF8Encoding]::new($false))
    
    Write-Host "[+] Successfully created latest.json" -ForegroundColor Green
    Write-Host "[*] Path: $latestJsonPath" -ForegroundColor Cyan
    
    # Preview checks
    if ($signatureContent -match "^untrusted comment:") {
        Write-Host "[OK] JSON signature format is correct (Plain text)." -ForegroundColor Green
    } else {
        Write-Host "[WARN] JSON signature might still be Base64. Check output." -ForegroundColor Yellow
    }

} catch {
    Write-Host "[!] Error writing JSON file: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[+] Release preparation completed!" -ForegroundColor Green