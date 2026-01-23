# RollCloud Experimental Build Script (PowerShell)
# Builds browser distributions WITH experimental two-way sync feature

param(
    [switch]$Chrome,
    [switch]$Firefox,
    [switch]$All
)

$BUILD_DIR = "dist-experimental"
$EXPERIMENTAL_TAG = "-experimental"

# Get version from manifest.json
$manifest = Get-Content "manifest.json" | ConvertFrom-Json
$VERSION = $manifest.version

Write-Host "RollCloud Experimental Build Script v$VERSION$EXPERIMENTAL_TAG" -ForegroundColor Cyan
Write-Host "WARNING: This build includes experimental two-way DiceCloud sync" -ForegroundColor Yellow
Write-Host ""

# Clean build directory
if (Test-Path $BUILD_DIR) {
    Write-Host "Cleaning experimental build directory..." -ForegroundColor Gray
    Remove-Item -Path $BUILD_DIR -Recurse -Force
}

function Build-ChromeExperimental {
    Write-Host "Building experimental Chrome version..." -ForegroundColor Green

    $CHROME_DIR = "$BUILD_DIR\chrome"
    New-Item -ItemType Directory -Path $CHROME_DIR -Force | Out-Null

    # Copy base files
    Write-Host "  Copying base files..." -ForegroundColor Gray
    Copy-Item -Path "src" -Destination $CHROME_DIR -Recurse -Force
    Copy-Item -Path "icons" -Destination $CHROME_DIR -Recurse -Force
    Copy-Item -Path "manifest.json" -Destination $CHROME_DIR -Force

    # Create lib directory
    $LIB_DIR = "$CHROME_DIR\src\lib"
    New-Item -ItemType Directory -Path $LIB_DIR -Force | Out-Null

    # Copy experimental sync files
    Write-Host "  Adding experimental sync modules..." -ForegroundColor Gray
    Copy-Item -Path "experimental\two-way-sync\meteor-ddp-client.js" -Destination "$LIB_DIR\meteor-ddp-client.js" -Force
    Copy-Item -Path "experimental\two-way-sync\dicecloud-sync.js" -Destination "$LIB_DIR\dicecloud-sync.js" -Force

    # Add back check structure button for experimental builds
    Write-Host "  Adding check structure button for experimental builds..." -ForegroundColor Gray
    $dicecloudJsPath = "$CHROME_DIR\src\content\dicecloud.js"
    $dicecloudContent = Get-Content $dicecloudJsPath -Raw
    
    # Replace both occurrences using proper string concatenation
    $replacement1 = "addSyncButton();`n      addCheckStructureButton();`n      observeRollLog();"
    $dicecloudContent = $dicecloudContent -replace 'addSyncButton\(\);\s*observeRollLog\(\);', $replacement1
    
    $replacement2 = "addSyncButton();`n    addCheckStructureButton();`n    observeRollLog();"
    $dicecloudContent = $dicecloudContent -replace 'addSyncButton\(\);\s*observeRollLog\(\);', $replacement2
    
    Set-Content $dicecloudJsPath $dicecloudContent -Encoding UTF8

    # Copy documentation
    Copy-Item -Path "experimental\two-way-sync\README.md" -Destination "$CHROME_DIR\EXPERIMENTAL-README.md" -Force
    Copy-Item -Path "experimental\two-way-sync\IMPLEMENTATION_GUIDE.md" -Destination "$CHROME_DIR\IMPLEMENTATION_GUIDE.md" -Force

    # Modify manifest
    Write-Host "  Updating manifest for experimental build..." -ForegroundColor Gray
    $chromeManifest = Get-Content "$CHROME_DIR\manifest.json" | ConvertFrom-Json
    $originalName = $chromeManifest.name
    $chromeManifest.name = "$originalName (Experimental Sync)"
    $chromeManifest.version = "1.1.3"

    # Add experimental sync files to Roll20 content script
    foreach ($script in $chromeManifest.content_scripts) {
        if ($script.matches -contains "https://app.roll20.net/*") {
            # Find the index of roll20.js
            $roll20Index = [Array]::IndexOf($script.js, "src/content/roll20.js")
            if ($roll20Index -ge 0) {
                # Insert sync files before roll20.js
                $newJs = @($script.js[0..($roll20Index-1)])
                $newJs += "src/lib/meteor-ddp-client.js"
                $newJs += "src/lib/dicecloud-sync.js"
                $newJs += @($script.js[$roll20Index..($script.js.Length-1)])
                $script.js = $newJs
            }
        }
    }

    # Add web_accessible_resources
    if (-not $chromeManifest.web_accessible_resources) {
        $chromeManifest.web_accessible_resources = @()
    }
    $chromeManifest.web_accessible_resources += @{
        resources = @(
            "src/lib/meteor-ddp-client.js",
            "src/lib/dicecloud-sync.js"
        )
        matches = @("<all_urls>")
    }

    $chromeManifest | ConvertTo-Json -Depth 10 | Set-Content "$CHROME_DIR\manifest.json" -Encoding UTF8

    Write-Host "Experimental Chrome build complete: $CHROME_DIR" -ForegroundColor Green
    Write-Host ""
}

