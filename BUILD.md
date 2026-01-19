# RollCloud Build Instructions

RollCloud supports multiple browsers through browser-specific builds.

## Supported Browsers

- **Chrome** (Manifest V3, Service Worker)
- **Firefox** (Manifest V2, Background Script)
- **Safari** (Planned)

## Directory Structure

```
rollCloud/
├── manifest.json          # Chrome manifest (MV3)
├── manifest_firefox.json  # Firefox manifest (MV2)
├── src/                   # Shared source code
├── icons/                 # Extension icons
├── dist/                  # Build output
│   ├── chrome/            # Chrome build
│   └── firefox/           # Firefox build
```

## Building for Chrome

### Manual Build
1. Copy all files except `manifest_firefox.json` to `dist/chrome/`
2. The default `manifest.json` is already configured for Chrome

### Install in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/chrome/` directory (or root directory for development)

## Building for Firefox

### Manual Build
1. Copy all files to `dist/firefox/`
2. Replace `manifest.json` with `manifest_firefox.json`:
   ```bash
   cd dist/firefox/
   rm manifest.json
   cp manifest_firefox.json manifest.json
   ```

### Install in Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file from `dist/firefox/`

### Package for Firefox
```bash
cd dist/firefox/
zip -r ../rollcloud-firefox.zip *
```

Then submit `rollcloud-firefox.zip` to Firefox Add-ons.

## Automated Build Script

Use the provided build script:

```bash
./build.sh chrome    # Build for Chrome
./build.sh firefox   # Build for Firefox
./build.sh all       # Build for all browsers
```

## Browser Compatibility Notes

### Chrome (Manifest V3)
- Uses Service Worker for background script
- Callback-based `chrome` API
- `action` for browser action button

### Firefox (Manifest V2)
- Uses background scripts (not service worker)
- Promise-based `browser` API (with fallback to `chrome`)
- `browser_action` for browser action button
- Requires `applications.gecko.id` for extension ID

### Code Compatibility
The extension uses a browser detection polyfill (`src/common/browser-polyfill.js`) that automatically detects the browser and uses the appropriate API:
- Firefox: Uses native `browser` API
- Chrome: Uses native `chrome` API

## Development

For development, you can use the root directory directly without building:
- **Chrome**: Load the root directory as unpacked extension
- **Firefox**: Load the root directory, but Firefox will use the Chrome manifest (MV3)

For Firefox development, temporarily copy `manifest_firefox.json` to `manifest.json`.

## API Differences Handled

The extension handles these browser differences automatically:
1. **Background scripts**: Service worker (Chrome) vs. script (Firefox)
2. **Browser API**: `chrome` vs. `browser` namespace
3. **Storage API**: Callback-based (Chrome) vs. Promise-based (Firefox)
4. **Extension button**: `action` (Chrome MV3) vs. `browser_action` (Firefox MV2)
5. **Web accessible resources**: Different syntax between MV2 and MV3
