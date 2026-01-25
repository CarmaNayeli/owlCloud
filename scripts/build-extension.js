#!/usr/bin/env node

/**
 * Build script for RollCloud browser extension
 * Creates distributable packages for Chrome and Firefox
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
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
function prepareBuildDir(buildDir, manifestOverrides = {}) {
  // Clean and create build directory
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true });
  }
  fs.mkdirSync(buildDir, { recursive: true });

  // Copy manifest.json
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));

  // Apply any overrides (e.g., for Firefox)
  Object.assign(manifest, manifestOverrides);

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

  return manifest.version;
}

// Recursively copy directory
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Create ZIP archive using archiver (cross-platform)
function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    // Remove existing file
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`  Created: ${outputPath}`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error(`  Error creating zip: ${err.message}`);
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Build Chrome extension
async function buildChrome() {
  console.log('\nBuilding Chrome extension...');

  const buildDir = path.join(DIST_DIR, 'chrome-build');
  const version = prepareBuildDir(buildDir);

  // Create ZIP (Chrome Web Store format)
  const zipPath = path.join(DIST_DIR, 'rollcloud-chrome.zip');
  await createZip(buildDir, zipPath);

  // Note: For local development, use the ZIP file directly
  // CRX files require signing and special headers
  console.log(`  Created: ${zipPath} (use this for local installation)`);

  // Cleanup build directory
  fs.rmSync(buildDir, { recursive: true });

  return version;
}

// Build Firefox extension
async function buildFirefox() {
  console.log('\nBuilding Firefox extension...');

  const buildDir = path.join(DIST_DIR, 'firefox-build');

  // Firefox-specific manifest modifications
  const firefoxOverrides = {
    // Firefox uses browser_specific_settings
    browser_specific_settings: {
      gecko: {
        id: 'rollcloud@dicecat.dev',
        strict_min_version: '109.0'
      }
    }
  };

  const version = prepareBuildDir(buildDir, firefoxOverrides);

  // Create XPI (which is just a ZIP with .xpi extension)
  const xpiPath = path.join(DIST_DIR, 'rollcloud-firefox.xpi');
  await createZip(buildDir, xpiPath);

  // Cleanup build directory
  fs.rmSync(buildDir, { recursive: true });

  return version;
}

// Main build function
async function build() {
  console.log('RollCloud Extension Build Script');
  console.log('=================================');

  ensureDistDir();

  const chromeVersion = await buildChrome();
  const firefoxVersion = await buildFirefox();

  console.log('\nBuild complete!');
  console.log(`  Version: ${chromeVersion}`);
  console.log(`  Output directory: ${DIST_DIR}`);
  console.log('\nFiles created:');
  console.log('  - rollcloud-chrome.zip (Chrome Web Store & local installation)');
  console.log('  - rollcloud-firefox.xpi (Firefox Add-ons)');
}

build().catch(error => {
  console.error('Build failed:', error.message);
  process.exit(1);
});
