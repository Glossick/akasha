import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { Akasha } from '../akasha';
import type { Scope, QueryStatistics } from '../types';
import type { EmbeddingProvider, LLMProvider } from '../services/providers/interfaces';

const mockSession = {
  run: mock(() => Promise.resolve({
    records: [],
  })),
  close: mock(() => Promise.resolve()),
} as any;

const mockDatabaseProvider = {
  connect: mock(() => Promise.resolve()),
  disconnect: mock(() => Promise.resolve()),
  ensureVectorIndex: mock(() => Promise.resolve()),
  findEntitiesByVector: mock(() => Promise.resolve([
    { id: '1', label: 'Person', properties: { name: 'Alice', scopeId: 'tenant-1', _similarity: 0.9 } },
  ])),
  findDocumentsByVector: mock(() => Promise.resolve([
    { id: 'doc1', label: 'Document', properties: { text: 'Alice works for Acme Corp.', scopeId: 'tenant-1', _similarity: 0.9 } },
  ])),
  retrieveSubgraph: mock(() => Promise.resolve({
    entities: [
      { id: '1', label: 'Person', properties: { name: 'Alice', scopeId: 'tenant-1' } },
    ],
    relationships: [
      { id: 'r1', type: 'KNOWS', from: '1', to: '2', properties: { scopeId: 'tenant-1' } },
    ],
  })),
  getEntitiesFromDocuments: mock(() => Promise.resolve([])),
  ping: mock(() => Promise.resolve(true)),
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
  listEntities: mock(() => Promise.resolve([])),
  findRelationshipById: mock(() => Promise.resolve(null)),
  updateRelationship: mock(() => Promise.resolve({ id: '1', type: 'REL', from: '1', to: '2', properties: {} })),
  deleteRelationship: mock(() => Promise.resolve({ deleted: true, message: 'Deleted' })),
  listRelationships: mock(() => Promise.resolve([])),
  findDocumentById: mock(() => Promise.resolve(null)),
  updateDocument: mock(() => Promise.resolve({ id: 'doc1', label: 'Document', properties: {} })),
  deleteDocument: mock(() => Promise.resolve({ deleted: true, message: 'Deleted' })),
  listDocuments: mock(() => Promise.resolve([])),
} as any;

// Mock providers
const mockEmbeddingProvider: EmbeddingProvider = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  generateEmbedding: mock(() => Promise.resolve(new Array(1536).fill(0.1))),
  generateEmbeddings: mock(() => Promise.resolve([new Array(1536).fill(0.1)])),
} as any;

const mockLLMProvider: LLMProvider = {
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
} as any;

describe('Akasha - Query Statistics', () => {
  beforeEach(() => {
    mockDatabaseProvider.findEntitiesByVector.mockClear();
    mockDatabaseProvider.findDocumentsByVector.mockClear();
    mockDatabaseProvider.retrieveSubgraph.mockClear();
    mockEmbeddingProvider.generateEmbedding.mockClear();
    mockLLMProvider.generateResponse.mockClear();
  });

  const scope: Scope = {
    id: 'tenant-1',
    type: 'tenant',
    name: 'Test Tenant',
  };

  it('should include statistics when includeStats is true', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
    }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

    await akasha.initialize();

    const result = await akasha.ask('Who is Alice?', {
      includeStats: true,
    });

    expect(result.statistics).toBeDefined();
    const stats = result.statistics as QueryStatistics;
    expect(stats.totalTimeMs).toBeGreaterThanOrEqual(0);
    expect(stats.searchTimeMs).toBeGreaterThanOrEqual(0);
    expect(stats.subgraphRetrievalTimeMs).toBeGreaterThanOrEqual(0);
    expect(stats.llmGenerationTimeMs).toBeGreaterThanOrEqual(0);
    expect(stats.entitiesFound).toBeGreaterThanOrEqual(0);
    expect(stats.relationshipsFound).toBeGreaterThanOrEqual(0);
    expect(stats.strategy).toBeDefined();
  });

  it('should not include statistics when includeStats is false', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
    }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

    await akasha.initialize();

    const result = await akasha.ask('Who is Alice?', {
      includeStats: false,
    });

    expect(result.statistics).toBeUndefined();
  });

  it('should not include statistics by default', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
    }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

    await akasha.initialize();

    const result = await akasha.ask('Who is Alice?');

    expect(result.statistics).toBeUndefined();
  });

  it('should include correct entity and relationship counts', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
    }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

    await akasha.initialize();

    const result = await akasha.ask('Who is Alice?', {
      includeStats: true,
    });

    expect(result.statistics).toBeDefined();
    const stats = result.statistics as QueryStatistics;
    expect(stats.entitiesFound).toBe(result.context.entities.length);
    expect(stats.relationshipsFound).toBe(result.context.relationships.length);
  });

  it('should include document count when strategy includes documents', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
    }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

    await akasha.initialize();

    const result = await akasha.ask('Who is Alice?', {
      includeStats: true,
      strategy: 'both',
    });

    expect(result.statistics).toBeDefined();
    const stats = result.statistics as QueryStatistics;
    expect(stats.documentsFound).toBeDefined();
    if (result.context.documents) {
      expect(stats.documentsFound).toBe(result.context.documents.length);
    }
  });

  it('should include correct strategy in statistics', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
    }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

    await akasha.initialize();

    const result1 = await akasha.ask('Who is Alice?', {
      includeStats: true,
      strategy: 'entities',
    });

    expect(result1.statistics?.strategy).toBe('entities');

    const result2 = await akasha.ask('Who is Alice?', {
      includeStats: true,
      strategy: 'documents',
    });

    expect(result2.statistics?.strategy).toBe('documents');

    const result3 = await akasha.ask('Who is Alice?', {
      includeStats: true,
      strategy: 'both',
    });

    expect(result3.statistics?.strategy).toBe('both');
  });

  it('should have totalTimeMs equal to sum of component times', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
    }, mockDatabaseProvider as any, mockEmbeddingProvider, mockLLMProvider);

    await akasha.initialize();

    const result = await akasha.ask('Who is Alice?', {
      includeStats: true,
    });

    expect(result.statistics).toBeDefined();
    const stats = result.statistics as QueryStatistics;
    // Total time should be approximately equal to sum (allowing for small timing differences)
    const sum = stats.searchTimeMs + stats.subgraphRetrievalTimeMs + stats.llmGenerationTimeMs;
    expect(stats.totalTimeMs).toBeGreaterThanOrEqual(sum - 10); // Allow 10ms tolerance
  });
});

