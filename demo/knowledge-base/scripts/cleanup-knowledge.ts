#!/usr/bin/env bun

/**
 * Cleanup Knowledge Base Script
 * 
 * Removes all EstiMate knowledge base data from Neo4j.
 * 
 * Required environment variables:
 * - NEO4J_URI
 * - NEO4J_USER
 * - NEO4J_PASSWORD
 * 
 * Usage:
 *   bun run scripts/cleanup-knowledge.ts
 */

import neo4j from 'neo4j-driver';

// Check environment variables
const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  process.exit(1);
}

async function cleanupKnowledgeBase() {
  console.log('🧹 Cleaning up EstiMate Knowledge Base\n');

  const driver = neo4j.driver(
    process.env.NEO4J_URI!,
    neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
  );

  try {
    const session = driver.session();

    console.log('🔍 Checking for EstiMate scope data...');

    // Count nodes and relationships
    const countResult = await session.run(`
      MATCH (n)
      WHERE n.scopeId = 'estimate-company'
      WITH count(n) as nodeCount
      MATCH ()-[r]->()
      WHERE r.scopeId = 'estimate-company'
      RETURN nodeCount, count(r) as relCount
    `);

    const record = countResult.records[0];
    const nodeCount = record?.get('nodeCount').toNumber() || 0;
    const relCount = record?.get('relCount').toNumber() || 0;

    if (nodeCount === 0 && relCount === 0) {
      console.log('✅ No EstiMate data found. Nothing to clean up.');
      await session.close();
      await driver.close();
      return;
    }

    console.log(`   Found ${nodeCount} nodes and ${relCount} relationships\n`);

    // Confirm deletion
    console.log('⚠️  WARNING: This will permanently delete all EstiMate knowledge base data.');
    console.log('   This includes:');
    console.log('   - All documents');
    console.log('   - All entities');
    console.log('   - All relationships');
    console.log('   - Context tracking data\n');

    console.log('❓ Are you sure you want to continue? (yes/no)');
    
    // Read user input
    const decoder = new TextDecoder();
    for await (const chunk of Bun.stdin.stream()) {
      const input = decoder.decode(chunk).trim().toLowerCase();
      
      if (input === 'yes' || input === 'y') {
        console.log('\n🗑️  Deleting data...');

        // Delete all relationships first
        await session.run(`
          MATCH ()-[r]->()
          WHERE r.scopeId = 'estimate-company'
          DELETE r
        `);

        // Delete all nodes
        await session.run(`
          MATCH (n)
          WHERE n.scopeId = 'estimate-company'
          DELETE n
        `);

        console.log('✅ Successfully deleted all EstiMate data\n');
        break;
      } else if (input === 'no' || input === 'n') {
        console.log('\n❌ Cleanup cancelled. No data was deleted.');
        break;
      } else {
        console.log('Please enter "yes" or "no"');
      }
    }

    await session.close();
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
  } finally {
    await driver.close();
    console.log('🧹 Closed database connection');
  }
}

cleanupKnowledgeBase();

