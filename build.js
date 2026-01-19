#!/usr/bin/env node

/**
 * Build Script for RollCloud Extension
 * Generates browser-specific packages for Chrome and Firefox
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const BUILD_CHROME = path.join(DIST, 'chrome');
const BUILD_FIREFOX = path.join(DIST, 'firefox');

// Files and directories to include in the build
const INCLUDE = [
  'src',
  'icons',
  'BUILD.md',
  'README.md'
];

// Files to exclude
const EXCLUDE = [
  '.git',
  '.gitignore',
  'node_modules',
  'dist',
  'build.js',
  'package.json',
  'package-lock.json',
  '.DS_Store'
];

console.log('🏗️  Building RollCloud extension packages...\n');

// Clean dist directory
if (fs.existsSync(DIST)) {
  console.log('🧹 Cleaning dist directory...');
  fs.rmSync(DIST, { recursive: true, force: true });
}

// Create dist directories
fs.mkdirSync(DIST, { recursive: true });
fs.mkdirSync(BUILD_CHROME, { recursive: true });
fs.mkdirSync(BUILD_FIREFOX, { recursive: true });

/**
 * Copy directory recursively
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Build Chrome package
 */
function buildChrome() {
  console.log('📦 Building Chrome package (Manifest V3)...');

  // Copy included files
  INCLUDE.forEach(item => {
    const srcPath = path.join(ROOT, item);
    const destPath = path.join(BUILD_CHROME, item);

    if (fs.existsSync(srcPath)) {
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  });

  // Copy Chrome manifest
  fs.copyFileSync(
    path.join(ROOT, 'manifest-chrome.json'),
    path.join(BUILD_CHROME, 'manifest.json')
  );

  console.log('   ✅ Chrome package built to dist/chrome/');
}

/**
 * Build Firefox package
 */
function buildFirefox() {
  console.log('📦 Building Firefox package (Manifest V2)...');

  // Copy included files
  INCLUDE.forEach(item => {
    const srcPath = path.join(ROOT, item);
    const destPath = path.join(BUILD_FIREFOX, item);

    if (fs.existsSync(srcPath)) {
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  });

  // Copy Firefox manifest
  fs.copyFileSync(
    path.join(ROOT, 'manifest.json'),
    path.join(BUILD_FIREFOX, 'manifest.json')
  );

  console.log('   ✅ Firefox package built to dist/firefox/');
}

/**
 * Create zip archives
 */
function createZips() {
  console.log('\n📦 Creating zip archives...');

  try {
    // Check if zip command is available
    execSync('which zip', { stdio: 'ignore' });

    // Create Chrome zip
    process.chdir(BUILD_CHROME);
    execSync(`zip -r ../rollcloud-chrome.zip . -x "*.DS_Store"`, { stdio: 'inherit' });
    console.log('   ✅ Chrome zip: dist/rollcloud-chrome.zip');

    // Create Firefox zip
    process.chdir(BUILD_FIREFOX);
    execSync(`zip -r ../rollcloud-firefox.zip . -x "*.DS_Store"`, { stdio: 'inherit' });
    console.log('   ✅ Firefox zip: dist/rollcloud-firefox.zip');

    process.chdir(ROOT);
  } catch (error) {
    console.log('   ⚠️  zip command not found, skipping zip creation');
    console.log('   📁 You can manually zip the directories:');
    console.log('      - dist/chrome/');
    console.log('      - dist/firefox/');
  }
}

/**
 * Display build summary
 */
function showSummary() {
  console.log('\n✨ Build complete!\n');
  console.log('📂 Output:');
  console.log('   Chrome (MV3):  dist/chrome/');
  console.log('   Firefox (MV2): dist/firefox/');

  if (fs.existsSync(path.join(DIST, 'rollcloud-chrome.zip'))) {
    console.log('\n📦 Zip files:');
    console.log('   dist/rollcloud-chrome.zip');
    console.log('   dist/rollcloud-firefox.zip');
  }

  console.log('\n🚀 Next steps:');
  console.log('   Chrome:  Load dist/chrome/ or upload rollcloud-chrome.zip');
  console.log('   Firefox: Load dist/firefox/ or upload rollcloud-firefox.zip');
}

// Run build
try {
  buildChrome();
  buildFirefox();
  createZips();
  showSummary();
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