function Build-FirefoxExperimental {
    Write-Host "Building experimental Firefox version..." -ForegroundColor Green

    $FIREFOX_DIR = "$BUILD_DIR\firefox"
    New-Item -ItemType Directory -Path $FIREFOX_DIR -Force | Out-Null

    # Copy base files
    Write-Host "  Copying base files..." -ForegroundColor Gray
    Copy-Item -Path "src" -Destination $FIREFOX_DIR -Recurse -Force
    Copy-Item -Path "icons" -Destination $FIREFOX_DIR -Recurse -Force
    Copy-Item -Path "manifest_firefox.json" -Destination "$FIREFOX_DIR\manifest.json" -Force

    # Create lib directory
    $LIB_DIR = "$FIREFOX_DIR\src\lib"
    New-Item -ItemType Directory -Path $LIB_DIR -Force | Out-Null

    # Copy experimental sync files
    Write-Host "  Adding experimental sync modules..." -ForegroundColor Gray
    Copy-Item -Path "experimental\two-way-sync\meteor-ddp-client.js" -Destination "$LIB_DIR\meteor-ddp-client.js" -Force
    Copy-Item -Path "experimental\two-way-sync\dicecloud-sync.js" -Destination "$LIB_DIR\dicecloud-sync.js" -Force

    # Add back check structure button for experimental builds
    Write-Host "  Adding check structure button for experimental builds..." -ForegroundColor Gray
    $dicecloudJsPath = "$FIREFOX_DIR\src\content\dicecloud.js"
    $dicecloudContent = Get-Content $dicecloudJsPath -Raw
    
    # Replace both occurrences using proper string concatenation
    $replacement1 = "addSyncButton();`n      addCheckStructureButton();`n      observeRollLog();"
    $dicecloudContent = $dicecloudContent -replace 'addSyncButton\(\);\s*observeRollLog\(\);', $replacement1
    
    $replacement2 = "addSyncButton();`n    addCheckStructureButton();`n    observeRollLog();"
    $dicecloudContent = $dicecloudContent -replace 'addSyncButton\(\);\s*observeRollLog\(\);', $replacement2
    
    Set-Content $dicecloudJsPath $dicecloudContent -Encoding UTF8

    # Copy documentation
    Copy-Item -Path "experimental\two-way-sync\README.md" -Destination "$FIREFOX_DIR\EXPERIMENTAL-README.md" -Force
    Copy-Item -Path "experimental\two-way-sync\IMPLEMENTATION_GUIDE.md" -Destination "$FIREFOX_DIR\IMPLEMENTATION_GUIDE.md" -Force

    # Modify manifest
    Write-Host "  Updating manifest for experimental build..." -ForegroundColor Gray
    $firefoxManifest = Get-Content "$FIREFOX_DIR\manifest.json" | ConvertFrom-Json
    $originalName = $firefoxManifest.name
    $firefoxManifest.name = "$originalName (Experimental Sync)"
    $firefoxManifest.version = "1.1.3"

    # Add experimental sync files to Roll20 content script
    foreach ($script in $firefoxManifest.content_scripts) {
        if ($script.matches -contains "https://app.roll20.net/*") {
            # Find the index of roll20.js
            $roll20Index = [Array]::IndexOf($script.js, "src/content/roll20.js")
            if ($roll20Index -ge 0) {
                # Insert sync files before roll20.js
                $newJs = @($script.js[0..($roll20Index-1)])
                $newJs += "src/lib/meteor-ddp-client.js"
                $newJs += "src/lib/dicecloud-sync.js"
                $newJs += @($script.js[$roll20Index..($script.js.Length-1)])
                $script.js = $newJs
            }
        }
    }

    # Add web_accessible_resources (Manifest V2 format - array of strings)
    if (-not $firefoxManifest.web_accessible_resources) {
        $firefoxManifest.web_accessible_resources = @()
    }
    $firefoxManifest.web_accessible_resources += "src/lib/meteor-ddp-client.js"
    $firefoxManifest.web_accessible_resources += "src/lib/dicecloud-sync.js"

    $firefoxManifest | ConvertTo-Json -Depth 10 | Set-Content "$FIREFOX_DIR\manifest.json" -Encoding UTF8

    Write-Host "Experimental Firefox build complete: $FIREFOX_DIR" -ForegroundColor Green
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

Write-Host "Experimental build complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "REMINDER: This is an experimental build with two-way sync" -ForegroundColor Yellow
Write-Host "   - Test thoroughly before using with real characters" -ForegroundColor Yellow
Write-Host "   - Check browser console for sync messages" -ForegroundColor Yellow
Write-Host "   - See IMPLEMENTATION_GUIDE.md for integration details" -ForegroundColor Yellow
