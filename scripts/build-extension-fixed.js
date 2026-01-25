#!/usr/bin/env node

/**
 * Fixed Extension Build Script
 * Creates ZIP files that work for both development and production
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
    // Remove existing file with retry logic
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (error) {
        if (error.code === 'EBUSY') {
          // File is locked, wait a moment and retry
          setTimeout(() => {
            try {
              fs.unlinkSync(outputPath);
            } catch (retryError) {
              if (retryError.code === 'EBUSY') {
                console.warn(`  Warning: Could not remove ${outputPath} - file is locked`);
              } else {
                throw retryError;
              }
            }
          }, 1000);
        } else {
          throw error;
        }
      }
    }

    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { 
      zlib: { 
        level: 6, // Medium compression for better compatibility
        windowBits: 15,
        memLevel: 8
      } 
    });

    output.on('close', () => {
      console.log(`  Created: ${outputPath}`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error(`  Error creating zip: ${err.message}`);
      reject(err);
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn(`  Warning: ${err.message}`);
      } else {
        reject(err);
      }
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

  // Create ZIP file
  const zipPath = path.join(DIST_DIR, 'rollcloud-chrome.zip');
  await createZip(buildDir, zipPath);

  console.log(`  Created: ${zipPath} (use this for Chrome installation)`);

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

  // Create ZIP file
  const zipPath = path.join(DIST_DIR, 'rollcloud-firefox.zip');
  await createZip(buildDir, zipPath);

  console.log(`  Created: ${zipPath} (use this for Firefox installation)`);

  // Cleanup build directory
  fs.rmSync(buildDir, { recursive: true });

  return version;
}

// Main build function
async function build() {
  console.log('RollCloud Extension Build Script (Fixed)');
  console.log('==========================================');

  ensureDistDir();

  const chromeVersion = await buildChrome();
  const firefoxVersion = await buildFirefox();

  console.log('\nBuild complete!');
  console.log(`  Version: ${chromeVersion}`);
  console.log(`  Output directory: ${DIST_DIR}`);
  console.log('\nFiles created:');
  console.log('  - rollcloud-chrome.zip (Chrome - use ZIP file directly)');
  console.log('  - rollcloud-firefox.zip (Firefox - use ZIP file directly)');
  console.log('\nInstallation Instructions:');
  console.log('Chrome: Load unpacked extension from ZIP contents');
  console.log('Firefox: Load temporary add-on from ZIP file');
}

build().catch(error => {
  console.error('Build failed:', error.message);
  process.exit(1);
});
