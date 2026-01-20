# Safari Extension Guide

This guide covers building, converting, and testing the RollCloud extension for Safari.

## Prerequisites

- **macOS** - Safari extensions can only be built and tested on macOS
- **Xcode** - Download from the Mac App Store (required for conversion)
- **Safari** 14.0 or later
- **Apple Developer Account** - Optional for local testing, required for distribution

## Building the Safari Extension

### 1. Build the Extension Package

Run the build script to create the Safari-ready package:

```bash
npm run build
```

This creates a Safari extension package in `dist/safari/` with the Safari-specific manifest.

### 2. Convert to Safari App Extension

Safari requires web extensions to be converted into Safari App Extensions using Apple's converter tool.

#### Option A: Using Xcode (Recommended)

1. Open Terminal and navigate to your project root
2. Run the Safari Web Extension Converter:

```bash
xcrun safari-web-extension-converter dist/safari --app-name RollCloud
```

3. Follow the prompts:
   - **Bundle Identifier**: Enter something like `com.yourname.rollcloud`
   - **Language**: Select Swift or Objective-C (Swift recommended)
   - **Create new Xcode project**: Yes

4. This creates a new Xcode project in the current directory

#### Option B: Convert to Existing Project

If you already have an Xcode project:

```bash
xcrun safari-web-extension-converter dist/safari --app-name RollCloud --project-location /path/to/existing/project --rebuild-project
```

### 3. Open and Build in Xcode

1. Open the generated `.xcodeproj` file in Xcode
2. Select your development team (Xcode → Preferences → Accounts)
3. Build the project: Product → Build (⌘B)

## Testing in Safari

### Enable Safari Extension Development

1. Open Safari
2. Go to Safari → Preferences → Advanced
3. Check "Show Develop menu in menu bar"
4. Go to Develop → Allow Unsigned Extensions

### Load the Extension

1. In Xcode, run the extension: Product → Run (⌘R)
2. This will:
   - Launch Safari (if not already running)
   - Install the extension
   - Open Safari's Extension Preferences

3. In Safari Preferences → Extensions:
   - Check the box next to "RollCloud"
   - Click "Always Allow on Every Website" for both dicecloud.com and roll20.net

### Verify Installation

1. Navigate to https://dicecloud.com and https://app.roll20.net
2. Open Safari's Web Inspector (Option+Command+I)
3. Check the Console for RollCloud initialization messages
4. Look for the RollCloud toolbar button
5. Open the extension popup to verify it loads correctly

## Debugging

### View Console Logs

**For Content Scripts:**
1. Right-click on a webpage → Inspect Element
2. Go to Console tab
3. Look for RollCloud messages (🌐, 🎲, ✅, etc.)

**For Background Script:**
1. Go to Develop → Web Extension Background Pages → RollCloud
2. Check the Console tab

**For Popup:**
1. Right-click the extension icon → Inspect Element
2. Check the Console tab

### Common Issues

#### Extension Not Loading
- Ensure "Allow Unsigned Extensions" is enabled
- Check that extension is enabled in Safari Preferences
- Try rebuilding in Xcode
- Check Console for errors

#### Permissions Issues
- Verify permissions in Safari Preferences → Extensions
- Make sure both dicecloud.com and roll20.net are allowed
- Try "Always Allow on Every Website"

#### API Errors
- Safari uses the `browser` namespace (like Firefox)
- Check browser-polyfill.js is loaded first
- Verify manifest permissions are correct

## Distribution Preparation

### For Mac App Store Distribution

1. **Join Apple Developer Program** ($99/year)
   - Visit https://developer.apple.com/programs/

2. **Configure App ID**
   - Go to Apple Developer Portal
   - Create an App ID for your extension

3. **Code Signing**
   - In Xcode, select your project
   - Go to Signing & Capabilities
   - Select your Development Team
   - Enable "Automatically manage signing"

4. **Archive and Submit**
   - Product → Archive
   - Window → Organizer
   - Select archive → Distribute App
   - Follow App Store submission process

### For Direct Distribution

1. **Code sign** with Developer ID Application certificate
2. **Notarize** the app with Apple
3. **Distribute** as a downloadable .pkg or .dmg

## Safari-Specific Notes

### Manifest Differences

Safari uses Manifest V2 (like Firefox) with some specific settings:

```json
{
  "browser_specific_settings": {
    "safari": {
      "strict_min_version": "14.0"
    }
  }
}
```

### API Compatibility

- Safari supports most WebExtensions APIs
- Uses `browser` namespace (Promise-based, like Firefox)
- Some Chrome-specific APIs may not be available
- Content Security Policy is strictly enforced

### Performance

- Safari may have stricter resource limits
- Background scripts are non-persistent by default
- Test thoroughly for memory leaks

## Updating the Extension

When you make changes:

1. Run `npm run build` to rebuild
2. Re-convert with `xcrun safari-web-extension-converter`
3. Clean build in Xcode: Product → Clean Build Folder
4. Rebuild and run

Or, for faster iteration during development:

1. Make changes to source files
2. Run `npm run build`
3. Copy updated files to the Xcode project's extension folder
4. Rebuild in Xcode

## Resources

- [Safari Web Extensions Documentation](https://developer.apple.com/documentation/safariservices/safari_web_extensions)
- [Converting a Web Extension for Safari](https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari)
- [Safari Extensions Guide](https://developer.apple.com/safari/extensions/)
- [WebExtensions API Compatibility](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Browser_support_for_JavaScript_APIs)

## Support

If you encounter issues specific to Safari:

1. Check Safari's Console for error messages
2. Verify API compatibility on MDN
3. Test the same functionality in Firefox (uses same codebase)
4. Open an issue on GitHub with Safari-specific details
