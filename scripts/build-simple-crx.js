#!/usr/bin/env node

/**
 * Build simple unsigned CRX for testing
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

function createUnsignedCRX(zipPath, crxPath) {
  try {
    // Read ZIP file
    const zipData = fs.readFileSync(zipPath);
    
    // Create unsigned CRX header (version 2, no key, no signature)
    const header = Buffer.alloc(16);
    header.write('Cr24', 0); // Magic number
    header.writeUInt32LE(2, 4); // Version
    header.writeUInt32LE(0, 8); // Public key length (0 = unsigned)
    header.writeUInt32LE(0, 12); // Signature length (0 = unsigned)
    
    // Combine header and zip data
    const crxData = Buffer.concat([header, zipData]);
    
    // Write CRX file
    fs.writeFileSync(crxPath, crxData);
    
    console.log(`✅ Created unsigned CRX: ${crxPath}`);
    console.log(`   Size: ${crxData.length} bytes`);
    console.log(`   Header: ${header.toString('hex')}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to create CRX:', error.message);
    return false;
  }
}

// Build unsigned CRX for testing
async function build() {
  try {
    console.log('🔧 Building Simple Unsigned CRX');
    console.log('================================');
    
    const zipPath = path.join(DIST_DIR, 'owlcloud-chrome.zip');
    const crxPath = path.join(DIST_DIR, 'owlcloud-chrome-unsigned.crx');
    
    if (!fs.existsSync(zipPath)) {
      console.error('❌ ZIP file not found:', zipPath);
      process.exit(1);
    }
    
    const success = createUnsignedCRX(zipPath, crxPath);
    
    if (success) {
      console.log('\n✅ Simple CRX build complete!');
      console.log('\n🎯 Usage:');
      console.log('1. Test this unsigned CRX in Chrome');
      console.log('2. If this works, the issue is with signing');
      console.log('3. If this fails, the issue is with ZIP format');
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
