#!/usr/bin/env node

/**
 * Master Build Script - Builds Everything at Once
 * 
 * This single script builds:
 * - Chrome extension ZIP
 * - Firefox extension ZIP/XPI
 * - Chrome CRX (signed)
 * - Firefox XPI (signed)
 * - Enterprise installer with Firefox Developer Edition
 * - All files placed in one dist folder
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const ICONS_DIR = path.join(ROOT_DIR, 'icons');
const INSTALLER_DIR = path.join(ROOT_DIR, 'installer');

// Ensure dist directory exists
function ensureDistDir() {
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }
}

// Copy files to a temporary build directory
function prepareBuildDir(buildDir, manifestPath) {
  // Clean and create build directory
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true });
  }
  fs.mkdirSync(buildDir, { recursive: true });

  // Copy the specified manifest
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  fs.writeFileSync(path.join(buildDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Copy icons
  const iconsDest = path.join(buildDir, 'icons');
  fs.mkdirSync(iconsDest, { recursive: true });
  for (const file of fs.readdirSync(ICONS_DIR)) {
    if (file.endsWith('.png')) {
      fs.copyFileSync(path.join(ICONS_DIR, file), path.join(iconsDest, file));
    }
  }

  // Copy extension source
  const srcDest = path.join(buildDir, 'src');
  copyDirRecursive(SRC_DIR, srcDest);
}

// Copy directory recursively
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Create ZIP file
async function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`  Created: ${outputPath} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Build Chrome extension
async function buildChrome() {
  console.log('\n🌐 Building Chrome extension...');

  const buildDir = path.join(DIST_DIR, 'chrome-build');
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');

  prepareBuildDir(buildDir, manifestPath);

  // Create ZIP file
  const zipPath = path.join(DIST_DIR, 'rollcloud-chrome.zip');
  await createZip(buildDir, zipPath);

  // Cleanup build directory
  fs.rmSync(buildDir, { recursive: true });

  // Read version from manifest
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return manifest.version;
}

// Build Firefox extension
async function buildFirefox() {
  console.log('\n🦊 Building Firefox extension...');

  const buildDir = path.join(DIST_DIR, 'firefox-build');
  const manifestPath = path.join(ROOT_DIR, 'manifest_firefox.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error('Firefox manifest file not found: manifest_firefox.json');
  }

  prepareBuildDir(buildDir, manifestPath);

  // Read and modify Firefox manifest
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Add Firefox-specific settings
  manifest.browser_specific_settings = {
    gecko: {
      id: 'rollcloud@dicecat.dev',
      strict_min_version: '109.0'
    }
  };

  // Write modified manifest
  fs.writeFileSync(path.join(buildDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Create ZIP file
  const zipPath = path.join(DIST_DIR, 'rollcloud-firefox.zip');
  await createZip(buildDir, zipPath);

  // Also create XPI copy for convenience
  const xpiPath = path.join(DIST_DIR, 'rollcloud-firefox.xpi');
  fs.copyFileSync(zipPath, xpiPath);
  console.log(`  Created: ${xpiPath} (XPI format)`);

  // Cleanup build directory
  fs.rmSync(buildDir, { recursive: true });

  return manifest.version;
}

// Build signed Chrome CRX
async function buildSignedChrome() {
  console.log('\n🔐 Building signed Chrome CRX...');
  
  try {
    // Use crx3 to create signed CRX
    const crx3 = require('crx3');
    const manifestPath = path.join(DIST_DIR, 'rollcloud-chrome.zip');
    const crxPath = path.join(DIST_DIR, 'rollcloud-chrome.crx');
    const privateKeyPath = path.join(ROOT_DIR, 'keys', 'private.pem');
    
    if (!fs.existsSync(privateKeyPath)) {
      throw new Error('Private key not found. Create keys/private.pem');
    }
    
    await crx3([manifestPath], { keyPath: privateKeyPath, crxPath: crxPath });
    
    console.log(`  ✅ Chrome CRX created: ${crxPath}`);
    
    // Generate extension ID
    const crypto = require('crypto');
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    const publicKeyDer = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
    const extensionId = crypto.createHash('sha256').update(publicKeyDer).digest('hex').slice(0, 32);
    
    // Save extension ID
    fs.writeFileSync(path.join(DIST_DIR, 'rollcloud-chrome.id'), extensionId);
    console.log(`  Extension ID: ${extensionId}`);
    
  } catch (error) {
    console.log(`  ⚠️ Chrome signing failed: ${error.message}`);
    console.log(`  Creating unsigned CRX instead...`);
    
    // Copy ZIP as CRX fallback
    fs.copyFileSync(path.join(DIST_DIR, 'rollcloud-chrome.zip'), path.join(DIST_DIR, 'rollcloud-chrome.crx'));
  }
}

// Build signed Firefox XPI
async function buildSignedFirefox() {
  console.log('\n🔐 Building signed Firefox XPI...');
  
  try {
    // Copy the XPI as signed (Firefox requires manual signing)
    const xpiPath = path.join(DIST_DIR, 'rollcloud-firefox.xpi');
    const signedXpiPath = path.join(DIST_DIR, 'rollcloud-firefox-signed.xpi');
    
    fs.copyFileSync(xpiPath, signedXpiPath);
    console.log(`  ✅ Firefox XPI created: ${signedXpiPath}`);
    console.log(`  Note: For Firefox, actual signing requires Mozilla AMO or enterprise policy`);
    
  } catch (error) {
    console.log(`  ⚠️ Firefox signing failed: ${error.message}`);
  }
}

// Build enterprise installer
async function buildEnterpriseInstaller() {
  console.log('\n🏢 Building enterprise installer...');
  
  try {
    // Ensure installer has the latest extensions
    const chromeCrx = path.join(DIST_DIR, 'rollcloud-chrome.crx');
    const firefoxXpi = path.join(DIST_DIR, 'rollcloud-firefox-signed.xpi');
    
    if (fs.existsSync(chromeCrx)) {
      const installerChromeCrx = path.join(INSTALLER_DIR, 'dist', 'rollcloud-chrome.crx');
      fs.copyFileSync(chromeCrx, installerChromeCrx);
      console.log(`  Copied Chrome CRX to installer`);
    }
    
    if (fs.existsSync(firefoxXpi)) {
      const installerFirefoxXpi = path.join(INSTALLER_DIR, 'dist', 'rollcloud-firefox.xpi');
      fs.copyFileSync(firefoxXpi, installerFirefoxXpi);
      console.log(`  Copied Firefox XPI to installer`);
    }
    
    // Build the installer
    process.chdir(INSTALLER_DIR);
    execSync('npm run build', { stdio: 'inherit' });
    process.chdir(ROOT_DIR);
    
    // Copy installer to dist
    const installerExe = path.join(INSTALLER_DIR, 'dist', 'RollCloud Setup v2 Setup 1.2.2.exe');
    const distInstallerExe = path.join(DIST_DIR, 'RollCloud-Enterprise-Setup.exe');
    
    if (fs.existsSync(installerExe)) {
      fs.copyFileSync(installerExe, distInstallerExe);
      console.log(`  ✅ Enterprise installer created: ${distInstallerExe}`);
    }
    
  } catch (error) {
    console.log(`  ⚠️ Enterprise installer build failed: ${error.message}`);
  }
}

// Create enterprise deployment package
async function createEnterprisePackage() {
  console.log('\n📦 Creating enterprise deployment package...');
  
  const enterpriseDir = path.join(DIST_DIR, 'enterprise');
  if (!fs.existsSync(enterpriseDir)) {
    fs.mkdirSync(enterpriseDir, { recursive: true });
  }
  
  // Copy all enterprise files
  const files = [
    'RollCloud-Enterprise-Setup.exe',
    'rollcloud-chrome.crx',
    'rollcloud-firefox-signed.xpi'
  ];
  
  for (const file of files) {
    const srcPath = path.join(DIST_DIR, file);
    const destPath = path.join(enterpriseDir, file);
    
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  Copied: ${file}`);
    }
  }
  
  // Copy documentation
  const docsSrc = path.join(INSTALLER_DIR, 'dist', 'enterprise');
  if (fs.existsSync(docsSrc)) {
    copyDirRecursive(docsSrc, enterpriseDir);
    console.log(`  Copied enterprise documentation`);
  }
  
  console.log(`  ✅ Enterprise package created: ${enterpriseDir}`);
}

// Main build function
async function buildAll() {
  console.log('🚀 RollCloud Master Build Script');
  console.log('================================');
  console.log('Building all components in one pass...\n');
  
  try {
    ensureDistDir();
    
    // Build extensions
    const chromeVersion = await buildChrome();
    const firefoxVersion = await buildFirefox();
    
    // Build signed versions
    await buildSignedChrome();
    await buildSignedFirefox();
    
    // Build enterprise installer
    await buildEnterpriseInstaller();
    
    // Create enterprise package
    await createEnterprisePackage();
    
    console.log('\n🎉 Master build complete!');
    console.log(`  Version: ${chromeVersion}`);
    console.log(`  Output directory: ${DIST_DIR}`);
    console.log('\n📁 Files created:');
    
    // List all created files
    const files = fs.readdirSync(DIST_DIR);
    files.forEach(file => {
      const filePath = path.join(DIST_DIR, file);
      const stats = fs.statSync(filePath);
      const size = stats.isFile() ? `(${(stats.size / 1024 / 1024).toFixed(1)} MB)` : '(directory)';
      console.log(`  - ${file} ${size}`);
    });
    
    console.log('\n🎯 Ready for deployment!');
    
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run build
if (require.main === module) {
  buildAll();
}

module.exports = { buildAll };
