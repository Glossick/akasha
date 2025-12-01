import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { Akasha } from '../akasha';
import type { Scope, BatchProgress, BatchProgressCallback } from '../types';
import type { EmbeddingProvider, LLMProvider } from '../services/providers/interfaces';

// Mock session
const mockSession = {
  run: mock(() => Promise.resolve({
    records: [],
  })),
  close: mock(() => Promise.resolve()),
} as any;

// Track state for update mocks
let lastFoundDocument: any = null;
let lastFoundEntity: any = null;

// Mock dependencies
const mockDatabaseProvider = {
  connect: mock(() => Promise.resolve()),
  disconnect: mock(() => Promise.resolve()),
  ensureVectorIndex: mock(() => Promise.resolve()),
  getEntitiesFromDocuments: mock(() => Promise.resolve([])),
  ping: mock(() => Promise.resolve(true)),
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
  createEntities: mock((entities: any[]) => Promise.resolve(
    entities.map((entity, idx) => ({
      id: String(idx + 1),
      label: entity.label || 'Person',
      properties: entity.properties || { name: 'Alice', scopeId: 'tenant-1' },
    }))
  )),
  createRelationships: mock(() => Promise.resolve([
    { id: 'r1', type: 'KNOWS', from: '1', to: '2', properties: { scopeId: 'tenant-1' } },
  ])),
  findDocumentByText: mock(async (text: string, scopeId: string) => {
    const result = lastFoundDocument || null;
    return Promise.resolve(result);
  }),
  createDocument: mock((doc: any) => Promise.resolve({
    id: 'doc1',
    label: 'Document',
    properties: doc.properties || { text: 'Alice works for Acme Corp.', scopeId: 'tenant-1' },
  })),
  linkEntityToDocument: mock(() => Promise.resolve({
    id: 'rel1',
    type: 'CONTAINS_ENTITY',
    from: 'doc1',
    to: '1',
    properties: {},
  })),
  findEntityByName: mock(async (name: string, scopeId: string) => {
    const result = lastFoundEntity || null;
    return Promise.resolve(result);
  }),
  updateDocumentContextIds: mock((docId: string, contextId: string) => {
    if (lastFoundDocument) {
      const existingContextIds = lastFoundDocument.properties?.contextIds || [];
      const newContextIds = existingContextIds.includes(contextId)
        ? existingContextIds
        : [...existingContextIds, contextId];
      const updated = {
        ...lastFoundDocument,
        properties: {
          ...lastFoundDocument.properties,
          contextIds: newContextIds,
        },
      };
      lastFoundDocument = updated;
      return Promise.resolve(updated);
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

      const updated = {
        ...lastFoundEntity,
        properties: {
          ...lastFoundEntity.properties,
          contextIds: newContextIds,
        },
      };
      lastFoundEntity = updated;
      return Promise.resolve(updated);
    }
    return Promise.resolve({
      id: entityId,
      label: 'Person',
      properties: { contextIds: [contextId] },
    });
  }),
  // Additional DatabaseProvider methods
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
  generateResponse: mock((prompt: string, context: string, systemPrompt?: string) => {
    // Return JSON for extraction requests
    if (prompt.includes('Extract all entities')) {
      return Promise.resolve(JSON.stringify({
        entities: [
          { label: 'Person', properties: { name: 'Alice' } },
          { label: 'Company', properties: { name: 'Acme Corp' } },
        ],
        relationships: [
          { from: 'Alice', to: 'Acme Corp', type: 'WORKS_FOR' },
        ],
      }));
    }
    return Promise.resolve('Test response');
  }),
} as any;

