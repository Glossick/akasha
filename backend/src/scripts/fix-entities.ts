#!/usr/bin/env bun
/**
 * Utility script to fix existing entities in Neo4j
 * 
 * This script:
 * 1. Adds the 'Entity' label to all nodes with embeddings that don't already have it
 * 2. Ensures the vector index exists and is properly configured
 * 
 * Usage:
 *   bun run backend/src/scripts/fix-entities.ts
 */

import { Neo4jService } from '../services/neo4j.service';

async function main() {
  console.log('🔧 Starting entity fix utility...\n');

  const neo4j = new Neo4jService();
  
  try {
    await neo4j.connect();
    console.log('✅ Connected to Neo4j\n');

    // Step 1: Add Entity label to existing nodes with embeddings
    console.log('Step 1: Adding Entity label to existing nodes with embeddings...');
    const updateResult = await neo4j.executeQuery<{ updated: number }>(`
      MATCH (n)
      WHERE n.embedding IS NOT NULL AND NOT n:Entity
      SET n:Entity
      RETURN count(n) as updated
    `);
    
    const updatedCount = updateResult[0]?.updated || 0;
    
    if (updatedCount > 0) {
      console.log(`✅ Added 'Entity' label to ${updatedCount} existing entities\n`);
    } else {
      console.log('ℹ️  All entities with embeddings already have the Entity label\n');
    }

    // Step 2: Ensure vector index exists
    console.log('Step 2: Ensuring vector index exists...');
    await neo4j.ensureVectorIndex();
    console.log('✅ Vector index verification complete\n');

    // Step 3: Verify entities are searchable
    console.log('Step 3: Verifying entities are searchable...');
    const verifyResult = await neo4j.executeQuery<{ count: number }>(`
      MATCH (n:Entity)
      WHERE n.embedding IS NOT NULL
      RETURN count(n) as count
    `);
    
    const entityCount = verifyResult[0]?.count || 0;
    console.log(`✅ Found ${entityCount} entities with embeddings ready for vector search\n`);

    console.log('✅ Entity fix utility completed successfully!');
    console.log('\nYou can now query entities using vector similarity search.');
    
  } catch (error) {
    console.error('❌ Error fixing entities:', error);
    process.exit(1);
  } finally {
    await neo4j.disconnect();
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

