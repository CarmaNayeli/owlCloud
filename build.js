#!/usr/bin/env node

/**
 * Build Script for RollCloud Extension
 * Generates browser-specific packages for Chrome and Firefox
 *
 * Usage:
 *   node build.js              - Standard build
 *   node build.js --experimental - Build with experimental two-way sync
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check for experimental flag
const args = process.argv.slice(2);
const isExperimental = args.includes('--experimental') || args.includes('--exp');

const ROOT = __dirname;
const DIST = path.join(ROOT, isExperimental ? 'dist-experimental' : 'dist');
const BUILD_CHROME = path.join(DIST, 'chrome');
const BUILD_FIREFOX = path.join(DIST, 'firefox');
const BUILD_SAFARI = path.join(DIST, 'safari');

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

if (isExperimental) {
  console.log('🧪 Building RollCloud extension packages (EXPERIMENTAL with two-way sync)...\n');
  console.log('⚠️  This build includes experimental DiceCloud sync via Meteor DDP\n');
} else {
  console.log('🏗️  Building RollCloud extension packages...\n');
}

// Clean dist directory
if (fs.existsSync(DIST)) {
  console.log('🧹 Cleaning dist directory...');
  fs.rmSync(DIST, { recursive: true, force: true });
}

// Create dist directories
fs.mkdirSync(DIST, { recursive: true });
fs.mkdirSync(BUILD_CHROME, { recursive: true });
fs.mkdirSync(BUILD_FIREFOX, { recursive: true });
fs.mkdirSync(BUILD_SAFARI, { recursive: true });

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
  const manifestSrc = path.join(ROOT, 'manifest.json');
  const manifestDest = path.join(BUILD_CHROME, 'manifest.json');
  fs.copyFileSync(manifestSrc, manifestDest);

  // Add experimental files if building experimental version
  if (isExperimental) {
    console.log('   📦 Adding experimental sync modules...');

    // Create lib directory
    const libDir = path.join(BUILD_CHROME, 'src', 'lib');
    fs.mkdirSync(libDir, { recursive: true });

    // Copy experimental files
    fs.copyFileSync(
      path.join(ROOT, 'experimental/two-way-sync/meteor-ddp-client.js'),
      path.join(libDir, 'meteor-ddp-client.js')
    );
    fs.copyFileSync(
      path.join(ROOT, 'experimental/two-way-sync/dicecloud-sync.js'),
      path.join(libDir, 'dicecloud-sync.js')
    );

    // Copy documentation
    fs.copyFileSync(
      path.join(ROOT, 'experimental/two-way-sync/README.md'),
      path.join(BUILD_CHROME, 'EXPERIMENTAL-README.md')
    );
    fs.copyFileSync(
      path.join(ROOT, 'experimental/two-way-sync/IMPLEMENTATION_GUIDE.md'),
      path.join(BUILD_CHROME, 'IMPLEMENTATION_GUIDE.md')
    );

    // Modify manifest for experimental build
    const manifest = JSON.parse(fs.readFileSync(manifestDest, 'utf8'));
    manifest.name = manifest.name + ' (Experimental Sync)';
    manifest.version = manifest.version.split('.').slice(0, 3).join('.') + '.1';
    manifest.description = manifest.description + ' - EXPERIMENTAL: Includes two-way sync features for testing';

    // Add web_accessible_resources for experimental files
    if (!manifest.web_accessible_resources) {
      manifest.web_accessible_resources = [];
    }
    manifest.web_accessible_resources.push({
      resources: [
        'src/lib/meteor-ddp-client.js',
        'src/lib/dicecloud-sync.js'
      ],
      matches: ['<all_urls>']
    });

    fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2));
  }

  console.log('   ✅ Chrome package built to ' + (isExperimental ? 'dist-experimental' : 'dist') + '/chrome/');
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

  // Copy Firefox-specific manifest (Manifest V2)
  const manifestSrc = path.join(ROOT, 'manifest_firefox.json');
  const manifestDest = path.join(BUILD_FIREFOX, 'manifest.json');
  fs.copyFileSync(manifestSrc, manifestDest);

  // Add experimental files if building experimental version
  if (isExperimental) {
    console.log('   📦 Adding experimental sync modules...');

    // Create lib directory
    const libDir = path.join(BUILD_FIREFOX, 'src', 'lib');
    fs.mkdirSync(libDir, { recursive: true });

    // Copy experimental files
    fs.copyFileSync(
      path.join(ROOT, 'experimental/two-way-sync/meteor-ddp-client.js'),
      path.join(libDir, 'meteor-ddp-client.js')
    );
    fs.copyFileSync(
      path.join(ROOT, 'experimental/two-way-sync/dicecloud-sync.js'),
      path.join(libDir, 'dicecloud-sync.js')
    );

    // Copy documentation
    fs.copyFileSync(
      path.join(ROOT, 'experimental/two-way-sync/README.md'),
      path.join(BUILD_FIREFOX, 'EXPERIMENTAL-README.md')
    );
    fs.copyFileSync(
      path.join(ROOT, 'experimental/two-way-sync/IMPLEMENTATION_GUIDE.md'),
      path.join(BUILD_FIREFOX, 'IMPLEMENTATION_GUIDE.md')
    );

    // Modify manifest for experimental build
    const manifest = JSON.parse(fs.readFileSync(manifestDest, 'utf8'));
    manifest.name = manifest.name + ' (Experimental Sync)';
    manifest.version = manifest.version.split('.').slice(0, 3).join('.') + '.1';
    manifest.description = manifest.description + ' - EXPERIMENTAL: Includes two-way sync features for testing';

    // Add web_accessible_resources for experimental files
    if (!manifest.web_accessible_resources) {
      manifest.web_accessible_resources = [];
    }
    manifest.web_accessible_resources.push({
      resources: [
        'src/lib/meteor-ddp-client.js',
        'src/lib/dicecloud-sync.js'
      ],
      matches: ['<all_urls>']
    });

    fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2));
  }

  console.log('   ✅ Firefox package built to ' + (isExperimental ? 'dist-experimental' : 'dist') + '/firefox/');
}

/**
 * Build Safari package
 */
