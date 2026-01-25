#!/usr/bin/env node

/**
 * Build properly signed CRX files for enterprise deployment
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const KEYS_DIR = path.join(ROOT_DIR, 'keys');

// Ensure keys directory exists
function ensureKeysDir() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }
}

// Generate or load RSA key pair
function getOrGenerateKeys() {
  const privateKeyPath = path.join(KEYS_DIR, 'private.pem');
  const publicKeyPath = path.join(KEYS_DIR, 'public.pem');
  const publicKeyDerPath = path.join(KEYS_DIR, 'public.der');

  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    console.log('🔑 Using existing RSA key pair');
    const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
    const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');

    // Convert PEM to DER for CRX format
    const publicKeyDer = pemToDer(publicKeyPem);

    return {
      privateKey: privateKeyPem,
      publicKeyPem: publicKeyPem,
      publicKeyDer: publicKeyDer
    };
  }

  console.log('🔑 Generating new RSA key pair...');

  // Generate 2048-bit RSA key pair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // Save keys in PEM format
  fs.writeFileSync(privateKeyPath, privateKey);
  fs.writeFileSync(publicKeyPath, publicKey);

  // Convert and save DER format for CRX
  const publicKeyDer = pemToDer(publicKey);
  fs.writeFileSync(publicKeyDerPath, publicKeyDer);

  console.log(`  Private key: ${privateKeyPath}`);
  console.log(`  Public key (PEM): ${publicKeyPath}`);
  console.log(`  Public key (DER): ${publicKeyDerPath}`);

  return { privateKey, publicKeyPem: publicKey, publicKeyDer };
}

// Convert PEM to DER format (raw binary)
function pemToDer(pem) {
  // Remove PEM headers/footers and decode base64
  const base64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/, '')
    .replace(/-----END [A-Z ]+-----/, '')
    .replace(/\s+/g, '');
  return Buffer.from(base64, 'base64');
}

// Generate Chrome extension ID from DER-encoded public key
function generateChromeId(publicKeyDer) {
  // Chrome extension ID is first 16 bytes of SHA256 hash of the DER public key
  // encoded as lowercase hex with a-p mapping (0-9 -> a-j, a-f -> k-p)
  const hash = crypto.createHash('sha256').update(publicKeyDer).digest();

  // Take first 16 bytes and map to a-p alphabet
  let result = '';
  for (let i = 0; i < 16; i++) {
    const byte = hash[i];
    const low = byte & 0x0F;
    const high = (byte & 0xF0) >> 4;
    // Map 0-15 to 'a'-'p'
    result += String.fromCharCode(97 + high) + String.fromCharCode(97 + low);
  }

  return result.substring(0, 32);
}

// Create properly signed CRX file (CRX2 format with DER-encoded key)
function createSignedCRX(zipPath, crxPath, privateKey, publicKeyDer) {
  return new Promise((resolve, reject) => {
    try {
      // Read ZIP file
      const zipData = fs.readFileSync(zipPath);

      // Create signature over the ZIP data
      const sign = crypto.createSign('RSA-SHA1'); // CRX2 uses SHA1
      sign.update(zipData);
      const signature = sign.sign(privateKey);

      console.log(`   ZIP size: ${zipData.length} bytes`);
      console.log(`   Public key (DER) size: ${publicKeyDer.length} bytes`);
      console.log(`   Signature size: ${signature.length} bytes`);

      // Create CRX2 header (16 bytes)
      const header = Buffer.alloc(16);
      header.write('Cr24', 0); // Magic number
      header.writeUInt32LE(2, 4); // CRX version 2
      header.writeUInt32LE(publicKeyDer.length, 8); // Public key length
      header.writeUInt32LE(signature.length, 12); // Signature length

      console.log(`   Header: ${header.toString('hex')}`);

      // CRX2 format: header + public_key (DER) + signature + zip_data
      const crxData = Buffer.concat([header, publicKeyDer, signature, zipData]);

      // Write CRX file
      fs.writeFileSync(crxPath, crxData);

      // Generate extension ID from DER public key
      const extensionId = generateChromeId(publicKeyDer);
      const idPath = crxPath.replace('.crx', '.id');
      fs.writeFileSync(idPath, extensionId);

      console.log(`  Created: ${crxPath}`);
      console.log(`  Extension ID: ${extensionId}`);
      console.log(`  Total CRX size: ${crxData.length} bytes`);

      resolve({ extensionId });
    } catch (error) {
      console.error('CRX creation error:', error);
      reject(error);
    }
  });
}

// Update Chrome manifest with extension ID (base64 DER key)
function updateChromeManifest(extensionId, publicKeyDer) {
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Chrome manifest "key" field needs base64-encoded DER public key
  manifest.key = publicKeyDer.toString('base64');

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  Updated manifest with public key (base64 DER)`);
}

// Build signed Chrome extension
async function buildSignedChrome() {
  console.log('🔐 Building Signed Chrome Extension');
  console.log('===================================');

  ensureKeysDir();

  // Get or generate keys (now returns DER for CRX format)
  const { privateKey, publicKeyPem, publicKeyDer } = getOrGenerateKeys();

  // Build the extension first (using existing script)
  console.log('\n📦 Building extension...');
  execSync('node scripts/build-extension-fixed.js', { stdio: 'inherit' });

  const zipPath = path.join(DIST_DIR, 'rollcloud-chrome.zip');
  const crxPath = path.join(DIST_DIR, 'rollcloud-chrome-signed.crx');

  if (!fs.existsSync(zipPath)) {
    throw new Error('Extension ZIP not found. Run build-extension-fixed.js first.');
  }

  // Create signed CRX with DER-encoded public key
  const result = await createSignedCRX(zipPath, crxPath, privateKey, publicKeyDer);

  // Update manifest with base64 DER public key
  updateChromeManifest(result.extensionId, publicKeyDer);

  console.log('\n✅ Signed Chrome extension created!');
  console.log(`📁 Files created:`);
  console.log(`   - ${crxPath} (signed CRX2)`);
  console.log(`   - ${crxPath.replace('.crx', '.id')} (extension ID)`);
  console.log(`   - ${path.join(KEYS_DIR, 'private.pem')} (private key - keep secure!)`);
  console.log(`   - ${path.join(KEYS_DIR, 'public.pem')} (public key PEM)`);

  console.log('\n🎯 Usage:');
  console.log('1. For enterprise: use signed CRX with group policy');
  console.log('2. For development: load unpacked from dist/chrome-build or ZIP');
  console.log('3. Extension ID: ' + result.extensionId);

  return result;
}

// Main function
async function build() {
  try {
    await buildSignedChrome();
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  build();
}

module.exports = { buildSignedChrome };
