#!/usr/bin/env node

/**
 * Post-build script to add .js extensions to ESM imports for Node.js compatibility
 * This allows us to keep source code clean (works with Bun/tsx) while ensuring
 * the built package works in Node.js ESM
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = join(__dirname, '..', 'dist');

/**
 * Recursively find all .js files in dist directory
 */
async function findJSFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findJSFiles(fullPath));
    } else if (entry.isFile() && extname(entry.name) === '.js') {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Fix import/export statements to include .js extensions
 */
function fixImports(content, filePath) {
  // Match relative imports/exports (./file or ../file)
  // Pattern: from "..." or export ... from "..."
  // We need to match the path part and add .js if it doesn't have an extension
  
  let fixed = content;
  const replacements = [];
  
  // Fix: import ... from "./path" or import ... from '../path'
  // Match: from "..." or from '...'
  fixed = fixed.replace(/from\s+(['"])(\.\.?\/[^'"]+?)(\1)/g, (match, quote, path) => {
    // Skip if already has an extension (.js, .json, .mjs, etc.)
    if (/\.(js|json|mjs|cjs|ts|tsx)$/.test(path)) {
      return match;
    }
    // Skip if it's a directory (ends with /)
    if (path.endsWith('/')) {
      return match;
    }
    const replacement = `from ${quote}${path}.js${quote}`;
    replacements.push(`${match} -> ${replacement}`);
    return replacement;
  });
  
  // Fix: export ... from "./path" or export ... from '../path'
  fixed = fixed.replace(/export\s+.*?\s+from\s+(['"])(\.\.?\/[^'"]+?)(\1)/g, (match, quote, path) => {
    if (/\.(js|json|mjs|cjs|ts|tsx)$/.test(path)) {
      return match;
    }
    if (path.endsWith('/')) {
      return match;
    }
    const replacement = match.replace(path, `${path}.js`);
    replacements.push(`${match} -> ${replacement}`);
    return replacement;
  });
  
  if (replacements.length > 0) {
    console.log(`  Fixed ${replacements.length} import(s) in ${filePath.replace(DIST_DIR, '')}`);
  }
  
  return fixed;
}

async function main() {
  console.log('🔧 Fixing ESM imports for Node.js compatibility...\n');
  
  try {
    const jsFiles = await findJSFiles(DIST_DIR);
    console.log(`Found ${jsFiles.length} .js file(s) to process\n`);
    
    let totalFixed = 0;
    
    for (const filePath of jsFiles) {
      const content = await readFile(filePath, 'utf-8');
      const fixed = fixImports(content, filePath);
      
      if (content !== fixed) {
        await writeFile(filePath, fixed, 'utf-8');
        totalFixed++;
      }
    }
    
    console.log(`\n✅ Fixed imports in ${totalFixed} file(s)`);
  } catch (error) {
    console.error('❌ Error fixing imports:', error);
    process.exit(1);
  }
}

main();

