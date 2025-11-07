import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { Akasha } from '../akasha';
import type { Scope, HealthStatus } from '../types';

const mockSession = {
  run: mock(() => Promise.resolve({
    records: [],
  })),
  close: mock(() => Promise.resolve()),
} as any;

describe('Akasha - Health Check', () => {
  beforeEach(() => {
    mockSession.run.mockClear();
  });

  const scope: Scope = {
    id: 'tenant-1',
    type: 'tenant',
    name: 'Test Tenant',
  };

  it('should return healthy status when both services are available', async () => {
    const mockNeo4jService = {
      connect: mock(() => Promise.resolve()),
      disconnect: mock(() => Promise.resolve()),
      ensureVectorIndex: mock(() => Promise.resolve()),
      getSession: mock(() => mockSession),
      verifyConnectivity: mock(() => Promise.resolve()),
    } as any;

    const mockEmbeddingService = {
      generateEmbedding: mock(() => Promise.resolve(new Array(1536).fill(0.1))),
    } as any;

    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
      openai: {
        apiKey: 'test-key',
      },
    }, mockNeo4jService as any, mockEmbeddingService as any);

    await akasha.initialize();

    const health = await akasha.healthCheck();

    expect(health.status).toBe('healthy');
    expect(health.neo4j.connected).toBe(true);
    expect(health.openai.available).toBe(true);
    expect(health.timestamp).toBeDefined();
  });

  it('should return degraded status when Neo4j is unavailable', async () => {
    const failingSession = {
      run: mock(() => Promise.reject(new Error('Connection failed'))),
      close: mock(() => Promise.resolve()),
    } as any;

    const mockNeo4jService = {
      connect: mock(() => Promise.resolve()),
      disconnect: mock(() => Promise.resolve()),
      ensureVectorIndex: mock(() => Promise.resolve()),
      getSession: mock(() => failingSession),
      verifyConnectivity: mock(() => Promise.reject(new Error('Connection failed'))),
    } as any;

    const mockEmbeddingService = {
      generateEmbedding: mock(() => Promise.resolve(new Array(1536).fill(0.1))),
    } as any;

    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
      openai: {
        apiKey: 'test-key',
      },
    }, mockNeo4jService as any, mockEmbeddingService as any);

    await akasha.initialize();

    const health = await akasha.healthCheck();

    expect(health.status).toBe('degraded');
    expect(health.neo4j.connected).toBe(false);
    expect(health.neo4j.error).toBeDefined();
    expect(health.openai.available).toBe(true);
  });

  it('should return degraded status when OpenAI is unavailable', async () => {
    const mockNeo4jService = {
      connect: mock(() => Promise.resolve()),
      disconnect: mock(() => Promise.resolve()),
      ensureVectorIndex: mock(() => Promise.resolve()),
      getSession: mock(() => mockSession),
      verifyConnectivity: mock(() => Promise.resolve()),
    } as any;

    const mockEmbeddingService = {
      generateEmbedding: mock(() => Promise.reject(new Error('API key invalid'))),
    } as any;

    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
      openai: {
        apiKey: 'invalid-key',
      },
    }, mockNeo4jService as any, mockEmbeddingService as any);

    await akasha.initialize();

    const health = await akasha.healthCheck();

    expect(health.status).toBe('degraded');
    expect(health.neo4j.connected).toBe(true);
    expect(health.openai.available).toBe(false);
    expect(health.openai.error).toBeDefined();
  });

  it('should return unhealthy status when both services are unavailable', async () => {
    const failingSession = {
      run: mock(() => Promise.reject(new Error('Connection failed'))),
      close: mock(() => Promise.resolve()),
    } as any;

    const mockNeo4jService = {
      connect: mock(() => Promise.resolve()),
      disconnect: mock(() => Promise.resolve()),
      ensureVectorIndex: mock(() => Promise.resolve()),
      getSession: mock(() => failingSession),
      verifyConnectivity: mock(() => Promise.reject(new Error('Connection failed'))),
    } as any;

    const mockEmbeddingService = {
      generateEmbedding: mock(() => Promise.reject(new Error('API key invalid'))),
    } as any;

    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
      openai: {
        apiKey: 'invalid-key',
      },
    }, mockNeo4jService as any, mockEmbeddingService as any);

    await akasha.initialize();

    const health = await akasha.healthCheck();

    expect(health.status).toBe('unhealthy');
    expect(health.neo4j.connected).toBe(false);
    expect(health.openai.available).toBe(false);
  });

  it('should include timestamp in health status', async () => {
    const mockNeo4jService = {
      connect: mock(() => Promise.resolve()),
      disconnect: mock(() => Promise.resolve()),
      ensureVectorIndex: mock(() => Promise.resolve()),
      getSession: mock(() => mockSession),
      verifyConnectivity: mock(() => Promise.resolve()),
    } as any;

    const mockEmbeddingService = {
      generateEmbedding: mock(() => Promise.resolve(new Array(1536).fill(0.1))),
    } as any;

    const akasha = new Akasha({
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
      scope,
      openai: {
        apiKey: 'test-key',
      },
    }, mockNeo4jService as any, mockEmbeddingService as any);

    await akasha.initialize();

    const health = await akasha.healthCheck();

    expect(health.timestamp).toBeDefined();
    expect(new Date(health.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

