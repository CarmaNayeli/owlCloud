# OwlCloud Enterprise Deployment Guide

## 🔐 Enterprise Deployment Overview

This guide covers deploying OwlCloud extensions in enterprise environments using Chrome Enterprise Policies and Firefox Group Policies.

## 📋 Prerequisites

### Chrome Enterprise
- Chrome Enterprise version (not regular Chrome)
- Administrative access to Group Policy Editor
- Extension ID: `mkckngoemfjdkhcpaomdndlecolckgdj`

### Firefox Enterprise
- Firefox ESR (Extended Support Release)
- Administrative access to Group Policy
- Extension ID: `owlcloud@dicecat.dev`

## 🚀 Chrome Enterprise Deployment

### Method 1: Group Policy Editor (Recommended)

1. **Open Group Policy Editor**
   - Press `Win + R`, type `gpedit.msc`
   - Navigate to: `Computer Configuration → Administrative Templates → Google → Google Chrome → Extensions`

2. **Configure Extension Installation**
   - Go to `Extensions → Extension Installation Forcelist`
   - Add new entry:
     - **Property Name**: `1` (or next available number)
     - **Property Value**: `mkckngoemfjdkhcpaomdndlecolckgdj`
     - **Property Value Name**: `update_url`
     - **Property Value**: `https://your-company.com/owlcloud-chrome-signed.crx`

3. **Deploy Extension**
   - Group Policy will automatically install the extension
   - Users cannot disable or remove it
   - Updates handled automatically when new version is published

### Method 2: Registry Configuration

For manual registry deployment:

```reg
Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist]
"1"="mkckngoemfjdkhcpaomdndlecolckgdj|https://your-company.com/owlcloud-chrome-signed.crx"
```

### Method 3: JSON Configuration File

Create `C:\Program Files\Google\Chrome\master_preferences\managed_policies.json`:

```json
{
  "ExtensionInstallForcelist": [
    {
      "id": "mkckngoemfjdkhcpaomdndlecolckgdj",
      "update_url": "https://your-company.com/owlcloud-chrome-signed.crx"
    }
  ]
}
```

## 🦊 Firefox Enterprise Deployment

### Method 1: Group Policy Object (Recommended)

1. **Create Group Policy Object**
   - Open Firefox ESR
   - Go to `about:config`
   - Search for "toolkit.legacyUserProfileCustomizations"
   - Set to `true`

2. **Create Policies JSON**
   Create `C:\Program Files\Mozilla Firefox\policies.json`:

```json
{
  "policies": {
    "Extensions": {
      "Install": [
        {
          "id": "owlcloud@dicecat.dev",
          "update_url": "https://your-company.com/owlcloud-firefox-signed.xpi",
          "installation_mode": "force_installed"
        }
      ],
      "Allowed": [
        "owlcloud@dicecat.dev"
      ],
      "Blocked": []
    }
  }
}
```

### Method 2: AutoConfig File

Create `autoconfig.js` in Firefox installation directory:

```javascript
lockPref("extensions.installOrigins", JSON.stringify({
  "owlcloud@dicecat.dev": "https://your-company.com/owlcloud-firefox-signed.xpi"
}));

lockPref("extensions.autoDisableScopes", JSON.stringify([
  "owlcloud@dicecat.dev"
]));
```

## 📦 Files Required for Enterprise

### Chrome Enterprise
- **Signed CRX**: `owlcloud-chrome-signed.crx`
- **Extension ID**: `mkckngoemfjdkhcpaomdndlecolckgdj`
- **Update URL**: Host the CRX file on internal server

### Firefox Enterprise  
- **Signed XPI**: `owlcloud-firefox-signed.xpi`
- **Extension ID**: `owlcloud@dicecat.dev`
- **Update URL**: Host the XPI file on internal server

## 🔧 Update Manifest for Enterprise

The manifest.json is already configured for enterprise deployment with the public key:

```json
{
  "key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "manifest_version": 3,
  "name": "OwlCloud: DiceCloud + Roll20 + Discord Integration",
  "version": "1.2.4",
  // ... rest of manifest
}
```

## 🌐 Hosting the Extension Files

### Internal Server Setup

1. **Create internal web server** to host extension files
2. **Upload signed files** to server:
   - `owlcloud-chrome-signed.crx`
   - `owlcloud-firefox-signed.xpi`
3. **Generate update URLs**:
   - Chrome: `https://your-company.com/owlcloud-chrome-signed.crx`
   - Firefox: `https://your-company.com/owlcloud-firefox-signed.xpi`

### Update URLs in Policies

When you deploy to different servers, update the `update_url` in your policies to point to the correct location.

## 🔄 Update Process

### For Chrome Updates:
1. Build new signed version: `npm run build:signed:chrome`
2. Update CRX file on internal server
3. Chrome will automatically update within 24 hours

### For Firefox Updates:
1. Build new signed version: `npm run build:signed:firefox`
2. Update XPI file on internal server
3. Firefox will check for updates periodically

## 🛡️ Security Considerations

### Private Key Management
- **Store private key securely**: `keys/private.pem`
- **Never share private key** outside your organization
- **Backup private key** in secure location
- **Rotate keys** if compromised

### Extension Verification
- **Chrome**: Extension ID `mkckngoemfjdkhcpaomdndlecolckgdj` is unique to your key pair
- **Firefox**: Extension ID `owlcloud@dicecat.dev` is hardcoded in manifest
- **Verify signatures**: Both browsers validate the digital signatures

## 🎯 Testing Enterprise Deployment

### Chrome Testing
1. Deploy to a test machine using Group Policy
2. Verify extension appears in `chrome://extensions/`
3. Test extension functionality
4. Verify user cannot disable extension

### Firefox Testing
1. Deploy to a test machine using Group Policy
2. Verify extension appears in `about:addons`
3. Test extension functionality
4. Verify user cannot disable extension

## 📞 Support and Troubleshooting

### Common Issues
- **Extension not installing**: Check policy syntax and file URLs
- **Update failures**: Verify file accessibility and permissions
- **Signature errors**: Ensure using the correct signed files
- **Permission issues**: Verify browser enterprise version

### Debug Information
- **Chrome**: Check `chrome://policy/` for policy status
- **Firefox**: Check `about:policies` for policy status
- **Logs**: Check browser console for extension errors

## 📚 OwlCloud Enterprise Features

With enterprise deployment, users get:
- ✅ **Automatic installation** - No user action required
- ✅ **Automatic updates** - Always latest version
- ✅ **Cannot disable** - Extension stays active
- ✅ **Centralized control** - IT admin manages all extensions
- ✅ **OwlCloud integration** - DiceCloud + Roll20 + Discord
- ✅ **Enterprise security** - Signed and verified

## 🎉 Next Steps

1. **Build signed extensions**: `npm run build:signed`
2. **Host files internally**: Upload to your company server
3. **Configure enterprise policies**: Use the provided templates
4. **Deploy to users**: Group Policy will handle installation
5. **Monitor and maintain**: Update as needed using the same process

Your OwlCloud extension is now ready for enterprise deployment! 🏢
