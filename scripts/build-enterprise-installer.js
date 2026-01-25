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
    // Step 1: Build signed extensions
    console.log('\n🔐 Building signed extensions...');
    execSync('npm run build:signed', { stdio: 'inherit' });

    // Step 2: Update installer package.json for enterprise
    console.log('\n📦 Configuring installer for enterprise...');
    const installerPackagePath = path.join(INSTALLER_DIR, 'package.json');
    const installerPackage = JSON.parse(fs.readFileSync(installerPackagePath, 'utf8'));

    // Update extraResources to use signed files
    installerPackage.build.extraResources = [
      {
        "from": "../dist/rollcloud-chrome-signed.crx",
        "to": "extension/rollcloud-chrome.crx"
      },
      {
        "from": "../dist/rollcloud-firefox-signed.xpi",
        "to": "extension/rollcloud-firefox.xpi"
      }
    ];

    // Update installer name for enterprise
    installerPackage.productName = "RollCloud Enterprise Setup";
    installerPackage.description = "RollCloud Enterprise Extension Installer";

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

    // Step 4: Build the installer
    console.log('\n🔨 Building enterprise installer...');
    execSync('npm run build:installer', { stdio: 'inherit' });

    // Step 5: Create enterprise deployment package
    console.log('\n📁 Creating enterprise deployment package...');
    const enterpriseDir = path.join(DIST_DIR, 'enterprise');
    
    if (!fs.existsSync(enterpriseDir)) {
      fs.mkdirSync(enterpriseDir, { recursive: true });
    }

    // Copy installer files
    const installerDist = path.join(INSTALLER_DIR, 'dist');
    if (fs.existsSync(installerDist)) {
      execSync(`xcopy "${installerDist}" "${enterpriseDir}" /E /I /Y`, { stdio: 'pipe' });
    }

    // Copy signed extensions
    fs.copyFileSync(
      path.join(DIST_DIR, 'rollcloud-chrome-signed.crx'),
      path.join(enterpriseDir, 'rollcloud-chrome.crx')
    );
    
    fs.copyFileSync(
      path.join(DIST_DIR, 'rollcloud-firefox-signed.xpi'),
      path.join(enterpriseDir, 'rollcloud-firefox.xpi')
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
    const enterpriseReadme = `# RollCloud Enterprise Installer

## 📦 Package Contents

- **RollCloud Enterprise Setup.exe** - Enterprise installer
- **rollcloud-chrome.crx** - Signed Chrome extension
- **rollcloud-firefox.xpi** - Signed Firefox extension
- **keys/public.pem** - Public key for verification
- **ENTERPRISE_DEPLOYMENT.md** - Full deployment guide

## 🔐 Extension Details

### Chrome Extension
- **Extension ID**: mkckngoemfjdkhcpaomdndlecolckgdj
- **File**: rollcloud-chrome.crx (signed)
- **Deployment**: Chrome Enterprise Policy

### Firefox Extension
- **Extension ID**: rollcloud@dicecat.dev
- **File**: rollcloud-firefox.xpi (signed)
- **Deployment**: Firefox Group Policy

## 🚀 Quick Start

1. **Run the installer**: \`RollCloud Enterprise Setup.exe\`
2. **Follow enterprise deployment guide**: See \`ENTERPRISE_DEPLOYMENT.md\`
3. **Configure policies**: Use Group Policy Editor
4. **Deploy to users**: Automatic installation

## 📞 Support

For enterprise support, see the deployment guide or contact IT department.

---

Built: ${new Date().toISOString()}
Version: 1.2.0
`;

    fs.writeFileSync(path.join(enterpriseDir, 'README.md'), enterpriseReadme);

    console.log('\n✅ Enterprise installer built successfully!');
    console.log('\n📁 Enterprise package created:');
    console.log(`   - ${enterpriseDir}`);
    console.log(`   - RollCloud Enterprise Setup.exe`);
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

// Run if called directly
if (require.main === module) {
  buildEnterpriseInstaller();
}

module.exports = { buildEnterpriseInstaller };
