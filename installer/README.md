# OwlCloud Setup Wizard

One-time installer that sets up the OwlCloud browser extension and connects it to Discord via Pip Bot.

## What It Does

1. **Installs the browser extension** (Chrome/Edge/Firefox) via enterprise policy - no store approval needed
2. **Opens Discord** to add Pip Bot to your server
3. **Generates a pairing code** and waits for you to connect
4. **Exits** - you never need to run it again

## For Users

### Download

Download the installer for your platform from [Releases](https://github.com/CarmaNayeli/rollCloud/releases):

- **Windows**: `OwlCloud-Setup-1.0.0.exe`
- **macOS**: `OwlCloud-Setup-1.0.0.dmg`
- **Linux**: `OwlCloud-Setup-1.0.0.AppImage`

### Requirements

- **Administrator/sudo access** - Required to install browser policies
- One of: Google Chrome, Microsoft Edge, or Mozilla Firefox
- A Discord account with a server you can add bots to

### Usage

1. Run the installer
2. Select your browser
3. Click "Add Pip Bot to Discord" and authorize it
4. Type the pairing code in Discord: `/owlcloud XXXXXX`
5. Done! Close the installer.

## For Developers

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
cd installer
npm install
```

### Development

```bash
# Run in dev mode with DevTools
npm run dev

# Run normally
npm start
```

### Building

```bash
# Build for current platform
npm run build

# Build for specific platform
npm run build:win
npm run build:mac
npm run build:linux

# Build for all platforms
npm run build:all
```

### Project Structure

```
installer/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # IPC bridge (secure)
│   ├── renderer.js          # UI logic
│   ├── extension-installer.js  # Policy installation for each OS
│   ├── pairing.js           # Supabase pairing logic
│   ├── index.html           # Setup wizard UI
│   └── styles.css           # Styles
├── assets/
│   ├── icon.ico             # Windows icon
│   ├── icon.icns            # macOS icon
│   └── icon.png             # Linux icon
├── package.json
└── README.md
```

### How Extension Installation Works

#### Chrome/Edge (Windows)
- Writes to registry: `HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist`
- Chrome reads this on startup and installs the extension from the update manifest URL

#### Chrome/Edge (macOS)
- Writes plist to `/Library/Managed Preferences/com.google.Chrome.plist`
- Similar mechanism, Chrome reads on startup

#### Chrome/Edge (Linux)
- Writes JSON to `/etc/opt/chrome/policies/managed/owlcloud.json`
- Chrome reads this directory for policies

#### Firefox (All platforms)
- Uses distribution folder method
- Writes `policies.json` to Firefox's distribution directory
- Specifies extension install URL

### Configuration

Update these values in `src/main.js`:

```javascript
const CONFIG = {
  extensionId: 'your-extension-id',           // From manifest.json or CRX
  pipBotInviteUrl: 'https://discord.com/...', // Your Pip Bot OAuth URL
  supabaseUrl: 'https://xxx.supabase.co',     // Your Supabase project
  supabaseAnonKey: 'your-anon-key',           // Supabase anon key
  updateManifestUrl: 'https://...'            // URL to update_manifest.xml
};
```

### Hosting the Extension

1. **Build the extension** as a `.crx` file (Chrome) or `.xpi` (Firefox)
2. **Upload to GitHub Releases** (or your own hosting)
3. **Update `updates/update_manifest.xml`** with the download URL
4. **Push** so the manifest is accessible at raw.githubusercontent.com

### Signing

For production releases:
- **Windows**: Sign with a code signing certificate to avoid SmartScreen warnings
- **macOS**: Sign and notarize with Apple Developer certificate
- **Linux**: AppImage doesn't require signing

## Troubleshooting

### "Extension not installing"
- Make sure you have admin rights
- Restart the browser after installation
- Check if your organization blocks policy-installed extensions

### "Pairing code not working"
- Make sure Pip Bot is in your server
- Make sure Supabase is configured correctly
- Check the console for errors

### "Firefox extension not appearing"
- Firefox requires a restart
- Check that the distribution folder was created: `/Applications/Firefox.app/Contents/Resources/distribution/`

## License

MIT
