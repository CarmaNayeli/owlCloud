#!/usr/bin/env node

/**
 * Wrapper script to suppress deprecation warnings during electron-builder build
 * Also builds the updater utility before building the main installer
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Suppress deprecation warnings
process.noDeprecationWarning = true;

/**
 * Safely remove a directory with retries (handles Windows file locking)
 * @param {string} dirPath - Path to directory to remove
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delayMs - Delay between retries in milliseconds
 */
async function safeRmDir(dirPath, maxRetries = 5, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return true;
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'ENOTEMPTY') {
        if (attempt < maxRetries) {
          console.log(`⏳ Directory locked, retrying in ${delayMs}ms... (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          console.warn(`⚠️ Could not remove ${dirPath} after ${maxRetries} attempts - continuing anyway`);
          return false;
        }
      } else if (error.code === 'ENOENT') {
        // Directory doesn't exist, that's fine
        return true;
      } else {
        throw error;
      }
    }
  }
  return false;
}

async function buildUpdater() {
  console.log('🔄 Building OwlCloud Updater...');
  
  const updaterPath = path.join(__dirname, 'updater');
  
  // Check if updater directory exists
  if (!fs.existsSync(updaterPath)) {
    console.log('⚠️ Updater directory not found, skipping updater build');
    return;
  }
  
  try {
    // Build updater for Windows and Linux only (macOS requires macOS)
    const platforms = process.argv.includes('--win') ? ['--win'] :
                     process.argv.includes('--linux') ? ['--linux'] :
                     process.argv.includes('--mac') ? ['--mac'] :
                     ['--win']; // Default to Windows only
    
    for (const platform of platforms) {
      console.log(`📦 Building updater for ${platform}...`);
      
      const buildScript = platform === '--win' ? 'build:win' :
                          platform === '--mac' ? 'build:mac' :
                          'build:linux';

      const buildProcess = spawn('npm', ['run', buildScript], {
        cwd: updaterPath,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: {
          ...process.env,
          NODE_NO_WARNINGS: '1',
          NODE_NO_DEPRECATION: '1'
        }
      });
      
      await new Promise((resolve, reject) => {
        buildProcess.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Updater build failed for ${platform}`));
          }
        });
        
        buildProcess.on('error', reject);
      });
    }
    
    console.log('✅ Updater build completed successfully');
    
    // Copy built updater to main installer resources
    const updaterDistPath = path.join(updaterPath, 'dist');
    const installerResourcesPath = path.join(__dirname, 'resources');
    
    if (!fs.existsSync(installerResourcesPath)) {
      fs.mkdirSync(installerResourcesPath, { recursive: true });
    }
    
    // Copy Windows updater
    const winUpdaterPath = path.join(updaterDistPath, 'OwlCloud Updater 1.0.0.exe');
    const winDestPath = path.join(installerResourcesPath, 'OwlCloud-Updater.exe');
    
    if (fs.existsSync(winUpdaterPath)) {
      fs.copyFileSync(winUpdaterPath, winDestPath);
      console.log('📋 Copied Windows updater to installer resources');
    } else {
      console.log('⚠️ Windows updater not found, checking alternative names...');
      // Check for alternative naming patterns
      const altPaths = [
        path.join(updaterDistPath, 'OwlCloud Updater.exe'),
        path.join(updaterDistPath, 'OwlCloud-Updater.exe'),
        path.join(updaterDistPath, 'owlcloud-updater.exe')
      ];
      
      for (const altPath of altPaths) {
        if (fs.existsSync(altPath)) {
          fs.copyFileSync(altPath, winDestPath);
          console.log('📋 Copied Windows updater (alternative name) to installer resources');
          break;
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Updater build failed:', error.message);
    process.exit(1);
  }
}

// Build updater first, then main installer
buildUpdater().then(async () => {
  console.log('🏗️ Building main installer...');

  // Clean dist folder before building (with retries for Windows file locking)
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    console.log('🧹 Cleaning dist folder...');
    await safeRmDir(distPath);
  }

  // Run electron-builder with original arguments
  const electronBuilderPath = path.join(__dirname, 'node_modules', '.bin', 'electron-builder');
  const args = process.argv.slice(2);

  const child = spawn(electronBuilderPath, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      NODE_NO_WARNINGS: '1',
      NODE_NO_DEPRECATION: '1'
    }
  });

  child.on('exit', (code) => {
    if (code === 0) {
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
      console.log(`\n🎉 Build complete at ${timestamp}`);
    }
    process.exit(code);
  });

  child.on('error', (err) => {
    console.error('Failed to start electron-builder:', err);
    process.exit(1);
  });
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
