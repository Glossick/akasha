#!/usr/bin/env bun

/**
 * Simple Query Test - No context filters
 * 
 * Test if basic semantic search works at all
 */

import { akasha } from '../../../akasha/src/factory';
import type { Scope } from '../../../akasha/src/types';

const scope: Scope = {
  id: 'estimate-company',
  type: 'organization',
  name: 'EstiMate Company Knowledge Base',
};

console.log('🔍 Testing Simple Query (No Context Filters)\n');

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

// Test 1: Query WITHOUT any filters
console.log('Test 1: Query WITHOUT context filters\n');
const result1 = await kg.ask('What is EstiMate? Who are Henry and Steven?', {
  includeStats: true,
  similarityThreshold: 0.5, // Lower threshold
});

console.log(`Answer: ${result1.answer.substring(0, 300)}...`);
console.log(`\nStats:`);
console.log(`  Documents found: ${result1.statistics?.documentsFound || 0}`);
console.log(`  Entities found: ${result1.statistics?.entitiesFound || 0}`);
console.log(`  Relationships found: ${result1.statistics?.relationshipsFound || 0}`);
console.log(`  Strategy: ${result1.statistics?.strategy || 'unknown'}`);

if (result1.context.documents && result1.context.documents.length > 0) {
  console.log(`\n  Sample documents:`);
  result1.context.documents.slice(0, 2).forEach(doc => {
    console.log(`    - Similarity: ${doc.properties._similarity?.toFixed(3)}`);
    console.log(`      contextIds: ${JSON.stringify(doc.properties.contextIds)}`);
    console.log(`      Text: ${doc.properties.text.substring(0, 80)}...`);
  });
}

if (result1.context.entities.length > 0) {
  console.log(`\n  Sample entities:`);
  result1.context.entities.slice(0, 3).forEach(entity => {
    console.log(`    - ${entity.label}: ${entity.properties.name || 'unnamed'}`);
    console.log(`      Similarity: ${entity.properties._similarity?.toFixed(3) || 'N/A'}`);
    console.log(`      contextIds: ${JSON.stringify(entity.properties.contextIds || [])}`);
  });
}

// Test 2: List entities to see what exists
console.log('\n\nTest 2: List entities (to verify data exists)\n');
const entities = await kg.listEntities({ limit: 10 });
console.log(`Total entities found: ${entities.length}`);
entities.slice(0, 5).forEach(entity => {
  console.log(`  - ${entity.label}: ${entity.properties.name || entity.properties.title || 'unnamed'}`);
  console.log(`    contextIds: ${JSON.stringify(entity.properties.contextIds)}`);
});

// Test 3: List documents
console.log('\n\nTest 3: List documents (to verify data exists)\n');
const documents = await kg.listDocuments({ limit: 10 });
console.log(`Total documents found: ${documents.length}`);
documents.slice(0, 3).forEach(doc => {
  console.log(`  - Text preview: ${doc.properties.text.substring(0, 100)}...`);
  console.log(`    contextIds: ${JSON.stringify(doc.properties.contextIds)}`);
});

// Test 4: Try with VERY generic query
console.log('\n\nTest 4: Very generic query\n');
const result4 = await kg.ask('Tell me about the company', {
  includeStats: true,
  similarityThreshold: 0.3, // Even lower threshold
});

console.log(`Answer: ${result4.answer.substring(0, 200)}...`);
console.log(`Documents found: ${result4.statistics?.documentsFound || 0}`);
console.log(`Entities found: ${result4.statistics?.entitiesFound || 0}`);

await kg.cleanup();

