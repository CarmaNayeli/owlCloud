#!/bin/bash

# RollCloud Experimental Build Script
# Builds browser distributions WITH experimental two-way sync feature

set -e

BUILD_DIR="dist-experimental"
VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
EXPERIMENTAL_TAG="-experimental"

echo "🧪 RollCloud Experimental Build Script v$VERSION$EXPERIMENTAL_TAG"
echo "⚠️  This build includes experimental two-way DiceCloud sync"
echo ""

build_chrome_experimental() {
    echo "🌐 Building experimental Chrome version..."

    CHROME_DIR="$BUILD_DIR/chrome"
    rm -rf "$CHROME_DIR"
    mkdir -p "$CHROME_DIR"

    # Copy base files
    cp -r src icons manifest.json "$CHROME_DIR/"

    # Create lib directory for experimental files
    mkdir -p "$CHROME_DIR/src/lib"

    # Copy experimental sync files
    echo "  📦 Adding experimental sync modules..."
    cp experimental/two-way-sync/meteor-ddp-client.js "$CHROME_DIR/src/lib/"
    cp experimental/two-way-sync/dicecloud-sync.js "$CHROME_DIR/src/lib/"

    # Copy documentation
    cp experimental/two-way-sync/README.md "$CHROME_DIR/"
    cp experimental/two-way-sync/IMPLEMENTATION_GUIDE.md "$CHROME_DIR/"

    # Modify manifest to include experimental files
    echo "  📝 Updating manifest for experimental build..."
    node -e "
      const fs = require('fs');
      const manifest = JSON.parse(fs.readFileSync('$CHROME_DIR/manifest.json', 'utf8'));

      // Update version to indicate experimental
      manifest.version = manifest.version + '.1';
      manifest.name = manifest.name + ' (Experimental Sync)';

      // Add web_accessible_resources if not present
      if (!manifest.web_accessible_resources) {
        manifest.web_accessible_resources = [];
      }

      // Add experimental files to web accessible resources
      manifest.web_accessible_resources.push({
        resources: [
          'src/lib/meteor-ddp-client.js',
          'src/lib/dicecloud-sync.js'
        ],
        matches: ['<all_urls>']
      });

      fs.writeFileSync('$CHROME_DIR/manifest.json', JSON.stringify(manifest, null, 2));
    "

    echo "✅ Experimental Chrome build complete: $CHROME_DIR/"
    echo ""
}

build_firefox_experimental() {
    echo "🦊 Building experimental Firefox version..."

    FIREFOX_DIR="$BUILD_DIR/firefox"
    rm -rf "$FIREFOX_DIR"
    mkdir -p "$FIREFOX_DIR"

    # Copy base files
    cp -r src icons manifest_firefox.json "$FIREFOX_DIR/"

    # Create lib directory for experimental files
    mkdir -p "$FIREFOX_DIR/src/lib"

    # Copy experimental sync files
    echo "  📦 Adding experimental sync modules..."
    cp experimental/two-way-sync/meteor-ddp-client.js "$FIREFOX_DIR/src/lib/"
    cp experimental/two-way-sync/dicecloud-sync.js "$FIREFOX_DIR/src/lib/"

    # Copy documentation
    cp experimental/two-way-sync/README.md "$FIREFOX_DIR/"
    cp experimental/two-way-sync/IMPLEMENTATION_GUIDE.md "$FIREFOX_DIR/"

    # Modify manifest to include experimental files
    echo "  📝 Updating manifest for experimental build..."
    node -e "
      const fs = require('fs');
      const manifest = JSON.parse(fs.readFileSync('$FIREFOX_DIR/manifest_firefox.json', 'utf8'));

      // Update version to indicate experimental
      manifest.version = manifest.version + '.1';
      manifest.name = manifest.name + ' (Experimental Sync)';

      // Add web_accessible_resources if not present
      if (!manifest.web_accessible_resources) {
        manifest.web_accessible_resources = [];
      }

      // Add experimental files to web accessible resources
      manifest.web_accessible_resources.push({
        resources: [
          'src/lib/meteor-ddp-client.js',
          'src/lib/dicecloud-sync.js'
        ],
        matches: ['<all_urls>']
      });

      fs.writeFileSync('$FIREFOX_DIR/manifest.json', JSON.stringify(manifest, null, 2));
      fs.unlinkSync('$FIREFOX_DIR/manifest_firefox.json');
    "

    echo "✅ Experimental Firefox build complete: $FIREFOX_DIR/"
    echo ""
}

