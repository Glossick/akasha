#!/usr/bin/env bun

/**
 * Cleanup script for test data
 * 
 * This script removes test data created by integration tests and demos.
 * 
 * Required environment variables:
 * - NEO4J_URI
 * - NEO4J_USER
 * - NEO4J_PASSWORD
 * 
 * Usage:
 *   bun run scripts/cleanup-test-data.ts
 */

import neo4j from 'neo4j-driver';

const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  process.exit(1);
}

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...\n');

  const driver = neo4j.driver(
    process.env.NEO4J_URI!,
    neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
  );

  try {
    await driver.verifyConnectivity();
    console.log('✅ Connected to Neo4j\n');

    const session = driver.session();

    try {
      // Delete all nodes (entities and documents) with test scopeIds
      console.log('Deleting test nodes (entities and documents)...');
      const deleteNodesResult = await session.run(`
        MATCH (n)
        WHERE n.scopeId STARTS WITH 'test-' 
           OR n.scopeId STARTS WITH 'integration-test-'
           OR n.scopeId STARTS WITH 'tenant-1-'
           OR n.scopeId STARTS WITH 'tenant-2-'
           OR n.scopeId STARTS WITH 'doc-test-'
           OR n.scopeId STARTS WITH 'template-test-'
           OR n.scopeId STARTS WITH 'embedding-test-'
           OR n.scopeId STARTS WITH 'query-'
           OR n.scopeId = 'demo-tenant-1'
           OR n.scopeId = 'demo-tenant-2'
           OR n.scopeId = 'demo-custom-ontology'
        DETACH DELETE n
        RETURN count(n) as deleted
      `);

      const deletedNodes = deleteNodesResult.records[0]?.get('deleted') || 0;
      console.log(`   ✅ Deleted ${deletedNodes} test nodes (entities and documents)\n`);

      // Delete relationships with test scopeIds (including CONTAINS_ENTITY)
      console.log('Deleting test relationships...');
      const deleteRelsResult = await session.run(`
        MATCH ()-[r]->()
        WHERE r.scopeId STARTS WITH 'test-'
           OR r.scopeId STARTS WITH 'integration-test-'
           OR r.scopeId STARTS WITH 'tenant-1-'
           OR r.scopeId STARTS WITH 'tenant-2-'
           OR r.scopeId STARTS WITH 'doc-test-'
           OR r.scopeId STARTS WITH 'template-test-'
           OR r.scopeId STARTS WITH 'embedding-test-'
           OR r.scopeId STARTS WITH 'query-'
           OR r.scopeId = 'demo-tenant-1'
           OR r.scopeId = 'demo-tenant-2'
           OR r.scopeId = 'demo-custom-ontology'
        DELETE r
        RETURN count(r) as deleted
      `);

      const deletedRels = deleteRelsResult.records[0]?.get('deleted') || 0;
      console.log(`   ✅ Deleted ${deletedRels} test relationships\n`);

      console.log('✨ Cleanup complete!');

    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
    process.exit(1);
  } finally {
    await driver.close();
  }
}

cleanupTestData();

