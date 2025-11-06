import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test';
import app from '../../app';

// Set test environment variables
beforeEach(() => {
  // Set dummy API key to prevent initialization errors
  if (!process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = 'test-key';
  }
});

describe('API Endpoints', () => {
  beforeAll(async () => {
    // App initialization happens automatically
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('GET /api/hello', () => {
    it('should return hello message', async () => {
      const response = await app.handle(new Request('http://localhost/api/hello'));
      expect(response.status).toBe(200);
      
      const text = await response.text();
      expect(text).toBe('Hello from API!');
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await app.handle(new Request('http://localhost/api/health'));
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data.status).toBe('ok');
      expect(data).toHaveProperty('service');
      expect(data.service).toBe('graphrag');
    });
  });

  describe('GET /api/neo4j/test', () => {
    it('should test Neo4j connection', async () => {
      const response = await app.handle(new Request('http://localhost/api/neo4j/test'));
      
      // May succeed or fail depending on Neo4j availability
      expect([200, 500]).toContain(response.status);
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      
      if (data.status === 'connected') {
        expect(data).toHaveProperty('message');
        expect(data).toHaveProperty('test');
      } else if (data.status === 'error') {
        expect(data).toHaveProperty('message');
        expect(data).toHaveProperty('hint');
      }
    });
  });

  describe('POST /api/graphrag/query', () => {
    it('should require query string in body', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/graphrag/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(200); // Elysia returns 200 even for validation errors
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Invalid request');
    });

    it('should accept valid GraphRAG query', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/graphrag/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'What is the relationship between Alice and Bob?',
            maxDepth: 2,
            limit: 50,
          }),
        })
      );

      // May succeed or fail depending on Neo4j/OpenAI availability
      expect([200, 500]).toContain(response.status);
      
      const data = await response.json();
      
      if (!data.error) {
        // Successful response
        expect(data).toHaveProperty('context');
        expect(data).toHaveProperty('answer');
        expect(data.context).toHaveProperty('entities');
        expect(data.context).toHaveProperty('relationships');
        expect(data.context).toHaveProperty('summary');
      }
    });

    it('should handle query with only required fields', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/graphrag/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'Test query',
          }),
        })
      );

      expect([200, 500]).toContain(response.status);
    });

    it('should reject non-string query', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/graphrag/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 123, // Invalid type
          }),
        })
      );

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });
});

