# Chrome Extension Installation Debugging Guide

## 🔍 Issue: CRX File Not Installing

You uploaded the CRX file from the GitHub release but got "no extension" - no errors, no installation.

## 🎯 Most Likely Causes & Solutions

### 1. **Chrome Security Policy (Most Common)**
Chrome blocks direct CRX installation from unknown sources.

**Solutions:**
- **A)** Use the unpacked folder method for testing
- **B)** Use Chrome Enterprise Policy for deployment
- **C)** Publish to Chrome Web Store

### 2. **Extension ID Mismatch**
The CRX is signed with ID: `mkckngoemfjdkhcpaomdndlecolckgdj`

**Verification:**
```bash
# Check the ID in the signed CRX
cat dist/rollcloud-chrome-signed.id
# Should output: mkckngoemfjdkhcpaomdndlecolckgdj
```

### 3. **Manifest Key Mismatch**
The manifest.json contains a specific key that must match the CRX signature.

**Test Method:**
1. Use the unpacked folder in `test-extension/`
2. Load as developer extension in Chrome
3. Check if it works

## 🛠️ Immediate Testing Solutions

### Option A: Test with Unpacked Extension (Recommended)
1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `test-extension` folder
6. Verify it loads and works

### Option B: Chrome Enterprise Policy Installation
1. Open Chrome Group Policy Editor
2. Navigate to: `Computer Configuration > Administrative Templates > Google Chrome > Extensions`
3. Configure "Install extensions" with:
   - Extension ID: `mkckngoemfjdkhcpaomdndlecolckgdj`
   - Update URL: Path to your CRX file
4. Apply policy and restart Chrome

### Option C: Manual CRX Installation (Advanced)
1. Download CRX file locally
2. Open Chrome developer tools
3. Drag CRX to extensions page
4. If blocked, enable: `chrome://flags/#extension-mime-request-handling`

## 🔧 Files Created for Testing

### Unpacked Extension (Ready to test)
- **Location**: `test-extension/` folder
- **Contains**: Full extension source code
- **Usage**: Load as developer extension

### Extension ID Verification
- **File**: `dist/rollcloud-chrome-signed.id`
- **Content**: `mkckngoemfjdkhcpaomdndlecolckgdj`
- **Purpose**: Verify CRX signature matches

## 📋 Troubleshooting Checklist

- [ ] Can you load the unpacked extension from `test-extension/`?
- [ ] Does the extension ID match between CRX and manifest?
- [ ] Are you trying to install on a managed Chrome browser?
- [ ] Is Chrome blocking installation from "unknown sources"?
- [ ] Does the GitHub release CRX file download completely?

## 🚀 Next Steps

1. **Test unpacked extension first** - this will tell us if the code works
2. **If unpacked works** - issue is CRX format/installation method
3. **If unpacked fails** - issue is in the extension code itself

## 📞 Expected Results

**Working Extension Should Show:**
- RollCloud icon in Chrome toolbar
- Popup when clicked
- Content scripts running on DiceCloud/Roll20
- No console errors

Let me know what happens with the unpacked extension test!
