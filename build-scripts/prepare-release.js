#!/usr/bin/env node

/**
 * Release Preparation Script for OwlCloud
 * Builds all browser extensions and packages them into a releases/ folder
 *
 * Usage:
 *   node prepare-release.js              - Production build
 *   node prepare-release.js --dev        - Development build with DEBUG enabled
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RELEASES_DIR = path.join(ROOT, 'releases');
const DIST_DIR = path.join(ROOT, 'dist');

// Check for build flags
const args = process.argv.slice(2);
const isDev = args.includes('--dev');

console.log('🚀 OwlCloud Release Preparation\n');
console.log(`🔧 Build mode: ${isDev ? 'DEVELOPMENT (DEBUG = true)' : 'PRODUCTION (DEBUG = false)'}\n`);

// Step 1: Run the build script
console.log('📦 Building browser extensions...\n');
try {
  const buildCmd = isDev
    ? 'node build-scripts/build.js --dev'
    : 'node build-scripts/build.js';

  execSync(buildCmd, { stdio: 'inherit', cwd: ROOT });
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Step 2: Create releases directory
console.log('\n📁 Preparing releases directory...');
if (fs.existsSync(RELEASES_DIR)) {
  console.log('   🧹 Cleaning existing releases directory...');
  fs.rmSync(RELEASES_DIR, { recursive: true, force: true });
}
fs.mkdirSync(RELEASES_DIR, { recursive: true });

// Step 3: Copy and rename zip files
console.log('📦 Packaging releases...\n');

const zipMappings = [
  { src: 'owlcloud-chrome.zip', dest: 'owlcloud-extension-chrome.zip', name: 'Chrome' },
  { src: 'owlcloud-firefox.zip', dest: 'owlcloud-extension-firefox.zip', name: 'Firefox' },
  { src: 'owlcloud-safari.zip', dest: 'owlcloud-extension-safari.zip', name: 'Safari' }
];

zipMappings.forEach(({ src, dest, name }) => {
  const srcPath = path.join(DIST_DIR, src);
  const destPath = path.join(RELEASES_DIR, dest);

  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`   ✅ ${name}: releases/${dest}`);
  } else {
    console.log(`   ⚠️  ${name} zip not found, skipping...`);
  }
});

// Step 4: Create universal "owlcloud-extension.zip" (Chrome version as default)
const universalSrc = path.join(DIST_DIR, 'owlcloud-chrome.zip');
const universalDest = path.join(RELEASES_DIR, 'owlcloud-extension.zip');

if (fs.existsSync(universalSrc)) {
  fs.copyFileSync(universalSrc, universalDest);
  console.log('   ✅ Universal: releases/owlcloud-extension.zip (Chrome/Edge)');
}

// Step 5: Create README in releases folder
console.log('\n📝 Creating release documentation...');
const readmeContent = `# OwlCloud Browser Extension Releases

This directory contains packaged browser extensions ready for distribution.

## Files

- **owlcloud-extension.zip** - Universal package for Chrome and Edge (recommended)
- **owlcloud-extension-chrome.zip** - Chrome/Edge specific package
- **owlcloud-extension-firefox.zip** - Firefox specific package
- **owlcloud-extension-safari.zip** - Safari specific package

## Installation Instructions

### Chrome / Edge
1. Download \`owlcloud-extension.zip\`
2. Unzip the file
3. Open \`chrome://extensions/\` (Chrome) or \`edge://extensions/\` (Edge)
4. Enable "Developer mode"
5. Click "Load unpacked" and select the unzipped folder

### Firefox
1. Download \`owlcloud-extension-firefox.zip\`
2. Open \`about:debugging#/runtime/this-firefox\`
3. Click "Load Temporary Add-on"
4. Select the zip file (no need to unzip)

### Safari
1. Download \`owlcloud-extension-safari.zip\`
2. See SAFARI.md in the project root for conversion instructions

## GitHub Releases

These files are intended to be uploaded to GitHub Releases with unversioned filenames.
The dashboard links to:
\`https://github.com/CarmaNayeli/OwlCloud/releases/latest/download/owlcloud-extension.zip\`

This ensures users always get the latest version without updating the link.

---

Built with ❤️ for the Owlbear Rodeo community
`;

fs.writeFileSync(path.join(RELEASES_DIR, 'README.md'), readmeContent);

// Step 6: Display summary
console.log('\n✨ Release preparation complete!\n');
console.log('📂 Release packages created in: releases/\n');
console.log('📦 Files ready for distribution:');
console.log('   • owlcloud-extension.zip (universal - Chrome/Edge)');
console.log('   • owlcloud-extension-chrome.zip');
console.log('   • owlcloud-extension-firefox.zip');
console.log('   • owlcloud-extension-safari.zip');
console.log('   • README.md');

console.log('\n🚀 Next steps:');
console.log('   1. Test each extension package');
console.log('   2. Create a new GitHub release');
console.log('   3. Upload all files from releases/ directory');
console.log('   4. Users can download via: .../releases/latest/download/owlcloud-extension.zip');

if (isDev) {
  console.log('\n⚠️  Note: This is a DEVELOPMENT build with DEBUG = true');
}
