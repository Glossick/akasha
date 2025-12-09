#!/usr/bin/env node

/**
 * Bundle lbug into Akasha's distribution
 * 
 * This script:
 * 1. Ensures lbug is installed and set up
 * 2. Copies required files to dist/vendor/lbug/
 * 3. Copies platform-specific binaries
 * 4. Creates VERSION file
 * 5. Creates minimal package.json
 * 6. Patches lbug_native.js for correct binary path
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const VENDOR_DIR = path.join(DIST_DIR, 'vendor');
const VENDOR_LBUG_DIR = path.join(VENDOR_DIR, 'lbug');
const PREBUILT_DIR = path.join(VENDOR_LBUG_DIR, 'prebuilt');

/**
 * Get lbug version from package.json
 */
function getLbugVersion() {
  const packageJsonPath = path.join(ROOT_DIR, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  
  const lbugVersion = packageJson.devDependencies?.lbug;
  if (!lbugVersion) {
    throw new Error(
      'lbug not found in devDependencies. Please add it:\n' +
      '  "devDependencies": {\n' +
      '    "lbug": "0.12.2"\n' +
      '  }'
    );
  }
  
  // Remove version prefix (^, ~, etc.)
  return lbugVersion.replace(/^[\^~]/, '');
}

/**
 * Ensure lbug is installed and set up
 */
function ensureLbugInstalled() {
  console.log('📦 Ensuring lbug is installed...');
  
  const lbugDir = path.join(ROOT_DIR, 'node_modules', 'lbug');
  
  if (!fs.existsSync(lbugDir)) {
    throw new Error(
      'lbug not found in node_modules. Please run:\n' +
      '  bun install'
    );
  }
  
  // Check if lbug is properly set up (has index.js, index.mjs, lbugjs.node)
  const requiredFiles = ['index.js', 'index.mjs', 'lbugjs.node'];
  const missingFiles = requiredFiles.filter(file => 
    !fs.existsSync(path.join(lbugDir, file))
  );
  
  if (missingFiles.length > 0) {
    console.log('🔧 Running lbug install script...');
    const installScript = path.join(lbugDir, 'install.js');
    
    if (!fs.existsSync(installScript)) {
      throw new Error(
        `lbug install.js not found. Missing files: ${missingFiles.join(', ')}`
      );
    }
    
    try {
      execSync('node install.js', {
        cwd: lbugDir,
        stdio: 'inherit',
        env: process.env
      });
      console.log('✅ lbug install script completed');
    } catch (error) {
      throw new Error(
        `Failed to run lbug install script: ${error.message}\n` +
        `Please run manually: cd node_modules/lbug && node install.js`
      );
    }
  } else {
    console.log('✅ lbug is already set up');
  }
}

/**
 * Copy JavaScript files from lbug to vendor directory
 */
function copyJSFiles() {
  console.log('📋 Copying JavaScript files...');
  
  const lbugDir = path.join(ROOT_DIR, 'node_modules', 'lbug');
  const jsFiles = [
    'index.js',
    'index.mjs',
    'connection.js',
    'database.js',
    'prepared_statement.js',
    'query_result.js',
    'lbug_native.js',
  ];
  
  for (const file of jsFiles) {
    const src = path.join(lbugDir, file);
    const dest = path.join(VENDOR_LBUG_DIR, file);
    
    if (!fs.existsSync(src)) {
      throw new Error(`Required file not found: ${src}`);
    }
    
    fs.copyFileSync(src, dest);
    console.log(`  ✓ ${file}`);
  }
}

/**
 * Copy type definitions
 */
function copyTypeDefinitions() {
  console.log('📋 Copying type definitions...');
  
  const lbugDir = path.join(ROOT_DIR, 'node_modules', 'lbug');
  const typeDefFile = 'lbug.d.ts';
  const src = path.join(lbugDir, typeDefFile);
  const dest = path.join(VENDOR_LBUG_DIR, typeDefFile);
  
  if (!fs.existsSync(src)) {
    throw new Error(`Type definition file not found: ${src}`);
  }
  
  fs.copyFileSync(src, dest);
  console.log(`  ✓ ${typeDefFile}`);
}

/**
 * Copy platform-specific binaries
 */
function copyPlatformBinaries() {
  console.log('📋 Copying platform-specific binaries...');
  
  const lbugDir = path.join(ROOT_DIR, 'node_modules', 'lbug');
  const prebuiltSourceDir = path.join(lbugDir, 'prebuilt');
  
  if (!fs.existsSync(prebuiltSourceDir)) {
    throw new Error(`Prebuilt directory not found: ${prebuiltSourceDir}`);
  }
  
  // Create prebuilt directory in vendor
  if (!fs.existsSync(PREBUILT_DIR)) {
    fs.mkdirSync(PREBUILT_DIR, { recursive: true });
  }
  
  // Copy all .node files from prebuilt
  const files = fs.readdirSync(prebuiltSourceDir);
  const nodeFiles = files.filter(file => file.endsWith('.node'));
  
  for (const file of nodeFiles) {
    const src = path.join(prebuiltSourceDir, file);
    const dest = path.join(PREBUILT_DIR, file);
    fs.copyFileSync(src, dest);
    console.log(`  ✓ ${file}`);
  }
  
  if (nodeFiles.length === 0) {
    throw new Error('No platform binaries found in prebuilt directory');
  }
}

/**
 * Copy installed binary for current platform
 */
function copyInstalledBinary() {
  console.log('📋 Copying installed binary for current platform...');
  
  const lbugDir = path.join(ROOT_DIR, 'node_modules', 'lbug');
  const binaryFile = 'lbugjs.node';
  const src = path.join(lbugDir, binaryFile);
  const dest = path.join(VENDOR_LBUG_DIR, binaryFile);
  
  if (!fs.existsSync(src)) {
    throw new Error(`Installed binary not found: ${src}\n` +
      `This should have been created by lbug's install script.`);
  }
  
  fs.copyFileSync(src, dest);
  console.log(`  ✓ ${binaryFile}`);
}

/**
 * Create VERSION file
 */
function createVersionFile(version) {
  console.log('📝 Creating VERSION file...');
  
  const versionFile = path.join(VENDOR_LBUG_DIR, 'VERSION');
  fs.writeFileSync(versionFile, version, 'utf-8');
  console.log(`  ✓ VERSION: ${version}`);
}

/**
 * Create minimal package.json for bundled lbug
 */
function createPackageJson(version) {
  console.log('📝 Creating package.json...');
  
  const packageJsonPath = path.join(VENDOR_LBUG_DIR, 'package.json');
  const packageJson = {
    name: 'lbug',
    version: version,
    main: './index.js',
    module: './index.mjs',
    types: './lbug.d.ts',
    type: 'commonjs',
    exports: {
      '.': {
        require: './index.js',
        import: './index.mjs',
        types: './lbug.d.ts'
      }
    }
  };
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
  console.log(`  ✓ package.json created`);
}

/**
 * Patch lbug_native.js to load binary from correct location
 */
function patchLbugNative() {
  console.log('🔧 Patching lbug_native.js for correct binary path...');
  
  const lbugNativePath = path.join(VENDOR_LBUG_DIR, 'lbug_native.js');
  
  if (!fs.existsSync(lbugNativePath)) {
    throw new Error(`lbug_native.js not found: ${lbugNativePath}`);
  }
  
  let content = fs.readFileSync(lbugNativePath, 'utf-8');
  
  // Find the path where it loads the binary
  // Typically looks like: require('./prebuilt/lbugjs-...')
  // We need to change it to use __dirname to find the correct path
  
  // Check if already patched
  if (content.includes('__dirname') && content.includes('vendor/lbug')) {
    console.log('  ✓ Already patched');
    return;
  }
  
  // Pattern 1: require('./prebuilt/lbugjs-...')
  // Pattern 2: require.resolve('./prebuilt/lbugjs-...')
  // We need to make it relative to the bundled location
  
  // Replace patterns like:
  // require('./prebuilt/lbugjs-...')
  // with:
  // require(path.join(__dirname, 'prebuilt', 'lbugjs-...'))
  
  // For now, we'll use a simpler approach: replace './prebuilt/' with path.join(__dirname, 'prebuilt')
  // But we need to be careful about the exact pattern
  
  // Actually, let's check what the current content looks like
  // The binary loading might already work if the paths are relative
  
  // For ESM compatibility, we might need to use import.meta.url
  // But since lbug_native.js is CommonJS, we can use __dirname
  
  // Let's add a require for path at the top if needed
  if (!content.includes("require('path')") && !content.includes('require("path")')) {
    // Add path require at the top (after any existing requires)
    const pathRequire = "const path = require('path');\n";
    // Find a good place to insert (after 'use strict' or at the beginning)
    if (content.includes("'use strict'")) {
      content = content.replace("'use strict'", "'use strict'\n" + pathRequire);
    } else {
      content = pathRequire + content;
    }
  }
  
  // Replace './prebuilt/' patterns with path.join(__dirname, 'prebuilt', ...)
  // This is a bit tricky - we need to match the require/require.resolve pattern
  // Let's do a more targeted replacement
  
  // Pattern: require('./prebuilt/lbugjs-...')
  content = content.replace(
    /require\(['"]\.\/prebuilt\/([^'"]+)['"]\)/g,
    "require(path.join(__dirname, 'prebuilt', '$1'))"
  );
  
  // Pattern: require.resolve('./prebuilt/lbugjs-...')
  content = content.replace(
    /require\.resolve\(['"]\.\/prebuilt\/([^'"]+)['"]\)/g,
    "require.resolve(path.join(__dirname, 'prebuilt', '$1'))"
  );
  
  fs.writeFileSync(lbugNativePath, content, 'utf-8');
  console.log('  ✓ lbug_native.js patched');
}

/**
 * Main bundling function
 */
async function bundleLbug() {
  console.log('📦 Bundling lbug into Akasha distribution...\n');
  
  try {
    // Ensure dist/vendor/lbug exists
    if (!fs.existsSync(VENDOR_LBUG_DIR)) {
      fs.mkdirSync(VENDOR_LBUG_DIR, { recursive: true });
    }
    
    // Get version
    const version = getLbugVersion();
    console.log(`📌 Bundling lbug version: ${version}\n`);
    
    // Ensure lbug is installed
    ensureLbugInstalled();
    console.log('');
    
    // Copy files
    copyJSFiles();
    console.log('');
    
    copyTypeDefinitions();
    console.log('');
    
    copyPlatformBinaries();
    console.log('');
    
    copyInstalledBinary();
    console.log('');
    
    // Create metadata files
    createVersionFile(version);
    console.log('');
    
    createPackageJson(version);
    console.log('');
    
    // Patch native loader
    patchLbugNative();
    console.log('');
    
    console.log('✅ lbug bundled successfully!');
    console.log(`   Location: ${VENDOR_LBUG_DIR}`);
    console.log(`   Version: ${version}`);
  } catch (error) {
    console.error('❌ Error bundling lbug:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  bundleLbug();
}

module.exports = { bundleLbug };

