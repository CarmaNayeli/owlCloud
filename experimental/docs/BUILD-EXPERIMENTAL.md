# Building OwlCloud with Experimental Two-Way Sync

This document explains how to build OwlCloud with the experimental DiceCloud two-way sync feature.

## What is the Experimental Build?

The experimental build includes:
- **Meteor DDP client** - For real-time communication with DiceCloud's backend
- **Two-way sync** - Changes made in OwlCloud automatically update DiceCloud
- **Property tracking** - Syncs action uses, resource consumption, HP, and more

⚠️ **Status:** Experimental - not integrated into main extension yet. Files are copied to `src/lib/` during build but not yet used by the extension code.

## Building

### Using npm (Cross-platform)

```bash
# Standard build (no experimental features)
npm run build

# Experimental build with two-way sync
npm run build:experimental
# or shorter:
npm run build:exp

# Clean all build directories
npm run clean
```

### Using Node.js directly

```bash
# Standard build
node build.js

# Experimental build
node build.js --experimental
# or shorter:
node build.js --exp
```

### Using PowerShell (Windows)

```powershell
# Experimental Chrome build
.\build-experimental.ps1 -Chrome

# Experimental Firefox build
.\build-experimental.ps1 -Firefox

# Both browsers
.\build-experimental.ps1 -All
```

### Using Bash (Linux/Mac)

```bash
# Experimental Chrome build
./build-experimental.sh chrome

# Experimental Firefox build
./build-experimental.sh firefox

# Both browsers
./build-experimental.sh all

# Package as zip
./build-experimental.sh package-all
```

## Build Output

### Standard Build
- **Directory:** `dist/`
- **Files:**
  - `dist/chrome/` - Chrome extension
  - `dist/firefox/` - Firefox add-on
  - `dist/safari/` - Safari extension

### Experimental Build
- **Directory:** `dist-experimental/`
- **Files:**
  - `dist-experimental/chrome/` - Chrome with experimental sync
  - `dist-experimental/firefox/` - Firefox with experimental sync
  - `dist-experimental/safari/` - Safari with experimental sync

### Experimental Build Differences

The experimental build includes additional files:

```
dist-experimental/chrome/
├── src/
│   ├── lib/                          # NEW
│   │   ├── meteor-ddp-client.js     # DDP protocol client
│   │   └── dicecloud-sync.js        # DiceCloud sync wrapper
│   └── ... (all normal src files)
├── EXPERIMENTAL-README.md            # NEW
├── IMPLEMENTATION_GUIDE.md           # NEW
└── manifest.json                     # Modified version
```

**Manifest Changes:**
- `name`: Appended with " (Experimental Sync)"
- `version`: Appended with ".1" (e.g., 1.1.0 → 1.1.0.1)
- `web_accessible_resources`: Includes experimental files

## Testing the Experimental Build

1. **Build the experimental version:**
   ```bash
   npm run build:experimental
   ```

2. **Load in browser:**
   - **Chrome:** `chrome://extensions/` → Load unpacked → `dist-experimental/chrome/`
   - **Firefox:** `about:debugging` → Load Temporary Add-on → `dist-experimental/firefox/manifest.json`

3. **Test sync:**
   - Log in to DiceCloud through the extension
   - Use an action with limited uses
   - Check DiceCloud character sheet - uses should update
   - Check browser console (F12) for `[DDP]` and `[Sync]` messages

4. **Read documentation:**
   - See `dist-experimental/chrome/EXPERIMENTAL-README.md`
   - See `dist-experimental/chrome/IMPLEMENTATION_GUIDE.md`

## Implementation Status

⚠️ **Current Status:** The experimental files are **copied** to the build but **not integrated** into the extension code yet.

To fully integrate:
1. Modify `src/background.js` to initialize DDP connection
2. Modify `src/popup-sheet.js` to call sync methods
3. Modify `src/content/dicecloud.js` to store property `_id` values
4. Add settings toggle to enable/disable sync

See `experimental/two-way-sync/IMPLEMENTATION_GUIDE.md` for complete integration instructions.

## Cleanup

```bash
# Remove standard build
rm -rf dist/

# Remove experimental build
rm -rf dist-experimental/

# Remove both (using npm script)
npm run clean
```

## Troubleshooting

### Build fails with "experimental directory not found"

Make sure you're in the root directory and the experimental directory exists:
```bash
ls experimental/two-way-sync/
# Should show: README.md, meteor-ddp-client.js, dicecloud-sync.js, etc.
```

### PowerShell script won't run

Enable script execution:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Zip command not found (Bash)

Install zip utility:
```bash
# Ubuntu/Debian
sudo apt-get install zip

# Mac
brew install zip
```

## See Also

- `experimental/two-way-sync/README.md` - Overview of experimental sync
- `experimental/two-way-sync/IMPLEMENTATION_GUIDE.md` - Complete integration guide
- `experimental/two-way-sync/integration-example.js` - Code examples
