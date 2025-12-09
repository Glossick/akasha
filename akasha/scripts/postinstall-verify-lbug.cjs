#!/usr/bin/env node

/**
 * Postinstall script to verify lbug is properly installed
 * 
 * This script runs after Akasha is installed to ensure lbug
 * (a dependency) is properly set up. If lbug's install script
 * didn't run (e.g., due to package manager issues), this script
 * will attempt to fix it.
 * 
 * This is a safety net - with trustedDependencies, lbug's install
 * script should run automatically, but this verifies and fixes if needed.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Find lbug package directory
 * 
 * When Akasha is installed as a dependency, lbug will be in the parent
 * project's node_modules, not in Akasha's node_modules.
 */
function findLbugPackage() {
  // Try multiple locations:
  // 1. Parent project's node_modules (when Akasha is installed as dependency)
  // 2. Current working directory's node_modules (when running from project root)
  // 3. Akasha's own node_modules (when running in development)
  const possiblePaths = [
    // Parent project's node_modules (most common case)
    path.join(process.cwd(), 'node_modules', 'lbug'),
    // Akasha's node_modules (development)
    path.join(__dirname, '..', 'node_modules', 'lbug'),
    // Try require.resolve as fallback
  ];
  
  // First, try require.resolve (works if lbug is in module resolution path)
  try {
    const lbugPath = require.resolve('lbug/package.json');
    const resolvedPath = path.dirname(lbugPath);
    if (fs.existsSync(path.join(resolvedPath, 'package.json'))) {
      return resolvedPath;
    }
  } catch (error) {
    // require.resolve failed, continue with path checking
  }
  
  // Check each possible path
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(path.join(possiblePath, 'package.json'))) {
      return possiblePath;
    }
  }
  
  return null;
}

/**
 * Check if lbug is properly installed
 */
function isLbugInstalled(lbugDir) {
  if (!lbugDir) return false;
  
  const requiredFiles = [
    'index.js',      // CommonJS entry
    'index.mjs',     // ESM entry
    'lbugjs.node'    // Native binary
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(lbugDir, file);
    if (!fs.existsSync(filePath)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Attempt to fix lbug installation by running its install script
 */
function fixLbugInstallation(lbugDir) {
  console.log('🔧 Attempting to fix lbug installation...');
  
  const installScript = path.join(lbugDir, 'install.js');
  if (!fs.existsSync(installScript)) {
    console.error('❌ lbug install.js not found');
    return false;
  }
  
  try {
    execSync('node install.js', {
      cwd: lbugDir,
      stdio: 'inherit',
      env: process.env
    });
    console.log('✅ lbug installation fixed!');
    return true;
  } catch (error) {
    console.error('❌ Failed to run lbug install script:', error.message);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  // Skip if explicitly disabled
  if (process.env.AKASHA_SKIP_LBUG_VERIFY === 'true') {
    return;
  }
  
  const lbugDir = findLbugPackage();
  
  if (!lbugDir) {
    // lbug not found - might not be installed, or we're in a different context
    // This is okay - user might not be using LadybugDB
    return;
  }
  
  if (isLbugInstalled(lbugDir)) {
    // Everything is good - no action needed
    if (process.env.AKASHA_VERBOSE === 'true') {
      console.log('✅ lbug is properly installed');
    }
    return;
  }
  
  // lbug is not properly installed
  console.warn('⚠️  lbug installation appears incomplete');
  console.warn('   This may cause issues when using LadybugDB provider');
  
  // Attempt to fix
  if (fixLbugInstallation(lbugDir)) {
    // Verify fix worked
    if (isLbugInstalled(lbugDir)) {
      console.log('✅ lbug installation verified');
    } else {
      console.error('❌ lbug installation fix did not complete successfully');
      console.error('   Please run manually: cd node_modules/lbug && node install.js');
    }
  } else {
    console.error('❌ Could not automatically fix lbug installation');
    console.error('   Please run manually: cd node_modules/lbug && node install.js');
  }
}

if (require.main === module) {
  main();
}

module.exports = { findLbugPackage, isLbugInstalled, fixLbugInstallation };

