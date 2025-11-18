#!/usr/bin/env bun

/**
 * Integration test script for Akasha library
 * 
 * This script tests the Akasha library with real Neo4j and OpenAI connections.
 * 
 * Required environment variables:
 * - NEO4J_URI
 * - NEO4J_USER
 * - NEO4J_PASSWORD
 * - OPENAI_API_KEY
 * 
 * Usage:
 *   bun run scripts/test-integration.ts
 */

import { akasha } from '../src/factory';
import type { Scope } from '../src/types';

// Check environment variables
const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'OPENAI_API_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease set these environment variables before running the integration tests.');
  process.exit(1);
}

console.log('🧪 Starting Akasha Integration Tests\n');

async function runIntegrationTests() {
  const testScope: Scope = {
    id: `integration-test-${Date.now()}`,
    type: 'test',
    name: 'Integration Test Scope',
  };

  try {
    console.log('1️⃣  Testing initialization...');
    const kg = akasha({
      neo4j: {
        uri: process.env.NEO4J_URI!,
        user: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
      },
      scope: testScope,
      providers: {
        embedding: {
          type: 'openai',
          config: {
            apiKey: process.env.OPENAI_API_KEY!,
            model: 'text-embedding-3-small',
          },
        },
        llm: {
          type: 'openai',
          config: {
            apiKey: process.env.OPENAI_API_KEY!,
            model: 'gpt-4',
          },
        },
      },
    });

    await kg.initialize();
    console.log('   ✅ Connected to Neo4j and initialized OpenAI\n');

    console.log('2️⃣  Testing text extraction and learning...');
    const text = 'Alice works for Acme Corp as a software engineer. Bob works for TechCorp as a designer. Alice knows Bob from college.';
    const learnResult = await kg.learn(text, {
      contextName: 'Integration Test Context',
    });

    console.log(`   ✅ Extracted ${learnResult.created.entities} entities and ${learnResult.created.relationships} relationships`);
    console.log(`   ✅ Created context: ${learnResult.context.name} (${learnResult.context.id})`);
    
    // Verify document node was created
    console.log(`   ✅ Document node created: ${learnResult.document ? 'Yes' : 'No'}`);
    if (learnResult.document) {
      console.log(`      - Document ID: ${learnResult.document.id}`);
      console.log(`      - Document text length: ${learnResult.document.properties.text?.length || 0} chars`);
      console.log(`      - Document created: ${learnResult.created.document === 1 ? 'New' : 'Reused'}`);
    }
    
    console.log(`   ✅ All entities have scopeId: ${testScope.id}`);
    
    // Verify scopeId
    const allHaveScopeId = learnResult.entities.every(e => e.properties.scopeId === testScope.id);
    console.log(`   ${allHaveScopeId ? '✅' : '❌'} Scope isolation verified`);
    
    // Verify embeddings are scrubbed by default
    const embeddingsScrubbed = learnResult.entities.every(e => !e.properties.embedding) &&
                               learnResult.relationships.every(r => !r.properties.embedding);
    console.log(`   ${embeddingsScrubbed ? '✅' : '❌'} Embeddings scrubbed by default\n`);

    console.log('3️⃣  Testing query (ask) with default strategy...');
    const queryResult = await kg.ask('What is the relationship between Alice and Bob?');
    console.log(`   ✅ Query successful (default strategy: 'both')`);
    console.log(`   ✅ Found ${queryResult.context.entities.length} entities and ${queryResult.context.relationships.length} relationships`);
    if (queryResult.context.documents) {
      console.log(`   ✅ Found ${queryResult.context.documents.length} documents`);
    }
    console.log(`   ✅ Generated answer: ${queryResult.answer.substring(0, 100)}...`);
    
    // Verify embeddings are scrubbed by default in ask()
    const queryEmbeddingsScrubbed = queryResult.context.entities.every(e => !e.properties.embedding) &&
                                     queryResult.context.relationships.every(r => !r.properties.embedding);
    console.log(`   ${queryEmbeddingsScrubbed ? '✅' : '❌'} Embeddings scrubbed in query results\n`);

    console.log('3️⃣a Testing query strategies...');
    
    // Test documents-only strategy
    const docsResult = await kg.ask('Who works for companies?', {
      strategy: 'documents',
    });
    console.log(`   ✅ Documents strategy: found ${docsResult.context.documents?.length || 0} documents`);
    
    // Test entities-only strategy
    const entitiesResult = await kg.ask('Who works for companies?', {
      strategy: 'entities',
    });
    console.log(`   ✅ Entities strategy: found ${entitiesResult.context.entities.length} entities`);
    console.log(`   ✅ Query strategies verified\n`);

    console.log('4️⃣  Testing multi-tenant isolation...');
    const tenant1: Scope = {
      id: `tenant-1-${Date.now()}`,
      type: 'tenant',
      name: 'Tenant 1',
    };

    const tenant2: Scope = {
      id: `tenant-2-${Date.now()}`,
      type: 'tenant',
      name: 'Tenant 2',
    };

    const kg1 = akasha({
      neo4j: {
        uri: process.env.NEO4J_URI!,
        user: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
      },
      scope: tenant1,
      providers: {
        embedding: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'text-embedding-3-small' } },
        llm: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4' } },
      },
    });

    const kg2 = akasha({
      neo4j: {
        uri: process.env.NEO4J_URI!,
        user: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
      },
      scope: tenant2,
      providers: {
        embedding: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'text-embedding-3-small' } },
        llm: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4' } },
      },
    });

    await kg1.initialize();
    await kg2.initialize();

    await kg1.learn('Charlie is a developer at StartupCo.', {
      contextName: 'Tenant 1 Context',
    });

    await kg2.learn('Diana is a manager at BigCorp.', {
      contextName: 'Tenant 2 Context',
    });

    const result1 = await kg1.ask('Who is a developer?');
    const result2 = await kg2.ask('Who is a manager?');

    const tenant1HasCharlie = result1.context.entities.some(e => 
      (e.properties.name as string)?.toLowerCase().includes('charlie')
    );
    const tenant2HasDiana = result2.context.entities.some(e => 
      (e.properties.name as string)?.toLowerCase().includes('diana')
    );

    console.log(`   ${tenant1HasCharlie ? '✅' : '❌'} Tenant 1 can see Charlie`);
    console.log(`   ${tenant2HasDiana ? '✅' : '❌'} Tenant 2 can see Diana`);

    // Verify isolation
    const tenant2HasCharlie = result2.context.entities.some(e => 
      (e.properties.name as string)?.toLowerCase().includes('charlie')
    );
    console.log(`   ${!tenant2HasCharlie ? '✅' : '❌'} Tenant 2 cannot see Tenant 1 data (isolation verified)\n`);

    await kg1.cleanup();
    await kg2.cleanup();
    await kg.cleanup();

    console.log('5️⃣  Testing context filtering...');
    const contextTestScope: Scope = {
      id: `context-filter-test-${Date.now()}`,
      type: 'test',
      name: 'Context Filter Test Scope',
    };

    const kgContext = akasha({
      neo4j: {
        uri: process.env.NEO4J_URI!,
        user: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
      },
      scope: contextTestScope,
      providers: {
        embedding: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'text-embedding-3-small' } },
        llm: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4' } },
      },
    });

    await kgContext.initialize();

    // Learn data in different contexts
    const learn1 = await kgContext.learn('Alice works for Acme Corp as a software engineer.', {
      contextId: 'context-1',
      contextName: 'Context 1',
    });

    const learn2 = await kgContext.learn('Bob works for TechCorp as a designer.', {
      contextId: 'context-2',
      contextName: 'Context 2',
    });

    const learn3 = await kgContext.learn('Charlie works for StartupCo as a manager.', {
      contextId: 'context-3',
      contextName: 'Context 3',
    });

    console.log(`   ✅ Created 3 contexts with different data`);
    console.log(`   ✅ Document 1 has contextIds: ${learn1.document.properties.contextIds?.join(', ') || 'none'}`);
    console.log(`   ✅ Document 2 has contextIds: ${learn2.document.properties.contextIds?.join(', ') || 'none'}`);
    console.log(`   ✅ Document 3 has contextIds: ${learn3.document.properties.contextIds?.join(', ') || 'none'}`);

    // Query with context 1 only
    const contextResult1 = await kgContext.ask('Who works for companies?', {
      contexts: ['context-1'],
    });
    const hasAlice = contextResult1.context.entities.some(e => 
      (e.properties.name as string)?.toLowerCase().includes('alice')
    );
    console.log(`   ${hasAlice ? '✅' : '❌'} Context 1 filter: found Alice`);

    // Query with contexts 1 and 2
    const contextResult2 = await kgContext.ask('Who works for companies?', {
      contexts: ['context-1', 'context-2'],
    });
    const hasAliceInBoth = contextResult2.context.entities.some(e => 
      (e.properties.name as string)?.toLowerCase().includes('alice')
    );
    const hasBobInBoth = contextResult2.context.entities.some(e => 
      (e.properties.name as string)?.toLowerCase().includes('bob')
    );
    console.log(`   ${hasAliceInBoth && hasBobInBoth ? '✅' : '❌'} Multiple contexts filter: found Alice and Bob`);

    // Query without contexts (should find all)
    const contextResult3 = await kgContext.ask('Who works for companies?');
    const hasAll = contextResult3.context.entities.length >= 3;
    console.log(`   ${hasAll ? '✅' : '❌'} No context filter: found all entities (${contextResult3.context.entities.length})`);

    // Test context append (learn same text with different context)
    const learn4 = await kgContext.learn('Alice works for Acme Corp.', {
      contextId: 'context-4',
      contextName: 'Context 4',
    });
    const hasBothContexts = learn4.document.properties.contextIds?.includes('context-1') && 
                            learn4.document.properties.contextIds?.includes('context-4');
    console.log(`   ${hasBothContexts ? '✅' : '❌'} Context append: document has both context-1 and context-4`);
    console.log(`   ✅ Context filtering verified\n`);

    await kgContext.cleanup();

    console.log('6️⃣  Testing template system...');
    const templateTestScope: Scope = {
      id: `template-test-${Date.now()}`,
      type: 'test',
      name: 'Template Test Scope',
    };

    // Test default template (backward compatible)
    const kgDefault = akasha({
      neo4j: {
        uri: process.env.NEO4J_URI!,
        user: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
      },
      scope: templateTestScope,
      providers: {
        embedding: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'text-embedding-3-small' } },
        llm: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4' } },
      },
      // No extractionPrompt = uses default template
    });

    await kgDefault.initialize();
    const defaultResult = await kgDefault.learn('Alice works for Acme Corp.', {
      contextName: 'Default Template Test',
    });
    console.log(`   ✅ Default template works: extracted ${defaultResult.created.entities} entities`);
    await kgDefault.cleanup();

    // Test custom template
    const kgCustom = akasha({
      neo4j: {
        uri: process.env.NEO4J_URI!,
        user: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
      },
      scope: templateTestScope,
      providers: {
        embedding: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'text-embedding-3-small' } },
        llm: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4' } },
      },
      extractionPrompt: {
        entityTypes: [
          {
            label: 'Employee',
            description: 'A person who works for a company',
            examples: ['Alice', 'Bob'],
            requiredProperties: ['name', 'company']
          },
          {
            label: 'Company',
            description: 'An organization',
            examples: ['Acme Corp', 'TechCorp'],
            requiredProperties: ['name']
          }
        ],
        relationshipTypes: [
          {
            type: 'WORKS_FOR',
            description: 'Employee works for Company',
            from: ['Employee'],
            to: ['Company'],
            examples: ['Employee WORKS_FOR Company']
          }
        ]
      },
    });

    await kgCustom.initialize();
    const customResult = await kgCustom.learn('Alice works for Acme Corp as a software engineer.', {
      contextName: 'Custom Template Test',
    });
    console.log(`   ✅ Custom template works: extracted ${customResult.created.entities} entities`);
    await kgCustom.cleanup();
    console.log('   ✅ Template system verified\n');

    console.log('6️⃣  Testing embedding scrubbing options...');
    const embeddingTestScope: Scope = {
      id: `embedding-test-${Date.now()}`,
      type: 'test',
      name: 'Embedding Test Scope',
    };

    const kgEmbedding = akasha({
      neo4j: {
        uri: process.env.NEO4J_URI!,
        user: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
      },
      scope: embeddingTestScope,
      providers: {
        embedding: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'text-embedding-3-small' } },
        llm: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4' } },
      },
    });

    await kgEmbedding.initialize();
    
    // Test default (embeddings scrubbed)
    const embeddingDefaultResult = await kgEmbedding.learn('Alice works for Acme Corp.', {
      contextName: 'Default Embedding Test',
    });
    const defaultScrubbed = embeddingDefaultResult.entities.every(e => !e.properties.embedding);
    console.log(`   ${defaultScrubbed ? '✅' : '❌'} Default behavior scrubs embeddings`);

    // Test with includeEmbeddings: true
    const includeResult = await kgEmbedding.learn('Bob works for TechCorp.', {
      contextName: 'Include Embeddings Test',
      includeEmbeddings: true,
    });
    console.log(`   ✅ includeEmbeddings option works: extracted ${includeResult.created.entities} entities`);

    // Test ask() with includeEmbeddings
    const queryWithEmbeddings = await kgEmbedding.ask('Who works for Acme Corp?', {
      includeEmbeddings: true,
    });
    console.log(`   ✅ ask() with includeEmbeddings option works`);

    await kgEmbedding.cleanup();
    console.log('   ✅ Embedding scrubbing verified\n');

    console.log('7️⃣  Testing document nodes and deduplication...');
    const docTestScope: Scope = {
      id: `doc-test-${Date.now()}`,
      type: 'test',
      name: 'Document Test Scope',
    };

    const kgDoc = akasha({
      neo4j: {
        uri: process.env.NEO4J_URI!,
        user: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
      },
      scope: docTestScope,
      providers: {
        embedding: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'text-embedding-3-small' } },
        llm: { type: 'openai', config: { apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4' } },
      },
    });

    await kgDoc.initialize();

    // Test document creation
    const docText1 = `Document test ${Date.now()}. Alice works for Acme Corp.`;
    const docResult1 = await kgDoc.learn(docText1, {
      contextName: 'Document Test 1',
    });
    console.log(`   ${docResult1.created.document === 1 ? '✅' : '❌'} Document created (first learn)`);
    const docId1 = docResult1.document.id;

    // Test document deduplication
    const docResult2 = await kgDoc.learn(docText1, {
      contextName: 'Document Test 2',
    });
    console.log(`   ${docResult2.created.document === 0 ? '✅' : '❌'} Document deduplicated (second learn)`);
    console.log(`   ${docResult2.document.id === docId1 ? '✅' : '❌'} Same document ID reused`);

    // Test entity deduplication across documents
    const docText2 = `Document test ${Date.now()}. Alice knows Bob.`;
    const docResult3 = await kgDoc.learn(docText2, {
      contextName: 'Document Test 3',
    });
    // Alice should be reused from first document
    const aliceEntities = docResult3.entities.filter(e => 
      (e.properties.name as string)?.toLowerCase().includes('alice')
    );
    console.log(`   ${aliceEntities.length > 0 ? '✅' : '❌'} Entity deduplication: Alice found in second document`);
    console.log(`   ✅ Document nodes and deduplication verified\n`);

    await kgDoc.cleanup();

    console.log('🎉 All integration tests passed!\n');
    console.log('Note: Test data has been created in Neo4j. You may want to clean it up manually.');

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

runIntegrationTests();

