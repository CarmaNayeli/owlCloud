# Debug version - checks if variables are set correctly
param([switch]$All)

Write-Host "=== DIAGNOSTIC START ===" -ForegroundColor Cyan

$BUILD_DIR = "dist-experimental"
Write-Host "BUILD_DIR = [$BUILD_DIR]" -ForegroundColor Yellow

$CHROME_DIR = "$BUILD_DIR\chrome"
Write-Host "CHROME_DIR = [$CHROME_DIR]" -ForegroundColor Yellow

$LIB_DIR = "$CHROME_DIR\src\lib"
Write-Host "LIB_DIR = [$LIB_DIR]" -ForegroundColor Yellow

$TEST_PATH = Join-Path -Path $CHROME_DIR -ChildPath "src\lib"
Write-Host "TEST_PATH (using Join-Path) = [$TEST_PATH]" -ForegroundColor Yellow

Write-Host "=== DIAGNOSTIC END ===" -ForegroundColor Cyan
