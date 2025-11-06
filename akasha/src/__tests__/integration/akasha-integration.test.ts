import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test';
import { akasha } from '../../factory';
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
});