function buildSafari() {
  console.log('📦 Building Safari package (Manifest V2)...');

  // Copy included files
  INCLUDE.forEach(item => {
    const srcPath = path.join(ROOT, item);
    const destPath = path.join(BUILD_SAFARI, item);

    if (fs.existsSync(srcPath)) {
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  });

  // Copy Safari-specific manifest (Manifest V2)
  fs.copyFileSync(
    path.join(ROOT, 'manifest_safari.json'),
    path.join(BUILD_SAFARI, 'manifest.json')
  );

  console.log('   ✅ Safari package built to dist/safari/');
}

/**
 * Create zip archives
 */
function createZips() {
  console.log('\n📦 Creating zip archives...');

  try {
    // Check if zip command is available
    execSync('which zip', { stdio: 'ignore' });

    const suffix = isExperimental ? '-experimental' : '';
    const distPath = isExperimental ? 'dist-experimental' : 'dist';

    // Create Chrome zip
    process.chdir(BUILD_CHROME);
    execSync(`zip -r ../rollcloud-chrome${suffix}.zip . -x "*.DS_Store"`, { stdio: 'inherit' });
    console.log(`   ✅ Chrome zip: ${distPath}/rollcloud-chrome${suffix}.zip`);

    // Create Firefox zip
    process.chdir(BUILD_FIREFOX);
    execSync(`zip -r ../rollcloud-firefox${suffix}.zip . -x "*.DS_Store"`, { stdio: 'inherit' });
    console.log(`   ✅ Firefox zip: ${distPath}/rollcloud-firefox${suffix}.zip`);

    // Create Safari zip
    process.chdir(BUILD_SAFARI);
    execSync(`zip -r ../rollcloud-safari${suffix}.zip . -x "*.DS_Store"`, { stdio: 'inherit' });
    console.log(`   ✅ Safari zip: ${distPath}/rollcloud-safari${suffix}.zip`);

    process.chdir(ROOT);
  } catch (error) {
    console.log('   ⚠️  zip command not found, skipping zip creation');
    console.log('   📁 You can manually zip the directories:');
    console.log('      - dist/chrome/');
    console.log('      - dist/firefox/');
    console.log('      - dist/safari/');
  }
}

/**
 * Display build summary
 */
function showSummary() {
  const distPath = isExperimental ? 'dist-experimental' : 'dist';
  const suffix = isExperimental ? '-experimental' : '';

  console.log('\n✨ Build complete!\n');

  if (isExperimental) {
    console.log('⚠️  EXPERIMENTAL BUILD - Includes two-way DiceCloud sync via Meteor DDP\n');
  }

  console.log('📂 Output:');
  console.log(`   Chrome (MV3):  ${distPath}/chrome/`);
  console.log(`   Firefox (MV2): ${distPath}/firefox/`);
  console.log(`   Safari (MV2):  ${distPath}/safari/`);

  if (fs.existsSync(path.join(DIST, `rollcloud-chrome${suffix}.zip`))) {
    console.log('\n📦 Zip files:');
    console.log(`   ${distPath}/rollcloud-chrome${suffix}.zip`);
    console.log(`   ${distPath}/rollcloud-firefox${suffix}.zip`);
    console.log(`   ${distPath}/rollcloud-safari${suffix}.zip`);
  }

  console.log('\n🚀 Next steps:');
  console.log(`   Chrome:  chrome://extensions/ → Load unpacked → ${distPath}/chrome/`);
  console.log(`   Firefox: about:debugging → Load Temporary Add-on → ${distPath}/firefox/manifest.json`);
  console.log(`   Safari:  See SAFARI.md for conversion and testing instructions`);

  if (isExperimental) {
    console.log('\n📚 Experimental Sync Documentation:');
    console.log(`   ${distPath}/chrome/EXPERIMENTAL-README.md`);
    console.log(`   ${distPath}/chrome/IMPLEMENTATION_GUIDE.md`);
    console.log('\n⚠️  Remember: This is experimental - test thoroughly before using with real characters!');
  }
}

// Run build
try {
  buildChrome();
  buildFirefox();
  buildSafari();
  createZips();
  showSummary();
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
