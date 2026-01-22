# RollCloud Experimental Build Script (PowerShell) - FIXED VERSION
# Builds browser distributions WITH experimental two-way sync feature
# Uses Join-Path for proper path construction

param(
    [switch]$Chrome,
    [switch]$Firefox,
    [switch]$All
)

$ErrorActionPreference = "Stop"
$BUILD_DIR = "dist-experimental"
$EXPERIMENTAL_TAG = "-experimental"

# Get version from manifest.json
$manifest = Get-Content "manifest.json" -Raw | ConvertFrom-Json
$VERSION = $manifest.version

Write-Host "🧪 RollCloud Experimental Build Script v$VERSION$EXPERIMENTAL_TAG" -ForegroundColor Cyan
Write-Host "⚠️  This build includes experimental two-way DiceCloud sync" -ForegroundColor Yellow
Write-Host ""

# Clean build directory
if (Test-Path $BUILD_DIR) {
    Write-Host "🧹 Cleaning experimental build directory..." -ForegroundColor Gray
    Remove-Item -Path $BUILD_DIR -Recurse -Force
}

function Build-ChromeExperimental {
    Write-Host "🌐 Building experimental Chrome version..." -ForegroundColor Green

    # Use Join-Path for reliable path construction
    $CHROME_DIR = Join-Path $BUILD_DIR "chrome"
    New-Item -ItemType Directory -Path $CHROME_DIR -Force | Out-Null

    # Copy base files
    Write-Host "  📦 Copying base files..." -ForegroundColor Gray
    Copy-Item -Path "src" -Destination $CHROME_DIR -Recurse -Force
    Copy-Item -Path "icons" -Destination $CHROME_DIR -Recurse -Force
    Copy-Item -Path "manifest.json" -Destination $CHROME_DIR -Force

    # Create lib directory
    $LIB_DIR = Join-Path (Join-Path $CHROME_DIR "src") "lib"
    New-Item -ItemType Directory -Path $LIB_DIR -Force | Out-Null

    # Copy experimental sync files
    Write-Host "  📦 Adding experimental sync modules..." -ForegroundColor Gray
    Copy-Item -Path (Join-Path "experimental\two-way-sync" "meteor-ddp-client.js") -Destination (Join-Path $LIB_DIR "meteor-ddp-client.js") -Force
    Copy-Item -Path (Join-Path "experimental\two-way-sync" "dicecloud-sync.js") -Destination (Join-Path $LIB_DIR "dicecloud-sync.js") -Force

    # Copy documentation
    Copy-Item -Path (Join-Path "experimental\two-way-sync" "README.md") -Destination (Join-Path $CHROME_DIR "EXPERIMENTAL-README.md") -Force
    Copy-Item -Path (Join-Path "experimental\two-way-sync" "IMPLEMENTATION_GUIDE.md") -Destination (Join-Path $CHROME_DIR "IMPLEMENTATION_GUIDE.md") -Force

    # Modify manifest
    Write-Host "  📝 Updating manifest for experimental build..." -ForegroundColor Gray
    $manifestPath = Join-Path $CHROME_DIR "manifest.json"
    $chromeManifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

    # Update name and version
    $chromeManifest.name = $chromeManifest.name + " (Experimental Sync)"
    $chromeManifest.version = "1.1.3"

    # Add experimental sync files to Roll20 content script
    foreach ($script in $chromeManifest.content_scripts) {
        $matches = $script.matches | Where-Object { $_ -eq "https://app.roll20.net/*" }
        if ($matches) {
            # Find the index of roll20.js
            $roll20Index = -1
            for ($i = 0; $i -lt $script.js.Count; $i++) {
                if ($script.js[$i] -eq "src/content/roll20.js") {
                    $roll20Index = $i
                    break
                }
            }

            if ($roll20Index -ge 0) {
                # Build new array with sync files inserted before roll20.js
                $newJs = New-Object System.Collections.ArrayList
                for ($i = 0; $i -lt $roll20Index; $i++) {
                    $null = $newJs.Add($script.js[$i])
                }
                $null = $newJs.Add("src/lib/meteor-ddp-client.js")
                $null = $newJs.Add("src/lib/dicecloud-sync.js")
                for ($i = $roll20Index; $i -lt $script.js.Count; $i++) {
                    $null = $newJs.Add($script.js[$i])
                }
                $script.js = $newJs.ToArray()
            }
        }
    }

    # Add web_accessible_resources
    if (-not $chromeManifest.PSObject.Properties['web_accessible_resources']) {
        $chromeManifest | Add-Member -MemberType NoteProperty -Name 'web_accessible_resources' -Value @()
    }

    $newResource = @{
        resources = @("src/lib/meteor-ddp-client.js", "src/lib/dicecloud-sync.js")
        matches = @("<all_urls>")
    }

    $chromeManifest.web_accessible_resources = @($chromeManifest.web_accessible_resources) + $newResource

    # Save manifest
    $chromeManifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8

    Write-Host "✅ Experimental Chrome build complete: $CHROME_DIR" -ForegroundColor Green
    Write-Host ""
}

