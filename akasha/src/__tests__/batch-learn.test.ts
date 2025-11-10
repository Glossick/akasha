import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { Akasha } from '../akasha';
import type { Scope, BatchLearnItem, BatchLearnResult } from '../types';
import type { EmbeddingProvider, LLMProvider } from '../services/providers/interfaces';

// Mock session
const mockSession = {
  run: mock(() => Promise.resolve({
    records: [],
  })),
  close: mock(() => Promise.resolve()),
} as any;

// Track state for mocks
let lastFoundDocument: any = null;
let lastFoundEntity: any = null;

const mockNeo4jService = {
  connect: mock(() => Promise.resolve()),
  disconnect: mock(() => Promise.resolve()),
  ensureVectorIndex: mock(() => Promise.resolve()),
  getSession: mock(() => mockSession),
  findDocumentByText: mock(async (text: string, scopeId: string) => {
    return Promise.resolve(lastFoundDocument || null);
  }),
  createDocument: mock((doc: any) => Promise.resolve({
    id: `doc-${Date.now()}`,
    label: 'Document',
    properties: doc.properties || { text: doc.properties?.text || '', scopeId: 'tenant-1' },
  })),
  findEntityByName: mock(async (name: string, scopeId: string) => {
    return Promise.resolve(lastFoundEntity || null);
  }),
  createEntities: mock((entities: any[]) => Promise.resolve(
    entities.map((entity, idx) => ({
      id: String(idx + 1),
      label: entity.label || 'Person',
      properties: entity.properties || { name: 'Test', scopeId: 'tenant-1' },
    }))
  )),
  createRelationships: mock(() => Promise.resolve([
    { id: 'r1', type: 'KNOWS', from: '1', to: '2', properties: { scopeId: 'tenant-1' } },
  ])),
  linkEntityToDocument: mock(() => Promise.resolve({
    id: 'rel1',
    type: 'CONTAINS_ENTITY',
    from: 'doc1',
    to: '1',
    properties: {},
  })),
  updateDocumentContextIds: mock((docId: string, contextId: string) => {
    if (lastFoundDocument) {
      const existingContextIds = lastFoundDocument.properties?.contextIds || [];
      const newContextIds = existingContextIds.includes(contextId)
        ? existingContextIds
        : [...existingContextIds, contextId];
      return Promise.resolve({
        ...lastFoundDocument,
        properties: {
          ...lastFoundDocument.properties,
          contextIds: newContextIds,
        },
      });
    }
    return Promise.resolve({
      id: docId,
      label: 'Document',
      properties: { contextIds: [contextId] },
    });
  }),
  updateEntityContextIds: mock((entityId: string, contextId: string) => {
    if (lastFoundEntity) {
      const existingContextIds = lastFoundEntity.properties?.contextIds || [];
      const newContextIds = existingContextIds.includes(contextId)
        ? existingContextIds
        : [...existingContextIds, contextId];
      return Promise.resolve({
        ...lastFoundEntity,
        properties: {
          ...lastFoundEntity.properties,
          contextIds: newContextIds,
        },
      });
    }
    return Promise.resolve({
      id: entityId,
      label: 'Person',
      properties: { contextIds: [contextId] },
    });
  }),
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

describe('Akasha - Batch Learning', () => {
  beforeEach(() => {
    lastFoundDocument = null;
    lastFoundEntity = null;
    mockNeo4jService.findDocumentByText.mockClear();
    mockNeo4jService.createDocument.mockClear();
    mockNeo4jService.findEntityByName.mockClear();
    mockNeo4jService.createEntities.mockClear();
    mockNeo4jService.createRelationships.mockClear();
    mockEmbeddingProvider.generateEmbedding.mockClear();
    mockLLMProvider.generateResponse.mockClear();
  });

  const scope: Scope = {
    id: 'tenant-1',
    type: 'tenant',
    name: 'Test Tenant',
  };

  it('should learn multiple texts in batch', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
    }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider as any);

    await akasha.initialize();

    const texts = [
      'Alice works for Acme Corp.',
      'Bob works for TechCorp.',
      'Charlie works for StartupCo.',
    ];

    const result = await akasha.learnBatch(texts, {
      contextName: 'Batch Test',
    });

    expect(result.summary.total).toBe(3);
    expect(result.summary.succeeded).toBe(3);
    expect(result.summary.failed).toBe(0);
    expect(result.results.length).toBe(3);
    expect(result.errors).toBeUndefined();

    // Verify all texts were processed
    expect(mockNeo4jService.findDocumentByText).toHaveBeenCalledTimes(3);
    expect(mockLLMProvider.generateResponse).toHaveBeenCalledTimes(3);
  });

  it('should aggregate statistics correctly', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
    }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider as any);

    await akasha.initialize();

    const texts = [
      'Alice works for Acme Corp.',
      'Bob works for TechCorp.',
    ];

    const result = await akasha.learnBatch(texts);

    expect(result.summary.totalDocumentsCreated).toBeGreaterThanOrEqual(0);
    expect(result.summary.totalEntitiesCreated).toBeGreaterThanOrEqual(0);
    expect(result.summary.totalRelationshipsCreated).toBeGreaterThanOrEqual(0);
    expect(result.summary.totalDocumentsCreated + result.summary.totalDocumentsReused).toBe(2);
  });

  it('should handle batch learning with per-item options', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
    }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider as any);

    await akasha.initialize();

    const items: BatchLearnItem[] = [
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

    const result = await akasha.learnBatch(items);

    expect(result.summary.total).toBe(2);
    expect(result.summary.succeeded).toBe(2);
    expect(result.results.length).toBe(2);
  });

  it('should handle errors gracefully and continue processing', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
    }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider as any);

    await akasha.initialize();

    // Make one call fail
    mockEmbeddingProvider, mockLLMProvider.generateResponse.mockImplementationOnce(() => {
      throw new Error('LLM error');
    });

    const texts = [
      'Alice works for Acme Corp.',
      'Bob works for TechCorp.',
      'Charlie works for StartupCo.',
    ];

    const result = await akasha.learnBatch(texts);

    expect(result.summary.total).toBe(3);
    expect(result.summary.succeeded).toBe(2);
    expect(result.summary.failed).toBe(1);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(1);
    expect(result.errors?.[0].index).toBe(0);
    expect(result.errors?.[0].error).toContain('LLM error');
  });

  it('should require scope for batch learning', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      // No scope
    }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider as any);

    await akasha.initialize();

    await expect(akasha.learnBatch(['Test text'])).rejects.toThrow('Scope is required');
  });

  it('should handle empty batch', async () => {
    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
    }, mockNeo4jService as any, mockEmbeddingProvider, mockLLMProvider as any);

    await akasha.initialize();

    const result = await akasha.learnBatch([]);

    expect(result.summary.total).toBe(0);
    expect(result.summary.succeeded).toBe(0);
    expect(result.summary.failed).toBe(0);
    expect(result.results.length).toBe(0);
  });
});

