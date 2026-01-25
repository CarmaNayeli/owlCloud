#!/usr/bin/env node

/**
 * Build properly signed extensions for distribution
 */

const { buildSignedChrome } = require('./build-signed-crx');
const { buildSignedFirefox } = require('./build-signed-xpi');

async function buildAll() {
  console.log('🔐 Building Signed Extensions for Distribution');
  console.log('=============================================');

  try {
    // Build signed Chrome extension
    await buildSignedChrome();
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Build signed Firefox extension
    await buildSignedFirefox();
    
    console.log('\n🎉 All signed extensions built successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Chrome: Upload signed CRX to Chrome Web Store or enterprise deployment');
    console.log('2. Firefox: Upload signed XPI to Firefox Add-on Store');
    console.log('3. Keep private keys secure for future updates');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  buildAll();
}

module.exports = { buildAll };
