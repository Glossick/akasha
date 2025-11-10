#!/usr/bin/env bun

/**
 * Reload Knowledge Base Script
 * 
 * Cleans up existing EstiMate data and reloads with correct multi-dimensional contexts.
 * 
 * Required environment variables:
 * - NEO4J_URI
 * - NEO4J_USER
 * - NEO4J_PASSWORD
 * - OPENAI_API_KEY
 * - DEEPSEEK_API_KEY
 * 
 * Usage:
 *   bun run scripts/reload-knowledge.ts
 */

import neo4j from 'neo4j-driver';
import { $ } from 'bun';

// Check environment variables
const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  process.exit(1);
}

async function reloadKnowledgeBase() {
  console.log('🔄 Reload EstiMate Knowledge Base\n');
  console.log('This will:');
  console.log('  1. Delete all existing EstiMate data');
  console.log('  2. Reload all documents with correct multi-dimensional contexts\n');

  const driver = neo4j.driver(
    process.env.NEO4J_URI!,
    neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
  );

  try {
    const session = driver.session();

    console.log('🗑️  Step 1: Cleaning up existing data...');

    // Delete relationships first
    await session.run(`
      MATCH ()-[r]->()
      WHERE r.scopeId = 'estimate-company'
      DELETE r
    `);

    // Delete nodes
    const result = await session.run(`
      MATCH (n)
      WHERE n.scopeId = 'estimate-company'
      WITH count(n) as nodeCount
      MATCH (n)
      WHERE n.scopeId = 'estimate-company'
      DELETE n
      RETURN nodeCount
    `);

    const deletedNodes = result.records[0]?.get('nodeCount').toNumber() || 0;
    console.log(`   ✅ Deleted ${deletedNodes} nodes and their relationships\n`);

    await session.close();
    await driver.close();

    console.log('📥 Step 2: Loading knowledge base with correct contexts...\n');

    // Run the load script
    await $`bun run ${__dirname}/load-knowledge.ts`;

    console.log('\n✨ Reload complete!');

  } catch (error) {
    console.error('❌ Error during reload:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    await driver.close();
    process.exit(1);
  }
}

reloadKnowledgeBase();

