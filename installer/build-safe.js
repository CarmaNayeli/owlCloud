#!/usr/bin/env node

/**
 * Wrapper script to suppress deprecation warnings during electron-builder build
 */

const { spawn } = require('child_process');
const path = require('path');

// Suppress deprecation warnings
process.noDeprecationWarning = true;

// Run electron-builder with original arguments
const electronBuilderPath = path.join(__dirname, 'node_modules', '.bin', 'electron-builder');
const args = process.argv.slice(2);

const child = spawn(electronBuilderPath, args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_NO_WARNINGS: '1',
    NODE_NO_DEPRECATION: '1'
  }
});

child.on('exit', (code) => {
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Failed to start electron-builder:', err);
  process.exit(1);
});
