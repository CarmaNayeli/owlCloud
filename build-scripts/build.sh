#!/bin/bash

# RollCloud Build Script
# Builds browser-specific distributions

set -e

BUILD_DIR="dist"
VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')

echo "🚀 RollCloud Build Script v$VERSION"
echo ""

build_chrome() {
    echo "🌐 Building for Chrome..."
    
    CHROME_DIR="$BUILD_DIR/chrome"
    rm -rf "$CHROME_DIR"
    mkdir -p "$CHROME_DIR"
    
    # Copy all files except Firefox-specific ones
    cp -r src icons manifest.json "$CHROME_DIR/"
    
    echo "✅ Chrome build complete: $CHROME_DIR/"
    echo ""
}

build_firefox() {
    echo "🦊 Building for Firefox..."
    
    FIREFOX_DIR="$BUILD_DIR/firefox"
    rm -rf "$FIREFOX_DIR"
    mkdir -p "$FIREFOX_DIR"
    
    # Copy all files
    cp -r src icons manifest_firefox.json "$FIREFOX_DIR/"
    
    # Rename Firefox manifest to manifest.json
    mv "$FIREFOX_DIR/manifest_firefox.json" "$FIREFOX_DIR/manifest.json"
    
    echo "✅ Firefox build complete: $FIREFOX_DIR/"
    echo ""
}

package_chrome() {
    echo "📦 Packaging Chrome extension..."
    cd "$BUILD_DIR"
    zip -r "rollcloud-chrome-$VERSION.zip" chrome/
    echo "✅ Chrome package: $BUILD_DIR/rollcloud-chrome-$VERSION.zip"
    cd ..
    echo ""
}

package_firefox() {
    echo "📦 Packaging Firefox add-on..."
    cd "$BUILD_DIR"
    zip -r "rollcloud-firefox-$VERSION.zip" firefox/
    echo "✅ Firefox package: $BUILD_DIR/rollcloud-firefox-$VERSION.zip"
    cd ..
    echo ""
}

case "$1" in
    chrome)
        build_chrome
        ;;
    firefox)
        build_firefox
        ;;
    package-chrome)
        build_chrome
        package_chrome
        ;;
    package-firefox)
        build_firefox
        package_firefox
        ;;
    all)
        build_chrome
        build_firefox
        ;;
    package-all)
        build_chrome
        build_firefox
        package_chrome
        package_firefox
        ;;
    clean)
        echo "🧹 Cleaning build directory..."
        rm -rf "$BUILD_DIR"
        echo "✅ Clean complete"
        ;;
    *)
        echo "Usage: $0 {chrome|firefox|all|package-chrome|package-firefox|package-all|clean}"
        echo ""
        echo "Commands:"
        echo "  chrome          - Build for Chrome only"
        echo "  firefox         - Build for Firefox only"
        echo "  all             - Build for both browsers"
        echo "  package-chrome  - Build and package Chrome extension"
        echo "  package-firefox - Build and package Firefox add-on"
        echo "  package-all     - Build and package for both browsers"
        echo "  clean           - Remove build directory"
        exit 1
        ;;
esac

echo "✨ Done!"
