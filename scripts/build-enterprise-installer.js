#!/usr/bin/env node

/**
 * Build Enterprise Installer with Signed Extensions
 * Creates installer for enterprise deployment using signed CRX/XPI files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const INSTALLER_DIR = path.join(ROOT_DIR, 'installer');

// Build enterprise installer
async function buildEnterpriseInstaller() {
  console.log('🏢 Building Enterprise Installer');
  console.log('=================================');

  try {
    // Step 1: Build base extensions first
    console.log('\n📦 Building base extensions...');
    execSync('npm run build:extension', { stdio: 'inherit' });

    // Step 2: Build signed extensions
    console.log('\n🔐 Building signed extensions...');
    execSync('npm run build:signed', { stdio: 'inherit' });

    // Step 3: Update installer package.json for enterprise
    console.log('\n📦 Configuring installer for enterprise...');
    const installerPackagePath = path.join(INSTALLER_DIR, 'package.json');
    const installerPackage = JSON.parse(fs.readFileSync(installerPackagePath, 'utf8'));

    // Update extraResources to use signed files
    installerPackage.build.extraResources = [
      {
        "from": "../dist/owlcloud-chrome-signed.crx",
        "to": "extension/owlcloud-chrome.crx"
      },
      {
        "from": "../dist/owlcloud-firefox-signed.xpi",
        "to": "extension/owlcloud-firefox.xpi"
      }
    ];

    // Update installer name for enterprise
    installerPackage.productName = "OwlCloud Enterprise Setup";
    installerPackage.description = "OwlCloud Enterprise Extension Installer";

    fs.writeFileSync(installerPackagePath, JSON.stringify(installerPackage, null, 2));

    // Step 3: Update installer to use enterprise policies
    const installerMainPath = path.join(INSTALLER_DIR, 'src', 'main.js');
    let installerMain = fs.readFileSync(installerMainPath, 'utf8');

    // Update configuration for enterprise
    installerMain = installerMain.replace(
      "const { installExtensions } = require('./local-installer');",
      "// const { installExtensions } = require('./local-installer'); // Disabled for enterprise"
    );

    installerMain = installerMain.replace(
      "const results = await installExtensions();",
      "const result = await installExtension(browser, CONFIG); // Use enterprise policy"
    );

    installerMain = installerMain.replace(
      "if (browser === 'chrome') {\n      return results.chrome;\n    } else if (browser === 'firefox') {\n      return results.firefox;",
      "return { success: true, ...result };"
    );

    fs.writeFileSync(installerMainPath, installerMain);

    // Step 5: Clean and build the installer
    console.log('\n🔨 Building enterprise installer...');
    
    // Clean previous installer build
    const installerBuildDir = path.join(INSTALLER_DIR, 'dist');
    if (fs.existsSync(installerBuildDir)) {
      fs.rmSync(installerBuildDir, { recursive: true });
      console.log('   Cleaned previous installer build');
    }
    
    execSync('npm run build:installer', { stdio: 'inherit' });

    // Step 6: Create enterprise deployment package
    console.log('\n📁 Creating enterprise deployment package...');
    const enterpriseDir = path.join(DIST_DIR, 'enterprise');
    
    if (!fs.existsSync(enterpriseDir)) {
      fs.mkdirSync(enterpriseDir, { recursive: true });
    }

    // Copy installer files
    const installerDist = path.join(INSTALLER_DIR, 'dist');
    console.log(`   Checking installer dist path: ${installerDist}`);
    console.log(`   Installer dist exists: ${fs.existsSync(installerDist)}`);
    
    if (fs.existsSync(installerDist)) {
      console.log(`   Found installer dist at: ${installerDist}`);
      // Use manual copy method for better compatibility
      console.log('   Using manual copy method...');
      copyFolderRecursive(installerDist, enterpriseDir);
    } else {
      console.log('   No installer dist directory found - this is expected if the build failed');
    }

    // Copy signed extensions
    fs.copyFileSync(
      path.join(DIST_DIR, 'owlcloud-chrome-signed.crx'),
      path.join(enterpriseDir, 'owlcloud-chrome.crx')
    );
    
    fs.copyFileSync(
      path.join(DIST_DIR, 'owlcloud-firefox-signed.xpi'),
      path.join(enterpriseDir, 'owlcloud-firefox.xpi')
    );

    // Copy enterprise deployment guide
    fs.copyFileSync(
      path.join(ROOT_DIR, 'ENTERPRISE_DEPLOYMENT.md'),
      path.join(enterpriseDir, 'ENTERPRISE_DEPLOYMENT.md')
    );

    // Copy keys (for IT department)
    const keysDir = path.join(enterpriseDir, 'keys');
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }
    
    fs.copyFileSync(
      path.join(ROOT_DIR, 'keys', 'public.pem'),
      path.join(keysDir, 'public.pem')
    );

    // Create enterprise README
    const enterpriseReadme = `# OwlCloud Enterprise Installer

## 📦 Package Contents

- **OwlCloud Enterprise Setup.exe** - Enterprise installer
- **owlcloud-chrome.crx** - Signed Chrome extension
- **owlcloud-firefox.xpi** - Signed Firefox extension
- **keys/public.pem** - Public key for verification
- **ENTERPRISE_DEPLOYMENT.md** - Full deployment guide

## 🔐 Extension Details

### Chrome Extension
- **Extension ID**: mkckngoemfjdkhcpaomdndlecolckgdj
- **File**: owlcloud-chrome.crx (signed)
- **Deployment**: Chrome Enterprise Policy

### Firefox Extension
- **Extension ID**: owlcloud@dicecat.dev
- **File**: owlcloud-firefox.xpi (signed)
- **Deployment**: Firefox Group Policy

## 🚀 Quick Start

1. **Run the installer**: \`OwlCloud Enterprise Setup.exe\`
2. **Follow enterprise deployment guide**: See \`ENTERPRISE_DEPLOYMENT.md\`
3. **Configure policies**: Use Group Policy Editor
4. **Deploy to users**: Automatic installation

## 📞 Support

For enterprise support, see the deployment guide or contact IT department.

---

Built: ${new Date().toISOString()}
Version: ${require(path.join(ROOT_DIR, 'package.json')).version}
`;

    fs.writeFileSync(path.join(enterpriseDir, 'README.md'), enterpriseReadme);

    console.log('\n✅ Enterprise installer built successfully!');
    console.log('\n📁 Enterprise package created:');
    console.log(`   - ${enterpriseDir}`);
    console.log(`   - OwlCloud Enterprise Setup.exe`);
    console.log(`   - Signed extensions (CRX/XPI)`);
    console.log(`   - Enterprise deployment guide`);
    console.log(`   - Public key for verification`);

    console.log('\n🎯 Next Steps:');
    console.log('1. Distribute enterprise package to IT department');
    console.log('2. Follow ENTERPRISE_DEPLOYMENT.md for policy configuration');
    console.log('3. Deploy extensions using enterprise policies');
    console.log('4. Monitor and update as needed');

  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Fallback recursive folder copy function
function copyFolderRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  entries.forEach(entry => {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

// Run if called directly
if (require.main === module) {
  buildEnterpriseInstaller();
}

module.exports = { buildEnterpriseInstaller };
