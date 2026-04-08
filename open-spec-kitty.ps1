# Projektroot = Ordner dieses Scripts
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

# Git init falls noch nicht vorhanden
if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
    git init
    git add .
    git commit -m "chore: initial import from Replit (Fogreach/Demonfall)"
    Write-Host "Git initialisiert" -ForegroundColor Cyan
}

# NPM install falls noetig
if ((Test-Path "package.json") -and -not (Test-Path "node_modules")) {
    Write-Host "npm install..." -ForegroundColor Cyan
    npm install
}

# .specignore anlegen
$ignoreContent = "node_modules/`n.git/`ndist/`nbuild/`n*.log`n*.map"
Set-Content -Path ".specignore" -Value $ignoreContent -Encoding utf8
Write-Host ".specignore angelegt" -ForegroundColor Cyan

# Spec Kitty initialisieren
Write-Host "" -ForegroundColor Green
Write-Host "=== Spec Kitty Setup ===" -ForegroundColor Green
Write-Host "Schritt 1: Projekt initialisieren" -ForegroundColor Cyan
spec-kitty init

Write-Host "" -ForegroundColor Green
Write-Host "Schritt 2: Setup verifizieren" -ForegroundColor Cyan
spec-kitty verify-setup

Write-Host "" -ForegroundColor Green
Write-Host "Schritt 3: Dashboard oeffnen" -ForegroundColor Cyan
spec-kitty dashboard