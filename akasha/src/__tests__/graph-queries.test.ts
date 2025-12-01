import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { Akasha } from '../akasha';
import type { Scope, ListEntitiesOptions, ListRelationshipsOptions, ListDocumentsOptions, Entity, Relationship, Document } from '../types';
import type { EmbeddingProvider, LLMProvider } from '../services/providers/interfaces';

// Mock session
const mockSession = {
  run: mock(() => Promise.resolve({
    records: [],
  })),
  close: mock(() => Promise.resolve()),
} as any;

// Mock dependencies
const mockDatabaseProvider = {
  connect: mock(() => Promise.resolve()),
  disconnect: mock(() => Promise.resolve()),
  ensureVectorIndex: mock(() => Promise.resolve()),
  listEntities: mock(() => Promise.resolve([
    { id: '1', label: 'Person', properties: { name: 'Alice', scopeId: 'tenant-1' } },
    { id: '2', label: 'Person', properties: { name: 'Bob', scopeId: 'tenant-1' } },
  ])),
  listRelationships: mock(() => Promise.resolve([
    { id: 'r1', type: 'WORKS_FOR', from: '1', to: '2', properties: { scopeId: 'tenant-1' } },
  ])),
  listDocuments: mock(() => Promise.resolve([
    { id: 'doc1', label: 'Document', properties: { text: 'Test document', scopeId: 'tenant-1' } },
  ])),
  getEntitiesFromDocuments: mock(() => Promise.resolve([])),
  ping: mock(() => Promise.resolve(true)),
  findEntitiesByVector: mock(() => Promise.resolve([])),
  findDocumentsByVector: mock(() => Promise.resolve([])),
  retrieveSubgraph: mock(() => Promise.resolve({ entities: [], relationships: [] })),
  createEntities: mock(() => Promise.resolve([])),
  createRelationships: mock(() => Promise.resolve([])),
  createDocument: mock(() => Promise.resolve({ id: 'doc1', label: 'Document', properties: {} })),
  linkEntityToDocument: mock(() => Promise.resolve({ id: 'rel1', type: 'CONTAINS_ENTITY', from: 'doc1', to: '1', properties: {} })),
  findEntityByName: mock(() => Promise.resolve(null)),
  findDocumentByText: mock(() => Promise.resolve(null)),
  updateDocumentContextIds: mock(() => Promise.resolve({ id: 'doc1', label: 'Document', properties: {} })),
  updateEntityContextIds: mock(() => Promise.resolve({ id: '1', label: 'Entity', properties: {} })),
  findEntityById: mock(() => Promise.resolve(null)),
  updateEntity: mock(() => Promise.resolve({ id: '1', label: 'Entity', properties: {} })),
  deleteEntity: mock(() => Promise.resolve({ deleted: true, message: 'Deleted' })),
  findRelationshipById: mock(() => Promise.resolve(null)),
  updateRelationship: mock(() => Promise.resolve({ id: '1', type: 'REL', from: '1', to: '2', properties: {} })),
  deleteRelationship: mock(() => Promise.resolve({ deleted: true, message: 'Deleted' })),
  findDocumentById: mock(() => Promise.resolve(null)),
  updateDocument: mock(() => Promise.resolve({ id: 'doc1', label: 'Document', properties: {} })),
  deleteDocument: mock(() => Promise.resolve({ deleted: true, message: 'Deleted' })),
} as any;

// Mock providers
const mockEmbeddingProvider = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  generateEmbedding: mock(() => Promise.resolve(new Array(1536).fill(0.1))),
  generateEmbeddings: mock(() => Promise.resolve([new Array(1536).fill(0.1)])),
};

const mockLLMProvider = {
  provider: 'openai',
  model: 'gpt-4',
  generateResponse: mock((prompt, context, systemMessage) => {
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
    return Promise.resolve('Test answer');
  }),
};

