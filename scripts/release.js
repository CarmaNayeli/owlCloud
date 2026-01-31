#!/usr/bin/env node

/**
 * Release script - builds and prepares files for GitHub release
 *
 * Usage:
 *   node scripts/release.js
 *
 * Then upload the dist/ files to a GitHub release.
 * The enterprise policy will auto-install from:
 *   https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-chrome.crx
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

async function release() {
  console.log('🚀 OwlCloud Release Builder');
  console.log('============================\n');

  // Step 1: Build extension
  console.log('📦 Step 1: Building extension...');
  execSync('node', ['scripts/build-extension-fixed.js'], { stdio: 'inherit', cwd: ROOT_DIR });

  // Step 2: Build signed CRX with crx3 library
  console.log('\n📦 Step 2: Building signed CRX...');
  execSync('node', ['scripts/build-signed.js'], { stdio: 'inherit', cwd: ROOT_DIR });

  // Step 3: Verify files exist
  console.log('\n✅ Step 3: Verifying build artifacts...');
  const requiredFiles = [
    'owlcloud-chrome.crx',
    'owlcloud-chrome.zip',
    'owlcloud-firefox.zip'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(DIST_DIR, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`   ✓ ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`   ✗ ${file} - MISSING!`);
    }
  }

  // Step 4: Read version from manifest
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));
  const version = manifest.version;

  console.log(`\n📋 Release Summary:`);
  console.log(`   Version: ${version}`);
  console.log(`   Extension ID: ${fs.readFileSync(path.join(DIST_DIR, 'owlcloud-chrome.id'), 'utf8').trim()}`);

  console.log(`\n📤 Next Steps:`);
  console.log(`   1. Go to: https://github.com/CarmaNayeli/rollCloud/releases/new`);
  console.log(`   2. Tag: v${version}`);
  console.log(`   3. Upload these files from dist/:`);
  console.log(`      - owlcloud-chrome.crx`);
  console.log(`      - owlcloud-chrome.zip`);
  console.log(`      - owlcloud-firefox.zip`);
  console.log(`   4. Publish the release`);
  console.log(`\n   Enterprise policy will auto-install from:`);
  console.log(`   https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-chrome.crx`);

  // Optional: Use gh CLI if available
  console.log(`\n💡 Or use GitHub CLI (if installed):`);
  console.log(`   gh release create v${version} dist/owlcloud-chrome.crx dist/owlcloud-chrome.zip dist/owlcloud-firefox.zip --title "OwlCloud v${version}" --notes "Release v${version}"`);
}

release().catch(err => {
  console.error('❌ Release failed:', err.message);
  process.exit(1);
});