describe('Akasha - Progress Callbacks', () => {
  beforeEach(() => {
    lastFoundDocument = null;
    lastFoundEntity = null;
    mockDatabaseProvider.createEntities.mockClear();
    mockDatabaseProvider.createRelationships.mockClear();
    mockDatabaseProvider.createDocument.mockClear();
    mockEmbeddingProvider.generateEmbedding.mockClear();
    mockLLMProvider.generateResponse.mockClear();
  });

  const scope: Scope = {
    id: 'tenant-1',
    type: 'tenant',
    name: 'Test Tenant',
  };

  it('should call progress callback for each item', async () => {
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

    const progressCalls: BatchProgress[] = [];
    const onProgress: BatchProgressCallback = (progress) => {
      progressCalls.push(progress);
    };

    const texts = [
      'Alice works for Acme Corp.',
      'Bob works for TechCorp.',
      'Charlie works for StartupCo.',
    ];

    await akasha.learnBatch(texts, { onProgress });

    // Should be called for each item (3 items = 3 calls)
    expect(progressCalls.length).toBe(3);

    // First call
    expect(progressCalls[0].current).toBe(0);
    expect(progressCalls[0].total).toBe(3);
    expect(progressCalls[0].completed).toBe(1);
    expect(progressCalls[0].failed).toBe(0);
    expect(progressCalls[0].currentText).toBeDefined();

    // Second call
    expect(progressCalls[1].current).toBe(1);
    expect(progressCalls[1].total).toBe(3);
    expect(progressCalls[1].completed).toBe(2);
    expect(progressCalls[1].failed).toBe(0);

    // Third call
    expect(progressCalls[2].current).toBe(2);
    expect(progressCalls[2].total).toBe(3);
    expect(progressCalls[2].completed).toBe(3);
    expect(progressCalls[2].failed).toBe(0);
  });

  it('should include failed count in progress when errors occur', async () => {
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

    const progressCalls: BatchProgress[] = [];
    const onProgress: BatchProgressCallback = (progress) => {
      progressCalls.push(progress);
    };

    // Make one call fail
    mockLLMProvider.generateResponse.mockImplementationOnce(() => {
      throw new Error('LLM error');
    });

    const texts = [
      'Alice works for Acme Corp.',
      'Bob works for TechCorp.',
      'Charlie works for StartupCo.',
    ];

    await akasha.learnBatch(texts, { onProgress });

    // Should still be called 3 times
    expect(progressCalls.length).toBe(3);

    // First call (failed)
    expect(progressCalls[0].completed).toBe(0);
    expect(progressCalls[0].failed).toBe(1);

    // Second call (succeeded)
    expect(progressCalls[1].completed).toBe(1);
    expect(progressCalls[1].failed).toBe(1);

    // Third call (succeeded)
    expect(progressCalls[2].completed).toBe(2);
    expect(progressCalls[2].failed).toBe(1);
  });

  it('should truncate long text in progress callback', async () => {
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

    const progressCalls: BatchProgress[] = [];
    const onProgress: BatchProgressCallback = (progress) => {
      progressCalls.push(progress);
    };

    const longText = 'A'.repeat(500); // Very long text
    const texts = [longText];

    await akasha.learnBatch(texts, { onProgress });

    expect(progressCalls.length).toBe(1);
    expect(progressCalls[0].currentText).toBeDefined();
    // Text should be truncated (e.g., max 200 chars)
    if (progressCalls[0].currentText) {
      expect(progressCalls[0].currentText.length).toBeLessThanOrEqual(250);
    }
  });

  it('should calculate estimated time remaining', async () => {
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

    const progressCalls: BatchProgress[] = [];
    const onProgress: BatchProgressCallback = (progress) => {
      progressCalls.push(progress);
    };

    const texts = [
      'Alice works for Acme Corp.',
      'Bob works for TechCorp.',
      'Charlie works for StartupCo.',
    ];

    await akasha.learnBatch(texts, { onProgress });

    // After first item, should have estimated time
    if (progressCalls.length > 1) {
      // Estimated time should be present after first item
      expect(progressCalls[1].estimatedTimeRemainingMs).toBeDefined();
      expect(typeof progressCalls[1].estimatedTimeRemainingMs).toBe('number');
    }
  });

  it('should work without progress callback', async () => {
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

    const texts = ['Alice works for Acme Corp.'];

    // Should not throw when no callback provided
    const result = await akasha.learnBatch(texts);

    expect(result.summary.total).toBe(1);
    expect(result.summary.succeeded).toBe(1);
  });

  it('should handle async progress callback', async () => {
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

    const progressCalls: BatchProgress[] = [];
    const onProgress: BatchProgressCallback = async (progress) => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      progressCalls.push(progress);
    };

    const texts = [
      'Alice works for Acme Corp.',
      'Bob works for TechCorp.',
    ];

    await akasha.learnBatch(texts, { onProgress });

    // Should still be called for each item
    expect(progressCalls.length).toBe(2);
  });
});