describe('Akasha - Direct Graph Queries', () => {
  beforeEach(() => {
    mockDatabaseProvider.listEntities.mockClear();
    mockDatabaseProvider.listRelationships.mockClear();
    mockDatabaseProvider.listDocuments.mockClear();
  });

  const scope: Scope = {
    id: 'tenant-1',
    type: 'tenant',
    name: 'Test Tenant',
  };

  describe('listEntities', () => {
    it('should list all entities with default options', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const result = await akasha.listEntities();

      expect(result.length).toBe(2);
      expect(mockDatabaseProvider.listEntities).toHaveBeenCalledWith(
        undefined, // label
        100, // limit (default)
        0, // offset (default)
        'tenant-1' // scopeId
      );
    });

    it('should filter entities by label', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListEntitiesOptions = {
        label: 'Person',
      };

      await akasha.listEntities(options);

      expect(mockDatabaseProvider.listEntities).toHaveBeenCalledWith(
        'Person',
        100,
        0,
        'tenant-1'
      );
    });

    it('should support pagination with limit and offset', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListEntitiesOptions = {
        limit: 50,
        offset: 10,
      };

      await akasha.listEntities(options);

      expect(mockDatabaseProvider.listEntities).toHaveBeenCalledWith(
        undefined,
        50,
        10,
        'tenant-1'
      );
    });

    it('should respect scope filtering', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      await akasha.listEntities();

      expect(mockDatabaseProvider.listEntities).toHaveBeenCalledWith(
        undefined,
        100,
        0,
        'tenant-1'
      );
    });

    it('should work without scope', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        // No scope
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      await akasha.listEntities();

      expect(mockDatabaseProvider.listEntities).toHaveBeenCalledWith(
        undefined,
        100,
        0,
        undefined
      );
    });

    it('should scrub embeddings by default (includeEmbeddings: false or undefined)', async () => {
      // Setup: Mock database provider to return entities WITH embeddings
      mockDatabaseProvider.listEntities.mockResolvedValueOnce([
        { 
          id: '1', 
          label: 'Person', 
          properties: { 
            name: 'Alice', 
            scopeId: 'tenant-1',
            embedding: [0.1, 0.2, 0.3, 0.4] // Has embedding
          } 
        },
        { 
          id: '2', 
          label: 'Person', 
          properties: { 
            name: 'Bob', 
            scopeId: 'tenant-1',
            embedding: [0.5, 0.6, 0.7, 0.8] // Has embedding
          } 
        },
      ]);

      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      // Test 1: Default (includeEmbeddings: undefined)
      const result1 = await akasha.listEntities();
      expect(result1[0].properties.embedding).toBeUndefined();
      expect(result1[1].properties.embedding).toBeUndefined();
      expect(result1[0].properties.name).toBe('Alice'); // Other properties preserved

      // Reset mock
      mockDatabaseProvider.listEntities.mockResolvedValueOnce([
        { 
          id: '1', 
          label: 'Person', 
          properties: { 
            name: 'Alice', 
            scopeId: 'tenant-1',
            embedding: [0.1, 0.2, 0.3, 0.4]
          } 
        },
      ]);

      // Test 2: Explicitly false
      const result2 = await akasha.listEntities({ includeEmbeddings: false });
      expect(result2[0].properties.embedding).toBeUndefined();
    });

    it('should include embeddings when includeEmbeddings: true', async () => {
      mockDatabaseProvider.listEntities.mockResolvedValueOnce([
        { 
          id: '1', 
          label: 'Person', 
          properties: { 
            name: 'Alice', 
            scopeId: 'tenant-1',
            embedding: [0.1, 0.2, 0.3, 0.4]
          } 
        },
      ]);

      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const result = await akasha.listEntities({ includeEmbeddings: true });
      
      expect(result[0].properties.embedding).toBeDefined();
      expect(result[0].properties.embedding).toEqual([0.1, 0.2, 0.3, 0.4]);
      expect(result[0].properties.name).toBe('Alice'); // Other properties preserved
    });
  });

  describe('listRelationships', () => {
    it('should list all relationships with default options', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const result = await akasha.listRelationships();

      expect(result.length).toBe(1);
      expect(mockDatabaseProvider.listRelationships).toHaveBeenCalledWith(
        undefined, // type
        undefined, // fromId
        undefined, // toId
        100, // limit
        0, // offset
        'tenant-1' // scopeId
      );
    });

    it('should filter relationships by type', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListRelationshipsOptions = {
        type: 'WORKS_FOR',
      };

      await akasha.listRelationships(options);

      expect(mockDatabaseProvider.listRelationships).toHaveBeenCalledWith(
        'WORKS_FOR',
        undefined,
        undefined,
        100,
        0,
        'tenant-1'
      );
    });

    it('should filter relationships by fromId and toId', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListRelationshipsOptions = {
        fromId: 'entity-1',
        toId: 'entity-2',
      };

      await akasha.listRelationships(options);

      expect(mockDatabaseProvider.listRelationships).toHaveBeenCalledWith(
        undefined,
        'entity-1',
        'entity-2',
        100,
        0,
        'tenant-1'
      );
    });

    it('should support pagination', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListRelationshipsOptions = {
        limit: 25,
        offset: 5,
      };

      await akasha.listRelationships(options);

      expect(mockDatabaseProvider.listRelationships).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        25,
        5,
        'tenant-1'
      );
    });

    it('should respect scope filtering', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      await akasha.listRelationships();

      expect(mockDatabaseProvider.listRelationships).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        100,
        0,
        'tenant-1'
      );
    });

    it('should scrub embeddings from relationships by default', async () => {
      mockDatabaseProvider.listRelationships.mockResolvedValueOnce([
        { 
          id: 'r1', 
          type: 'WORKS_FOR', 
          from: '1', 
          to: '2', 
          properties: { 
            scopeId: 'tenant-1',
            embedding: [0.1, 0.2, 0.3] // Has embedding
          } 
        },
      ]);

      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const result = await akasha.listRelationships();
      
      expect(result[0].properties.embedding).toBeUndefined();
      expect(result[0].properties.scopeId).toBe('tenant-1'); // Other properties preserved
    });

    it('should include embeddings in relationships when includeEmbeddings: true', async () => {
      mockDatabaseProvider.listRelationships.mockResolvedValueOnce([
        { 
          id: 'r1', 
          type: 'WORKS_FOR', 
          from: '1', 
          to: '2', 
          properties: { 
            scopeId: 'tenant-1',
            embedding: [0.1, 0.2, 0.3]
          } 
        },
      ]);

      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const result = await akasha.listRelationships({ includeEmbeddings: true });
      
      expect(result[0].properties.embedding).toBeDefined();
      expect(result[0].properties.embedding).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe('listDocuments', () => {
    it('should list all documents with default options', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const result = await akasha.listDocuments();

      expect(result.length).toBe(1);
      expect(mockDatabaseProvider.listDocuments).toHaveBeenCalledWith(
        100, // limit
        0, // offset
        'tenant-1' // scopeId
      );
    });

    it('should support pagination', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListDocumentsOptions = {
        limit: 20,
        offset: 5,
      };

      await akasha.listDocuments(options);

      expect(mockDatabaseProvider.listDocuments).toHaveBeenCalledWith(
        20,
        5,
        'tenant-1'
      );
    });

    it('should scrub embeddings from documents by default', async () => {
      mockDatabaseProvider.listDocuments.mockResolvedValueOnce([
        { 
          id: 'doc1', 
          label: 'Document', 
          properties: { 
            text: 'Test document', 
            scopeId: 'tenant-1',
            embedding: [0.1, 0.2, 0.3, 0.4] // Has embedding
          } 
        },
      ]);

      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const result = await akasha.listDocuments();
      
      expect(result[0].properties.embedding).toBeUndefined();
      expect(result[0].properties.text).toBe('Test document'); // Other properties preserved
    });

    it('should include embeddings in documents when includeEmbeddings: true', async () => {
      mockDatabaseProvider.listDocuments.mockResolvedValueOnce([
        { 
          id: 'doc1', 
          label: 'Document', 
          properties: { 
            text: 'Test document', 
            scopeId: 'tenant-1',
            embedding: [0.1, 0.2, 0.3, 0.4]
          } 
        },
      ]);

      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const result = await akasha.listDocuments({ includeEmbeddings: true });
      
      expect(result[0].properties.embedding).toBeDefined();
      expect(result[0].properties.embedding).toEqual([0.1, 0.2, 0.3, 0.4]);
    });

    it('should respect scope filtering', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        scope,
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      await akasha.listDocuments();

      expect(mockDatabaseProvider.listDocuments).toHaveBeenCalledWith(
        100,
        0,
        'tenant-1'
      );
    });

    it('should work without scope', async () => {
      const akasha = new Akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'test-key',
              model: 'gpt-4',
            },
          },
        },
        // No scope
      }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      await akasha.listDocuments();

      expect(mockDatabaseProvider.listDocuments).toHaveBeenCalledWith(
        100,
        0,
        undefined
      );
    });
  });
});

