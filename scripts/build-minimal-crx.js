#!/usr/bin/env node

/**
 * Build minimal CRX following Chrome CRX v2 specification exactly
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

function createMinimalCRX(zipPath, crxPath) {
  try {
    // Read ZIP file
    const zipData = fs.readFileSync(zipPath);
    
    console.log(`   ZIP size: ${zipData.length} bytes`);
    
    // Create CRX header following exact Chrome CRX v2 spec
    // Header format: 4 bytes magic + 4 bytes version + 4 bytes pubkey_len + 4 bytes sig_len
    const header = Buffer.alloc(16);
    
    // Magic number "Cr24"
    header[0] = 0x43; // C
    header[1] = 0x72; // r
    header[2] = 0x32; // 2
    header[3] = 0x34; // 4
    
    // Version 2 (little-endian)
    header[4] = 0x02;
    header[5] = 0x00;
    header[6] = 0x00;
    header[7] = 0x00;
    
    // Public key length (0 for unsigned, little-endian)
    header[8] = 0x00;
    header[9] = 0x00;
    header[10] = 0x00;
    header[11] = 0x00;
    
    // Signature length (0 for unsigned, little-endian)
    header[12] = 0x00;
    header[13] = 0x00;
    header[14] = 0x00;
    header[15] = 0x00;
    
    console.log(`   Header bytes: ${Array.from(header).map(b => b.toString(16).padStart(2, '0')).join('')}`);
    
    // Combine header and zip data
    const crxData = Buffer.concat([header, zipData]);
    
    // Write CRX file
    fs.writeFileSync(crxPath, crxData);
    
    console.log(`✅ Created minimal CRX: ${crxPath}`);
    console.log(`   Total size: ${crxData.length} bytes`);
    console.log(`   Header hex: ${header.toString('hex')}`);
    
    // Verify the first 16 bytes
    const first16 = crxData.slice(0, 16);
    console.log(`   First 16 bytes: ${first16.toString('hex')}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to create CRX:', error.message);
    return false;
  }
}

// Build minimal CRX
async function build() {
  try {
    console.log('🔧 Building Minimal CRX');
    console.log('========================');
    
    const zipPath = path.join(DIST_DIR, 'rollcloud-chrome.zip');
    const crxPath = path.join(DIST_DIR, 'rollcloud-chrome-minimal.crx');
    
    if (!fs.existsSync(zipPath)) {
      console.error('❌ ZIP file not found:', zipPath);
      process.exit(1);
    }
    
    const success = createMinimalCRX(zipPath, crxPath);
    
    if (success) {
      console.log('\n✅ Minimal CRX build complete!');
      console.log('\n🎯 This follows the exact Chrome CRX v2 specification');
      console.log('   Magic: Cr24');
      console.log('   Version: 2');
      console.log('   Public key length: 0 (unsigned)');
      console.log('   Signature length: 0 (unsigned)');
    }
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  build();
}
