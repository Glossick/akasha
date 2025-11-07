import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { Akasha } from '../akasha';
import type { Scope, QueryStatistics } from '../types';

const mockSession = {
  run: mock(() => Promise.resolve({
    records: [],
  })),
  close: mock(() => Promise.resolve()),
} as any;

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
} as any;

const mockEmbeddingService = {
  generateEmbedding: mock(() => Promise.resolve(new Array(1536).fill(0.1))),
  generateResponse: mock(() => Promise.resolve('Test answer')),
} as any;

describe('Akasha - Query Statistics', () => {
  beforeEach(() => {
    mockNeo4jService.findEntitiesByVector.mockClear();
    mockNeo4jService.findDocumentsByVector.mockClear();
    mockNeo4jService.retrieveSubgraph.mockClear();
    mockEmbeddingService.generateEmbedding.mockClear();
    mockEmbeddingService.generateResponse.mockClear();
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
    }, mockNeo4jService as any, mockEmbeddingService as any);

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
    }, mockNeo4jService as any, mockEmbeddingService as any);

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
    }, mockNeo4jService as any, mockEmbeddingService as any);

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
    }, mockNeo4jService as any, mockEmbeddingService as any);

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
    }, mockNeo4jService as any, mockEmbeddingService as any);

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
    }, mockNeo4jService as any, mockEmbeddingService as any);

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
    }, mockNeo4jService as any, mockEmbeddingService as any);

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

