/**
 * LadybugDB Example with Akasha
 * 
 * This example demonstrates how to use Akasha with LadybugDB
 * (an embedded graph database) instead of Neo4j.
 * 
 * Prerequisites:
 * 1. Install lbug: npm install lbug (or bun add lbug)
 * 2. Set environment variables:
 *    - OPENAI_API_KEY (for embeddings)
 *    - DEEPSEEK_API_KEY (for LLM)
 * 
 * Run with:
 *   bun run examples/ladybug-example.ts
 */

import { akasha } from '../src/factory';
import type { AkashaConfig } from '../src/types';
import * as path from 'path';
import * as fs from 'fs';

// Ensure we have required environment variables
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error('DEEPSEEK_API_KEY environment variable is required');
}

// Create a directory for the LadybugDB database
const ladybugDbPath = path.join(process.cwd(), 'ladybug-db-example');

// Clean up any existing database files
if (fs.existsSync(ladybugDbPath)) {
  console.log(`🧹 Cleaning up existing database at: ${ladybugDbPath}`);
  fs.rmSync(ladybugDbPath, { recursive: true, force: true });
}

// Also clean up any WAL files
const walFile = `${ladybugDbPath}.wal`;
if (fs.existsSync(walFile)) {
  fs.rmSync(walFile, { force: true });
}

console.log(`📁 Using LadybugDB database at: ${ladybugDbPath}\n`);

// Configure Akasha with LadybugDB
const config: AkashaConfig = {
  database: {
    type: 'ladybug',
    config: {
      databasePath: ladybugDbPath,
    },
  },
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'text-embedding-3-small',
      },
    },
    llm: {
      type: 'deepseek',
      config: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-chat',
      },
    },
  },
  scope: {
    id: 'example-scope',
    type: 'example',
    name: 'LadybugDB Example Scope',
  },
};

async function main() {
  console.log('🚀 Starting LadybugDB example with Akasha...\n');

  try {
    // Create Akasha instance
    const kg = akasha(config);

    // Initialize (this will connect to LadybugDB and set up schema)
    console.log('📊 Initializing Akasha with LadybugDB...');
    await kg.initialize();
    console.log('✅ Akasha initialized successfully!\n');

    // Health check
    console.log('🏥 Health check:');
    const health = await kg.healthCheck();
    console.log(`  Database: ${health.database.connected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`  OpenAI: ${health.openai.available ? '✅ Available' : '❌ Unavailable'}`);
    console.log(`  Overall: ${health.status}\n`);

    // Learn some knowledge
    console.log('📚 Learning knowledge from text...');
    const learnResult = await kg.learn(
      'Alice works at Acme Corp as a software engineer. Bob is the CEO of Acme Corp. Alice reports to Bob. Charlie is a designer at TechCorp. Alice and Charlie are friends.'
    );
    console.log(`✅ Learned ${learnResult.entities.length} entities and ${learnResult.relationships.length} relationships\n`);
    
    console.log('Entities created:');
    learnResult.entities.forEach((entity, idx) => {
      console.log(`  ${idx + 1}. ${entity.label}: ${entity.properties.name || entity.id}`);
    });
    console.log('\nRelationships created:');
    learnResult.relationships.forEach((rel, idx) => {
      console.log(`  ${idx + 1}. ${rel.type}: ${rel.from} → ${rel.to}`);
    });

    // Query the knowledge graph
    console.log('\n\n🔍 Querying the knowledge graph...');
    const query1 = 'Who does Alice work for?';
    console.log(`Query: "${query1}"`);
    const queryResult1 = await kg.ask(query1);
    console.log('📝 Answer:', queryResult1.answer);
    if (queryResult1.context) {
      console.log(`\n📊 Found ${queryResult1.context.entities.length} entities and ${queryResult1.context.relationships.length} relationships`);
    }

    // Another query
    console.log('\n\n🔍 Another query...');
    const query2 = 'What is Alice\'s role at Acme Corp?';
    console.log(`Query: "${query2}"`);
    const queryResult2 = await kg.ask(query2);
    console.log('📝 Answer:', queryResult2.answer);

    // List entities
    console.log('\n\n📋 Listing all entities:');
    const entities = await kg.listEntities();
    console.log(`Found ${entities.length} entities:`);
    entities.forEach((entity, idx) => {
      const name = entity.properties.name || entity.id;
      const scopeId = entity.properties.scopeId || 'N/A';
      console.log(`  ${idx + 1}. ${entity.label}: ${name} (scope: ${scopeId})`);
    });

    // List relationships
    console.log('\n\n📋 Listing all relationships:');
    const relationships = await kg.listRelationships();
    console.log(`Found ${relationships.length} relationships:`);
    relationships.forEach((rel, idx) => {
      console.log(`  ${idx + 1}. ${rel.type}: ${rel.from} → ${rel.to}`);
    });

    // Demonstrate scope filtering
    console.log('\n\n🔒 Demonstrating scope filtering...');
    console.log('All entities are in scope:', config.scope?.id);
    const scopedEntities = await kg.listEntities({ limit: 100 });
    console.log(`Found ${scopedEntities.length} entities in scope "${config.scope?.id}"`);

    // Cleanup
    console.log('\n\n🧹 Cleaning up...');
    await kg.cleanup();
    console.log('✅ Cleanup complete!');

    console.log('\n✨ Example completed successfully!');
    console.log(`\n💡 Note: Database files are stored at: ${ladybugDbPath}`);
    console.log('   You can delete this directory to start fresh.');
  } catch (error) {
    console.error('❌ Error:', error);
    
    if (error instanceof Error) {
      console.error('\nError details:', error.message);
      if (error.stack) {
        console.error('\nStack trace:', error.stack);
      }
    }
    
    process.exit(1);
  }
}

// Run the example
main();

