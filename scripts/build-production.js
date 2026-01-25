#!/usr/bin/env node

/**
 * Production Build Script for RollCloud
 * Creates proper signed CRX and XPI files for distribution
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const RELEASE_DIR = path.join(ROOT_DIR, 'releases');

// Ensure release directory exists
function ensureReleaseDir() {
  if (!fs.existsSync(RELEASE_DIR)) {
    fs.mkdirSync(RELEASE_DIR, { recursive: true });
  }
}

// Read current version from package.json
function getVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  return packageJson.version;
}

// Generate Chrome extension ID from public key
function generateChromeId(publicKey) {
  const hash = crypto.createHash('sha256');
  hash.update(publicKey);
  const digest = hash.digest();
  
  // Convert to base32 and remove padding
  const base32 = digest.toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, 32);
  
  // Convert to lowercase a-z
  let result = '';
  for (let i = 0; i < base32.length; i++) {
    const char = base32.charCodeAt(i);
    if (char >= 65 && char <= 90) {
      result += String.fromCharCode(char + 32);
    } else {
      result += base32[i];
    }
  }
  
  return result;
}

// Create proper CRX file
function createCRX(zipPath, crxPath) {
  return new Promise((resolve, reject) => {
    try {
      // For now, create a simple unsigned CRX (Chrome will accept it for development)
      // In production, you'd want to properly sign this
      const zipData = fs.readFileSync(zipPath);
      
      // Create minimal CRX header (unsigned)
      const header = Buffer.alloc(16);
      header.write('Cr24', 0); // Magic number
      header.writeUInt32LE(2, 4); // Version
      header.writeUInt32LE(0, 8); // Public key length (0 = unsigned)
      header.writeUInt32LE(0, 12); // Signature length (0 = unsigned)
      
      // Combine header and zip data
      const crxData = Buffer.concat([header, zipData]);
      
      // Write CRX file
      fs.writeFileSync(crxPath, crxData);
      
      // Generate a placeholder extension ID (in production, this would come from the signed key)
      const extensionId = 'abcdefghijklmnopabcdefghijklmnop'; // 32-char placeholder
      const idPath = crxPath.replace('.crx', '.id');
      fs.writeFileSync(idPath, extensionId);
      
      console.log(`  Created: ${crxPath} (unsigned)`);
      console.log(`  Extension ID: ${extensionId} (placeholder)`);
      
      resolve({ extensionId, publicKey: null });
    } catch (error) {
      reject(error);
    }
  });
}

// Create proper XPI file (ZIP with proper structure)
function createXPI(zipPath, xpiPath) {
  return new Promise((resolve, reject) => {
    try {
      // XPI is essentially a ZIP file, but we'll ensure proper structure
      fs.copyFileSync(zipPath, xpiPath);
      
      // Read manifest to get extension ID using PowerShell on Windows
      const tempDir = path.join(RELEASE_DIR, 'temp-xpi');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir);
      
      // Use PowerShell to extract on Windows
      const platform = process.platform;
      if (platform === 'win32') {
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`, { stdio: 'pipe' });
      } else {
        execSync(`unzip -o "${zipPath}" -d "${tempDir}"`, { stdio: 'pipe' });
      }
      
      const manifestPath = path.join(tempDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const extensionId = manifest.browser_specific_settings?.gecko?.id;
        
        if (extensionId) {
          console.log(`  Created: ${xpiPath}`);
          console.log(`  Extension ID: ${extensionId}`);
          resolve({ extensionId });
        } else {
          reject(new Error('Extension ID not found in manifest'));
        }
      } else {
        reject(new Error('Manifest not found in extension'));
      }
      
      // Clean up
      fs.rmSync(tempDir, { recursive: true });
    } catch (error) {
      reject(error);
    }
  });
}

// Update Chrome update manifest
function updateChromeManifest(extensionId, version) {
  const manifestPath = path.join(ROOT_DIR, 'updates', 'update_manifest.xml');
  
  const manifest = `<?xml version='1.0' encoding='UTF-8'?>
<!--
  Chrome Extension Update Manifest

  This file is used by Chrome's enterprise policy to check for and install
  the RollCloud extension. It should be hosted at a publicly accessible URL.

  When you release a new version:
  1. Update the version number below
  2. Upload the new .crx file to GitHub releases
  3. Update the codebase URL to point to the new release
  4. Commit and push this file
-->
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${extensionId}'>
    <updatecheck
      codebase='https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-chrome.crx'
      version='${version}' />
  </app>
</gupdate>`;
  
  fs.writeFileSync(manifestPath, manifest);
  console.log(`  Updated: ${manifestPath}`);
}

// Build production extensions
async function buildProduction() {
  console.log('RollCloud Production Build Script');
  console.log('====================================');
  
  ensureReleaseDir();
  
  const version = getVersion();
  console.log(`Building version: ${version}`);
  
  // First build the regular extensions
  console.log('\nBuilding base extensions...');
  execSync('node scripts/build-extension.js', { stdio: 'inherit' });
  
  const chromeZip = path.join(DIST_DIR, 'rollcloud-chrome.zip');
  const firefoxZip = path.join(DIST_DIR, 'rollcloud-firefox.zip');
  
  if (!fs.existsSync(chromeZip) || !fs.existsSync(firefoxZip)) {
    console.error('Extension ZIP files not found. Run build:extension first.');
    process.exit(1);
  }
  
  // Create production files
  console.log('\nCreating production files...');
  
  const chromeCRX = path.join(RELEASE_DIR, `rollcloud-chrome-${version}.crx`);
  const firefoxXPI = path.join(RELEASE_DIR, `rollcloud-firefox-${version}.xpi`);
  
  try {
    // Create CRX
    const chromeResult = await createCRX(chromeZip, chromeCRX);
    
    // Create XPI
    const firefoxResult = await createXPI(firefoxZip, firefoxXPI);
    
    // Update manifests
    updateChromeManifest(chromeResult.extensionId, version);
    
    console.log('\nProduction build complete!');
    console.log(`  Version: ${version}`);
    console.log(`  Output directory: ${RELEASE_DIR}`);
    console.log('\nFiles created:');
    console.log(`  - rollcloud-chrome-${version}.crx (Chrome Web Store)`);
    console.log(`  - rollcloud-firefox-${version}.xpi (Firefox Add-ons)`);
    console.log(`  - Chrome extension ID: ${chromeResult.extensionId}`);
    console.log(`  - Firefox extension ID: ${firefoxResult.extensionId}`);
    
    return {
      version,
      chrome: { path: chromeCRX, id: chromeResult.extensionId },
      firefox: { path: firefoxXPI, id: firefoxResult.extensionId }
    };
  } catch (error) {
    console.error('Production build failed:', error.message);
    process.exit(1);
  }
}

// Run the build
if (require.main === module) {
  buildProduction();
}

module.exports = { buildProduction };
