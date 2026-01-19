# Building RollCloud for Different Browsers

This extension supports both Chrome and Firefox through a unified codebase with browser-specific manifests.

## Architecture

The extension uses a **browser API polyfill** (`src/common/browser-polyfill.js`) that provides a unified API across browsers. This allows the same code to run on both Chrome and Firefox without modifications.

### Key Components

- **`manifest.json`** - Chrome Manifest V3 (default)
- **`manifest-firefox.json`** - Firefox Manifest V2
- **`src/common/browser-polyfill.js`** - Browser compatibility layer

## Building for Chrome

### Requirements
- Chrome 88+ (Manifest V3 support)

### Installation
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `/home/user/rollCloud` directory
5. The extension will use `manifest.json` (Manifest V3)

## Building for Firefox

### Requirements
- Firefox 109+ (Manifest V2 required - MV3 not fully supported)

### Installation
1. **Rename manifests**:
   ```bash
   cd /home/user/rollCloud
   mv manifest.json manifest-chrome.json
   mv manifest-firefox.json manifest.json
   ```

2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`

3. Click "Load Temporary Add-on"

4. Select the `manifest.json` file in `/home/user/rollCloud`

5. The extension will load with Firefox-compatible Manifest V2

### For Production (Firefox)

To create a signed Firefox extension:

```bash
# Install web-ext
npm install -g web-ext

# Build the extension
cd /home/user/rollCloud
web-ext build --overwrite-dest

# Sign the extension (requires AMO API credentials)
web-ext sign --api-key=$AMO_JWT_ISSUER --api-secret=$AMO_JWT_SECRET
```

## Key Differences

| Feature | Chrome (MV3) | Firefox (MV2) |
|---------|--------------|---------------|
| Manifest Version | 3 | 2 |
| Background Script | Service Worker | Persistent Background Page |
| Permissions | Separate `host_permissions` | Combined in `permissions` |
| Browser Action | `action` | `browser_action` |
| Web Accessible Resources | Object with matches | Simple array |
| API Namespace | `chrome.*` | `browser.*` (promisified) |

## Browser API Polyfill

The polyfill (`src/common/browser-polyfill.js`) provides:

- **Unified API**: Use `browserAPI` instead of `chrome` or `browser`
- **Promise-based**: All async operations return Promises
- **Automatic detection**: Detects browser and uses appropriate API
- **Error handling**: Consistent error handling across browsers

### Example Usage

```javascript
// Old (Chrome-specific)
chrome.runtime.sendMessage({ action: 'test' }, (response) => {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
  } else {
    console.log(response);
  }
});

// New (Cross-browser)
try {
  const response = await browserAPI.runtime.sendMessage({ action: 'test' });
  console.log(response);
} catch (error) {
  console.error(error);
}
```

## Testing

### Chrome Testing
1. Load the extension with `manifest.json`
2. Open DiceCloud and Roll20
3. Test all features

### Firefox Testing
1. Swap to `manifest-firefox.json` as described above
2. Load as temporary add-on
3. Test all features
4. Verify polyfill console message: `🌐 Browser API polyfill loaded for: firefox`

## Troubleshooting

### Chrome Issues
- **Service Worker not loading**: Check console for importScripts errors
- **API errors**: Verify `browserAPI` is defined before use

### Firefox Issues
- **MV3 not supported**: Use `manifest-firefox.json` (Manifest V2)
- **Background page not persistent**: This is normal for MV2
- **API promises not working**: Check that polyfill loaded successfully

## Future Improvements

- Automated build script to swap manifests
- Webpack/Rollup build pipeline
- Automated testing with both browsers
- CI/CD for both Chrome Web Store and Firefox Add-ons
