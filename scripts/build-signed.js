#!/usr/bin/env node

/**
 * Build properly signed extensions for distribution
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const extract = require('extract-zip');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const KEYS_DIR = path.join(ROOT_DIR, 'keys');

/**
 * Build signed Chrome extension using crx library
 */
async function buildSignedChrome() {
  console.log('🔐 Building Signed Chrome Extension');
  console.log('===================================');

  const ChromeExtension = require('crx');

  // Ensure keys directory exists
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  // Get or create private key
  const privateKeyPath = path.join(KEYS_DIR, 'private.pem');
  let privateKey;

  if (fs.existsSync(privateKeyPath)) {
    console.log('🔑 Using existing private key');
    privateKey = fs.readFileSync(privateKeyPath);
  } else {
    console.log('🔑 Generating new key pair...');
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    privateKey = keyPair.privateKey;
    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(path.join(KEYS_DIR, 'public.pem'), keyPair.publicKey);
  }

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

  // Create CRX using crx library
  const crx = new ChromeExtension({ privateKey });
  await crx.load(tempDir);
  const crxBuffer = await crx.pack();

  // Save as rollcloud-chrome-signed.crx (for enterprise build compatibility)
  const crxPath = path.join(DIST_DIR, 'rollcloud-chrome-signed.crx');
  fs.writeFileSync(crxPath, crxBuffer);

  // Also save as rollcloud-chrome.crx
  fs.writeFileSync(path.join(DIST_DIR, 'rollcloud-chrome.crx'), crxBuffer);

  // Generate extension ID
  const publicKey = crx.publicKey;
  const hash = crypto.createHash('sha256').update(publicKey).digest();
  let extensionId = '';
  for (let i = 0; i < 16; i++) {
    extensionId += String.fromCharCode(97 + ((hash[i] >> 4) & 0x0F));
    extensionId += String.fromCharCode(97 + (hash[i] & 0x0F));
  }

  // Save extension ID
  fs.writeFileSync(path.join(DIST_DIR, 'rollcloud-chrome-signed.id'), extensionId);
  fs.writeFileSync(path.join(DIST_DIR, 'rollcloud-chrome.id'), extensionId);

  // Update manifest with key
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.key = publicKey.toString('base64');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });

  console.log(`\n✅ Chrome CRX created: ${crxPath}`);
  console.log(`   Extension ID: ${extensionId}`);
  console.log(`   Size: ${(crxBuffer.length / 1024).toFixed(1)} KB`);

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
