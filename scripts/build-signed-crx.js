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

  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    console.log('🔑 Using existing RSA key pair');
    return {
      privateKey: fs.readFileSync(privateKeyPath),
      publicKey: fs.readFileSync(publicKeyPath)
    };
  }

  console.log('🔑 Generating new RSA key pair...');
  
  // Generate 2048-bit RSA key pair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // Save keys
  fs.writeFileSync(privateKeyPath, privateKey);
  fs.writeFileSync(publicKeyPath, publicKey);

  console.log(`  Private key: ${privateKeyPath}`);
  console.log(`  Public key: ${publicKeyPath}`);

  return { privateKey, publicKey };
}

// Generate Chrome extension ID from public key
function generateChromeId(publicKey) {
  // Convert PEM to Buffer if it's a string
  const keyBuffer = Buffer.isBuffer(publicKey) ? publicKey : Buffer.from(publicKey);
  
  // Remove PEM headers and footers
  const pemKey = keyBuffer.toString();
  const keyBody = pemKey
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');

  // Create SHA256 hash
  const hash = crypto.createHash('sha256').update(keyBody, 'base64').digest();

  // Convert to base32 and map to lowercase a-z
  const base32Chars = 'abcdefghijklmnopqrstuvwxyz234567';
  let result = '';
  
  for (let i = 0; i < 32; i++) {
    const byte = hash[i];
    const low = byte & 0x0F;
    const high = (byte & 0xF0) >> 4;
    
    result += base32Chars[high] + base32Chars[low];
  }

  return result.substring(0, 32);
}

// Create properly signed CRX file
function createSignedCRX(zipPath, crxPath, privateKey, publicKey, publicKeyPath) {
  return new Promise((resolve, reject) => {
    try {
      // Read ZIP file
      const zipData = fs.readFileSync(zipPath);
      
      // Create signature
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(zipData);
      const signature = sign.sign(privateKey);
      
      // Create CRX header
      const header = Buffer.alloc(16);
      header.write('Cr24', 0); // Magic number
      header.writeUInt32LE(2, 4); // Version
      header.writeUInt32LE(publicKey.length, 8); // Public key length
      header.writeUInt32LE(signature.length, 12); // Signature length
      
      // Combine header, public key, signature, and zip data
      const crxData = Buffer.concat([header, publicKey, signature, zipData]);
      
      // Write CRX file
      fs.writeFileSync(crxPath, crxData);
      
      // Generate and save extension ID
      const extensionId = generateChromeId(publicKey);
      const idPath = crxPath.replace('.crx', '.id');
      fs.writeFileSync(idPath, extensionId);
      
      console.log(`  Created: ${crxPath}`);
      console.log(`  Extension ID: ${extensionId}`);
      
      resolve({ extensionId, publicKeyPath });
    } catch (error) {
      reject(error);
    }
  });
}

// Update Chrome manifest with extension ID
function updateChromeManifest(extensionId, publicKeyPath) {
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Add key property for enterprise deployment
  manifest.key = fs.readFileSync(publicKeyPath, 'utf8');
  
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  Updated manifest with public key`);
}

// Build signed Chrome extension
async function buildSignedChrome() {
  console.log('🔐 Building Signed Chrome Extension');
  console.log('===================================');

  ensureKeysDir();
  
  // Get or generate keys
  const { privateKey, publicKey } = getOrGenerateKeys();
  const publicKeyPath = path.join(KEYS_DIR, 'public.pem');
  
  // Build the extension first (using existing script)
  console.log('\n📦 Building extension...');
  execSync('node scripts/build-extension-fixed.js', { stdio: 'inherit' });
  
  const zipPath = path.join(DIST_DIR, 'rollcloud-chrome.zip');
  const crxPath = path.join(DIST_DIR, 'rollcloud-chrome-signed.crx');
  
  if (!fs.existsSync(zipPath)) {
    throw new Error('Extension ZIP not found. Run build-extension-fixed.js first.');
  }
  
  // Create signed CRX
  const result = await createSignedCRX(zipPath, crxPath, privateKey, publicKey, publicKeyPath);
  
  // Update manifest with public key
  updateChromeManifest(result.extensionId, result.publicKeyPath);
  
  console.log('\n✅ Signed Chrome extension created!');
  console.log(`📁 Files created:`);
  console.log(`   - ${crxPath} (signed CRX)`);
  console.log(`   - ${crxPath.replace('.crx', '.id')} (extension ID)`);
  console.log(`   - ${path.join(KEYS_DIR, 'private.pem')} (private key)`);
  console.log(`   - ${path.join(KEYS_DIR, 'public.pem')} (public key)`);
  
  console.log('\n🎯 Usage:');
  console.log('1. Use the signed CRX for enterprise deployment');
  console.log('2. Keep the private key secure for future updates');
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
