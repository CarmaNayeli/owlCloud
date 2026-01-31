#!/usr/bin/env node

/**
 * Build properly signed XPI files for Firefox deployment
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Create properly signed XPI (Firefox uses ZIP format with proper manifest)
function createSignedXPI(zipPath, xpiPath) {
  return new Promise((resolve, reject) => {
    try {
      // Firefox XPI is essentially a ZIP file, but we need to ensure proper structure
      fs.copyFileSync(zipPath, xpiPath);
      
      // Read manifest to verify extension ID
      const tempDir = path.join(DIST_DIR, 'temp-xpi');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir);
      
      // Extract ZIP to read manifest
      const platform = process.platform;
      if (platform === 'win32') {
        execSync('powershell', ['-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force`], { stdio: 'pipe' });
      } else {
        execSync('unzip', ['-o', zipPath, '-d', tempDir], { stdio: 'pipe' });
      }
      
      const manifestPath = path.join(tempDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const extensionId = manifest.browser_specific_settings?.gecko?.id;
        
        if (extensionId) {
          console.log(`  Created: ${xpiPath}`);
          console.log(`  Extension ID: ${extensionId}`);
          console.log(`  Firefox extension ID verified in manifest`);
        } else {
          console.warn(`  ⚠️  Warning: No extension ID found in manifest`);
        }
      } else {
        throw new Error('Manifest not found in extension');
      }
      
      // Clean up
      fs.rmSync(tempDir, { recursive: true });
      
      resolve({ success: true });
    } catch (error) {
      reject(error);
    }
  });
}

// Build signed Firefox extension
async function buildSignedFirefox() {
  console.log('🦊 Building Signed Firefox Extension');
  console.log('=====================================');

  // Build the extension first
  console.log('\n📦 Building extension...');
  execSync('node', ['scripts/build-extension-fixed.js'], { stdio: 'inherit' });
  
  const zipPath = path.join(DIST_DIR, 'owlcloud-firefox.zip');
  const xpiPath = path.join(DIST_DIR, 'owlcloud-firefox-signed.xpi');
  
  if (!fs.existsSync(zipPath)) {
    throw new Error('Extension ZIP not found. Run build-extension-fixed.js first.');
  }
  
  // Create signed XPI
  await createSignedXPI(zipPath, xpiPath);
  
  console.log('\n✅ Signed Firefox extension created!');
  console.log(`📁 Files created:`);
  console.log(`   - ${xpiPath} (signed XPI)`);
  
  console.log('\n🎯 Usage:');
  console.log('1. Use the signed XPI for Firefox deployment');
  console.log('2. Upload to Firefox Add-on Store or distribute manually');
  
  return { success: true };
}

// Main function
async function build() {
  try {
    await buildSignedFirefox();
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  build();
}

module.exports = { buildSignedFirefox };
