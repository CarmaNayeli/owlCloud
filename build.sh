#!/bin/bash

# Build script for RollCloud extension
# Creates zip files for both Chrome and Firefox from the same codebase

VERSION="1.0.0"
BUILD_DIR="builds"

echo "🔨 Building RollCloud Extension v${VERSION}"

# Clean previous builds
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Files to include in the extension
FILES=(
  "manifest.json"
  "icons/"
  "src/"
)

# Create Chrome/Firefox build (same files, universal manifest)
echo "📦 Creating extension package..."
zip -r "$BUILD_DIR/rollcloud-v${VERSION}.zip" "${FILES[@]}" \
  -x "*.git*" \
  -x "*node_modules*" \
  -x "*.DS_Store" \
  -x "*builds/*"

echo "✅ Build complete!"
echo "📁 Output: $BUILD_DIR/rollcloud-v${VERSION}.zip"
echo ""
echo "Installation:"
echo "  Chrome: Load unpacked extension or drag zip to chrome://extensions"
echo "  Firefox: about:debugging → Load Temporary Add-on → select manifest.json or zip"
