import { describe, expect, it, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import { Akasha } from '../akasha';
import type { Scope, Context } from '../types';

// Mock session for document entity retrieval
const mockSession = {
  run: mock(() => Promise.resolve({
    records: [],
  })),
  close: mock(() => Promise.resolve()),
} as any;

// Mock dependencies
const mockNeo4jService = {
  connect: mock(() => Promise.resolve()),
  disconnect: mock(() => Promise.resolve()),
  ensureVectorIndex: mock(() => Promise.resolve()),
  getSession: mock(() => mockSession),
  findEntitiesByVector: mock(() => Promise.resolve([
    { id: '1', label: 'Person', properties: { name: 'Alice', scopeId: 'tenant-1' } },
  ])),
  findDocumentsByVector: mock(() => Promise.resolve([
    { id: 'doc1', label: 'Document', properties: { text: 'Alice works for Acme Corp.', scopeId: 'tenant-1' } },
  ])),
  retrieveSubgraph: mock(() => Promise.resolve({
    entities: [
      { id: '1', label: 'Person', properties: { name: 'Alice', scopeId: 'tenant-1' } },
    ],
    relationships: [
      { id: 'r1', type: 'KNOWS', from: '1', to: '2', properties: { scopeId: 'tenant-1' } },
    ],
  })),
  createEntities: mock(() => Promise.resolve([
    { id: '1', label: 'Person', properties: { name: 'Alice', scopeId: 'tenant-1' } },
  ])),
  createRelationships: mock(() => Promise.resolve([
    { id: 'r1', type: 'KNOWS', from: '1', to: '2', properties: { scopeId: 'tenant-1' } },
  ])),
  findDocumentByText: mock(() => Promise.resolve(null)), // Default: document doesn't exist
  createDocument: mock(() => Promise.resolve({
    id: 'doc1',
    label: 'Document',
    properties: { text: 'Alice works for Acme Corp.', scopeId: 'tenant-1' },
  })),
  linkEntityToDocument: mock(() => Promise.resolve({
    id: 'rel1',
    type: 'CONTAINS_ENTITY',
    from: 'doc1',
    to: '1',
    properties: {},
  })),
  findEntityByName: mock(() => Promise.resolve(null)), // Default: entity doesn't exist
} as any;

const mockEmbeddingService = {
  generateEmbedding: mock(() => Promise.resolve(new Array(1536).fill(0.1))),
  generateEmbeddings: mock(() => Promise.resolve([new Array(1536).fill(0.1)])),
  generateResponse: mock((prompt: string, context: string, systemMessage?: string) => {
    // If it's an extraction request (has the extraction system prompt), return JSON
    if (systemMessage?.includes('extracting knowledge graph structures')) {
      return Promise.resolve(JSON.stringify({
        entities: [
          { label: 'Person', properties: { name: 'Alice' } },
          { label: 'Company', properties: { name: 'Acme Corp' } },
        ],
        relationships: [
          { from: 'Alice', to: 'Acme Corp', type: 'WORKS_FOR', properties: {} },
        ],
      }));
    }
    // Otherwise return a regular answer
    return Promise.resolve('Test answer');
  }),
} as any;

describe('Akasha', () => {
  describe('Initialization', () => {
    it('should initialize with scope configuration', async () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();
      expect(mockNeo4jService.connect).toHaveBeenCalled();
      expect(mockNeo4jService.ensureVectorIndex).toHaveBeenCalled();
    });

    it('should initialize without scope (scope-agnostic mode)', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();
      expect(mockNeo4jService.connect).toHaveBeenCalled();
    });

    it('should cleanup connection on cleanup', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.cleanup();
      expect(mockNeo4jService.disconnect).toHaveBeenCalled();
    });
  });

  describe('Scope Management', () => {
    it('should store scope configuration', () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope,
      }, mockNeo4jService as any, mockEmbeddingService as any);

      expect(akasha.getScope()).toEqual(scope);
    });

    it('should return undefined when no scope configured', () => {
      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      expect(akasha.getScope()).toBeUndefined();
    });
  });

  describe('Query with Scope Filtering', () => {
    beforeEach(() => {
      mockNeo4jService.findEntitiesByVector.mockClear();
      mockNeo4jService.retrieveSubgraph.mockClear();
      mockEmbeddingService.generateEmbedding.mockClear();
      mockEmbeddingService.generateResponse.mockClear();
    });

    it('should filter queries by scopeId when scope is configured', async () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope,
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      await akasha.ask('What is the relationship between Alice and Bob?');

      // Verify scopeId is passed to Neo4j queries
      expect(mockNeo4jService.findEntitiesByVector).toHaveBeenCalled();
      const findCall = mockNeo4jService.findEntitiesByVector.mock.calls[0];
      expect(findCall[3]).toBe('tenant-1'); // scopeId parameter

      expect(mockNeo4jService.retrieveSubgraph).toHaveBeenCalled();
      const subgraphCall = mockNeo4jService.retrieveSubgraph.mock.calls[0];
      expect(subgraphCall[5]).toBe('tenant-1'); // scopeId parameter
    });

    it('should not filter queries when no scope is configured', async () => {
      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      await akasha.ask('What is the relationship between Alice and Bob?');

      expect(mockNeo4jService.findEntitiesByVector).toHaveBeenCalled();
      const findCall = mockNeo4jService.findEntitiesByVector.mock.calls[0];
      expect(findCall[3]).toBeUndefined(); // No scopeId
    });

    it('should return answer with context', async () => {
      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      const result = await akasha.ask('Test query');

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('context');
      expect(result.context).toHaveProperty('entities');
      expect(result.context).toHaveProperty('relationships');
      expect(result.context).toHaveProperty('summary');
    });
  });

  describe('Extract and Create with Scope', () => {
    beforeEach(() => {
      mockEmbeddingService.generateEmbeddings.mockClear();
      mockNeo4jService.createEntities.mockClear();
      mockNeo4jService.createRelationships.mockClear();
    });

    it('should add scopeId to all created entities', async () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope,
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      const text = 'Alice works for Acme Corp.';
      await akasha.learn(text);

      expect(mockNeo4jService.createEntities).toHaveBeenCalled();
      const createCall = mockNeo4jService.createEntities.mock.calls[0];
      const entities = createCall[0];
      
      // All entities should have scopeId
      entities.forEach((entity: any) => {
        expect(entity.properties.scopeId).toBe('tenant-1');
      });
    });

    it('should add scopeId to all created relationships', async () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope,
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      const text = 'Alice works for Acme Corp.';
      await akasha.learn(text);

      expect(mockNeo4jService.createRelationships).toHaveBeenCalled();
      const createCall = mockNeo4jService.createRelationships.mock.calls[0];
      const relationships = createCall[0];
      
      // All relationships should have scopeId in properties
      relationships.forEach((rel: any) => {
        expect(rel.properties.scopeId).toBe('tenant-1');
      });
    });

    it('should create context when extracting from text', async () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope,
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      const text = 'Alice works for Acme Corp.';
      const result = await akasha.learn(text);

      expect(result).toHaveProperty('context');
      expect(result.context).toHaveProperty('id');
      expect(result.context).toHaveProperty('scopeId', 'tenant-1');
      expect(result.context).toHaveProperty('source', text);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate queries between different scopes', async () => {
      const tenant1 = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope: { id: 'tenant-1', type: 'tenant', name: 'Tenant 1' },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      const tenant2 = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope: { id: 'tenant-2', type: 'tenant', name: 'Tenant 2' },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await tenant1.initialize();
      await tenant2.initialize();

      // Query tenant 1
      mockNeo4jService.findEntitiesByVector.mockClear();
      await tenant1.ask('Find Alice');
      expect(mockNeo4jService.findEntitiesByVector.mock.calls[0][3]).toBe('tenant-1');

      // Query tenant 2
      mockNeo4jService.findEntitiesByVector.mockClear();
      await tenant2.ask('Find Alice');
      expect(mockNeo4jService.findEntitiesByVector.mock.calls[0][3]).toBe('tenant-2');
    });
  });

  describe('Context Management', () => {
    it('should extract text into a context', async () => {
      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope: { id: 'tenant-1', type: 'tenant', name: 'Test Tenant' },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      const text = 'Alice works for Acme Corp. Bob works for TechCorp.';
      const result = await akasha.learn(text, { contextName: 'Test Context' });

      expect(result.context).toHaveProperty('name', 'Test Context');
      expect(result.context).toHaveProperty('source', text);
    });

    it('should query within specific contexts', async () => {
      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope: { id: 'tenant-1', type: 'tenant', name: 'Test Tenant' },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      mockNeo4jService.findEntitiesByVector.mockClear();
      await akasha.ask('Find connections', {
        contexts: ['context-1', 'context-2'],
      });

      // Should filter by both scopeId and contextIds
      expect(mockNeo4jService.findEntitiesByVector).toHaveBeenCalled();
    });
  });

  describe('Document Nodes', () => {
    beforeEach(() => {
      mockNeo4jService.findDocumentByText.mockClear();
      mockNeo4jService.createDocument.mockClear();
      mockNeo4jService.linkEntityToDocument.mockClear();
      mockEmbeddingService.generateEmbedding.mockClear();
    });

    it('should create a document node when learning from text', async () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope,
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      const text = 'Alice works for Acme Corp.';
      const result = await akasha.learn(text);

      // Should check if document exists
      expect(mockNeo4jService.findDocumentByText).toHaveBeenCalledWith(text, 'tenant-1');
      
      // Should create document node
      expect(mockNeo4jService.createDocument).toHaveBeenCalled();
      const createDocCall = mockNeo4jService.createDocument.mock.calls[0];
      expect(createDocCall[0].properties.text).toBe(text);
      expect(createDocCall[0].properties.scopeId).toBe('tenant-1');

      // Should return document in result
      expect(result).toHaveProperty('document');
      expect(result.document.properties.text).toBe(text);
      expect(result.created.document).toBe(1);
    });

    it('should deduplicate documents with same text', async () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      const existingDocument = {
        id: 'doc-existing',
        label: 'Document',
        properties: { text: 'Hello world', scopeId: 'tenant-1' },
      };

      // First call: document doesn't exist
      mockNeo4jService.findDocumentByText.mockResolvedValueOnce(null);
      // Second call: document exists
      mockNeo4jService.findDocumentByText.mockResolvedValueOnce(existingDocument);

      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope,
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      const text = 'Hello world';

      // First learn: creates document
      const result1 = await akasha.learn(text);
      expect(result1.created.document).toBe(1);
      expect(mockNeo4jService.createDocument).toHaveBeenCalledTimes(1);

      // Second learn: uses existing document
      const result2 = await akasha.learn(text);
      expect(result2.created.document).toBe(0); // Not created, deduplicated
      expect(mockNeo4jService.createDocument).toHaveBeenCalledTimes(1); // Still only called once
      expect(result2.document.id).toBe('doc-existing');
    });

    it('should link entities to document via CONTAINS_ENTITY relationship', async () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope,
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      const text = 'Alice works for Acme Corp.';
      await akasha.learn(text);

      // Should link each entity to the document
      expect(mockNeo4jService.linkEntityToDocument).toHaveBeenCalled();
      const linkCalls = mockNeo4jService.linkEntityToDocument.mock.calls;
      expect(linkCalls.length).toBeGreaterThan(0);
      
      // Each call should link an entity to the document
      linkCalls.forEach((call: any[]) => {
        expect(call[0]).toBe('doc1'); // Document ID
        expect(call[1]).toBeDefined(); // Entity ID
        expect(call[2]).toBe('tenant-1'); // Scope ID
      });
    });

    it('should deduplicate entities across documents', async () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      // First document
      mockNeo4jService.findDocumentByText.mockResolvedValueOnce(null);
      mockNeo4jService.createDocument.mockResolvedValueOnce({
        id: 'doc1',
        label: 'Document',
        properties: { text: 'Alice works for Acme Corp.', scopeId: 'tenant-1' },
      });

      // Second document (different text, but same entity "Alice")
      mockNeo4jService.findDocumentByText.mockResolvedValueOnce(null);
      mockNeo4jService.createDocument.mockResolvedValueOnce({
        id: 'doc2',
        label: 'Document',
        properties: { text: 'Alice knows Bob.', scopeId: 'tenant-1' },
      });

      // Mock entity lookup: "Alice" entity already exists
      mockNeo4jService.findEntityByName = mock((name: string, scopeId: string) => {
        if (name === 'Alice') {
          return Promise.resolve({
            id: 'entity-alice',
            label: 'Person',
            properties: { name: 'Alice', scopeId: 'tenant-1' },
          });
        }
        return Promise.resolve(null);
      });

      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope,
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      // Learn from first document
      await akasha.learn('Alice works for Acme Corp.');

      // Learn from second document (should reuse Alice entity)
      const result2 = await akasha.learn('Alice knows Bob.');

      // Should link existing Alice entity to second document
      const linkCalls = mockNeo4jService.linkEntityToDocument.mock.calls;
      const aliceLinks = linkCalls.filter((call: any[]) => call[1] === 'entity-alice');
      expect(aliceLinks.length).toBeGreaterThanOrEqual(1); // Alice linked to at least one document
    });
  });

  describe('Query Strategy', () => {
    beforeEach(() => {
      mockNeo4jService.findEntitiesByVector.mockClear();
      mockNeo4jService.findDocumentsByVector.mockClear();
      mockNeo4jService.retrieveSubgraph.mockClear();
      mockEmbeddingService.generateEmbedding.mockClear();
    });

    it('should use "both" strategy by default (documents and entities)', async () => {
      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope: { id: 'tenant-1', type: 'tenant', name: 'Test Tenant' },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      await akasha.ask('What is Alice?');

      // Should search both documents and entities
      expect(mockNeo4jService.findDocumentsByVector).toHaveBeenCalled();
      expect(mockNeo4jService.findEntitiesByVector).toHaveBeenCalled();
    });

    it('should use "documents" strategy when specified', async () => {
      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope: { id: 'tenant-1', type: 'tenant', name: 'Test Tenant' },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      await akasha.ask('What is Alice?', { strategy: 'documents' });

      // Should only search documents
      expect(mockNeo4jService.findDocumentsByVector).toHaveBeenCalled();
      expect(mockNeo4jService.findEntitiesByVector).not.toHaveBeenCalled();
    });

    it('should use "entities" strategy when specified', async () => {
      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope: { id: 'tenant-1', type: 'tenant', name: 'Test Tenant' },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      await akasha.ask('What is Alice?', { strategy: 'entities' });

      // Should only search entities
      expect(mockNeo4jService.findDocumentsByVector).not.toHaveBeenCalled();
      expect(mockNeo4jService.findEntitiesByVector).toHaveBeenCalled();
    });

    it('should include documents in response when strategy includes documents', async () => {
      const akasha = new Akasha({
        neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' },
        scope: { id: 'tenant-1', type: 'tenant', name: 'Test Tenant' },
      }, mockNeo4jService as any, mockEmbeddingService as any);

      await akasha.initialize();

      const result = await akasha.ask('What is Alice?', { strategy: 'both' });

      // Should include documents in response
      expect(result.context).toHaveProperty('documents');
      expect(Array.isArray(result.context.documents)).toBe(true);
    });
  });
});

