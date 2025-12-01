/**
 * Test helpers for mocking providers and creating test configurations
 */

import { describe, mock } from 'bun:test';
import type { AkashaConfig } from '../types';
import type { EmbeddingProvider, LLMProvider } from '../services/providers/interfaces';
import type { DatabaseProvider } from '../services/providers/database/interfaces';
import type { Entity, Relationship, Document } from '../types';

/**
 * Create a mock embedding provider
 */
export function createMockEmbeddingProvider(): EmbeddingProvider {
  return {
    provider: 'test',
    model: 'test-embedding',
    dimensions: 1536,
    generateEmbedding: async (text: string) => {
      return new Array(1536).fill(0).map((_, i) => i * 0.001);
    },
    generateEmbeddings: async (texts: string[]) => {
      return texts.map(() => new Array(1536).fill(0).map((_, i) => i * 0.001));
    },
  };
}

/**
 * Create a mock LLM provider
 */
export function createMockLLMProvider(): LLMProvider {
  return {
    provider: 'test',
    model: 'test-llm',
    generateResponse: async (prompt: string, context: string, systemMessage?: string, temperature?: number) => {
      // Check if this is an extraction prompt (contains "extract" or asks for JSON)
      if (prompt.includes('extract') || prompt.includes('JSON') || prompt.includes('entities') || prompt.includes('relationships')) {
        // Return valid JSON for extraction
        return JSON.stringify({
          entities: [
            { label: 'Person', properties: { name: 'Alice' } },
            { label: 'Company', properties: { name: 'Acme Corp' } },
          ],
          relationships: [
            { from: 'Alice', to: 'Acme Corp', type: 'WORKS_FOR', properties: {} },
          ],
        });
      }
      // Default response for queries
      return 'Test response';
    },
  };
}

/**
 * Create a valid test configuration with providers
 */
export function createTestConfig(overrides?: Partial<AkashaConfig>): AkashaConfig {
  return {
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
    ...overrides,
  };
}

/**
 * Create a config with Anthropic LLM provider (for multi-provider tests)
 */
export function createAnthropicConfig(overrides?: Partial<AkashaConfig>): AkashaConfig {
  return {
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
        type: 'anthropic',
        config: {
          apiKey: 'test-key',
          model: 'claude-3-5-sonnet-20241022',
        },
      },
    },
    ...overrides,
  };
}

/**
 * Create a mock database provider
 */
export function createMockDatabaseProvider(): DatabaseProvider {
  return {
    connect: mock(() => Promise.resolve()),
    disconnect: mock(() => Promise.resolve()),
    ensureVectorIndex: mock(() => Promise.resolve()),
    findEntitiesByVector: mock(() => Promise.resolve([])),
    findDocumentsByVector: mock(() => Promise.resolve([])),
    retrieveSubgraph: mock(() => Promise.resolve({ entities: [], relationships: [] })),
    createEntities: mock(() => Promise.resolve([])),
    findEntityByName: mock(() => Promise.resolve(null)),
    findEntityById: mock(() => Promise.resolve(null)),
    updateEntity: mock(() => Promise.resolve({ id: '1', label: 'Entity', properties: {} })),
    updateEntityContextIds: mock(() => Promise.resolve({ id: '1', label: 'Entity', properties: {} })),
    deleteEntity: mock(() => Promise.resolve({ deleted: true, message: 'Deleted' })),
    listEntities: mock(() => Promise.resolve([])),
    createRelationships: mock(() => Promise.resolve([])),
    findRelationshipById: mock(() => Promise.resolve(null)),
    updateRelationship: mock(() => Promise.resolve({ id: '1', type: 'REL', from: '1', to: '2', properties: {} })),
    deleteRelationship: mock(() => Promise.resolve({ deleted: true, message: 'Deleted' })),
    listRelationships: mock(() => Promise.resolve([])),
    createDocument: mock(() => Promise.resolve({ id: '1', label: 'Document', properties: { text: '', scopeId: '' } })),
    findDocumentByText: mock(() => Promise.resolve(null)),
    findDocumentById: mock(() => Promise.resolve(null)),
    updateDocument: mock(() => Promise.resolve({ id: '1', label: 'Document', properties: { text: '', scopeId: '' } })),
    updateDocumentContextIds: mock(() => Promise.resolve({ id: '1', label: 'Document', properties: { text: '', scopeId: '' } })),
    deleteDocument: mock(() => Promise.resolve({ deleted: true, message: 'Deleted' })),
    listDocuments: mock(() => Promise.resolve([])),
    linkEntityToDocument: mock(() => Promise.resolve({ id: '1', type: 'CONTAINS_ENTITY', from: '1', to: '2', properties: {} })),
    getEntitiesFromDocuments: mock(() => Promise.resolve([])),
    ping: mock(() => Promise.resolve(true)),
  } as any;
}