function Build-FirefoxExperimental {
    Write-Host "🦊 Building experimental Firefox version..." -ForegroundColor Green

    # Use Join-Path for reliable path construction
    $FIREFOX_DIR = Join-Path $BUILD_DIR "firefox"
    New-Item -ItemType Directory -Path $FIREFOX_DIR -Force | Out-Null

    # Copy base files
    Write-Host "  📦 Copying base files..." -ForegroundColor Gray
    Copy-Item -Path "src" -Destination $FIREFOX_DIR -Recurse -Force
    Copy-Item -Path "icons" -Destination $FIREFOX_DIR -Recurse -Force
    Copy-Item -Path "manifest_firefox.json" -Destination (Join-Path $FIREFOX_DIR "manifest.json") -Force

    # Create lib directory
    $LIB_DIR = Join-Path (Join-Path $FIREFOX_DIR "src") "lib"
    New-Item -ItemType Directory -Path $LIB_DIR -Force | Out-Null

    # Copy experimental sync files
    Write-Host "  📦 Adding experimental sync modules..." -ForegroundColor Gray
    Copy-Item -Path (Join-Path "experimental\two-way-sync" "meteor-ddp-client.js") -Destination (Join-Path $LIB_DIR "meteor-ddp-client.js") -Force
    Copy-Item -Path (Join-Path "experimental\two-way-sync" "dicecloud-sync.js") -Destination (Join-Path $LIB_DIR "dicecloud-sync.js") -Force

    # Copy documentation
    Copy-Item -Path (Join-Path "experimental\two-way-sync" "README.md") -Destination (Join-Path $FIREFOX_DIR "EXPERIMENTAL-README.md") -Force
    Copy-Item -Path (Join-Path "experimental\two-way-sync" "IMPLEMENTATION_GUIDE.md") -Destination (Join-Path $FIREFOX_DIR "IMPLEMENTATION_GUIDE.md") -Force

    # Modify manifest
    Write-Host "  📝 Updating manifest for experimental build..." -ForegroundColor Gray
    $manifestPath = Join-Path $FIREFOX_DIR "manifest.json"
    $firefoxManifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

    # Update name and version
    $firefoxManifest.name = $firefoxManifest.name + " (Experimental Sync)"
    $firefoxManifest.version = "1.1.3"

    # Add experimental sync files to Roll20 content script
    foreach ($script in $firefoxManifest.content_scripts) {
        $matches = $script.matches | Where-Object { $_ -eq "https://app.roll20.net/*" }
        if ($matches) {
            # Find the index of roll20.js
            $roll20Index = -1
            for ($i = 0; $i -lt $script.js.Count; $i++) {
                if ($script.js[$i] -eq "src/content/roll20.js") {
                    $roll20Index = $i
                    break
                }
            }

            if ($roll20Index -ge 0) {
                # Build new array with sync files inserted before roll20.js
                $newJs = New-Object System.Collections.ArrayList
                for ($i = 0; $i -lt $roll20Index; $i++) {
                    $null = $newJs.Add($script.js[$i])
                }
                $null = $newJs.Add("src/lib/meteor-ddp-client.js")
                $null = $newJs.Add("src/lib/dicecloud-sync.js")
                for ($i = $roll20Index; $i -lt $script.js.Count; $i++) {
                    $null = $newJs.Add($script.js[$i])
                }
                $script.js = $newJs.ToArray()
            }
        }
    }

    # Add web_accessible_resources
    if (-not $firefoxManifest.PSObject.Properties['web_accessible_resources']) {
        $firefoxManifest | Add-Member -MemberType NoteProperty -Name 'web_accessible_resources' -Value @()
    }

    $newResource = @{
        resources = @("src/lib/meteor-ddp-client.js", "src/lib/dicecloud-sync.js")
        matches = @("<all_urls>")
    }

    $firefoxManifest.web_accessible_resources = @($firefoxManifest.web_accessible_resources) + $newResource

    # Save manifest
    $firefoxManifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8

    Write-Host "✅ Experimental Firefox build complete: $FIREFOX_DIR" -ForegroundColor Green
    Write-Host ""
}

# Run builds based on parameters
if ($Chrome -or (-not $Firefox -and -not $All)) {
    Build-ChromeExperimental
}

if ($Firefox) {
    Build-FirefoxExperimental
}

if ($All) {
    Build-ChromeExperimental
    Build-FirefoxExperimental
}

Write-Host "✨ Experimental build complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  REMINDER: This is an experimental build with two-way sync" -ForegroundColor Yellow
Write-Host "   - Test thoroughly before using with real characters" -ForegroundColor Yellow
Write-Host "   - Check browser console for sync messages" -ForegroundColor Yellow
Write-Host "   - See IMPLEMENTATION_GUIDE.md for integration details" -ForegroundColor Yellow
