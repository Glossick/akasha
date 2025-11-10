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
const mockNeo4jService = {
  connect: mock(() => Promise.resolve()),
  disconnect: mock(() => Promise.resolve()),
  ensureVectorIndex: mock(() => Promise.resolve()),
  getSession: mock(() => mockSession),
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
    mockNeo4jService.listEntities.mockClear();
    mockNeo4jService.listRelationships.mockClear();
    mockNeo4jService.listDocuments.mockClear();
  });

  const scope: Scope = {
    id: 'tenant-1',
    type: 'tenant',
    name: 'Test Tenant',
  };

  describe('listEntities', () => {
    it('should list all entities with default options', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const result = await akasha.listEntities();

      expect(result.length).toBe(2);
      expect(mockNeo4jService.listEntities).toHaveBeenCalledWith(
        undefined, // label
        100, // limit (default)
        0, // offset (default)
        'tenant-1' // scopeId
      );
    });

    it('should filter entities by label', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListEntitiesOptions = {
        label: 'Person',
      };

      await akasha.listEntities(options);

      expect(mockNeo4jService.listEntities).toHaveBeenCalledWith(
        'Person',
        100,
        0,
        'tenant-1'
      );
    });

    it('should support pagination with limit and offset', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListEntitiesOptions = {
        limit: 50,
        offset: 10,
      };

      await akasha.listEntities(options);

      expect(mockNeo4jService.listEntities).toHaveBeenCalledWith(
        undefined,
        50,
        10,
        'tenant-1'
      );
    });

    it('should respect scope filtering', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      await akasha.listEntities();

      expect(mockNeo4jService.listEntities).toHaveBeenCalledWith(
        undefined,
        100,
        0,
        'tenant-1'
      );
    });

    it('should work without scope', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        // No scope
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      await akasha.listEntities();

      expect(mockNeo4jService.listEntities).toHaveBeenCalledWith(
        undefined,
        100,
        0,
        undefined
      );
    });

    it('should handle includeEmbeddings option', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListEntitiesOptions = {
        includeEmbeddings: true,
      };

      const result = await akasha.listEntities(options);

      // Note: includeEmbeddings is handled at the service layer
      expect(mockNeo4jService.listEntities).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('listRelationships', () => {
    it('should list all relationships with default options', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const result = await akasha.listRelationships();

      expect(result.length).toBe(1);
      expect(mockNeo4jService.listRelationships).toHaveBeenCalledWith(
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
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListRelationshipsOptions = {
        type: 'WORKS_FOR',
      };

      await akasha.listRelationships(options);

      expect(mockNeo4jService.listRelationships).toHaveBeenCalledWith(
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
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListRelationshipsOptions = {
        fromId: 'entity-1',
        toId: 'entity-2',
      };

      await akasha.listRelationships(options);

      expect(mockNeo4jService.listRelationships).toHaveBeenCalledWith(
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
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListRelationshipsOptions = {
        limit: 25,
        offset: 5,
      };

      await akasha.listRelationships(options);

      expect(mockNeo4jService.listRelationships).toHaveBeenCalledWith(
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
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      await akasha.listRelationships();

      expect(mockNeo4jService.listRelationships).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        100,
        0,
        'tenant-1'
      );
    });
  });

  describe('listDocuments', () => {
    it('should list all documents with default options', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const result = await akasha.listDocuments();

      expect(result.length).toBe(1);
      expect(mockNeo4jService.listDocuments).toHaveBeenCalledWith(
        100, // limit
        0, // offset
        'tenant-1' // scopeId
      );
    });

    it('should support pagination', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      const options: ListDocumentsOptions = {
        limit: 20,
        offset: 5,
      };

      await akasha.listDocuments(options);

      expect(mockNeo4jService.listDocuments).toHaveBeenCalledWith(
        20,
        5,
        'tenant-1'
      );
    });

    it('should respect scope filtering', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope,
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      await akasha.listDocuments();

      expect(mockNeo4jService.listDocuments).toHaveBeenCalledWith(
        100,
        0,
        'tenant-1'
      );
    });

    it('should work without scope', async () => {
      const akasha = new Akasha({
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        // No scope
      }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider);

      await akasha.initialize();

      await akasha.listDocuments();

      expect(mockNeo4jService.listDocuments).toHaveBeenCalledWith(
        100,
        0,
        undefined
      );
    });
  });
});

