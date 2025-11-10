#!/usr/bin/env bun

/**
 * Debug Context IDs
 * 
 * Check what contextIds are actually stored in the database
 */

import { akasha } from '../../../akasha/src/factory';
import type { Scope } from '../../../akasha/src/types';

const scope: Scope = {
  id: 'estimate-company',
  type: 'organization',
  name: 'EstiMate Company Knowledge Base',
};

console.log('🔍 Debugging Context IDs in Database\n');

const kg = akasha({
  neo4j: {
    uri: process.env.NEO4J_URI!,
    user: process.env.NEO4J_USER!,
    password: process.env.NEO4J_PASSWORD!,
  },
  scope,
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'text-embedding-3-small',
      },
    },
    llm: {
      type: 'deepseek',
      config: {
        apiKey: process.env.DEEPSEEK_API_KEY!,
        model: 'deepseek-chat',
      },
    },
  },
});

await kg.initialize();

// Get all documents
const documents = await kg.listDocuments({ limit: 5 });

console.log(`📄 Sample Documents (${documents.length}):\n`);
for (const doc of documents.slice(0, 3)) {
  console.log(`Document ID: ${doc.id.substring(0, 12)}...`);
  console.log(`  contextIds: ${JSON.stringify(doc.properties.contextIds)}`);
  console.log(`  text preview: ${doc.properties.text.substring(0, 80)}...\n`);
}

// Get all entities
const entities = await kg.listEntities({ limit: 5 });

console.log(`\n🏷️  Sample Entities (${entities.length}):\n`);
for (const entity of entities.slice(0, 3)) {
  console.log(`${entity.label}: ${entity.properties.name || entity.properties.title || 'unnamed'}`);
  console.log(`  contextIds: ${JSON.stringify(entity.properties.contextIds)}\n`);
}

// Now test a query WITHOUT context filter to see if we get results
console.log('\n🔍 Testing query WITHOUT context filter:\n');
const result = await kg.ask('What happened in February 2024?', {
  includeStats: true,
});

console.log(`Answer: ${result.answer.substring(0, 200)}...`);
console.log(`\nStats:`);
console.log(`  Documents found: ${result.statistics?.documentsFound}`);
console.log(`  Entities found: ${result.statistics?.entitiesFound}`);

// Now test WITH context filter
console.log('\n\n🔍 Testing query WITH context filter [time:2024-02]:\n');
const result2 = await kg.ask('What happened in February 2024?', {
  contexts: ['time:2024-02'],
  includeStats: true,
});

console.log(`Answer: ${result2.answer.substring(0, 200)}...`);
console.log(`\nStats:`);
console.log(`  Documents found: ${result2.statistics?.documentsFound}`);
console.log(`  Entities found: ${result2.statistics?.entitiesFound}`);

if (result2.context.documents && result2.context.documents.length > 0) {
  console.log(`\nDocuments returned:`);
  result2.context.documents.slice(0, 2).forEach(doc => {
    console.log(`  - ${doc.id.substring(0, 12)}... contextIds: ${JSON.stringify(doc.properties.contextIds)}`);
  });
}

await kg.cleanup();

