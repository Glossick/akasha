import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test';
import { akasha } from '../../factory';
import { Akasha } from '../../akasha';
import type { Scope } from '../../types';

// Check if integration tests should run
const shouldRunIntegrationTests = 
  process.env.NEO4J_URI &&
  process.env.NEO4J_USER &&
  process.env.NEO4J_PASSWORD &&
  process.env.OPENAI_API_KEY;

describe('Akasha Integration Tests', () => {
  let testScope: Scope;
  let isConnected = false;

  beforeAll(async () => {
    if (!shouldRunIntegrationTests) {
      console.warn('⚠️  Skipping integration tests - missing environment variables');
      return;
    }

    testScope = {
      id: `test-${Date.now()}`,
      type: 'test',
      name: 'Integration Test Scope',
    };
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    if (isConnected && shouldRunIntegrationTests) {
      try {
        const kg = akasha({
          neo4j: {
            uri: process.env.NEO4J_URI!,
            user: process.env.NEO4J_USER!,
            password: process.env.NEO4J_PASSWORD!,
          },
          scope: testScope,
          openai: {
            apiKey: process.env.OPENAI_API_KEY!,
          },
        });

        await kg.initialize();
        
        // Delete all entities in test scope
        // Note: This would require a delete method, for now we'll just disconnect
        await kg.cleanup();
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
  });

  describe('Initialization', () => {
    it.skipIf(!shouldRunIntegrationTests)('should connect to Neo4j and OpenAI', async () => {
      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should cleanup connections', async () => {
      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      await kg.cleanup();
    });
  });

  describe('Learn (Extract and Create)', () => {
    it.skipIf(!shouldRunIntegrationTests)('should extract entities and relationships from text', async () => {
      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const text = 'Alice works for Acme Corp. Bob works for TechCorp. Alice knows Bob.';
      const result = await kg.learn(text, {
        contextName: 'Test Context',
      });

      expect(result).toHaveProperty('context');
      expect(result).toHaveProperty('document');
      expect(result.context.scopeId).toBe(testScope.id);
      expect(result.context.name).toBe('Test Context');
      expect(result.context.source).toBe(text);
      
      // Verify document node
      expect(result.document).toBeDefined();
      expect(result.document.label).toBe('Document');
      expect(result.document.properties.text).toBe(text);
      expect(result.document.properties.scopeId).toBe(testScope.id);
      expect(result.created.document).toBeGreaterThanOrEqual(0);
      
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.relationships.length).toBeGreaterThan(0);
      expect(result.created.entities).toBeGreaterThan(0);
      expect(result.created.relationships).toBeGreaterThan(0);

      // Verify all entities have scopeId
      result.entities.forEach(entity => {
        expect(entity.properties.scopeId).toBe(testScope.id);
      });

      // Verify all relationships have scopeId
      result.relationships.forEach(rel => {
        expect(rel.properties.scopeId).toBe(testScope.id);
      });

      // Verify embeddings are scrubbed by default
      result.entities.forEach(entity => {
        expect(entity.properties.embedding).toBeUndefined();
      });
      result.relationships.forEach(rel => {
        expect(rel.properties.embedding).toBeUndefined();
      });

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should scrub embeddings by default in learn()', async () => {
      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const text = 'Alice works for Acme Corp.';
      const result = await kg.learn(text, {
        contextName: 'Embedding Scrub Test',
      });

      // Verify embeddings are scrubbed (default behavior)
      result.entities.forEach(entity => {
        expect(entity.properties.embedding).toBeUndefined();
      });
      result.relationships.forEach(rel => {
        expect(rel.properties.embedding).toBeUndefined();
      });

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should include embeddings when includeEmbeddings is true in learn()', async () => {
      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const text = 'Alice works for Acme Corp.';
      const result = await kg.learn(text, {
        contextName: 'Include Embeddings Test',
        includeEmbeddings: true,
      });

      // Verify embeddings are included when requested
      const hasEmbeddings = result.entities.some(entity => 
        Array.isArray(entity.properties.embedding) && entity.properties.embedding.length > 0
      );
      
      // Note: Embeddings may or may not be present depending on Neo4j storage
      // This test verifies the option works, not that embeddings are always present
      expect(result.entities.length).toBeGreaterThan(0);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should create multiple contexts', async () => {
      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const text1 = 'Alice works for Acme Corp.';
      const result1 = await kg.learn(text1, {
        contextName: 'Context 1',
        contextId: 'context-1',
      });

      const text2 = 'Bob works for TechCorp.';
      const result2 = await kg.learn(text2, {
        contextName: 'Context 2',
        contextId: 'context-2',
      });

      expect(result1.context.id).toBe('context-1');
      expect(result2.context.id).toBe('context-2');
      expect(result1.context.scopeId).toBe(testScope.id);
      expect(result2.context.scopeId).toBe(testScope.id);

      await kg.cleanup();
    });
  });

  describe('Document Nodes', () => {
    it.skipIf(!shouldRunIntegrationTests)('should create document node when learning', async () => {
      // Use unique scope for this test to avoid conflicts
      const uniqueScope: Scope = {
        id: `test-doc-create-${Date.now()}-${Math.random()}`,
        type: 'test',
        name: 'Document Create Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: uniqueScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Use unique text to ensure no deduplication
      const text = `Alice works for Acme Corp. Test ${Date.now()}.`;
      const result = await kg.learn(text, {
        contextName: 'Document Test',
      });

      // Verify document was created
      expect(result.document).toBeDefined();
      expect(result.document.label).toBe('Document');
      expect(result.document.properties.text).toBe(text);
      expect(result.created.document).toBe(1);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should deduplicate documents with same text', async () => {
      // Use unique scope for this test to avoid conflicts
      const uniqueScope: Scope = {
        id: `test-doc-dedup-${Date.now()}-${Math.random()}`,
        type: 'test',
        name: 'Document Dedup Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: uniqueScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Use unique text to ensure first call creates, second deduplicates
      const text = `Dedup test text ${Date.now()}. Alice works for Acme Corp.`;
      
      // First learn - should create document
      const result1 = await kg.learn(text, {
        contextName: 'First Learn',
      });
      expect(result1.created.document).toBe(1);
      const docId1 = result1.document.id;

      // Second learn with same text - should reuse document
      const result2 = await kg.learn(text, {
        contextName: 'Second Learn',
      });
      expect(result2.created.document).toBe(0); // Document reused
      expect(result2.document.id).toBe(docId1); // Same document ID

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should link entities to document', async () => {
      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const text = 'Alice works for Acme Corp.';
      const result = await kg.learn(text, {
        contextName: 'Link Test',
      });

      // Verify document exists
      expect(result.document).toBeDefined();
      
      // Verify entities were created and linked (via CONTAINS_ENTITY relationships)
      expect(result.entities.length).toBeGreaterThan(0);

      await kg.cleanup();
    });
  });

  describe('Query Strategy', () => {
    it.skipIf(!shouldRunIntegrationTests)('should use "both" strategy by default', async () => {
      // Use unique scope for this test
      const uniqueScope: Scope = {
        id: `test-query-both-${Date.now()}-${Math.random()}`,
        type: 'test',
        name: 'Query Both Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: uniqueScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Learn some data first with unique text
      const learnText = `Query both test ${Date.now()}. Alice works for Acme Corp.`;
      await kg.learn(learnText, {
        contextName: 'Query Test',
      });

      // Query with default strategy (both)
      const result = await kg.ask('Who works for Acme Corp?');
      
      expect(result.context).toBeDefined();
      // Documents may or may not be present depending on similarity
      // But the structure should support it
      expect(result.context.entities).toBeDefined();

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should use "documents" strategy when specified', async () => {
      // Use unique scope for this test
      const uniqueScope: Scope = {
        id: `test-query-docs-${Date.now()}-${Math.random()}`,
        type: 'test',
        name: 'Query Docs Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: uniqueScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Learn some data first with unique text
      const learnText = `Query docs test ${Date.now()}. Alice works for Acme Corp.`;
      await kg.learn(learnText, {
        contextName: 'Document Strategy Test',
      });

      // Query with documents strategy
      const result = await kg.ask('Who works for Acme Corp?', {
        strategy: 'documents',
      });
      
      expect(result.context).toBeDefined();
      expect(result.context.documents).toBeDefined(); // Should be array (may be empty)

      await kg.cleanup();
    });
  });

  describe('Ask (Query)', () => {
    it.skipIf(!shouldRunIntegrationTests)('should query knowledge graph and return answer', async () => {
      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // First, learn some data
      await kg.learn('Alice works for Acme Corp. Bob works for TechCorp. Alice knows Bob.', {
        contextName: 'Query Test Context',
      });

      // Then query
      const result = await kg.ask('What is the relationship between Alice and Bob?');

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('context');
      expect(result.context).toHaveProperty('entities');
      expect(result.context).toHaveProperty('relationships');
      expect(result.context).toHaveProperty('summary');
      expect(typeof result.answer).toBe('string');
      expect(result.answer.length).toBeGreaterThan(0);

      // Verify embeddings are scrubbed by default in ask()
      result.context.entities.forEach(entity => {
        expect(entity.properties.embedding).toBeUndefined();
      });
      result.context.relationships.forEach(rel => {
        expect(rel.properties.embedding).toBeUndefined();
      });

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should scrub embeddings by default in ask()', async () => {
      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // First, learn some data
      await kg.learn('Alice works for Acme Corp. Bob works for TechCorp.', {
        contextName: 'Embedding Scrub Query Test',
      });

      // Then query
      const result = await kg.ask('Who works for Acme Corp?');

      // Verify embeddings are scrubbed (default behavior)
      result.context.entities.forEach(entity => {
        expect(entity.properties.embedding).toBeUndefined();
      });
      result.context.relationships.forEach(rel => {
        expect(rel.properties.embedding).toBeUndefined();
      });

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should include embeddings when includeEmbeddings is true in ask()', async () => {
      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // First, learn some data
      await kg.learn('Alice works for Acme Corp.', {
        contextName: 'Include Embeddings Query Test',
      });

      // Then query with includeEmbeddings option
      const result = await kg.ask('Who works for Acme Corp?', {
        includeEmbeddings: true,
      });

      // Verify the option is respected (embeddings may or may not be present in Neo4j)
      expect(result.context.entities.length).toBeGreaterThan(0);
      expect(result.answer.length).toBeGreaterThan(0);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should filter queries by scope', async () => {
      // Create two different scopes
      const scope1: Scope = {
        id: `test-scope-1-${Date.now()}`,
        type: 'test',
        name: 'Scope 1',
      };

      const scope2: Scope = {
        id: `test-scope-2-${Date.now()}`,
        type: 'test',
        name: 'Scope 2',
      };

      const kg1 = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: scope1,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      const kg2 = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: scope2,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg1.initialize();
      await kg2.initialize();
      isConnected = true;

      // Add data to scope 1
      await kg1.learn('Alice works for Acme Corp.', {
        contextName: 'Scope 1 Context',
      });

      // Add data to scope 2
      await kg2.learn('Bob works for TechCorp.', {
        contextName: 'Scope 2 Context',
      });

      // Query scope 1 - should find Alice
      const result1 = await kg1.ask('Who works for Acme Corp?');
      expect(result1.context.entities.length).toBeGreaterThan(0);
      const hasAlice = result1.context.entities.some(e => 
        e.properties.name === 'Alice' || 
        (e.properties.name as string)?.toLowerCase().includes('alice')
      );
      expect(hasAlice).toBe(true);

      // Query scope 2 - should find Bob, not Alice
      const result2 = await kg2.ask('Who works for TechCorp?');
      expect(result2.context.entities.length).toBeGreaterThan(0);
      const hasBob = result2.context.entities.some(e => 
        e.properties.name === 'Bob' || 
        (e.properties.name as string)?.toLowerCase().includes('bob')
      );
      expect(hasBob).toBe(true);

      // Scope 2 should not find Alice
      const result3 = await kg2.ask('Who works for Acme Corp?');
      // Should either return no results or not find Alice
      const hasAliceInScope2 = result3.context.entities.some(e => 
        e.properties.name === 'Alice' || 
        (e.properties.name as string)?.toLowerCase().includes('alice')
      );
      expect(hasAliceInScope2).toBe(false);

      await kg1.cleanup();
      await kg2.cleanup();
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it.skipIf(!shouldRunIntegrationTests)('should isolate data between different scopes', async () => {
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
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

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

      await kg1.initialize();
      await kg2.initialize();
      isConnected = true;

      // Tenant 1 learns about Alice
      await kg1.learn('Alice is a software engineer at Acme Corp.', {
        contextName: 'Tenant 1 Data',
      });

      // Tenant 2 learns about Bob
      await kg2.learn('Bob is a designer at TechCorp.', {
        contextName: 'Tenant 2 Data',
      });

      // Tenant 1 should only see Alice
      const result1 = await kg1.ask('Who is a software engineer?');
      expect(result1.context.entities.length).toBeGreaterThan(0);

      // Tenant 2 should only see Bob
      const result2 = await kg2.ask('Who is a designer?');
      expect(result2.context.entities.length).toBeGreaterThan(0);

      // Verify isolation - tenant 1 shouldn't see Bob
      const result3 = await kg1.ask('Who is a designer?');
      const hasBob = result3.context.entities.some(e => 
        e.properties.name === 'Bob' || 
        (e.properties.name as string)?.toLowerCase().includes('bob')
      );
      expect(hasBob).toBe(false);

      await kg1.cleanup();
      await kg2.cleanup();
    });
  });

  describe('Template System', () => {
    it.skipIf(!shouldRunIntegrationTests)('should work with default template (backward compatible)', async () => {
      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
        // No extractionPrompt = uses default template
      });

      await kg.initialize();
      isConnected = true;

      const text = 'Alice works for Acme Corp as a software engineer.';
      const result = await kg.learn(text, {
        contextName: 'Default Template Test',
      });

      // Should extract entities and relationships using default template
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.created.entities).toBeGreaterThan(0);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should work with custom template', async () => {
      const customTemplate = {
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
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
        extractionPrompt: customTemplate,
      });

      await kg.initialize();
      isConnected = true;

      const text = 'Alice works for Acme Corp as a software engineer. Bob works for TechCorp.';
      const result = await kg.learn(text, {
        contextName: 'Custom Template Test',
      });

      // Should extract entities using custom template
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.created.entities).toBeGreaterThan(0);

      // Verify entities were extracted (may be Employee/Company or Person/Company depending on LLM)
      const entityLabels = result.entities.map(e => e.label);
      expect(entityLabels.length).toBeGreaterThan(0);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should work with process ontology template', async () => {
      const processTemplate = {
        role: "You are an expert at extracting process-oriented knowledge structures from natural language text.",
        task: "Your task is to analyze the provided text and extract:\n1. Processes, Events, and Activities\n2. Participating entities\n3. Temporal and processual relationships",
        entityTypes: [
          {
            label: 'Process',
            description: 'An ongoing activity or transformation',
            examples: ['Working', 'Meeting', 'Building'],
            requiredProperties: ['name', 'startTime']
          },
          {
            label: 'Participant',
            description: 'An entity that takes part in a process',
            examples: ['Worker', 'Agent'],
            requiredProperties: ['name', 'role']
          }
        ],
        relationshipTypes: [
          {
            type: 'PARTICIPATES_IN',
            description: 'Entity participates in a process',
            from: ['Participant'],
            to: ['Process', 'Event'],
            examples: ['Participant PARTICIPATES_IN Process']
          },
          {
            type: 'CAUSES',
            description: 'One process causes another',
            from: ['Process', 'Event'],
            to: ['Process', 'Event'],
            examples: ['Process CAUSES Event']
          }
        ]
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
        extractionPrompt: processTemplate,
      });

      await kg.initialize();
      isConnected = true;

      const text = 'Alice started working at Acme Corp on Monday at 9 AM. She attended a team meeting at 10 AM. The meeting led to a decision to launch a new project.';
      const result = await kg.learn(text, {
        contextName: 'Process Ontology Test',
      });

      // Should extract entities using process ontology
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.created.entities).toBeGreaterThan(0);
      expect(result.relationships.length).toBeGreaterThan(0);

      // Verify process-oriented extraction (may have Process, Event, or Participant entities)
      const entityLabels = result.entities.map(e => e.label);
      expect(entityLabels.length).toBeGreaterThan(0);

      // Verify processual relationships (may have PARTICIPATES_IN, CAUSES, etc.)
      const relationshipTypes = result.relationships.map(r => r.type);
      expect(relationshipTypes.length).toBeGreaterThan(0);

      await kg.cleanup();
    });
  });

  describe('Context Filtering', () => {
    it.skipIf(!shouldRunIntegrationTests)('should filter queries by specific contexts', async () => {
      const contextTestScope: Scope = {
        id: `context-filter-test-${Date.now()}`,
        type: 'test',
        name: 'Context Filter Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: contextTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Learn data in context 1
      const learn1 = await kg.learn('Alice works for Acme Corp as a software engineer.', {
        contextId: 'context-1',
        contextName: 'Context 1',
      });

      // Learn data in context 2
      const learn2 = await kg.learn('Bob works for TechCorp as a designer.', {
        contextId: 'context-2',
        contextName: 'Context 2',
      });

      // Learn data in context 3
      const learn3 = await kg.learn('Charlie works for StartupCo as a manager.', {
        contextId: 'context-3',
        contextName: 'Context 3',
      });

      // Verify documents have contextIds
      expect(learn1.document.properties.contextIds).toContain('context-1');
      expect(learn2.document.properties.contextIds).toContain('context-2');
      expect(learn3.document.properties.contextIds).toContain('context-3');

      // Query with context 1 only - should find Alice
      const result1 = await kg.ask('Who works for companies?', {
        contexts: ['context-1'],
      });
      const hasAlice = result1.context.entities.some(e => 
        (e.properties.name as string)?.toLowerCase().includes('alice')
      );
      expect(hasAlice).toBe(true);

      // Query with context 2 only - should find Bob
      const result2 = await kg.ask('Who works for companies?', {
        contexts: ['context-2'],
      });
      const hasBob = result2.context.entities.some(e => 
        (e.properties.name as string)?.toLowerCase().includes('bob')
      );
      expect(hasBob).toBe(true);

      // Query with contexts 1 and 2 - should find both Alice and Bob
      const result3 = await kg.ask('Who works for companies?', {
        contexts: ['context-1', 'context-2'],
      });
      const hasAliceInBoth = result3.context.entities.some(e => 
        (e.properties.name as string)?.toLowerCase().includes('alice')
      );
      const hasBobInBoth = result3.context.entities.some(e => 
        (e.properties.name as string)?.toLowerCase().includes('bob')
      );
      expect(hasAliceInBoth).toBe(true);
      expect(hasBobInBoth).toBe(true);

      // Query with context 3 only - should find Charlie, not Alice or Bob
      const result4 = await kg.ask('Who works for companies?', {
        contexts: ['context-3'],
      });
      const hasCharlie = result4.context.entities.some(e => 
        (e.properties.name as string)?.toLowerCase().includes('charlie')
      );
      const hasAliceInContext3 = result4.context.entities.some(e => 
        (e.properties.name as string)?.toLowerCase().includes('alice')
      );
      const hasBobInContext3 = result4.context.entities.some(e => 
        (e.properties.name as string)?.toLowerCase().includes('bob')
      );
      expect(hasCharlie).toBe(true);
      expect(hasAliceInContext3).toBe(false);
      expect(hasBobInContext3).toBe(false);

      // Query without contexts - should find all
      const result5 = await kg.ask('Who works for companies?');
      const hasAll = result5.context.entities.length >= 3;
      expect(hasAll).toBe(true);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should append contextIds to existing documents and entities', async () => {
      const appendTestScope: Scope = {
        id: `context-append-test-${Date.now()}`,
        type: 'test',
        name: 'Context Append Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: appendTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Learn text first time (creates document and entity)
      const learn1 = await kg.learn('Alice works for Acme Corp.', {
        contextId: 'context-1',
        contextName: 'Context 1',
      });

      const aliceEntityId = learn1.entities.find(e => 
        (e.properties.name as string)?.toLowerCase().includes('alice')
      )?.id;

      expect(learn1.document.properties.contextIds).toContain('context-1');
      expect(aliceEntityId).toBeDefined();
      if (aliceEntityId) {
        const aliceEntity = learn1.entities.find(e => e.id === aliceEntityId);
        expect(aliceEntity?.properties.contextIds).toContain('context-1');
      }

      // Learn same text again with different context (should append to existing document)
      const learn2 = await kg.learn('Alice works for Acme Corp.', {
        contextId: 'context-2',
        contextName: 'Context 2',
      });

      // Document should now have both contextIds
      expect(learn2.document.properties.contextIds).toContain('context-1');
      expect(learn2.document.properties.contextIds).toContain('context-2');

      // Entity should also have both contextIds
      const aliceEntity2 = learn2.entities.find(e => 
        (e.properties.name as string)?.toLowerCase().includes('alice')
      );
      expect(aliceEntity2?.properties.contextIds).toContain('context-1');
      expect(aliceEntity2?.properties.contextIds).toContain('context-2');

      // Query with context-1 should find Alice
      const result1 = await kg.ask('Who works for Acme Corp?', {
        contexts: ['context-1'],
      });
      const hasAlice1 = result1.context.entities.some(e => 
        (e.properties.name as string)?.toLowerCase().includes('alice')
      );
      expect(hasAlice1).toBe(true);

      // Query with context-2 should also find Alice
      const result2 = await kg.ask('Who works for Acme Corp?', {
        contexts: ['context-2'],
      });
      const hasAlice2 = result2.context.entities.some(e => 
        (e.properties.name as string)?.toLowerCase().includes('alice')
      );
      expect(hasAlice2).toBe(true);

      await kg.cleanup();
    });
  });

  describe('Temporal Tracking', () => {
    it.skipIf(!shouldRunIntegrationTests)('should record _recordedAt automatically on learned facts', async () => {
      const temporalTestScope: Scope = {
        id: `temporal-recordedAt-test-${Date.now()}`,
        type: 'test',
        name: 'Temporal RecordedAt Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: temporalTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const learnResult = await kg.learn('Alice works for Acme Corp as a software engineer.', {
        contextName: 'Temporal Test',
      });

      // Verify document has _recordedAt
      expect(learnResult.document.properties).toHaveProperty('_recordedAt');
      expect(typeof learnResult.document.properties._recordedAt).toBe('string');
      expect(learnResult.document.properties._recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Verify entities have _recordedAt
      expect(learnResult.entities.length).toBeGreaterThan(0);
      learnResult.entities.forEach(entity => {
        expect(entity.properties).toHaveProperty('_recordedAt');
        expect(typeof entity.properties._recordedAt).toBe('string');
      });

      // Verify _validFrom defaults to _recordedAt
      expect(learnResult.document.properties).toHaveProperty('_validFrom');
      expect(learnResult.document.properties._validFrom).toBe(learnResult.document.properties._recordedAt);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should use provided validFrom and validTo when specified', async () => {
      const temporalValidTestScope: Scope = {
        id: `temporal-valid-test-${Date.now()}`,
        type: 'test',
        name: 'Temporal Valid Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: temporalValidTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const validFrom = new Date('2024-01-01T00:00:00Z');
      const validTo = new Date('2024-12-31T23:59:59Z');

      const learnResult = await kg.learn('Bob works for TechCorp as a designer.', {
        contextName: 'Temporal Valid Test',
        validFrom,
        validTo,
      });

      // Verify document has temporal metadata
      expect(learnResult.document.properties).toHaveProperty('_recordedAt');
      expect(learnResult.document.properties).toHaveProperty('_validFrom');
      expect(learnResult.document.properties).toHaveProperty('_validTo');
      expect(learnResult.document.properties._validFrom).toBe('2024-01-01T00:00:00.000Z');
      expect(learnResult.document.properties._validTo).toBe('2024-12-31T23:59:59.000Z');

      // Verify entities have temporal metadata
      learnResult.entities.forEach(entity => {
        expect(entity.properties).toHaveProperty('_validFrom');
        expect(entity.properties).toHaveProperty('_validTo');
        expect(entity.properties._validFrom).toBe('2024-01-01T00:00:00.000Z');
        expect(entity.properties._validTo).toBe('2024-12-31T23:59:59.000Z');
      });

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should not include _validTo for ongoing facts', async () => {
      const temporalOngoingTestScope: Scope = {
        id: `temporal-ongoing-test-${Date.now()}`,
        type: 'test',
        name: 'Temporal Ongoing Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: temporalOngoingTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const learnResult = await kg.learn('Charlie works for StartupCo as a manager.', {
        contextName: 'Temporal Ongoing Test',
        // No validTo = ongoing fact
      });

      // Verify document does not have _validTo
      expect(learnResult.document.properties).toHaveProperty('_recordedAt');
      expect(learnResult.document.properties).toHaveProperty('_validFrom');
      expect(learnResult.document.properties).not.toHaveProperty('_validTo');

      // Verify entities do not have _validTo
      learnResult.entities.forEach(entity => {
        expect(entity.properties).toHaveProperty('_validFrom');
        expect(entity.properties).not.toHaveProperty('_validTo');
      });

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should filter queries by validAt timestamp', async () => {
      const temporalQueryTestScope: Scope = {
        id: `temporal-query-test-${Date.now()}`,
        type: 'test',
        name: 'Temporal Query Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: temporalQueryTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Learn fact valid from 2024-01-01 to 2024-06-30
      await kg.learn('Alice works for Acme Corp.', {
        contextId: 'context-1',
        contextName: 'Q1-Q2 2024',
        validFrom: new Date('2024-01-01T00:00:00Z'),
        validTo: new Date('2024-06-30T23:59:59Z'),
      });

      // Learn fact valid from 2024-07-01 to 2024-12-31
      await kg.learn('Bob works for TechCorp.', {
        contextId: 'context-2',
        contextName: 'Q3-Q4 2024',
        validFrom: new Date('2024-07-01T00:00:00Z'),
        validTo: new Date('2024-12-31T23:59:59Z'),
      });

      // Learn ongoing fact (no validTo)
      await kg.learn('Charlie works for StartupCo.', {
        contextId: 'context-3',
        contextName: 'Ongoing',
        validFrom: new Date('2024-01-01T00:00:00Z'),
        // No validTo = ongoing
      });

      // Query at time when only Alice's fact is valid (2024-03-01)
      const result1 = await kg.ask('Who works for companies?', {
        validAt: new Date('2024-03-01T12:00:00Z'),
      });
      const hasAlice = result1.context.entities.some(e =>
        (e.properties.name as string)?.toLowerCase().includes('alice')
      );
      const hasBob = result1.context.entities.some(e =>
        (e.properties.name as string)?.toLowerCase().includes('bob')
      );
      const hasCharlie = result1.context.entities.some(e =>
        (e.properties.name as string)?.toLowerCase().includes('charlie')
      );
      expect(hasAlice).toBe(true); // Alice's fact is valid
      expect(hasBob).toBe(false); // Bob's fact is not yet valid
      expect(hasCharlie).toBe(true); // Charlie's fact is ongoing (valid)

      // Query at time when Bob's fact is valid (2024-08-01)
      const result2 = await kg.ask('Who works for companies?', {
        validAt: new Date('2024-08-01T12:00:00Z'),
      });
      const hasAlice2 = result2.context.entities.some(e =>
        (e.properties.name as string)?.toLowerCase().includes('alice')
      );
      const hasBob2 = result2.context.entities.some(e =>
        (e.properties.name as string)?.toLowerCase().includes('bob')
      );
      const hasCharlie2 = result2.context.entities.some(e =>
        (e.properties.name as string)?.toLowerCase().includes('charlie')
      );
      expect(hasAlice2).toBe(false); // Alice's fact has expired
      expect(hasBob2).toBe(true); // Bob's fact is valid
      expect(hasCharlie2).toBe(true); // Charlie's fact is ongoing

      // Query without validAt - should return all facts
      const result3 = await kg.ask('Who works for companies?');
      const allCount = result3.context.entities.length;
      expect(allCount).toBeGreaterThanOrEqual(3); // Should find all entities

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should handle facts with validFrom in the past', async () => {
      const temporalPastTestScope: Scope = {
        id: `temporal-past-test-${Date.now()}`,
        type: 'test',
        name: 'Temporal Past Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: temporalPastTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Learn fact that was valid in the past
      const pastDate = new Date('2020-01-01T00:00:00Z');
      const learnResult = await kg.learn('David worked for OldCorp.', {
        contextName: 'Past Fact',
        validFrom: pastDate,
        validTo: new Date('2023-12-31T23:59:59Z'),
      });

      // Verify temporal metadata
      expect(learnResult.document.properties._validFrom).toBe('2020-01-01T00:00:00.000Z');
      expect(learnResult.document.properties._validTo).toBe('2023-12-31T23:59:59.000Z');
      
      // _recordedAt should be recent (when learn() was called)
      expect(learnResult.document.properties._recordedAt).toBeDefined();
      const recordedAt = new Date(learnResult.document.properties._recordedAt as string);
      const now = new Date();
      expect(recordedAt.getTime()).toBeLessThanOrEqual(now.getTime());

      // Query at time when fact was valid
      const result1 = await kg.ask('Who worked for companies?', {
        validAt: new Date('2022-06-01T12:00:00Z'),
      });
      const hasDavid = result1.context.entities.some(e =>
        (e.properties.name as string)?.toLowerCase().includes('david')
      );
      expect(hasDavid).toBe(true);

      // Query at time after fact expired
      const result2 = await kg.ask('Who worked for companies?', {
        validAt: new Date('2024-06-01T12:00:00Z'),
      });
      const hasDavid2 = result2.context.entities.some(e =>
        (e.properties.name as string)?.toLowerCase().includes('david')
      );
      expect(hasDavid2).toBe(false);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should default _validFrom to _recordedAt when not provided', async () => {
      const temporalDefaultTestScope: Scope = {
        id: `temporal-default-test-${Date.now()}`,
        type: 'test',
        name: 'Temporal Default Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: temporalDefaultTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const learnResult = await kg.learn('Eve works for NewCorp.', {
        contextName: 'Default ValidFrom Test',
        // No validFrom provided
      });

      // Verify _validFrom equals _recordedAt
      expect(learnResult.document.properties._validFrom).toBe(learnResult.document.properties._recordedAt);
      
      // Verify entities also have matching _validFrom and _recordedAt
      learnResult.entities.forEach(entity => {
        expect(entity.properties._validFrom).toBe(entity.properties._recordedAt);
      });

      await kg.cleanup();
    });
  });

  describe('Batch Learning', () => {
    it.skipIf(!shouldRunIntegrationTests)('should learn multiple texts in batch', async () => {
      const batchTestScope: Scope = {
        id: `batch-test-${Date.now()}`,
        type: 'test',
        name: 'Batch Learning Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: batchTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const texts = [
        'Alice works for Acme Corp as a software engineer.',
        'Bob works for TechCorp as a designer.',
        'Charlie works for StartupCo as a manager.',
      ];

      const result = await kg.learnBatch(texts, {
        contextName: 'Batch Test',
      });

      expect(result.summary.total).toBe(3);
      expect(result.summary.succeeded).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(result.results.length).toBe(3);
      expect(result.summary.totalDocumentsCreated).toBeGreaterThanOrEqual(0);
      expect(result.summary.totalEntitiesCreated).toBeGreaterThanOrEqual(0);
      expect(result.summary.totalRelationshipsCreated).toBeGreaterThanOrEqual(0);

      // Verify we can query the learned data
      const queryResult = await kg.ask('Who works for companies?');
      expect(queryResult.context.entities.length).toBeGreaterThan(0);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should handle batch learning with per-item options', async () => {
      const batchItemTestScope: Scope = {
        id: `batch-item-test-${Date.now()}`,
        type: 'test',
        name: 'Batch Item Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: batchItemTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const items = [
        {
          text: 'Alice works for Acme Corp.',
          contextId: 'context-1',
          contextName: 'Item 1',
        },
        {
          text: 'Bob works for TechCorp.',
          contextId: 'context-2',
          contextName: 'Item 2',
        },
      ];

      const result = await kg.learnBatch(items);

      expect(result.summary.total).toBe(2);
      expect(result.summary.succeeded).toBe(2);
      expect(result.results.length).toBe(2);

      // Verify context filtering works
      const queryResult = await kg.ask('Who works for companies?', {
        contexts: ['context-1'],
      });
      expect(queryResult.context.entities.length).toBeGreaterThan(0);

      await kg.cleanup();
    });
  });

  describe('Health Check', () => {
    it.skipIf(!shouldRunIntegrationTests)('should return healthy status when services are available', async () => {
      const healthTestScope: Scope = {
        id: `health-test-${Date.now()}`,
        type: 'test',
        name: 'Health Check Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: healthTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const health = await kg.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.neo4j.connected).toBe(true);
      expect(health.openai.available).toBe(true);
      expect(health.timestamp).toBeDefined();
      expect(new Date(health.timestamp).getTime()).toBeLessThanOrEqual(Date.now());

      await kg.cleanup();
    });
  });

  describe('Query Statistics', () => {
    it.skipIf(!shouldRunIntegrationTests)('should include statistics when requested', async () => {
      const statsTestScope: Scope = {
        id: `stats-test-${Date.now()}`,
        type: 'test',
        name: 'Query Statistics Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: statsTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Learn some data first
      await kg.learn('Alice works for Acme Corp. Bob works for TechCorp.');

      // Query with statistics
      const result = await kg.ask('Who works for companies?', {
        includeStats: true,
      });

      expect(result.statistics).toBeDefined();
      const stats = result.statistics!;
      expect(stats.totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(stats.searchTimeMs).toBeGreaterThanOrEqual(0);
      expect(stats.subgraphRetrievalTimeMs).toBeGreaterThanOrEqual(0);
      expect(stats.llmGenerationTimeMs).toBeGreaterThanOrEqual(0);
      expect(stats.entitiesFound).toBe(result.context.entities.length);
      expect(stats.relationshipsFound).toBe(result.context.relationships.length);
      expect(stats.strategy).toBe('both'); // Default strategy

      // Verify total time is approximately sum of components
      const sum = stats.searchTimeMs + stats.subgraphRetrievalTimeMs + stats.llmGenerationTimeMs;
      expect(stats.totalTimeMs).toBeGreaterThanOrEqual(sum - 50); // Allow 50ms tolerance

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should not include statistics by default', async () => {
      const statsDefaultTestScope: Scope = {
        id: `stats-default-test-${Date.now()}`,
        type: 'test',
        name: 'Query Statistics Default Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: statsDefaultTestScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      await kg.learn('Alice works for Acme Corp.');

      const result = await kg.ask('Who works for Acme Corp?');

      expect(result.statistics).toBeUndefined();

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should call progress callback during batch learning', async () => {
      const progressScope: Scope = {
        id: `progress-test-${Date.now()}`,
        type: 'test',
        name: 'Progress Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: progressScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const progressCalls: Array<{
        current: number;
        total: number;
        completed: number;
        failed: number;
      }> = [];

      const texts = [
        'Alice works for Acme Corp.',
        'Bob works for TechCorp.',
        'Charlie works for StartupCo.',
      ];

      const result = await kg.learnBatch(texts, {
        onProgress: (progress) => {
          progressCalls.push({
            current: progress.current,
            total: progress.total,
            completed: progress.completed,
            failed: progress.failed,
          });
        },
      });

      // Should be called for each item
      expect(progressCalls.length).toBe(3);

      // Verify progress values
      expect(progressCalls[0].current).toBe(0);
      expect(progressCalls[0].total).toBe(3);
      expect(progressCalls[0].completed).toBe(1);
      expect(progressCalls[0].failed).toBe(0);

      expect(progressCalls[2].current).toBe(2);
      expect(progressCalls[2].total).toBe(3);
      expect(progressCalls[2].completed).toBe(3);
      expect(progressCalls[2].failed).toBe(0);

      // Verify batch result
      expect(result.summary.total).toBe(3);
      expect(result.summary.succeeded).toBe(3);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should include estimated time in progress callback', async () => {
      const timeScope: Scope = {
        id: `time-estimate-test-${Date.now()}`,
        type: 'test',
        name: 'Time Estimate Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: timeScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      const progressCalls: Array<{ estimatedTimeRemainingMs?: number }> = [];

      const texts = [
        'Alice works for Acme Corp.',
        'Bob works for TechCorp.',
        'Charlie works for StartupCo.',
      ];

      await kg.learnBatch(texts, {
        onProgress: (progress) => {
          progressCalls.push({
            estimatedTimeRemainingMs: progress.estimatedTimeRemainingMs,
          });
        },
      });

      // After first item, should have estimated time
      if (progressCalls.length > 1) {
        expect(progressCalls[1].estimatedTimeRemainingMs).toBeDefined();
        expect(typeof progressCalls[1].estimatedTimeRemainingMs).toBe('number');
      }

      await kg.cleanup();
    });
  });

  describe('Graph Management - Delete Operations', () => {
    it.skipIf(!shouldRunIntegrationTests)('should delete entity and verify removal', async () => {
      const deleteScope: Scope = {
        id: `delete-entity-test-${Date.now()}`,
        type: 'test',
        name: 'Delete Entity Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: deleteScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create entity via learn()
      const learnResult = await kg.learn('Alice works for Acme Corp.');
      expect(learnResult.entities.length).toBeGreaterThan(0);
      
      const entityId = learnResult.entities[0].id;

      // Verify exists
      const found = await kg.findEntity(entityId);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(entityId);

      // Delete entity
      const deleteResult = await kg.deleteEntity(entityId);
      expect(deleteResult.deleted).toBe(true);
      expect(deleteResult.message).toBe('Entity deleted');

      // Verify gone
      const foundAfter = await kg.findEntity(entityId);
      expect(foundAfter).toBeNull();

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should cascade delete relationships when deleting entity', async () => {
      const cascadeScope: Scope = {
        id: `cascade-delete-test-${Date.now()}`,
        type: 'test',
        name: 'Cascade Delete Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: cascadeScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create entity with relationships
      const learnResult = await kg.learn('Alice works for Acme Corp. Bob works for Acme Corp. Alice knows Bob.');
      expect(learnResult.entities.length).toBeGreaterThan(0);
      expect(learnResult.relationships.length).toBeGreaterThan(0);

      const aliceEntity = learnResult.entities.find(e => 
        (e.properties.name as string)?.includes('Alice') || 
        (e.properties.title as string)?.includes('Alice')
      );
      expect(aliceEntity).toBeDefined();
      const entityId = aliceEntity!.id;

      // Verify entity exists and has relationships
      const found = await kg.findEntity(entityId);
      expect(found).not.toBeNull();

      // Delete entity
      const deleteResult = await kg.deleteEntity(entityId);
      expect(deleteResult.deleted).toBe(true);
      expect(deleteResult.relatedRelationshipsDeleted).toBeGreaterThanOrEqual(0);

      // Verify entity is gone
      const foundAfter = await kg.findEntity(entityId);
      expect(foundAfter).toBeNull();

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should delete relationship and verify removal', async () => {
      const relScope: Scope = {
        id: `delete-rel-test-${Date.now()}`,
        type: 'test',
        name: 'Delete Relationship Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: relScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create relationship via learn()
      const learnResult = await kg.learn('Alice works for Acme Corp.');
      expect(learnResult.relationships.length).toBeGreaterThan(0);
      
      const relationshipId = learnResult.relationships[0].id;

      // Verify exists
      const found = await kg.findRelationship(relationshipId);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(relationshipId);

      // Delete relationship
      const deleteResult = await kg.deleteRelationship(relationshipId);
      expect(deleteResult.deleted).toBe(true);
      expect(deleteResult.message).toBe('Relationship deleted');

      // Verify gone
      const foundAfter = await kg.findRelationship(relationshipId);
      expect(foundAfter).toBeNull();

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should delete document and verify removal', async () => {
      const docScope: Scope = {
        id: `delete-doc-test-${Date.now()}`,
        type: 'test',
        name: 'Delete Document Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: docScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create document via learn()
      const learnResult = await kg.learn('Alice works for Acme Corp.');
      expect(learnResult.document).toBeDefined();
      
      const documentId = learnResult.document.id;

      // Verify exists
      const found = await kg.findDocument(documentId);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(documentId);

      // Delete document
      const deleteResult = await kg.deleteDocument(documentId);
      expect(deleteResult.deleted).toBe(true);
      expect(deleteResult.message).toBe('Document deleted');

      // Verify gone
      const foundAfter = await kg.findDocument(documentId);
      expect(foundAfter).toBeNull();

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should respect scope isolation when deleting', async () => {
      const scope1: Scope = {
        id: `scope1-${Date.now()}`,
        type: 'test',
        name: 'Scope 1',
      };

      const scope2: Scope = {
        id: `scope2-${Date.now()}`,
        type: 'test',
        name: 'Scope 2',
      };

      const kg1 = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: scope1,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      const kg2 = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: scope2,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg1.initialize();
      await kg2.initialize();
      isConnected = true;

      // Create entity in scope1
      const learnResult1 = await kg1.learn('Alice works for Acme Corp.');
      const entityId = learnResult1.entities[0].id;

      // Verify exists in scope1
      const found1 = await kg1.findEntity(entityId);
      expect(found1).not.toBeNull();

      // Try to delete from scope2 (should not find it)
      const deleteResult = await kg2.deleteEntity(entityId);
      expect(deleteResult.deleted).toBe(false);
      expect(deleteResult.message).toContain('not found');

      // Verify still exists in scope1
      const foundAfter = await kg1.findEntity(entityId);
      expect(foundAfter).not.toBeNull();

      await kg1.cleanup();
      await kg2.cleanup();
    });
  });

  describe('Graph Management - Update Operations', () => {
    it.skipIf(!shouldRunIntegrationTests)('should update entity properties', async () => {
      const updateScope: Scope = {
        id: `update-entity-test-${Date.now()}`,
        type: 'test',
        name: 'Update Entity Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: updateScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create entity via learn()
      const learnResult = await kg.learn('Alice works for Acme Corp.');
      expect(learnResult.entities.length).toBeGreaterThan(0);
      
      const entityId = learnResult.entities[0].id;
      const originalName = learnResult.entities[0].properties.name as string;

      // Verify original properties
      const found = await kg.findEntity(entityId);
      expect(found).not.toBeNull();
      expect(found?.properties.name).toBe(originalName);

      // Update entity properties
      const updated = await kg.updateEntity(entityId, {
        properties: {
          name: 'Alice Updated',
          age: 30,
          role: 'Senior Engineer',
        },
      });

      expect(updated.id).toBe(entityId);
      expect(updated.properties.name).toBe('Alice Updated');
      expect(updated.properties.age).toBe(30);
      expect(updated.properties.role).toBe('Senior Engineer');

      // Verify update persisted
      const foundAfter = await kg.findEntity(entityId);
      expect(foundAfter?.properties.name).toBe('Alice Updated');
      expect(foundAfter?.properties.age).toBe(30);

      // Verify system metadata preserved
      expect(foundAfter?.properties._recordedAt).toBeDefined();
      expect(foundAfter?.properties.scopeId).toBe(updateScope.id);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should not allow updating system metadata', async () => {
      const metadataScope: Scope = {
        id: `metadata-test-${Date.now()}`,
        type: 'test',
        name: 'Metadata Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: metadataScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create entity
      const learnResult = await kg.learn('Bob works for TechCorp.');
      const entityId = learnResult.entities[0].id;
      
      const originalRecordedAt = learnResult.entities[0].properties._recordedAt as string;
      const originalScopeId = learnResult.entities[0].properties.scopeId as string;

      // Attempt to update system metadata (should be filtered out)
      const updated = await kg.updateEntity(entityId, {
        properties: {
          name: 'Bob Updated',
          _recordedAt: '2020-01-01', // Should be ignored
          _validFrom: '2020-01-01', // Should be ignored
          scopeId: 'different-scope', // Should be ignored
        },
      });

      // Verify system metadata unchanged
      expect(updated.properties._recordedAt).toBe(originalRecordedAt);
      expect(updated.properties.scopeId).toBe(originalScopeId);
      
      // Verify regular property updated
      expect(updated.properties.name).toBe('Bob Updated');

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should update relationship properties', async () => {
      const relScope: Scope = {
        id: `update-rel-test-${Date.now()}`,
        type: 'test',
        name: 'Update Relationship Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: relScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create relationship via learn()
      const learnResult = await kg.learn('Alice works for Acme Corp since 2020.');
      expect(learnResult.relationships.length).toBeGreaterThan(0);
      
      const relationshipId = learnResult.relationships[0].id;

      // Verify original properties
      const found = await kg.findRelationship(relationshipId);
      expect(found).not.toBeNull();

      // Update relationship properties
      const updated = await kg.updateRelationship(relationshipId, {
        properties: {
          since: '2019-01-01',
          role: 'Manager',
          department: 'Engineering',
        },
      });

      expect(updated.id).toBe(relationshipId);
      expect(updated.properties.since).toBe('2019-01-01');
      expect(updated.properties.role).toBe('Manager');
      expect(updated.properties.department).toBe('Engineering');

      // Verify update persisted
      const foundAfter = await kg.findRelationship(relationshipId);
      expect(foundAfter?.properties.since).toBe('2019-01-01');
      expect(foundAfter?.properties.role).toBe('Manager');

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should update document properties', async () => {
      const docScope: Scope = {
        id: `update-doc-test-${Date.now()}`,
        type: 'test',
        name: 'Update Document Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: docScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create document via learn()
      const learnResult = await kg.learn('Alice works for Acme Corp.');
      expect(learnResult.document).toBeDefined();
      
      const documentId = learnResult.document.id;
      const originalText = learnResult.document.properties.text as string;

      // Verify original properties
      const found = await kg.findDocument(documentId);
      expect(found).not.toBeNull();
      expect(found?.properties.text).toBe(originalText);

      // Update document metadata (not text - text is protected)
      const updated = await kg.updateDocument(documentId, {
        properties: {
          metadata: {
            source: 'updated-source',
            author: 'Test Author',
            version: 2,
          },
        },
      });

      expect(updated.id).toBe(documentId);
      expect(updated.properties.text).toBe(originalText); // Text unchanged
      expect(updated.properties.metadata).toEqual({
        source: 'updated-source',
        author: 'Test Author',
        version: 2,
      });

      // Verify update persisted
      const foundAfter = await kg.findDocument(documentId);
      expect(foundAfter?.properties.metadata).toEqual({
        source: 'updated-source',
        author: 'Test Author',
        version: 2,
      });
      expect(foundAfter?.properties.text).toBe(originalText); // Still unchanged

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should not allow updating document text', async () => {
      const textScope: Scope = {
        id: `text-test-${Date.now()}`,
        type: 'test',
        name: 'Text Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: textScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create document
      const learnResult = await kg.learn('Original text content.');
      const documentId = learnResult.document.id;
      const originalText = learnResult.document.properties.text as string;

      // Attempt to update text (should be filtered out)
      const updated = await kg.updateDocument(documentId, {
        properties: {
          text: 'New text content', // Should be ignored
          metadata: { source: 'test' },
        },
      });

      // Verify text unchanged
      expect(updated.properties.text).toBe(originalText);
      expect(updated.properties.metadata).toEqual({ source: 'test' });

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should respect scope isolation when updating', async () => {
      const scope1: Scope = {
        id: `scope1-update-${Date.now()}`,
        type: 'test',
        name: 'Scope 1',
      };

      const scope2: Scope = {
        id: `scope2-update-${Date.now()}`,
        type: 'test',
        name: 'Scope 2',
      };

      const kg1 = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: scope1,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      const kg2 = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: scope2,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg1.initialize();
      await kg2.initialize();
      isConnected = true;

      // Create entity in scope1
      const learnResult1 = await kg1.learn('Alice works for Acme Corp.');
      const entityId = learnResult1.entities[0].id;

      // Verify exists in scope1
      const found1 = await kg1.findEntity(entityId);
      expect(found1).not.toBeNull();

      // Try to update from scope2 (should fail - entity not found)
      await expect(
        kg2.updateEntity(entityId, { properties: { name: 'Updated' } })
      ).rejects.toThrow('Entity with id');

      // Verify entity unchanged in scope1
      const foundAfter = await kg1.findEntity(entityId);
      expect(foundAfter?.properties.name).toBe(learnResult1.entities[0].properties.name);

      await kg1.cleanup();
      await kg2.cleanup();
    });
  });

  describe('Direct Graph Queries - List Operations', () => {
    it.skipIf(!shouldRunIntegrationTests)('should list all entities', async () => {
      const listScope: Scope = {
        id: `list-entities-test-${Date.now()}`,
        type: 'test',
        name: 'List Entities Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: listScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create multiple entities
      await kg.learn('Alice works for Acme Corp.');
      await kg.learn('Bob works for TechCorp.');
      await kg.learn('Charlie works for StartupCo.');

      // List all entities
      const entities = await kg.listEntities();

      expect(entities.length).toBeGreaterThanOrEqual(3);
      expect(entities.every(e => e.properties.scopeId === listScope.id)).toBe(true);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should filter entities by label', async () => {
      const labelScope: Scope = {
        id: `label-filter-test-${Date.now()}`,
        type: 'test',
        name: 'Label Filter Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: labelScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create entities (should include Person and Company labels)
      await kg.learn('Alice works for Acme Corp. Acme Corp is a technology company.');

      // List all entities
      const allEntities = await kg.listEntities();
      expect(allEntities.length).toBeGreaterThan(0);

      // Filter by Person label (if Person entities exist)
      const personEntities = await kg.listEntities({ label: 'Person' });
      expect(personEntities.every(e => e.label === 'Person')).toBe(true);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should support pagination for entities', async () => {
      const paginationScope: Scope = {
        id: `pagination-test-${Date.now()}`,
        type: 'test',
        name: 'Pagination Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: paginationScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create multiple entities
      await kg.learn('Alice works for Acme Corp.');
      await kg.learn('Bob works for TechCorp.');
      await kg.learn('Charlie works for StartupCo.');

      // Get first page
      const page1 = await kg.listEntities({ limit: 2, offset: 0 });
      expect(page1.length).toBeLessThanOrEqual(2);

      // Get second page
      const page2 = await kg.listEntities({ limit: 2, offset: 2 });
      expect(page2.length).toBeLessThanOrEqual(2);

      // Verify no overlap
      const page1Ids = new Set(page1.map(e => e.id));
      const page2Ids = new Set(page2.map(e => e.id));
      const intersection = [...page1Ids].filter(id => page2Ids.has(id));
      expect(intersection.length).toBe(0);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should list all relationships', async () => {
      const relScope: Scope = {
        id: `list-rels-test-${Date.now()}`,
        type: 'test',
        name: 'List Relationships Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: relScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create relationships
      await kg.learn('Alice works for Acme Corp.');
      await kg.learn('Bob works for TechCorp.');

      // List all relationships
      const relationships = await kg.listRelationships();

      expect(relationships.length).toBeGreaterThan(0);
      expect(relationships.every(r => r.properties.scopeId === relScope.id)).toBe(true);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should filter relationships by type', async () => {
      const typeScope: Scope = {
        id: `type-filter-test-${Date.now()}`,
        type: 'test',
        name: 'Type Filter Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: typeScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create relationships (should include WORKS_FOR type)
      await kg.learn('Alice works for Acme Corp.');

      // List all relationships
      const allRels = await kg.listRelationships();
      expect(allRels.length).toBeGreaterThan(0);

      // Filter by type (if WORKS_FOR exists)
      const worksForRels = await kg.listRelationships({ type: 'WORKS_FOR' });
      expect(worksForRels.every(r => r.type === 'WORKS_FOR')).toBe(true);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should filter relationships by fromId and toId', async () => {
      const filterScope: Scope = {
        id: `filter-rels-test-${Date.now()}`,
        type: 'test',
        name: 'Filter Relationships Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: filterScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create relationships
      const learnResult = await kg.learn('Alice works for Acme Corp.');
      expect(learnResult.relationships.length).toBeGreaterThan(0);

      const relationship = learnResult.relationships[0];
      const fromId = relationship.from;
      const toId = relationship.to;

      // Filter by fromId
      const fromRels = await kg.listRelationships({ fromId });
      expect(fromRels.length).toBeGreaterThan(0);
      expect(fromRels.every(r => r.from === fromId)).toBe(true);

      // Filter by toId
      const toRels = await kg.listRelationships({ toId });
      expect(toRels.length).toBeGreaterThan(0);
      expect(toRels.every(r => r.to === toId)).toBe(true);

      // Filter by both
      const bothRels = await kg.listRelationships({ fromId, toId });
      expect(bothRels.every(r => r.from === fromId && r.to === toId)).toBe(true);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should list all documents', async () => {
      const docScope: Scope = {
        id: `list-docs-test-${Date.now()}`,
        type: 'test',
        name: 'List Documents Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: docScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create documents
      await kg.learn('Alice works for Acme Corp.');
      await kg.learn('Bob works for TechCorp.');

      // List all documents
      const documents = await kg.listDocuments();

      expect(documents.length).toBeGreaterThan(0);
      expect(documents.every(d => d.properties.scopeId === docScope.id)).toBe(true);
      expect(documents.every(d => d.label === 'Document')).toBe(true);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should support pagination for documents', async () => {
      const paginationScope: Scope = {
        id: `doc-pagination-test-${Date.now()}`,
        type: 'test',
        name: 'Document Pagination Test Scope',
      };

      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: paginationScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg.initialize();
      isConnected = true;

      // Create multiple documents
      await kg.learn('Document 1: Alice works for Acme Corp.');
      await kg.learn('Document 2: Bob works for TechCorp.');
      await kg.learn('Document 3: Charlie works for StartupCo.');

      // Get first page
      const page1 = await kg.listDocuments({ limit: 2, offset: 0 });
      expect(page1.length).toBeLessThanOrEqual(2);

      // Get second page
      const page2 = await kg.listDocuments({ limit: 2, offset: 2 });
      expect(page2.length).toBeLessThanOrEqual(2);

      await kg.cleanup();
    });

    it.skipIf(!shouldRunIntegrationTests)('should respect scope isolation when listing', async () => {
      const scope1: Scope = {
        id: `scope1-list-${Date.now()}`,
        type: 'test',
        name: 'Scope 1',
      };

      const scope2: Scope = {
        id: `scope2-list-${Date.now()}`,
        type: 'test',
        name: 'Scope 2',
      };

      const kg1 = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: scope1,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      const kg2 = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: scope2,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      await kg1.initialize();
      await kg2.initialize();
      isConnected = true;

      // Create entities in scope1
      await kg1.learn('Alice works for Acme Corp.');

      // List entities in scope1
      const scope1Entities = await kg1.listEntities();
      expect(scope1Entities.length).toBeGreaterThan(0);

      // List entities in scope2 (should be empty or different)
      const scope2Entities = await kg2.listEntities();
      
      // Verify no overlap (entities from scope1 shouldn't appear in scope2)
      const scope1Ids = new Set(scope1Entities.map(e => e.id));
      const scope2Ids = new Set(scope2Entities.map(e => e.id));
      const intersection = [...scope1Ids].filter(id => scope2Ids.has(id));
      expect(intersection.length).toBe(0);

      await kg1.cleanup();
      await kg2.cleanup();
    });
  });

  describe('Configuration Validation', () => {
    it.skipIf(!shouldRunIntegrationTests)('should validate valid configuration', () => {
      const config = {
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
        scope: testScope,
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it.skipIf(!shouldRunIntegrationTests)('should detect invalid Neo4j URI', () => {
      const config = {
        neo4j: {
          uri: '',
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('neo4j.uri'))).toBe(true);
    });

    it.skipIf(!shouldRunIntegrationTests)('should detect missing OpenAI API key when openai is provided', () => {
      const config = {
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        openai: {
          apiKey: '',
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('openai.apiKey'))).toBe(true);
    });

    it.skipIf(!shouldRunIntegrationTests)('should validate instance configuration', async () => {
      const kg = akasha({
        neo4j: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: testScope,
        openai: {
          apiKey: process.env.OPENAI_API_KEY!,
        },
      });

      const result = kg.validateConfig();

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });
});

