#!/usr/bin/env node

/**
 * Build Updater Script
 * Builds the RollCloud Updater and copies it to installer resources
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const UPDATER_DIR = path.join(ROOT_DIR, 'updater');
const RESOURCES_DIR = path.join(ROOT_DIR, 'resources');
const UPDATER_DIST = path.join(UPDATER_DIR, 'dist', 'RollCloud Updater 1.0.0.exe');
const UPDATER_TARGET = path.join(RESOURCES_DIR, 'RollCloud-Updater.exe');

console.log('\n🔨 Building RollCloud Updater...\n');

// Ensure resources directory exists
if (!fs.existsSync(RESOURCES_DIR)) {
  fs.mkdirSync(RESOURCES_DIR, { recursive: true });
}

try {
  // Build the updater
  console.log('   Building updater...');
  execSync('npm run build:win', {
    cwd: UPDATER_DIR,
    stdio: 'inherit'
  });

  // Copy to resources
  if (fs.existsSync(UPDATER_DIST)) {
    console.log('\n   Copying updater to installer resources...');
    fs.copyFileSync(UPDATER_DIST, UPDATER_TARGET);

    const stats = fs.statSync(UPDATER_TARGET);
    const size = (stats.size / (1024 * 1024)).toFixed(1);
    console.log(`   ✅ RollCloud-Updater.exe (${size} MB)`);
  } else {
    console.error('   ❌ Updater executable not found at:', UPDATER_DIST);
    process.exit(1);
  }

  console.log('\n✅ Updater build complete!\n');
} catch (error) {
  console.error('\n❌ Updater build failed:', error.message);
  process.exit(1);
}
