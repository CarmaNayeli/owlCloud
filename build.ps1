# RollCloud Build Script for PowerShell
# Builds browser-specific distributions

param(
    [Parameter(Position=0)]
    [ValidateSet('chrome', 'firefox', 'all', 'package-chrome', 'package-firefox', 'package-all', 'clean')]
    [string]$Target = 'all'
)

$BUILD_DIR = "dist"
$VERSION = (Get-Content manifest.json | ConvertFrom-Json).version

Write-Host "🚀 RollCloud Build Script v$VERSION" -ForegroundColor Cyan
Write-Host ""

function Build-Chrome {
    Write-Host "🌐 Building for Chrome..." -ForegroundColor Green
    
    $CHROME_DIR = Join-Path $BUILD_DIR "chrome"
    if (Test-Path $CHROME_DIR) {
        Remove-Item -Recurse -Force $CHROME_DIR
    }
    New-Item -ItemType Directory -Force -Path $CHROME_DIR | Out-Null
    
    # Copy files
    Copy-Item -Recurse -Force "src" $CHROME_DIR
    Copy-Item -Recurse -Force "icons" $CHROME_DIR
    Copy-Item -Force "manifest.json" $CHROME_DIR
    
    Write-Host "✅ Chrome build complete: $CHROME_DIR/" -ForegroundColor Green
    Write-Host ""
}

function Build-Firefox {
    Write-Host "🦊 Building for Firefox..." -ForegroundColor Yellow
    
    $FIREFOX_DIR = Join-Path $BUILD_DIR "firefox"
    if (Test-Path $FIREFOX_DIR) {
        Remove-Item -Recurse -Force $FIREFOX_DIR
    }
    New-Item -ItemType Directory -Force -Path $FIREFOX_DIR | Out-Null
    
    # Copy files
    Copy-Item -Recurse -Force "src" $FIREFOX_DIR
    Copy-Item -Recurse -Force "icons" $FIREFOX_DIR
    Copy-Item -Force "manifest_firefox.json" (Join-Path $FIREFOX_DIR "manifest.json")
    
    Write-Host "✅ Firefox build complete: $FIREFOX_DIR/" -ForegroundColor Green
    Write-Host ""
}

function Package-Chrome {
    Write-Host "📦 Packaging Chrome extension..." -ForegroundColor Cyan
    $zipPath = Join-Path $BUILD_DIR "rollcloud-chrome-$VERSION.zip"
    
    if (Test-Path $zipPath) {
        Remove-Item -Force $zipPath
    }
    
    Compress-Archive -Path (Join-Path $BUILD_DIR "chrome\*") -DestinationPath $zipPath
    Write-Host "✅ Chrome package: $zipPath" -ForegroundColor Green
    Write-Host ""
}

function Package-Firefox {
    Write-Host "📦 Packaging Firefox add-on..." -ForegroundColor Cyan
    $zipPath = Join-Path $BUILD_DIR "rollcloud-firefox-$VERSION.zip"
    
    if (Test-Path $zipPath) {
        Remove-Item -Force $zipPath
    }
    
    Compress-Archive -Path (Join-Path $BUILD_DIR "firefox\*") -DestinationPath $zipPath
    Write-Host "✅ Firefox package: $zipPath" -ForegroundColor Green
    Write-Host ""
}

function Clean-Build {
    Write-Host "🧹 Cleaning build directory..." -ForegroundColor Yellow
    if (Test-Path $BUILD_DIR) {
        Remove-Item -Recurse -Force $BUILD_DIR
    }
    Write-Host "✅ Clean complete" -ForegroundColor Green
}

# Execute based on target
switch ($Target) {
    'chrome' {
        Build-Chrome
    }
    'firefox' {
        Build-Firefox
    }
    'package-chrome' {
        Build-Chrome
        Package-Chrome
    }
    'package-firefox' {
        Build-Firefox
        Package-Firefox
    }
    'all' {
        Build-Chrome
        Build-Firefox
    }
    'package-all' {
        Build-Chrome
        Build-Firefox
        Package-Chrome
        Package-Firefox
    }
    'clean' {
        Clean-Build
    }
}

Write-Host "✨ Done!" -ForegroundColor Cyan
