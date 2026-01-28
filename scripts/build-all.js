#!/usr/bin/env node

/**
 * Unified Build Script
 * Rebuilds everything: extension files, signed packages, and installer
 *
 * Usage: node scripts/build-all.js [options]
 *   --skip-installer    Skip building the installer
 *   --skip-signing      Skip signing (just build raw extensions)
 *   --verbose           Show detailed output
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const RELEASES_DIR = path.join(ROOT_DIR, 'releases');
const INSTALLER_DIR = path.join(ROOT_DIR, 'installer');

// Parse command line arguments
const args = process.argv.slice(2);
const skipInstaller = args.includes('--skip-installer');
const skipSigning = args.includes('--skip-signing');
const verbose = args.includes('--verbose');

// Helper to run commands
function run(command, options = {}) {
  const opts = {
    stdio: verbose ? 'inherit' : 'pipe',
    cwd: ROOT_DIR,
    encoding: 'utf-8',
    ...options
  };

  try {
    const result = execSync(command, opts);
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout };
  }
}

// Helper to check if a command exists
function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    try {
      execSync(`where ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

// Helper to check if we can build installer components
function canBuildInstaller() {
  // Check for Node.js and npm
  if (!commandExists('node') || !commandExists('npm')) {
    return false;
  }
  
  // Check if installer directory exists and has package.json
  const installerPackageJson = path.join(INSTALLER_DIR, 'package.json');
  return fs.existsSync(installerPackageJson);
}

// Helper to check if we can sign extensions
function canSignExtensions() {
  return commandExists('openssl') || fs.existsSync(path.join(ROOT_DIR, 'keys', 'private.pem'));
}

// Print section header
function printSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

// Print step
function printStep(step, description) {
  console.log(`\n[${step}] ${description}`);
}

// Main build function
async function buildAll() {
  const startTime = Date.now();

  console.log('\n🚀 RollCloud Unified Build');
  console.log('==========================');
  console.log(`   Version: ${require(path.join(ROOT_DIR, 'package.json')).version}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Node: ${process.version}`);
  console.log(`   Can build installer: ${canBuildInstaller()}`);
  console.log(`   Can sign extensions: ${canSignExtensions()}`);
  console.log(`   Skip Installer: ${skipInstaller}`);
  console.log(`   Skip Signing: ${skipSigning}`);

  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // ============================================================================
  // Step 1: Build Extension Files (Chrome + Firefox + Safari)
  // ============================================================================
  printSection('Step 1: Building Extension Files');

  printStep('1.1', 'Building Chrome, Firefox, and Safari extensions...');
  const extResult = run('node scripts/build-extension-clean.js');

  if (!extResult.success) {
    console.error('❌ Extension build failed:', extResult.error);
    process.exit(1);
  }
  console.log('   ✅ Extension files built');

  // Also build the fixed versions for signing
  printStep('1.2', 'Building extension packages for signing...');
  const fixedResult = run('node scripts/build-extension-fixed.js');

  if (!fixedResult.success) {
    console.error('❌ Extension package build failed:', fixedResult.error);
    process.exit(1);
  }
  console.log('   ✅ Extension packages built');

  // ============================================================================
  // Step 2: Sign Extensions (Chrome CRX + Firefox XPI)
  // ============================================================================
  if (!skipSigning && canSignExtensions()) {
    printSection('Step 2: Signing Extensions');

    // Check for signing keys
    const keysDir = path.join(ROOT_DIR, 'keys');
    const privateKeyPath = path.join(keysDir, 'private.pem');

    if (!fs.existsSync(privateKeyPath)) {
      console.log('   ⚠️ No signing key found at keys/private.pem');
      console.log('   Generating new signing keys...');

      if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true });
      }

      // Generate new RSA key pair
      const keyGenResult = run(
        `openssl genrsa -out "${privateKeyPath}" 2048`,
        { stdio: 'pipe' }
      );

      if (!keyGenResult.success) {
        console.error('❌ Key generation failed. Please install OpenSSL.');
        console.log('   Skipping signing step...');
      } else {
        // Generate public key
        run(`openssl rsa -in "${privateKeyPath}" -pubout -out "${path.join(keysDir, 'public.pem')}"`, { stdio: 'pipe' });
        console.log('   ✅ Generated new signing keys');
      }
    }

    if (fs.existsSync(privateKeyPath)) {
      printStep('2.1', 'Signing Chrome extension (CRX3)...');
      const signedResult = run('node scripts/build-signed.js');

      if (!signedResult.success) {
        console.error('   ⚠️ Chrome signing failed:', signedResult.error);
        console.log('   Continuing without signed Chrome extension...');
      } else {
        console.log('   ✅ Chrome CRX signed');

        // Read and display extension ID
        const idFile = path.join(DIST_DIR, 'rollcloud-chrome-signed.id');
        if (fs.existsSync(idFile)) {
          const extensionId = fs.readFileSync(idFile, 'utf8').trim();
          console.log(`   Extension ID: ${extensionId}`);
        }
      }

      printStep('2.2', 'Creating Firefox XPI...');
      const xpiSrc = path.join(DIST_DIR, 'rollcloud-firefox.zip');
      const xpiDest = path.join(DIST_DIR, 'rollcloud-firefox-signed.xpi');

      if (fs.existsSync(xpiSrc)) {
        fs.copyFileSync(xpiSrc, xpiDest);
        console.log('   ✅ Firefox XPI created');
      } else {
        console.log('   ⚠️ Firefox ZIP not found, skipping XPI');
      }
    }
  } else {
    printSection('Step 2: Signing Extensions (SKIPPED)');
  }

  // ============================================================================
  // Step 3: Build Installer
  // ============================================================================
  if (!skipInstaller && canBuildInstaller()) {
    printSection('Step 3: Building Installer');

    // Verify signed extensions exist for installer
    const chromeCrx = path.join(DIST_DIR, 'rollcloud-chrome-signed.crx');
    const firefoxXpi = path.join(DIST_DIR, 'rollcloud-firefox-signed.xpi');

    if (!fs.existsSync(chromeCrx)) {
      console.log('   ⚠️ Chrome CRX not found, installer may not work properly');
    }
    if (!fs.existsSync(firefoxXpi)) {
      console.log('   ⚠️ Firefox XPI not found, installer may not work properly');
    }

    printStep('3.1', 'Installing installer dependencies...');
    const npmInstallResult = run('npm install', { cwd: INSTALLER_DIR });
    if (!npmInstallResult.success) {
      console.error('   ⚠️ npm install failed in installer directory');
    }

    printStep('3.2', 'Building Electron installer...');
    const installerResult = run('npm run build', { cwd: INSTALLER_DIR, stdio: 'inherit' });

    if (!installerResult.success) {
      console.error('   ⚠️ Installer build failed');
      console.log('   You can try building manually: cd installer && npm run build');
    } else {
      console.log('   ✅ Installer built');
    }
  } else {
    printSection('Step 3: Building Installer (SKIPPED)');
  }

  // ============================================================================
  // Step 4: Copy to Releases Folder
  // ============================================================================
  printSection('Step 4: Copying to Releases Folder');

  // Clear releases directory to ensure only current build assets
  if (fs.existsSync(RELEASES_DIR)) {
    console.log('   🧹 Clearing releases directory...');
    fs.rmSync(RELEASES_DIR, { recursive: true });
  }
  fs.mkdirSync(RELEASES_DIR, { recursive: true });

  // Get version from package.json
  const packageJson = require(path.join(ROOT_DIR, 'package.json'));
  const version = packageJson.version;

  // Files to copy to releases (ONLY GitHub release assets)
  const releaseFiles = [
    { src: 'rollcloud-chrome-signed.crx', dest: 'rollcloud-chrome-signed.crx' },
    { src: 'rollcloud-chrome-signed.id', dest: 'rollcloud-chrome-signed.id' },
    { src: 'rollcloud-firefox-signed.xpi', dest: 'rollcloud-firefox-signed.xpi' },
    { src: 'rollcloud-chrome.zip', dest: 'rollcloud-chrome.zip' },
    { src: 'rollcloud-firefox.zip', dest: 'rollcloud-firefox.zip' },
    { src: 'rollcloud-safari.zip', dest: 'rollcloud-safari.zip' },
  ];

  let copiedCount = 0;
  for (const file of releaseFiles) {
    const srcPath = path.join(DIST_DIR, file.src);
    const destPath = path.join(RELEASES_DIR, file.dest);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      const stats = fs.statSync(destPath);
      const size = (stats.size / 1024).toFixed(1);
      console.log(`   ✅ ${file.dest} (${size} KB)`);
      copiedCount++;
    } else {
      console.log(`   ⚠️ ${file.src} not found, skipping`);
    }
  }

  console.log(`\n   Copied ${copiedCount} files to releases/`);

  // Copy installer files from installer/dist/ to releases/
  if (!skipInstaller && canBuildInstaller()) {
    console.log('\n   Copying installer files...');
    const installerDistDir = path.join(INSTALLER_DIR, 'dist');

    if (fs.existsSync(installerDistDir)) {
      const installerFiles = fs.readdirSync(installerDistDir).filter(f =>
        f.endsWith('.exe') || f.endsWith('.dmg') || f.endsWith('.AppImage') || f.endsWith('.deb')
      );

      for (const file of installerFiles) {
        const srcPath = path.join(installerDistDir, file);
        // Standardize name: replace spaces with dashes, remove version number
        // e.g., "RollCloud Setup 1.2.4.exe" -> "RollCloud-Setup.exe"
        let destName = file.replace(/\s+/g, '-').replace(/-\d+\.\d+\.\d+/, '');
        const destPath = path.join(RELEASES_DIR, destName);

        fs.copyFileSync(srcPath, destPath);
        const stats = fs.statSync(destPath);
        const size = (stats.size / (1024 * 1024)).toFixed(1);
        console.log(`   ✅ ${destName} (${size} MB)`);
        copiedCount++;
      }
    } else {
      console.log('   ⚠️ installer/dist/ not found, skipping installer files');
    }
  }

  console.log(`\n   Total: ${copiedCount} files copied to releases/`);

  // ============================================================================
  // Summary
  // ============================================================================
  printSection('Build Complete!');

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n   Build completed in ${duration}s\n`);

  console.log('📦 Output Files:');
  console.log('   dist/');

  // List generated files
  const distFiles = [
    'rollcloud-chrome.zip',
    'rollcloud-firefox.zip',
    'rollcloud-chrome-signed.crx',
    'rollcloud-firefox-signed.xpi',
    'rollcloud-chrome-signed.id'
  ];

  for (const file of distFiles) {
    const filePath = path.join(DIST_DIR, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const size = (stats.size / 1024).toFixed(1);
      console.log(`     ✅ ${file} (${size} KB)`);
    } else {
      console.log(`     ❌ ${file} (not found)`);
    }
  }

  // Check installer output
  if (!skipInstaller) {
    const installerDistDir = path.join(INSTALLER_DIR, 'dist');
    if (fs.existsSync(installerDistDir)) {
      console.log('\n   installer/dist/');
      const installerFiles = fs.readdirSync(installerDistDir);
      for (const file of installerFiles) {
        if (file.endsWith('.exe') || file.endsWith('.dmg') || file.endsWith('.AppImage') || file.endsWith('.deb')) {
          const filePath = path.join(installerDistDir, file);
          const stats = fs.statSync(filePath);
          const size = (stats.size / (1024 * 1024)).toFixed(1);
          console.log(`     ✅ ${file} (${size} MB)`);
        }
      }
    }
  }

  // List releases folder
  console.log('\n   releases/ (for GitHub Release uploads):');
  if (fs.existsSync(RELEASES_DIR)) {
    const releaseFilesInDir = fs.readdirSync(RELEASES_DIR).filter(f =>
      f.endsWith('.crx') || f.endsWith('.xpi') || f.endsWith('.zip') ||
      f.endsWith('.exe') || f.endsWith('.dmg') || f.endsWith('.AppImage') || f.endsWith('.deb')
    );
    for (const file of releaseFilesInDir) {
      const filePath = path.join(RELEASES_DIR, file);
      const stats = fs.statSync(filePath);
      const isLarge = stats.size > 1024 * 1024;
      const size = isLarge
        ? (stats.size / (1024 * 1024)).toFixed(1) + ' MB'
        : (stats.size / 1024).toFixed(1) + ' KB';
      console.log(`     📦 ${file} (${size})`);
    }
  }

  console.log('\n📋 GitHub Release Upload Checklist:');
  console.log(`     Upload these files from releases/ folder:`);
  console.log(`       Extensions:`);
  console.log(`         - rollcloud-chrome-signed.crx (for enterprise policy install)`);
  console.log(`         - rollcloud-firefox-signed.xpi (for Firefox install)`);
  console.log(`         - rollcloud-chrome.zip (for manual Chrome install)`);
  console.log(`         - rollcloud-firefox.zip (for manual Firefox install)`);
  if (fs.existsSync(path.join(RELEASES_DIR, 'rollcloud-safari.zip'))) {
    console.log(`         - rollcloud-safari.zip (for Safari)`);
  }
  if (!skipInstaller && canBuildInstaller()) {
    console.log(`       Installers:`);
    console.log(`         - RollCloud-Setup.exe (Windows installer)`);
    console.log(`         - RollCloud-Setup.dmg (macOS installer)`);
    console.log(`         - RollCloud-Setup.AppImage (Linux installer)`);
  }

  const now = new Date();
  const timestamp = now.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  console.log(`\n🎉 Build complete at ${timestamp}\n`);
}

// Run
buildAll().catch(error => {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
});
