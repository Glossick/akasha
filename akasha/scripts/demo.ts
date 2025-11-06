#!/usr/bin/env bun

/**
 * Demo script for Akasha library
 * 
 * This script demonstrates basic usage of the Akasha library.
 * 
 * Required environment variables:
 * - NEO4J_URI
 * - NEO4J_USER
 * - NEO4J_PASSWORD
 * - OPENAI_API_KEY
 * 
 * Usage:
 *   bun run scripts/demo.ts
 */

import { akasha } from '../src/factory';
import type { Scope } from '../src/types';

// Check environment variables
const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'OPENAI_API_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  process.exit(1);
}

async function demo() {
  console.log('🚀 Akasha Library Demo\n');

  // Create a scope (like a tenant or workspace)
  const scope: Scope = {
    id: 'demo-tenant-1',
    type: 'tenant',
    name: 'Demo Tenant',
  };

  // Initialize Akasha
  console.log('📦 Initializing Akasha...');
  const kg = akasha({
    neo4j: {
      uri: process.env.NEO4J_URI!,
      user: process.env.NEO4J_USER!,
      password: process.env.NEO4J_PASSWORD!,
    },
    scope,
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
    },
  });

  await kg.initialize();
  console.log('✅ Akasha initialized\n');

  try {
    // Example 1: Learn from text
    console.log('📚 Example 1: Learning from text...');
    const text1 = `
      Alice is a software engineer at Acme Corp. 
      Bob is a designer at TechCorp. 
      Alice and Bob met in college and are good friends.
      Acme Corp is a technology company founded in 2010.
      TechCorp is a design agency founded in 2015.
    `;

    const learnResult = await kg.learn(text1, {
      contextName: 'Company Network',
    });

    console.log(`✅ Learned ${learnResult.created.entities} entities and ${learnResult.created.relationships} relationships`);
    console.log(`   Context: ${learnResult.context.name} (${learnResult.context.id})`);
    console.log(`   Document: ${learnResult.document ? 'Created' : 'Not created'} (ID: ${learnResult.document?.id || 'N/A'})`);
    console.log(`   Document created: ${learnResult.created.document === 1 ? 'New document' : 'Reused existing'}\n`);

    // Example 2: Query the knowledge graph (default strategy: 'both')
    console.log('❓ Example 2: Querying the knowledge graph (default: both documents and entities)...');
    const query1 = 'What is the relationship between Alice and Bob?';
    const result1 = await kg.ask(query1);

    console.log(`Question: ${query1}`);
    console.log(`Answer: ${result1.answer}`);
    console.log(`   Found ${result1.context.entities.length} entities, ${result1.context.relationships.length} relationships`);
    if (result1.context.documents) {
      console.log(`   Found ${result1.context.documents.length} documents\n`);
    } else {
      console.log();
    }

    // Example 3: Query with different strategies
    console.log('❓ Example 3: Query strategies (documents vs entities)...');
    
    // Query with documents strategy
    const query2a = 'What companies are mentioned?';
    const result2a = await kg.ask(query2a, {
      strategy: 'documents',
    });
    console.log(`Question (documents strategy): ${query2a}`);
    console.log(`   Found ${result2a.context.documents?.length || 0} documents`);
    console.log(`Answer: ${result2a.answer.substring(0, 150)}...\n`);

    // Query with entities strategy
    const result2b = await kg.ask(query2a, {
      strategy: 'entities',
    });
    console.log(`Question (entities strategy): ${query2a}`);
    console.log(`   Found ${result2b.context.entities.length} entities`);
    console.log(`Answer: ${result2b.answer.substring(0, 150)}...\n`);

    // Example 4: Document deduplication
    console.log('📚 Example 4: Document deduplication...');
    const text2 = 'Charlie is a product manager at Acme Corp. Charlie reports to Alice.';
    const learnResult2 = await kg.learn(text2, {
      contextName: 'Organizational Structure',
    });
    console.log(`   Document created: ${learnResult2.created.document === 1 ? 'New' : 'Reused'}`);
    
    // Try learning the same text again
    const learnResult2b = await kg.learn(text2, {
      contextName: 'Organizational Structure (duplicate)',
    });
    console.log(`   Same text again - Document created: ${learnResult2b.created.document === 1 ? 'New (unexpected!)' : 'Reused (deduplicated ✅)'}`);
    console.log(`   Same document ID: ${learnResult2b.document.id === learnResult2.document.id ? 'Yes ✅' : 'No ❌'}\n`);

    const query3 = 'Who works at Acme Corp?';
    const result3 = await kg.ask(query3);

    console.log(`Question: ${query3}`);
    console.log(`Answer: ${result3.answer}\n`);

    // Example 5: Multi-tenant demo
    console.log('🏢 Example 5: Multi-tenant isolation...');
    const tenant2: Scope = {
      id: 'demo-tenant-2',
      type: 'tenant',
      name: 'Demo Tenant 2',
    };

    const kg2 = akasha({
      neo4j: {
        uri: process.env.NEO4J_URI!,
        user: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
      },
      scope: tenant2,
      openai: {
        apiKey: process.env.OPENAI_API_KEY!,
      },
    });

    await kg2.initialize();
    await kg2.learn('Diana is a CEO at StartupInc.', {
      contextName: 'Tenant 2 Data',
    });

    const result4 = await kg2.ask('Who works at Acme Corp?');
    console.log(`Question (Tenant 2): Who works at Acme Corp?`);
    console.log(`Answer: ${result4.answer}`);
    console.log(`   (Note: Tenant 2 cannot see Tenant 1's data)\n`);

    await kg2.cleanup();

    // Example 6: Custom ontology template
    console.log('🎨 Example 6: Custom ontology template...');
    const customScope: Scope = {
      id: 'demo-custom-ontology',
      type: 'tenant',
      name: 'Custom Ontology Demo',
    };

    const kg3 = akasha({
      neo4j: {
        uri: process.env.NEO4J_URI!,
        user: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
      },
      scope: customScope,
      openai: {
        apiKey: process.env.OPENAI_API_KEY!,
      },
      extractionPrompt: {
        entityTypes: [
          {
            label: 'Customer',
            description: 'A customer who makes purchases',
            examples: ['John Doe', 'Jane Smith'],
            requiredProperties: ['name', 'email']
          },
          {
            label: 'Product',
            description: 'A product for sale',
            examples: ['iPhone 15', 'MacBook Pro'],
            requiredProperties: ['name', 'sku']
          }
        ],
        relationshipTypes: [
          {
            type: 'PURCHASED',
            description: 'Customer purchased a product',
            from: ['Customer'],
            to: ['Product'],
            examples: ['Customer PURCHASED Product']
          }
        ]
      },
    });

    await kg3.initialize();
    await kg3.learn('John Doe purchased an iPhone 15. Jane Smith purchased a MacBook Pro.', {
      contextName: 'E-commerce Data',
    });

    const result5 = await kg3.ask('What products were purchased?');
    console.log(`Question (Custom Ontology): What products were purchased?`);
    console.log(`Answer: ${result5.answer}\n`);

    await kg3.cleanup();

    console.log('✨ Demo complete!\n');
    console.log('💡 Key features demonstrated:');
    console.log('   - Text extraction and knowledge graph creation');
    console.log('   - Document nodes (canonical text storage)');
    console.log('   - Document deduplication');
    console.log('   - Entity deduplication across documents');
    console.log('   - Natural language querying (GraphRAG)');
    console.log('   - Query strategies (documents, entities, both)');
    console.log('   - Multi-tenant data isolation');
    console.log('   - Context management');
    console.log('   - Custom ontology templates');

  } catch (error) {
    console.error('❌ Demo error:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
  } finally {
    await kg.cleanup();
    console.log('🧹 Cleaned up connections');
  }
}

demo();

