#!/usr/bin/env node

/**
 * Build CRX using the crx npm package (well-tested implementation)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ChromeExtension = require('crx');
const extract = require('extract-zip');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const KEYS_DIR = path.join(ROOT_DIR, 'keys');

async function build() {
  console.log('🔐 Building CRX using crx library');
  console.log('==================================');

  // Get or create private key
  const privateKeyPath = path.join(KEYS_DIR, 'private.pem');
  let privateKey;

  if (fs.existsSync(privateKeyPath)) {
    console.log('🔑 Using existing private key');
    privateKey = fs.readFileSync(privateKeyPath);
  } else {
    console.log('🔑 Generating new key pair...');
    fs.mkdirSync(KEYS_DIR, { recursive: true });

    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    privateKey = keyPair.privateKey;
    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(path.join(KEYS_DIR, 'public.pem'), keyPair.publicKey);
  }

  // First extract the ZIP to a temp folder
  const tempDir = path.join(DIST_DIR, 'chrome-build-temp');
  const zipPath = path.join(DIST_DIR, 'rollcloud-chrome.zip');

  if (!fs.existsSync(zipPath)) {
    console.log('❌ ZIP not found. Run build-extension-fixed.js first.');
    process.exit(1);
  }

  // Clean temp dir
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // Extract ZIP (cross-platform)
  await extract(zipPath, { dir: tempDir });
  console.log(`📦 Extracted ZIP to ${tempDir}`);

  // Create CRX
  const crx = new ChromeExtension({
    privateKey: privateKey
  });

  await crx.load(tempDir);

  const crxBuffer = await crx.pack();
  const crxPath = path.join(DIST_DIR, 'rollcloud-chrome.crx');
  fs.writeFileSync(crxPath, crxBuffer);

  // Get extension ID
  const publicKey = crx.publicKey;
  const hash = crypto.createHash('sha256').update(publicKey).digest();
  let extensionId = '';
  for (let i = 0; i < 16; i++) {
    extensionId += String.fromCharCode(97 + ((hash[i] >> 4) & 0x0F));
    extensionId += String.fromCharCode(97 + (hash[i] & 0x0F));
  }

  fs.writeFileSync(path.join(DIST_DIR, 'rollcloud-chrome.id'), extensionId);

  // Update manifest with key
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.key = publicKey.toString('base64');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Clean up temp dir
  fs.rmSync(tempDir, { recursive: true });

  console.log(`\n✅ CRX created successfully!`);
  console.log(`📁 Output: ${crxPath}`);
  console.log(`🆔 Extension ID: ${extensionId}`);
  console.log(`📏 Size: ${crxBuffer.length} bytes`);

  // Verify the CRX header
  const magic = crxBuffer.slice(0, 4).toString();
  const version = crxBuffer.readUInt32LE(4);
  console.log(`\n🔍 CRX Header verification:`);
  console.log(`   Magic: ${magic}`);
  console.log(`   Version: ${version}`);

  console.log(`\n⚠️  IMPORTANT: Chrome Installation Notes`);
  console.log(`   Chrome blocks drag-and-drop CRX installation for security.`);
  console.log(`   Use one of these methods instead:`);
  console.log(`   `);
  console.log(`   1. Developer Mode (recommended for testing):`);
  console.log(`      - Go to chrome://extensions`);
  console.log(`      - Enable "Developer mode"`);
  console.log(`      - Click "Load unpacked" and select: ${tempDir}`);
  console.log(`      - Or extract the ZIP and load that folder`);
  console.log(`   `);
  console.log(`   2. Enterprise Policy (for deployment):`);
  console.log(`      - Use the installer to set up enterprise policies`);
  console.log(`      - CRX will auto-install on browser restart`);
  console.log(`   `);
  console.log(`   3. Chrome Web Store (for public distribution):`);
  console.log(`      - Upload ZIP to Chrome Developer Dashboard`);

  // Also create an unpacked folder for easy developer mode loading
  const unpackedDir = path.join(DIST_DIR, 'chrome-unpacked');
  if (fs.existsSync(unpackedDir)) {
    fs.rmSync(unpackedDir, { recursive: true });
  }
  fs.mkdirSync(unpackedDir, { recursive: true });
  await extract(zipPath, { dir: unpackedDir });
  console.log(`\n📂 Unpacked extension ready at: ${unpackedDir}`);
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
