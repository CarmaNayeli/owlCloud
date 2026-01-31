#!/usr/bin/env node

/**
 * Build Script for OwlCloud Extension
 * Generates browser-specific packages for Chrome and Firefox
 *
 * Usage:
 *   node build.js                    - Production build (DEBUG = false)
 *   node build.js --dev              - Development build (DEBUG = true)
 *   node build.js --experimental     - Experimental build with two-way sync
 *   node build.js --experimental --dev - Experimental with DEBUG enabled
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check for build flags
const args = process.argv.slice(2);
const isExperimental = args.includes('--experimental') || args.includes('--exp');
const isDev = args.includes('--dev'); // Enable debug mode in production build

const ROOT = path.join(__dirname, '..'); // Parent directory (project root)
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
  console.log('🧪 Building OwlCloud extension packages (EXPERIMENTAL with two-way sync)...\n');
  console.log('⚠️  This build includes experimental DiceCloud sync via Meteor DDP');
} else {
  console.log('🏗️  Building OwlCloud extension packages...\n');
}

console.log(`🔧 Build mode: ${isDev ? 'DEVELOPMENT (DEBUG = true)' : 'PRODUCTION (DEBUG = false)'}\n`);

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
 * Process debug.js to set DEBUG flag based on build type
 * @param {string} buildDir - Build directory (chrome, firefox, or safari)
 */
function processDebugFlag(buildDir) {
  const debugFilePath = path.join(buildDir, 'src', 'common', 'debug.js');

  if (!fs.existsSync(debugFilePath)) {
    console.warn(`   ⚠️  Warning: debug.js not found at ${debugFilePath}`);
    return;
  }

  let content = fs.readFileSync(debugFilePath, 'utf8');

  // Replace DEBUG = true with DEBUG = false for production builds
  // Keep DEBUG = true for development builds (--dev flag)
  const debugValue = isDev ? 'true' : 'false';

  content = content.replace(
    /const DEBUG = true; \/\/ BUILD_PLACEHOLDER: Set by build script/,
    `const DEBUG = ${debugValue}; // Set by build script (${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode)`
  );

  fs.writeFileSync(debugFilePath, content, 'utf8');

  console.log(`   🔧 DEBUG mode set to: ${debugValue} (${isDev ? 'development' : 'production'} build)`);
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
    manifest.name = 'OwlCloud: EXPERIMENTAL';
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

    // Add experimental sync scripts to Roll20 content script
    const roll20ContentScript = manifest.content_scripts.find(script => 
      script.matches && script.matches.includes('https://app.roll20.net/*')
    );
    if (roll20ContentScript) {
      roll20ContentScript.js.push('src/lib/meteor-ddp-client.js');
      roll20ContentScript.js.push('src/lib/dicecloud-sync.js');
    }

    fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2));
  }

  // Process debug.js to set DEBUG flag
  processDebugFlag(BUILD_CHROME);

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
    manifest.name = 'OwlCloud: EXPERIMENTAL';
    manifest.version = manifest.version.split('.').slice(0, 3).join('.') + '.1';
    manifest.description = manifest.description + ' - EXPERIMENTAL: Includes two-way sync features for testing';

    // Add web_accessible_resources for experimental files
    // Manifest V2 (Firefox) uses array of strings, not objects
    if (!manifest.web_accessible_resources) {
      manifest.web_accessible_resources = [];
    }
    manifest.web_accessible_resources.push(
      'src/lib/meteor-ddp-client.js',
      'src/lib/dicecloud-sync.js'
    );

    // Add experimental sync scripts to Roll20 content script
    const roll20ContentScript = manifest.content_scripts.find(script =>
      script.matches && script.matches.includes('https://app.roll20.net/*')
    );
    if (roll20ContentScript) {
      // Insert sync files before roll20.js
      const roll20Index = roll20ContentScript.js.indexOf('src/content/roll20.js');
      if (roll20Index !== -1) {
        roll20ContentScript.js.splice(roll20Index, 0,
          'src/lib/meteor-ddp-client.js',
          'src/lib/dicecloud-sync.js'
        );
      }
    }

    fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2));
  }

  // Process debug.js to set DEBUG flag
  processDebugFlag(BUILD_FIREFOX);

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

  // Process debug.js to set DEBUG flag
  processDebugFlag(BUILD_SAFARI);

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
    execSync(`zip -r ../owlcloud-chrome${suffix}.zip . -x "*.DS_Store"`, { stdio: 'inherit' });
    console.log(`   ✅ Chrome zip: ${distPath}/owlcloud-chrome${suffix}.zip`);

    // Create Firefox zip
    process.chdir(BUILD_FIREFOX);
    execSync(`zip -r ../owlcloud-firefox${suffix}.zip . -x "*.DS_Store"`, { stdio: 'inherit' });
    console.log(`   ✅ Firefox zip: ${distPath}/owlcloud-firefox${suffix}.zip`);

    // Create Safari zip
    process.chdir(BUILD_SAFARI);
    execSync(`zip -r ../owlcloud-safari${suffix}.zip . -x "*.DS_Store"`, { stdio: 'inherit' });
    console.log(`   ✅ Safari zip: ${distPath}/owlcloud-safari${suffix}.zip`);

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

  if (fs.existsSync(path.join(DIST, `owlcloud-chrome${suffix}.zip`))) {
    console.log('\n📦 Zip files:');
    console.log(`   ${distPath}/owlcloud-chrome${suffix}.zip`);
    console.log(`   ${distPath}/owlcloud-firefox${suffix}.zip`);
    console.log(`   ${distPath}/owlcloud-safari${suffix}.zip`);
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
