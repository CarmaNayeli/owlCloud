# OwlCloud Build Instructions

OwlCloud supports multiple browsers through browser-specific builds.

## Supported Browsers

- **Chrome** (Manifest V3, Service Worker)
- **Firefox** (Manifest V2, Background Script)
- **Safari** (Planned)

## Quick Build

### Using NPM (Cross-platform)
```bash
npm run build
```

This builds both Chrome and Firefox packages to `dist/chrome/` and `dist/firefox/` and creates zip files.

### Using Build Scripts

**Linux/macOS (Bash):**
```bash
./build.sh all              # Build both browsers
./build.sh chrome           # Build Chrome only
./build.sh firefox          # Build Firefox only
./build.sh package-all      # Build and create ZIP files
./build.sh clean            # Remove dist directory
```

**Windows (PowerShell):**
```powershell
.\build.ps1 all             # Build both browsers
.\build.ps1 chrome          # Build Chrome only
.\build.ps1 firefox         # Build Firefox only
.\build.ps1 package-all     # Build and create ZIP files
.\build.ps1 clean           # Remove dist directory
```

## Directory Structure

```
owlCloud/
├── manifest.json          # Chrome manifest (MV3)
├── manifest_firefox.json  # Firefox manifest (MV2)
├── src/                   # Shared source code
├── icons/                 # Extension icons
├── build.js               # Node.js build script
├── build.sh               # Bash build script
├── build.ps1              # PowerShell build script
├── dist/                  # Build output
│   ├── chrome/            # Chrome build
│   ├── firefox/           # Firefox build
│   ├── owlcloud-chrome.zip
│   └── owlcloud-firefox.zip
```

## Installing in Browsers

### Chrome
1. Build: `npm run build` or `./build.sh chrome`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/chrome/` directory

### Firefox
1. Build: `npm run build` or `./build.sh firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from `dist/firefox/`

### Installing ZIP Packages
- **Chrome**: Upload `owlcloud-chrome.zip` to Chrome Web Store
- **Firefox**: Upload `owlcloud-firefox.zip` to Firefox Add-ons

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

### Quick Development (Without Building)
For rapid development, you can load the extension directly from the root directory:

**Chrome:**
- Load root directory in `chrome://extensions/`
- Uses `manifest.json` (Manifest V3)

**Firefox:**
- Temporarily rename `manifest_firefox.json` to `manifest.json`
- Load in `about:debugging`
- Remember to restore the original manifest before committing

### Making Changes
1. Edit source files in `src/`
2. Rebuild: `npm run build`
3. Reload extension in browser:
   - **Chrome**: Click refresh icon on extension card
   - **Firefox**: Click "Reload" button

### Debugging
- **Content Scripts**: Browser DevTools console on DiceCloud/Roll20 pages
- **Background Script**: 
  - Chrome: Click "Service Worker" in extension details
  - Firefox: Click "Inspect" on extension in about:debugging
- **Popup**: Right-click extension popup → "Inspect"

## API Differences Handled

The extension automatically handles these browser differences:
1. **Background scripts**: Service worker (Chrome) vs. script (Firefox)
2. **Browser API**: `chrome` vs. `browser` namespace
3. **Storage API**: Callback-based (Chrome) vs. Promise-based (Firefox)
4. **Extension button**: `action` (Chrome MV3) vs. `browser_action` (Firefox MV2)
5. **Web accessible resources**: Different syntax between MV2 and MV3
6. **Manifest version**: V3 (Chrome) vs. V2 (Firefox for better compatibility)

## Build Script Options

### Node.js (build.js)
```bash
npm run build              # Build both browsers + create ZIPs
```

### Bash (build.sh)
```bash
./build.sh chrome          # Build Chrome only
./build.sh firefox         # Build Firefox only
./build.sh all             # Build both (no ZIPs)
./build.sh package-chrome  # Build Chrome + create ZIP
./build.sh package-firefox # Build Firefox + create ZIP
./build.sh package-all     # Build both + create ZIPs
./build.sh clean           # Remove dist directory
```

### PowerShell (build.ps1)
```powershell
.\build.ps1 chrome         # Build Chrome only
.\build.ps1 firefox        # Build Firefox only
.\build.ps1 all            # Build both (no ZIPs)
.\build.ps1 package-chrome # Build Chrome + create ZIP
.\build.ps1 package-firefox # Build Firefox + create ZIP
.\build.ps1 package-all    # Build both + create ZIPs
.\build.ps1 clean          # Remove dist directory
```

## Troubleshooting

### Build Issues

**"zip command not found" (Linux/macOS)**
- The build script will still create the dist directories
- Manually zip with: `cd dist/chrome && zip -r ../owlcloud-chrome.zip .`

**PowerShell execution policy error (Windows)**
- Run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- Or use: `powershell -ExecutionPolicy Bypass -File build.ps1 all`

**Node.js not found**
- Install Node.js from https://nodejs.org/
- Or use the bash/PowerShell scripts instead

### Extension Loading Issues

**Chrome: "Manifest file is missing or unreadable"**
- Make sure you selected the `dist/chrome/` directory
- Check that `manifest.json` exists in the directory

**Firefox: "There was an error during installation"**
- Load the `manifest.json` file directly, not the directory
- Check browser console for specific error messages
- Ensure Firefox version is 109+

## Publishing

### Chrome Web Store
1. Build: `npm run build`
2. Upload `dist/owlcloud-chrome.zip` to Chrome Web Store Developer Dashboard
3. Fill out listing details and submit for review

### Firefox Add-ons (AMO)
1. Build: `npm run build`
2. Upload `dist/owlcloud-firefox.zip` to Firefox Add-ons Developer Hub
3. Fill out listing details and submit for review
4. Note: May need to use `web-ext` tool for signing

## Next Steps

After building, see the main README.md for:
- Installation instructions
- Usage guide
- Feature documentation
- Troubleshooting
