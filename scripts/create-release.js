#!/usr/bin/env node

/**
 * GitHub Release Creator
 * Creates GitHub releases with proper assets
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const RELEASE_DIR = path.join(ROOT_DIR, 'releases');

// Get version from package.json
function getVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  return packageJson.version;
}

// Get release info from production build
function getReleaseInfo() {
  const version = getVersion();
  const chromeCRX = path.join(RELEASE_DIR, `owlcloud-chrome-${version}.crx`);
  const firefoxXPI = path.join(RELEASE_DIR, `owlcloud-firefox-${version}.xpi`);
  
  if (!fs.existsSync(chromeCRX) || !fs.existsSync(firefoxXPI)) {
    console.error('Production files not found. Run build:production first.');
    process.exit(1);
  }
  
  return {
    version,
    tag: `v${version}`,
    name: `OwlCloud ${version}`,
    chrome: chromeCRX,
    firefox: firefoxXPI
  };
}

// Create release notes
function createReleaseNotes(version) {
  return `# OwlCloud ${version}

## 🚀 Features
- DiceCloud V2 character synchronization
- Roll20 integration with automatic updates
- Discord turn notifications via Pip 2
- Cross-browser support (Chrome, Firefox, Edge)

## 📦 Installation Options

### Option 1: Automatic Installer (Recommended)
Download and run the installer executable for your platform:
- \`OwlCloud Setup Setup ${version}.exe\` (Windows)
- Installer automatically detects and installs browser extensions

### Option 2: Manual Extension Installation
**Chrome:**
1. Download \`owlcloud-chrome-${version}.crx\`
2. Open Chrome and go to \`chrome://extensions/\`
3. Enable "Developer mode"
4. Drag and drop the CRX file

**Firefox:**
1. Download \`owlcloud-firefox-${version}.xpi\`
2. Open Firefox and go to \`about:debugging\`
3. Click "This Firefox" → "Load Temporary Add-on"
4. Select the XPI file

## 🔧 Setup
1. Install the extension in your browser
2. Connect to your DiceCloud account
3. Join the Discord server for Pip 2 integration
4. Configure your Roll20 campaign

## 🐛 Bug Fixes
- Fixed Windows build compatibility issues
- Improved extension packaging for better browser compatibility
- Enhanced installer with automatic extension detection

## 📋 Requirements
- Chrome 109+ or Firefox 109+
- DiceCloud V2 account
- Discord account (for Pip 2 integration)
- Roll20 campaign (optional)

---

**Download Links:**
- [Windows Installer](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/RollCloud%20Setup%20Setup%20${version}.exe)
- [Chrome Extension](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-chrome-${version}.crx)
- [Firefox Extension](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-firefox-${version}.xpi)`;
}

// Check if GitHub CLI is available
function checkGitHubCLI() {
  try {
    execSync('gh', ['--version'], { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

// Create GitHub release using CLI
function createGitHubRelease(releaseInfo) {
  if (!checkGitHubCLI()) {
    console.log('⚠️  GitHub CLI not found. Please install gh CLI to create releases automatically.');
    console.log('   Visit: https://cli.github.com/manual/installation');
    return false;
  }
  
  try {
    const { version, tag, name, chrome, firefox } = releaseInfo;
    const notes = createReleaseNotes(version);
    
    console.log('\n🚀 Creating GitHub release...');
    
    // Create release
    const releaseArgs = [
      'release', 'create', tag, chrome, firefox,
      '--title', name,
      '--notes', notes,
      '--latest'
    ];
    execSync('gh', releaseArgs, { stdio: 'inherit' });
    
    console.log(`✅ Release ${tag} created successfully!`);
    console.log(`🔗 View at: https://github.com/CarmaNayeli/rollCloud/releases/${tag}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to create GitHub release:', error.message);
    return false;
  }
}

// Update installer to use production files
function updateInstaller(releaseInfo) {
  console.log('\n📦 Updating installer for production...');
  
  const { version, chrome, firefox } = releaseInfo;
  
  // Update installer package.json to reference production files
  const installerPackagePath = path.join(ROOT_DIR, 'installer', 'package.json');
  const installerPackage = JSON.parse(fs.readFileSync(installerPackagePath, 'utf8'));
  
  // Update extraResources to use production files
  installerPackage.build.extraResources = [
    {
      "from": "../releases/owlcloud-chrome-" + version + ".crx",
      "to": "extension/owlcloud-chrome.crx"
    },
    {
      "from": "../releases/owlcloud-firefox-" + version + ".xpi", 
      "to": "extension/owlcloud-firefox.xpi"
    }
  ];
  
  fs.writeFileSync(installerPackagePath, JSON.stringify(installerPackage, null, 2));
  
  // Update installer to use enterprise policy installation for production
  const installerMainPath = path.join(ROOT_DIR, 'installer', 'src', 'main.js');
  let installerMain = fs.readFileSync(installerMainPath, 'utf8');
  
  // Replace local installer with enterprise policy for production
  installerMain = installerMain.replace(
    "const { installExtensions } = require('./local-installer');",
    "// const { installExtensions } = require('./local-installer'); // Disabled for production"
  );
  
  installerMain = installerMain.replace(
    "const results = await installExtensions();",
    "const result = await installExtension(browser, CONFIG); // Use enterprise policy"
  );
  
  installerMain = installerMain.replace(
    "if (browser === 'chrome') {\n      return results.chrome;\n    } else if (browser === 'firefox') {\n      return results.firefox;",
    "return { success: true, ...result };"
  );
  
  fs.writeFileSync(installerMainPath, installerMain);
  
  console.log('✅ Installer updated for production');
}

// Build production installer
function buildProductionInstaller() {
  console.log('\n🔨 Building production installer...');
  
  try {
    execSync('npm run build:installer', { stdio: 'inherit' });
    console.log('✅ Production installer built');
  } catch (error) {
    console.error('❌ Failed to build installer:', error.message);
  }
}

// Main release function
async function createRelease() {
  console.log('OwlCloud Release Creator');
  console.log('========================');
  
  const releaseInfo = getReleaseInfo();
  
  console.log(`Creating release for version ${releaseInfo.version}`);
  
  // Update installer for production
  updateInstaller(releaseInfo);
  
  // Build production installer
  buildProductionInstaller();
  
  // Create GitHub release
  const success = createGitHubRelease(releaseInfo);
  
  if (success) {
    console.log('\n🎉 Release process completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Test the downloaded installer and extensions');
    console.log('2. Update any documentation if needed');
    console.log('3. Announce the release to users');
  } else {
    console.log('\n⚠️  Release created with manual steps required.');
    console.log('Please manually upload the files to GitHub releases.');
  }
}

// Run the release
if (require.main === module) {
  createRelease();
}

module.exports = { createRelease };
