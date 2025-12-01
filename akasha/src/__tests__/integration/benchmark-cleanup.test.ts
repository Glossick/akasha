import { describe, expect, it } from 'bun:test';
import { akasha } from '../../factory';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests to verify that Akasha instances use cleanup() method, not disconnect()
 * 
 * This ensures the benchmark script and other code use the correct API.
 */
describe('Benchmark Script Cleanup API', () => {
  it('should have cleanup() method and not have disconnect() method', () => {
    const kg = akasha({
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
          config: { apiKey: 'test-key', model: 'text-embedding-3-small' },
        },
        llm: {
          type: 'openai',
          config: { apiKey: 'test-key', model: 'gpt-4' },
        },
      },
    });

    // Verify cleanup() exists and is a function
    expect(typeof kg.cleanup).toBe('function');
    expect(kg.cleanup).toBeDefined();

    // Verify disconnect() does NOT exist
    expect(kg.disconnect).toBeUndefined();
  });

  it('should work with Neo4j cleanup() method', async () => {
    // Skip if integration test environment not available
    if (!process.env.NEO4J_URI || !process.env.NEO4J_USER || !process.env.NEO4J_PASSWORD) {
      console.log('⚠️  Skipping Neo4j cleanup test - missing environment variables');
      return;
    }

    const kg = akasha({
      database: {
        type: 'neo4j',
        config: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
      },
      providers: {
        embedding: {
          type: 'openai',
          config: {
            apiKey: process.env.OPENAI_API_KEY || 'test-key',
            model: 'text-embedding-3-small',
          },
        },
        llm: {
          type: 'openai',
          config: {
            apiKey: process.env.OPENAI_API_KEY || 'test-key',
            model: 'gpt-4',
          },
        },
      },
    });

    await kg.initialize();

    // Verify cleanup() exists and works
    expect(typeof kg.cleanup).toBe('function');
    // cleanup() should complete without throwing
    await kg.cleanup();

    // Verify disconnect() does NOT exist
    expect(kg.disconnect).toBeUndefined();
  });

  it('should work with LadybugDB cleanup() method', async () => {
    const testDbPath = path.join(__dirname, `../../../../test-cleanup-${Date.now()}`);

    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true });
    }
    const walFile = `${testDbPath}.wal`;
    if (fs.existsSync(walFile)) {
      fs.rmSync(walFile, { force: true });
    }

    const kg = akasha({
      database: {
        type: 'ladybug',
        config: { databasePath: testDbPath },
      },
      providers: {
        embedding: {
          type: 'openai',
          config: { apiKey: 'test-key', model: 'text-embedding-3-small' },
        },
        llm: {
          type: 'openai',
          config: { apiKey: 'test-key', model: 'gpt-4' },
        },
      },
    });

    await kg.initialize();

    // Verify cleanup() exists and works
    expect(typeof kg.cleanup).toBe('function');
    // cleanup() should complete without throwing
    await kg.cleanup();

    // Verify disconnect() does NOT exist
    expect(kg.disconnect).toBeUndefined();

    // Clean up test database
    try {
      if (fs.existsSync(testDbPath)) {
        fs.rmSync(testDbPath, { recursive: true, force: true });
      }
      if (fs.existsSync(walFile)) {
        fs.rmSync(walFile, { force: true });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it('should verify that disconnect() is not a valid method name', () => {
    const kg = akasha({
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
          config: { apiKey: 'test-key', model: 'text-embedding-3-small' },
        },
        llm: {
          type: 'openai',
          config: { apiKey: 'test-key', model: 'gpt-4' },
        },
      },
    });

    // This test ensures that calling disconnect() would fail
    // The benchmark script should use cleanup() instead
    expect(kg.disconnect).toBeUndefined();
    
    // Verify the correct method exists
    expect(kg.cleanup).toBeDefined();
    expect(typeof kg.cleanup).toBe('function');
  });
});

