#!/usr/bin/env node

/**
 * Build CRX3 format for modern Chrome
 * CRX3 uses a protobuf-based header format
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const KEYS_DIR = path.join(ROOT_DIR, 'keys');

/**
 * Build CRX3 protobuf header manually (without protobuf library)
 *
 * CRX3 Header format (protobuf):
 * message CrxFileHeader {
 *   repeated AsymmetricKeyProof sha256_with_rsa = 2;
 *   bytes signed_header_data = 10000;
 * }
 *
 * message AsymmetricKeyProof {
 *   bytes public_key = 1;
 *   bytes signature = 2;
 * }
 *
 * message SignedData {
 *   bytes crx_id = 1;
 * }
 */

function writeVarint(value) {
  const bytes = [];
  while (value > 0x7F) {
    bytes.push((value & 0x7F) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7F);
  return Buffer.from(bytes);
}

function writeTag(fieldNumber, wireType) {
  return writeVarint((fieldNumber << 3) | wireType);
}

function writeLengthDelimited(fieldNumber, data) {
  const tag = writeTag(fieldNumber, 2); // wire type 2 = length-delimited
  const length = writeVarint(data.length);
  return Buffer.concat([tag, length, data]);
}

function buildAsymmetricKeyProof(publicKeyDer, signature) {
  // AsymmetricKeyProof message
  const pubKeyField = writeLengthDelimited(1, publicKeyDer);
  const sigField = writeLengthDelimited(2, signature);
  return Buffer.concat([pubKeyField, sigField]);
}

function buildSignedData(crxId) {
  // SignedData message with crx_id field
  return writeLengthDelimited(1, crxId);
}

function buildCrxFileHeader(publicKeyDer, signature, signedHeaderData) {
  // CrxFileHeader message
  const keyProof = buildAsymmetricKeyProof(publicKeyDer, signature);
  const keyProofField = writeLengthDelimited(2, keyProof); // field 2: sha256_with_rsa
  const signedDataField = writeLengthDelimited(10000, signedHeaderData); // field 10000: signed_header_data
  return Buffer.concat([keyProofField, signedDataField]);
}

function generateCrxId(publicKeyDer) {
  // CRX ID is first 16 bytes of SHA256 hash of the public key
  const hash = crypto.createHash('sha256').update(publicKeyDer).digest();
  return hash.slice(0, 16);
}

function generateExtensionId(crxId) {
  // Extension ID is crx_id encoded as a-p (base16 with a-p alphabet)
  let result = '';
  for (const byte of crxId) {
    result += String.fromCharCode(97 + ((byte >> 4) & 0x0F));
    result += String.fromCharCode(97 + (byte & 0x0F));
  }
  return result;
}

function pemToDer(pem) {
  const base64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/, '')
    .replace(/-----END [A-Z ]+-----/, '')
    .replace(/\s+/g, '');
  return Buffer.from(base64, 'base64');
}

function createCRX3(zipPath, crxPath, privateKeyPem, publicKeyDer) {
  console.log('📦 Creating CRX3 package...');

  // Read ZIP file
  const zipData = fs.readFileSync(zipPath);
  console.log(`   ZIP size: ${zipData.length} bytes`);

  // Generate CRX ID from public key
  const crxId = generateCrxId(publicKeyDer);
  const extensionId = generateExtensionId(crxId);
  console.log(`   Extension ID: ${extensionId}`);

  // Build SignedData protobuf
  const signedData = buildSignedData(crxId);

  // Create signature over: "CRX3 SignedData\x00" + length(signedData) + signedData + zipData
  const signedDataPrefix = Buffer.from('CRX3 SignedData\x00');
  const signedDataLength = Buffer.alloc(4);
  signedDataLength.writeUInt32LE(signedData.length, 0);

  const dataToSign = Buffer.concat([signedDataPrefix, signedDataLength, signedData, zipData]);

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(dataToSign);
  const signature = sign.sign(privateKeyPem);
  console.log(`   Signature size: ${signature.length} bytes`);

  // Build CRX file header protobuf
  const crxHeader = buildCrxFileHeader(publicKeyDer, signature, signedData);
  console.log(`   Header protobuf size: ${crxHeader.length} bytes`);

  // Build final CRX3 file
  // Magic: "Cr24" (4 bytes)
  // Version: 3 (4 bytes LE)
  // Header length (4 bytes LE)
  // Header protobuf
  // ZIP data

  const magic = Buffer.from('Cr24');
  const version = Buffer.alloc(4);
  version.writeUInt32LE(3, 0);
  const headerLength = Buffer.alloc(4);
  headerLength.writeUInt32LE(crxHeader.length, 0);

  const crxData = Buffer.concat([magic, version, headerLength, crxHeader, zipData]);

  fs.writeFileSync(crxPath, crxData);
  console.log(`   Total CRX3 size: ${crxData.length} bytes`);

  // Save extension ID
  const idPath = crxPath.replace('.crx', '.id');
  fs.writeFileSync(idPath, extensionId);

  return { extensionId, crxId };
}

async function build() {
  console.log('🔐 Building CRX3 Chrome Extension');
  console.log('==================================');

  // Check for existing keys
  const privateKeyPath = path.join(KEYS_DIR, 'private.pem');
  const publicKeyPath = path.join(KEYS_DIR, 'public.pem');

  if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
    console.log('❌ Keys not found. Run build-signed-crx.js first to generate keys.');
    process.exit(1);
  }

  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
  const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
  const publicKeyDer = pemToDer(publicKeyPem);

  console.log(`🔑 Using existing RSA key pair`);
  console.log(`   Public key (DER) size: ${publicKeyDer.length} bytes`);

  const zipPath = path.join(DIST_DIR, 'owlcloud-chrome.zip');
  const crxPath = path.join(DIST_DIR, 'owlcloud-chrome-v3.crx');

  if (!fs.existsSync(zipPath)) {
    console.log('❌ ZIP not found. Run build-extension-fixed.js first.');
    process.exit(1);
  }

  const result = createCRX3(zipPath, crxPath, privateKeyPem, publicKeyDer);

  console.log('\n✅ CRX3 Chrome extension created!');
  console.log(`📁 Output: ${crxPath}`);
  console.log(`🆔 Extension ID: ${result.extensionId}`);
  console.log('\n💡 Note: CRX3 is the modern format preferred by Chrome 64+');
}

if (require.main === module) {
  build().catch(err => {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
  });
}

module.exports = { createCRX3 };
