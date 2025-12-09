import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for bundled lbug verification
 * 
 * These tests verify that lbug is properly bundled into dist/vendor/lbug/
 * after the build process runs.
 */

const DIST_DIR = path.join(__dirname, '../../..', 'dist');
const VENDOR_LBUG_DIR = path.join(DIST_DIR, 'vendor', 'lbug');

describe('Bundled lbug Verification', () => {
  it('should have vendor/lbug directory after build', () => {
    // Check that the bundled lbug directory exists
    expect(fs.existsSync(VENDOR_LBUG_DIR)).toBe(true);
  });

  it('should have all required JavaScript files', () => {
    const requiredFiles = [
      'index.js',
      'index.mjs',
      'connection.js',
      'database.js',
      'prepared_statement.js',
      'query_result.js',
      'lbug_native.js',
    ];

    const missingFiles: string[] = [];

    for (const file of requiredFiles) {
      const filePath = path.join(VENDOR_LBUG_DIR, file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      throw new Error(
        `Missing required JavaScript files in bundled lbug: ${missingFiles.join(', ')}\n` +
        `Expected location: ${VENDOR_LBUG_DIR}\n` +
        `Run: bun run build`
      );
    }

    expect(missingFiles.length).toBe(0);
  });

  it('should have type definitions', () => {
    const typeDefFile = path.join(VENDOR_LBUG_DIR, 'lbug.d.ts');
    expect(fs.existsSync(typeDefFile)).toBe(true);
  });

  it('should have VERSION file with correct format', () => {
    const versionFile = path.join(VENDOR_LBUG_DIR, 'VERSION');
    expect(fs.existsSync(versionFile)).toBe(true);

    const versionContent = fs.readFileSync(versionFile, 'utf-8').trim();
    // Version should be in format like "0.12.2"
    expect(versionContent).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should have VERSION file matching package.json devDependencies', () => {
    const versionFile = path.join(VENDOR_LBUG_DIR, 'VERSION');
    const packageJsonPath = path.join(__dirname, '../../..', 'package.json');
    
    const versionContent = fs.readFileSync(versionFile, 'utf-8').trim();
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    // Get lbug version from devDependencies
    const lbugVersion = packageJson.devDependencies?.lbug;
    
    if (!lbugVersion) {
      throw new Error(
        'lbug not found in devDependencies. It should be there for bundling.'
      );
    }

    // Remove any version prefix (^, ~, etc.)
    const cleanVersion = lbugVersion.replace(/^[\^~]/, '');
    
    expect(versionContent).toBe(cleanVersion);
  });

  it('should have platform-specific binaries in prebuilt directory', () => {
    const prebuiltDir = path.join(VENDOR_LBUG_DIR, 'prebuilt');
    expect(fs.existsSync(prebuiltDir)).toBe(true);

    const expectedBinaries = [
      'lbugjs-win32-x64.node',
      'lbugjs-darwin-arm64.node',
      'lbugjs-darwin-x64.node',
      'lbugjs-linux-x64.node',
      'lbugjs-linux-arm64.node',
    ];

    const existingBinaries = fs.readdirSync(prebuiltDir);
    const foundBinaries = expectedBinaries.filter(binary => 
      existingBinaries.includes(binary)
    );

    // At least some platform binaries should be present
    expect(foundBinaries.length).toBeGreaterThan(0);
  });

  it('should have installed binary for current platform', () => {
    const binaryFile = path.join(VENDOR_LBUG_DIR, 'lbugjs.node');
    
    // The installed binary should exist (copied from prebuilt for current platform)
    expect(fs.existsSync(binaryFile)).toBe(true);
  });

  it('should have minimal package.json in bundled location', () => {
    const packageJsonPath = path.join(VENDOR_LBUG_DIR, 'package.json');
    expect(fs.existsSync(packageJsonPath)).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    // Should have name and version at minimum
    expect(packageJson.name).toBe('lbug');
    expect(packageJson.version).toBeDefined();
    expect(typeof packageJson.version).toBe('string');
  });

  it('should have package.json version matching VERSION file', () => {
    const versionFile = path.join(VENDOR_LBUG_DIR, 'VERSION');
    const packageJsonPath = path.join(VENDOR_LBUG_DIR, 'package.json');
    
    const versionContent = fs.readFileSync(versionFile, 'utf-8').trim();
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    expect(packageJson.version).toBe(versionContent);
  });

  it('should have main and module exports in package.json', () => {
    const packageJsonPath = path.join(VENDOR_LBUG_DIR, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    expect(packageJson.main).toBeDefined();
    expect(packageJson.module).toBeDefined();
    
    // Verify the files exist
    const mainFile = path.join(VENDOR_LBUG_DIR, packageJson.main);
    const moduleFile = path.join(VENDOR_LBUG_DIR, packageJson.module);
    
    expect(fs.existsSync(mainFile)).toBe(true);
    expect(fs.existsSync(moduleFile)).toBe(true);
  });

  it.skip('should be able to import bundled lbug (file existence check)', async () => {
    // This test verifies the import path exists and is correct
    // We skip the actual import due to Bun native module issues in test environment
    
    const bundledIndexPath = path.join(VENDOR_LBUG_DIR, 'index.mjs');
    expect(fs.existsSync(bundledIndexPath)).toBe(true);
    
    // Verify the file is not empty
    const content = fs.readFileSync(bundledIndexPath, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });
});

