# 🎯 Automatic Extension Deployment - Updated Installer

## ✅ What's Now Fixed

The installer now **automatically configures Chrome and Firefox policies** for enterprise deployment!

### 🔧 Key Updates Made

1. **Chrome Extension ID**: Now uses actual ID `mkckngoemfjdkhcpaomdndlecolckgdj`
2. **Update URLs**: Proper GitHub release URLs for both browsers
3. **Policy Configuration**: Automatic enterprise policy deployment
4. **Cross-Platform**: Windows Registry, macOS plist, Linux JSON support

### 🚀 How It Works Now

**When you run the installer:**

1. **Chrome/Edge**: Automatically creates registry entries:
   ```
   HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist
   Value: "mkckngoemfjdkhcpaomdndlecolckgdj;https://raw.githubusercontent.com/CarmaNayeli/rollCloud/main/updates/update_manifest.xml"
   ```

2. **Firefox**: Automatically creates distribution policies:
   ```json
   {
     "policies": {
       "ExtensionSettings": {
         "rollcloud@dicecat.dev": {
           "installation_mode": "force_installed",
           "install_url": "https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-firefox-signed.xpi"
         }
       }
     }
   }
   ```

### 📋 Installation Process

1. **Run installer** as administrator
2. **Select browser(s)** to deploy
3. **Installer automatically**:
   - Creates enterprise policies
   - Sets force-install configuration
   - Configures update URLs
   - Requires browser restart

4. **Result**: Extensions auto-install when browser restarts

### 🔍 Verification

After installation:
1. **Check Chrome**: `chrome://extensions/` - RollCloud should appear
2. **Check Chrome**: `chrome://policy/` - Verify policies applied
3. **Check Firefox**: `about:addons` - RollCloud should appear
4. **Test functionality** on DiceCloud/Roll20

### 🎯 Expected Behavior

**Before Fix**: CRX files wouldn't install (Chrome security blocks direct installation)

**After Fix**: 
- ✅ Extensions auto-install via enterprise policies
- ✅ Users cannot disable extensions
- ✅ Automatic updates from GitHub releases
- ✅ No manual intervention needed

### 📦 Files Updated

- `installer/src/main.js` - Updated CONFIG with correct IDs and URLs
- `installer/src/extension-installer.js` - Fixed policy deployment logic
- Built installer now includes all fixes

## 🚀 Test It Now

1. **Run the updated installer**: `RollCloud Setup Setup 1.2.0.exe`
2. **Select Chrome** (or Firefox)
3. **Restart browser** when prompted
4. **Verify extension appears** automatically

**The installer now handles everything automatically - no more manual policy configuration needed!** 🎉
