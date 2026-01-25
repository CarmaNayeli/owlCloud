#!/usr/bin/env node

/**
 * Build properly signed extensions for distribution
 * Uses crx3 package for proper CRX3 format with signed proofs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const extract = require('extract-zip');
const crx3 = require('crx3');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const KEYS_DIR = path.join(ROOT_DIR, 'keys');

/**
 * Build signed Chrome extension using crx3 library (proper CRX3 format)
 */
async function buildSignedChrome() {
  console.log('🔐 Building Signed Chrome Extension (CRX3)');
  console.log('==========================================');

  // Ensure directories exist
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  const privateKeyPath = path.join(KEYS_DIR, 'private.pem');

  // Build extension ZIP first
  console.log('\n📦 Building extension...');
  execSync('node scripts/build-extension-fixed.js', { stdio: 'inherit', cwd: ROOT_DIR });

  const zipPath = path.join(DIST_DIR, 'rollcloud-chrome.zip');
  if (!fs.existsSync(zipPath)) {
    throw new Error('Extension ZIP not found');
  }

  // Extract ZIP to temp folder (cross-platform)
  const tempDir = path.join(DIST_DIR, 'chrome-build-temp');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });
  await extract(zipPath, { dir: tempDir });

  console.log('🔑 Creating CRX3 with proper signed proofs...');

  // Use crx3 to create properly signed CRX3 file
  const crxPath = path.join(DIST_DIR, 'rollcloud-chrome.crx');
  const manifestPath = path.join(tempDir, 'manifest.json');

  await crx3([manifestPath], {
    keyPath: privateKeyPath,
    crxPath: crxPath
  });

  // Also copy to signed name for compatibility
  fs.copyFileSync(crxPath, path.join(DIST_DIR, 'rollcloud-chrome-signed.crx'));

  // Read the private key to generate extension ID
  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');

  // Generate public key from private key
  const privateKeyObj = crypto.createPrivateKey(privateKeyPem);
  const publicKeyObj = crypto.createPublicKey(privateKeyObj);
  const publicKeyDer = publicKeyObj.export({ type: 'spki', format: 'der' });

  // Generate extension ID from public key
  const hash = crypto.createHash('sha256').update(publicKeyDer).digest();
  let extensionId = '';
  for (let i = 0; i < 16; i++) {
    extensionId += String.fromCharCode(97 + ((hash[i] >> 4) & 0x0F));
    extensionId += String.fromCharCode(97 + (hash[i] & 0x0F));
  }

  // Save extension ID
  fs.writeFileSync(path.join(DIST_DIR, 'rollcloud-chrome-signed.id'), extensionId);
  fs.writeFileSync(path.join(DIST_DIR, 'rollcloud-chrome.id'), extensionId);

  // Update manifest with key (base64 DER)
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));
  manifest.key = publicKeyDer.toString('base64');
  fs.writeFileSync(path.join(ROOT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });

  // Get file size
  const crxSize = fs.statSync(crxPath).size;

  console.log(`\n✅ Chrome CRX3 created: ${crxPath}`);
  console.log(`   Extension ID: ${extensionId}`);
  console.log(`   Size: ${(crxSize / 1024).toFixed(1)} KB`);

  return { extensionId };
}

/**
 * Build Firefox extension (XPI is just a ZIP with correct manifest)
 */
async function buildSignedFirefox() {
  console.log('\n🔐 Building Firefox Extension');
  console.log('==============================');

  // Firefox XPI is created by build-extension-fixed.js
  const srcZip = path.join(DIST_DIR, 'rollcloud-firefox.zip');
  const destXpi = path.join(DIST_DIR, 'rollcloud-firefox-signed.xpi');

  if (!fs.existsSync(srcZip)) {
    throw new Error('Firefox ZIP not found. Run build-extension-fixed.js first.');
  }

  // Copy ZIP as XPI
  fs.copyFileSync(srcZip, destXpi);

  console.log(`✅ Firefox XPI created: ${destXpi}`);
  console.log(`   Note: For Firefox, actual signing requires Mozilla AMO or enterprise policy`);

  return { success: true };
}

async function buildAll() {
  console.log('🔐 Building Signed Extensions for Distribution');
  console.log('=============================================');

  try {
    await buildSignedChrome();
    console.log('\n' + '='.repeat(50) + '\n');
    await buildSignedFirefox();

    console.log('\n🎉 All signed extensions built successfully!');
    console.log('\n📋 Output files:');
    console.log('   - dist/rollcloud-chrome-signed.crx (Chrome)');
    console.log('   - dist/rollcloud-firefox-signed.xpi (Firefox)');

  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  buildAll();
}

module.exports = { buildAll, buildSignedChrome, buildSignedFirefox };
