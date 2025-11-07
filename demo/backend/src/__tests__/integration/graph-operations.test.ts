import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import app from '../../app';

// Check if integration tests should run
const shouldRunIntegrationTests = 
  process.env.NEO4J_URI &&
  process.env.NEO4J_USER &&
  process.env.NEO4J_PASSWORD &&
  process.env.OPENAI_API_KEY;

describe('Graph Operations - List Endpoints', () => {
  beforeAll(async () => {
    if (!shouldRunIntegrationTests) {
      console.warn('⚠️  Skipping integration tests - missing environment variables');
    }
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('GET /api/graph/entities', () => {
    it.skipIf(!shouldRunIntegrationTests)('should list all entities', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/graph/entities', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!shouldRunIntegrationTests)('should filter entities by label', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/graph/entities?label=Person', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data.every((e: any) => e.label === 'Person')).toBe(true);
      }
    });

    it.skipIf(!shouldRunIntegrationTests)('should support pagination', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/graph/entities?limit=10&offset=0', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(10);
    });
  });

  describe('GET /api/graph/relationships', () => {
    it.skipIf(!shouldRunIntegrationTests)('should list all relationships', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/graph/relationships', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!shouldRunIntegrationTests)('should filter relationships by type', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/graph/relationships?type=WORKS_FOR', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data.every((r: any) => r.type === 'WORKS_FOR')).toBe(true);
      }
    });
  });

  describe('GET /api/graph/documents', () => {
    it.skipIf(!shouldRunIntegrationTests)('should list all documents', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/graph/documents', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});

describe('Graph Operations - Find Endpoints', () => {
  describe('GET /api/graph/relationships/:id', () => {
    it.skipIf(!shouldRunIntegrationTests)('should find relationship by ID', async () => {
      // First create a relationship to test with
      const createResponse = await app.handle(
        new Request('http://localhost/api/graph/relationships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: '1',
            to: '2',
            type: 'TEST_REL',
          }),
        })
      );

      if (createResponse.status === 200) {
        const created = await createResponse.json();
        const relId = created.id;

        const response = await app.handle(
          new Request(`http://localhost/api/graph/relationships/${relId}`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('type');
        expect(data).toHaveProperty('from');
        expect(data).toHaveProperty('to');
      }
    });
  });

  describe('GET /api/graph/documents/:id', () => {
    it.skipIf(!shouldRunIntegrationTests)('should find document by ID', async () => {
      // First create a document via learn
      const learnResponse = await app.handle(
        new Request('http://localhost/api/graph/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Test document for find operation',
          }),
        })
      );

      if (learnResponse.status === 200) {
        const result = await learnResponse.json();
        const docId = result.document.id;

        const response = await app.handle(
          new Request(`http://localhost/api/graph/documents/${docId}`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('label');
        expect(data.label).toBe('Document');
      }
    });
  });
});

describe('Graph Operations - Update Endpoints', () => {
  describe('PUT /api/graph/relationships/:id', () => {
    it.skipIf(!shouldRunIntegrationTests)('should update relationship properties', async () => {
      // First create a relationship
      const createResponse = await app.handle(
        new Request('http://localhost/api/graph/relationships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: '1',
            to: '2',
            type: 'TEST_REL',
          }),
        })
      );

      if (createResponse.status === 200) {
        const created = await createResponse.json();
        const relId = created.id;

        const updateResponse = await app.handle(
          new Request(`http://localhost/api/graph/relationships/${relId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              properties: { since: '2024-01-01', role: 'Manager' },
            }),
          })
        );

        expect(updateResponse.status).toBe(200);
        const updated = await updateResponse.json();
        expect(updated.properties.since).toBe('2024-01-01');
        expect(updated.properties.role).toBe('Manager');
      }
    });
  });

  describe('PUT /api/graph/documents/:id', () => {
    it.skipIf(!shouldRunIntegrationTests)('should update document properties', async () => {
      // First create a document
      const learnResponse = await app.handle(
        new Request('http://localhost/api/graph/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Test document for update',
          }),
        })
      );

      if (learnResponse.status === 200) {
        const result = await learnResponse.json();
        const docId = result.document.id;

        const updateResponse = await app.handle(
          new Request(`http://localhost/api/graph/documents/${docId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              properties: { metadata: { source: 'test', version: 1 } },
            }),
          })
        );

        expect(updateResponse.status).toBe(200);
        const updated = await updateResponse.json();
        expect(updated.properties.metadata).toEqual({ source: 'test', version: 1 });
      }
    });
  });
});

describe('Graph Operations - Delete Document', () => {
  describe('DELETE /api/graph/documents/:id', () => {
    it.skipIf(!shouldRunIntegrationTests)('should delete document by ID', async () => {
      // First create a document
      const learnResponse = await app.handle(
        new Request('http://localhost/api/graph/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Test document for deletion',
          }),
        })
      );

      if (learnResponse.status === 200) {
        const result = await learnResponse.json();
        const docId = result.document.id;

        const deleteResponse = await app.handle(
          new Request(`http://localhost/api/graph/documents/${docId}`, {
            method: 'DELETE',
          })
        );

        expect(deleteResponse.status).toBe(200);
        const data = await deleteResponse.json();
        expect(data).toHaveProperty('success');
        expect(data.success).toBe(true);
      }
    });
  });
});

describe('Configuration Validation', () => {
  describe('POST /api/config/validate', () => {
    it.skipIf(!shouldRunIntegrationTests)('should validate valid configuration', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/config/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            neo4j: {
              uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
              user: process.env.NEO4J_USER || 'neo4j',
              password: process.env.NEO4J_PASSWORD || 'password',
            },
            openai: {
              apiKey: process.env.OPENAI_API_KEY || 'test-key',
            },
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('valid');
      expect(data.valid).toBe(true);
      expect(data).toHaveProperty('errors');
      expect(Array.isArray(data.errors)).toBe(true);
    });

    it.skipIf(!shouldRunIntegrationTests)('should detect invalid configuration', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/config/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            neo4j: {
              uri: '',
              user: 'neo4j',
              password: 'password',
            },
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('valid');
      expect(data.valid).toBe(false);
      expect(data.errors.length).toBeGreaterThan(0);
    });
  });
});

