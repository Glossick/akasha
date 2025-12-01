/**
 * Kuzu DB Example with Akasha
 * 
 * This example demonstrates how to use Akasha with Kuzu database
 * instead of Neo4j.
 * 
 * Prerequisites:
 * 1. Install Kuzu: npm install kuzu (or bun add kuzu)
 * 2. Set environment variables:
 *    - OPENAI_API_KEY (for embeddings)
 *    - DEEPSEEK_API_KEY (for LLM)
 * 
 * Note: KuzuProvider is currently a stub implementation.
 * You'll need to implement the actual Kuzu database operations
 * in kuzu-provider.ts before this example will work.
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

// Create a directory for the Kuzu database
const kuzuDbPath = path.join(process.cwd(), 'kuzu-db-example');

// Ensure the directory exists
if (!fs.existsSync(kuzuDbPath)) {
  fs.mkdirSync(kuzuDbPath, { recursive: true });
  console.log(`📁 Created Kuzu database directory: ${kuzuDbPath}`);
}

// Configure Akasha with Kuzu database
const config: AkashaConfig = {
  database: {
    type: 'kuzu',
    config: {
      databasePath: kuzuDbPath,
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
    name: 'Kuzu Example Scope',
  },
};

async function main() {
  console.log('🚀 Starting Kuzu DB example with Akasha...\n');

  try {
    // Create Akasha instance
    const kg = akasha(config);

    // Initialize (this will connect to Kuzu and set up indexes)
    console.log('📊 Initializing Akasha with Kuzu database...');
    await kg.initialize();
    console.log('✅ Akasha initialized successfully!\n');

    // Learn some knowledge
    console.log('📚 Learning knowledge from text...');
    const learnResult = await kg.learn(
      'Alice works at Acme Corp as a software engineer. Bob is the CEO of Acme Corp. Alice reports to Bob.'
    );
    console.log(`✅ Learned ${learnResult.entities.length} entities and ${learnResult.relationships.length} relationships\n`);

    // Query the knowledge graph
    console.log('🔍 Querying the knowledge graph...');
    const queryResult = await kg.ask('Who does Alice work for?');
    console.log('📝 Answer:', queryResult.answer);
    console.log(`\n📊 Found ${queryResult.entities.length} entities and ${queryResult.relationships.length} relationships`);

    // List entities
    console.log('\n📋 Listing all entities:');
    const entities = await kg.listEntities();
    entities.forEach((entity) => {
      console.log(`  - ${entity.label}: ${JSON.stringify(entity.properties)}`);
    });

    // Health check
    console.log('\n🏥 Health check:');
    const health = await kg.healthCheck();
    console.log(`  Database: ${health.database.connected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`  OpenAI: ${health.openai.available ? '✅ Available' : '❌ Unavailable'}`);
    console.log(`  Overall: ${health.status}`);

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await kg.cleanup();
    console.log('✅ Cleanup complete!');

    console.log('\n✨ Example completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    
    if (error instanceof Error && error.message.includes('not yet implemented')) {
      console.error('\n💡 Note: KuzuProvider methods need to be implemented.');
      console.error('   See src/services/providers/database/kuzu-provider.ts');
      console.error('   Install Kuzu: npm install kuzu (or bun add kuzu)');
    }
    
    process.exit(1);
  }
}

// Run the example
main();