package_chrome_experimental() {
    echo "📦 Packaging experimental Chrome extension..."
    cd "$BUILD_DIR"
    zip -r "rollcloud-chrome-$VERSION$EXPERIMENTAL_TAG.zip" chrome/
    echo "✅ Chrome package: $BUILD_DIR/rollcloud-chrome-$VERSION$EXPERIMENTAL_TAG.zip"
    cd ..
    echo ""
}

package_firefox_experimental() {
    echo "📦 Packaging experimental Firefox add-on..."
    cd "$BUILD_DIR"
    zip -r "rollcloud-firefox-$VERSION$EXPERIMENTAL_TAG.zip" firefox/
    echo "✅ Firefox package: $BUILD_DIR/rollcloud-firefox-$VERSION$EXPERIMENTAL_TAG.zip"
    cd ..
    echo ""
}

create_readme() {
    echo "📄 Creating experimental build README..."
    cat > "$BUILD_DIR/README.md" << 'EOF'
# RollCloud Experimental Build

⚠️ **EXPERIMENTAL FEATURE**

This build includes experimental two-way synchronization with DiceCloud.

## What's Different

This experimental version includes:
- Meteor DDP client for real-time communication with DiceCloud
- Two-way sync: changes made in RollCloud update DiceCloud automatically
- Syncs action uses, resource consumption, HP changes, and more

## How to Test

1. Install this experimental build (load unpacked extension)
2. Log in to DiceCloud through RollCloud
3. Use an action with limited uses (e.g., "Second Wind")
4. Check DiceCloud character sheet - uses should update automatically
5. Use resources (Ki Points, Sorcery Points)
6. Check DiceCloud - values should decrease

## Known Limitations

- Requires active internet connection for sync
- May have slight delay (1-2 seconds) for updates
- Sync failures are silent - local data still works
- Not all property types supported yet

## Documentation

See `IMPLEMENTATION_GUIDE.md` for complete technical documentation.

## Reporting Issues

If you encounter issues:
1. Check browser console (F12) for error messages
2. Look for `[DDP]` or `[Sync]` prefixed messages
3. Report to the RollCloud GitHub repository with console logs

## Reverting to Stable

To go back to the stable version:
1. Uninstall this experimental build
2. Install the regular RollCloud extension from the Chrome/Firefox store
EOF
    echo "✅ README created"
    echo ""
}

case "$1" in
    chrome)
        build_chrome_experimental
        create_readme
        ;;
    firefox)
        build_firefox_experimental
        create_readme
        ;;
    package-chrome)
        build_chrome_experimental
        create_readme
        package_chrome_experimental
        ;;
    package-firefox)
        build_firefox_experimental
        create_readme
        package_firefox_experimental
        ;;
    all)
        build_chrome_experimental
        build_firefox_experimental
        create_readme
        ;;
    package-all)
        build_chrome_experimental
        build_firefox_experimental
        create_readme
        package_chrome_experimental
        package_firefox_experimental
        ;;
    clean)
        echo "🧹 Cleaning experimental build directory..."
        rm -rf "$BUILD_DIR"
        echo "✅ Clean complete"
        ;;
    *)
        echo "Usage: $0 {chrome|firefox|all|package-chrome|package-firefox|package-all|clean}"
        echo ""
        echo "Commands:"
        echo "  chrome          - Build experimental Chrome version"
        echo "  firefox         - Build experimental Firefox version"
        echo "  all             - Build experimental for both browsers"
        echo "  package-chrome  - Build and package experimental Chrome extension"
        echo "  package-firefox - Build and package experimental Firefox add-on"
        echo "  package-all     - Build and package experimental for both browsers"
        echo "  clean           - Remove experimental build directory"
        echo ""
        echo "⚠️  Experimental builds include two-way DiceCloud sync via Meteor DDP"
        exit 1
        ;;
esac

echo "✨ Experimental build complete!"
echo ""
echo "⚠️  REMINDER: This is an experimental build with two-way sync"
echo "   - Test thoroughly before using with real characters"
echo "   - Check browser console for sync messages"
echo "   - See IMPLEMENTATION_GUIDE.md for integration details"
