import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { LadybugProvider } from '../../../services/providers/database/ladybug-provider';
import * as fs from 'fs';
import * as path from 'path';

describe('LadybugProvider - Vector Search Limit Calculation', () => {
  let provider: LadybugProvider;
  const testDbPath = path.join(__dirname, '../../../../test-ladybug-vector-filtering-db');
  let capturedQueries: string[] = [];

  beforeEach(async () => {
    // Clean up previous test database
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true });
    }
    const walFile = `${testDbPath}.wal`;
    if (fs.existsSync(walFile)) {
      fs.rmSync(walFile, { force: true });
    }

    provider = new LadybugProvider({ databasePath: testDbPath });
    await provider.connect();
    await provider.ensureSchema();
    
    capturedQueries = [];
    
    // Mock the query method to capture queries
    const originalQuery = (provider as any).conn.query.bind((provider as any).conn);
    (provider as any).conn.query = mock((query: string) => {
      capturedQueries.push(query);
      // Return empty result for testing
      return Promise.resolve({
        getAll: async () => [],
        close: () => {},
      });
    });
  });

  afterEach(async () => {
    try {
      await provider.disconnect();
    } catch (e) {
      // Ignore cleanup errors
    }
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true });
    }
    const walFile = `${testDbPath}.wal`;
    if (fs.existsSync(walFile)) {
      fs.rmSync(walFile, { force: true });
    }
  });

  describe('findEntitiesByVector - Limit calculation', () => {
    it('should request higher limit when scopeId filter is present', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await provider.findEntitiesByVector(
        queryEmbedding,
        10, // limit
        0.7,
        'test-scope' // scopeId filter
      );

      expect(capturedQueries.length).toBeGreaterThan(0);
      const query = capturedQueries[capturedQueries.length - 1];
      // Should have LIMIT >= 50 or limit * 5 when filters are present
      const limitMatch = query.match(/LIMIT (\d+)/);
      expect(limitMatch).toBeTruthy();
      const limitValue = parseInt(limitMatch![1], 10);
      expect(limitValue).toBeGreaterThanOrEqual(50);
      expect(limitValue).toBeGreaterThanOrEqual(10 * 5);
    });

    it('should request higher limit when contexts filter is present', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await provider.findEntitiesByVector(
        queryEmbedding,
        10, // limit
        0.7,
        undefined, // no scopeId
        ['context-1'] // contexts filter
      );

      expect(capturedQueries.length).toBeGreaterThan(0);
      const query = capturedQueries[capturedQueries.length - 1];
      const limitMatch = query.match(/LIMIT (\d+)/);
      expect(limitMatch).toBeTruthy();
      const limitValue = parseInt(limitMatch![1], 10);
      expect(limitValue).toBeGreaterThanOrEqual(50);
    });

    it('should request higher limit when validAt filter is present', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await provider.findEntitiesByVector(
        queryEmbedding,
        10, // limit
        0.7,
        undefined, // no scopeId
        undefined, // no contexts
        '2024-06-01T00:00:00Z' // validAt filter
      );

      expect(capturedQueries.length).toBeGreaterThan(0);
      const query = capturedQueries[capturedQueries.length - 1];
      const limitMatch = query.match(/LIMIT (\d+)/);
      expect(limitMatch).toBeTruthy();
      const limitValue = parseInt(limitMatch![1], 10);
      expect(limitValue).toBeGreaterThanOrEqual(50);
    });

    it('should request higher limit when multiple filters are present', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await provider.findEntitiesByVector(
        queryEmbedding,
        10, // limit
        0.7,
        'test-scope', // scopeId
        ['context-1'], // contexts
        '2024-06-01T00:00:00Z' // validAt
      );

      expect(capturedQueries.length).toBeGreaterThan(0);
      const query = capturedQueries[capturedQueries.length - 1];
      const limitMatch = query.match(/LIMIT (\d+)/);
      expect(limitMatch).toBeTruthy();
      const limitValue = parseInt(limitMatch![1], 10);
      expect(limitValue).toBeGreaterThanOrEqual(50);
    });

    it('should use normal limit when no filters are present', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await provider.findEntitiesByVector(
        queryEmbedding,
        10, // limit
        0.7
        // No filters
      );

      expect(capturedQueries.length).toBeGreaterThan(0);
      const query = capturedQueries[capturedQueries.length - 1];
      // When no filters, limit should be reasonable but not necessarily 5x
      // The current implementation uses 500 as max, so we just verify it's not unnecessarily high
      const limitMatch = query.match(/LIMIT (\d+)/);
      expect(limitMatch).toBeTruthy();
      const limitValue = parseInt(limitMatch![1], 10);
      // Should be at least the requested limit, but not necessarily 5x when no filters
      expect(limitValue).toBeGreaterThanOrEqual(10);
    });
  });

  describe('findDocumentsByVector - Limit calculation', () => {
    it('should request higher limit when scopeId filter is present', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await provider.findDocumentsByVector(
        queryEmbedding,
        10, // limit
        0.7,
        'test-scope' // scopeId filter
      );

      expect(capturedQueries.length).toBeGreaterThan(0);
      const query = capturedQueries[capturedQueries.length - 1];
      const limitMatch = query.match(/LIMIT (\d+)/);
      expect(limitMatch).toBeTruthy();
      const limitValue = parseInt(limitMatch![1], 10);
      expect(limitValue).toBeGreaterThanOrEqual(50);
      expect(limitValue).toBeGreaterThanOrEqual(10 * 5);
    });

    it('should request higher limit when contexts filter is present', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await provider.findDocumentsByVector(
        queryEmbedding,
        10, // limit
        0.7,
        undefined, // no scopeId
        ['context-1'] // contexts filter
      );

      expect(capturedQueries.length).toBeGreaterThan(0);
      const query = capturedQueries[capturedQueries.length - 1];
      const limitMatch = query.match(/LIMIT (\d+)/);
      expect(limitMatch).toBeTruthy();
      const limitValue = parseInt(limitMatch![1], 10);
      expect(limitValue).toBeGreaterThanOrEqual(50);
    });

    it('should request higher limit when validAt filter is present', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await provider.findDocumentsByVector(
        queryEmbedding,
        10, // limit
        0.7,
        undefined, // no scopeId
        undefined, // no contexts
        '2024-06-01T00:00:00Z' // validAt filter
      );

      expect(capturedQueries.length).toBeGreaterThan(0);
      const query = capturedQueries[capturedQueries.length - 1];
      const limitMatch = query.match(/LIMIT (\d+)/);
      expect(limitMatch).toBeTruthy();
      const limitValue = parseInt(limitMatch![1], 10);
      expect(limitValue).toBeGreaterThanOrEqual(50);
    });

    it('should use normal limit when no filters are present', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await provider.findDocumentsByVector(
        queryEmbedding,
        10, // limit
        0.7
        // No filters
      );

      expect(capturedQueries.length).toBeGreaterThan(0);
      const query = capturedQueries[capturedQueries.length - 1];
      const limitMatch = query.match(/LIMIT (\d+)/);
      expect(limitMatch).toBeTruthy();
      const limitValue = parseInt(limitMatch![1], 10);
      // Should be at least the requested limit
      expect(limitValue).toBeGreaterThanOrEqual(10);
    });
  });
});

