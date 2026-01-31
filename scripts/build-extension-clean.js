#!/usr/bin/env node

/**
 * Clean Extension Build Script
 * Properly builds Chrome and Firefox extensions with correct manifests
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const ICONS_DIR = path.join(ROOT_DIR, 'icons');

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
  console.log('\nBuilding Chrome extension...');

  const buildDir = path.join(DIST_DIR, 'chrome-build');
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');

  prepareBuildDir(buildDir, manifestPath);

  // Create ZIP file
  const zipPath = path.join(DIST_DIR, 'owlcloud-chrome.zip');
  await createZip(buildDir, zipPath);

  // Cleanup build directory
  fs.rmSync(buildDir, { recursive: true });

  // Read version from manifest
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return manifest.version;
}

// Build Firefox extension
async function buildFirefox() {
  console.log('\nBuilding Firefox extension...');

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
      id: 'owlcloud@dicecat.dev',
      strict_min_version: '109.0'
    }
  };

  // Write modified manifest
  fs.writeFileSync(path.join(buildDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Create ZIP file
  const zipPath = path.join(DIST_DIR, 'owlcloud-firefox.zip');
  await createZip(buildDir, zipPath);

  // Also create XPI copy for convenience
  const xpiPath = path.join(DIST_DIR, 'owlcloud-firefox.xpi');
  fs.copyFileSync(zipPath, xpiPath);
  console.log(`  Created: ${xpiPath} (XPI format)`);

  // Cleanup build directory
  fs.rmSync(buildDir, { recursive: true });

  return manifest.version;
}

// Main build function
async function buildAll() {
  console.log('OwlCloud Extension Build Script');
  console.log('=================================');

  try {
    ensureDistDir();

    const chromeVersion = await buildChrome();
    const firefoxVersion = await buildFirefox();

    console.log('\nBuild complete!');
    console.log(`  Version: ${chromeVersion}`);
    console.log(`  Output directory: ${DIST_DIR}`);
    console.log('\nFiles created:');
    console.log('  - owlcloud-chrome.zip (Chrome Web Store & local installation)');
    console.log('  - owlcloud-firefox.zip (Firefox Add-ons - use this for installation)');
    console.log('  - owlcloud-firefox.xpi (XPI format)');

  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

// Run build
if (require.main === module) {
  buildAll();
}

module.exports = { buildChrome, buildFirefox, buildAll };
