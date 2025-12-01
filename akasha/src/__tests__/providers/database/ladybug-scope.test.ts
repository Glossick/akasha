import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { LadybugProvider } from '../../../services/providers/database/ladybug-provider';
import type { Entity, Relationship, Document } from '../../../types';
import * as fs from 'fs';
import * as path from 'path';

describe('LadybugProvider - Scope Filtering', () => {
  let provider: LadybugProvider;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = path.join(__dirname, `../../../../test-scope-${Date.now()}`);
    provider = new LadybugProvider({ databasePath: testDbPath });
    await provider.connect();
    await provider.ensureVectorIndex();
  });

  afterEach(async () => {
    try {
      await provider.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
    
    // Clean up database files
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true });
    }
    const walFile = `${testDbPath}.wal`;
    if (fs.existsSync(walFile)) {
      fs.rmSync(walFile, { force: true });
    }
  });

  describe('Entity Creation with Scope', () => {
    it('should create entities with scopeId', async () => {
      const entities: Entity[] = [
        {
          id: 'e1',
          label: 'Person',
          properties: {
            name: 'Alice',
            scopeId: 'scope-1',
          },
        },
        {
          id: 'e2',
          label: 'Person',
          properties: {
            name: 'Bob',
            scopeId: 'scope-1',
          },
        },
      ];

      const created = await provider.createEntities(entities);

      expect(created.length).toBe(2);
      expect(created[0].properties.scopeId).toBe('scope-1');
      expect(created[1].properties.scopeId).toBe('scope-1');
    });

    it('should create entities with different scopeIds', async () => {
      const entities: Entity[] = [
        {
          id: 'e1',
          label: 'Person',
          properties: {
            name: 'Alice',
            scopeId: 'scope-1',
          },
        },
        {
          id: 'e2',
          label: 'Person',
          properties: {
            name: 'Bob',
            scopeId: 'scope-2',
          },
        },
      ];

      const created = await provider.createEntities(entities);

      expect(created.length).toBe(2);
      expect(created[0].properties.scopeId).toBe('scope-1');
      expect(created[1].properties.scopeId).toBe('scope-2');
    });
  });

  describe('Entity Retrieval with Scope Filtering', () => {
    beforeEach(async () => {
      // Create entities in different scopes
      const entities: Entity[] = [
        {
          id: 'e1',
          label: 'Person',
          properties: {
            name: 'Alice',
            scopeId: 'scope-1',
          },
        },
        {
          id: 'e2',
          label: 'Person',
          properties: {
            name: 'Bob',
            scopeId: 'scope-2',
          },
        },
        {
          id: 'e3',
          label: 'Person',
          properties: {
            name: 'Charlie',
            scopeId: 'scope-1',
          },
        },
      ];

      await provider.createEntities(entities);
    });

    it('should find entity by ID with scopeId filter', async () => {
      const entity = await provider.findEntityById('e1', 'scope-1');
      
      expect(entity).toBeDefined();
      expect(entity).not.toBeNull();
      // The id is stored in properties.id in LadybugDB
      expect(entity?.properties.id || entity?.id).toBe('e1');
      expect(entity?.properties.scopeId).toBe('scope-1');
    });

    it('should return null when entity ID exists but scopeId does not match', async () => {
      const entity = await provider.findEntityById('e1', 'scope-2');
      
      expect(entity).toBeNull();
    });

    it('should list entities filtered by scopeId', async () => {
      const entities = await provider.listEntities(undefined, 100, 0, 'scope-1');
      
      expect(entities.length).toBe(2);
      expect(entities.every(e => e.properties.scopeId === 'scope-1')).toBe(true);
      expect(entities.some(e => e.properties.name === 'Alice')).toBe(true);
      expect(entities.some(e => e.properties.name === 'Charlie')).toBe(true);
    });

    it('should list entities from different scope when scopeId filter changes', async () => {
      const entities = await provider.listEntities(undefined, 100, 0, 'scope-2');
      
      expect(entities.length).toBe(1);
      expect(entities[0].properties.scopeId).toBe('scope-2');
      expect(entities[0].properties.name).toBe('Bob');
    });

    it('should list all entities when no scopeId filter is provided', async () => {
      const entities = await provider.listEntities(undefined, 100, 0);
      
      expect(entities.length).toBe(3);
    });
  });

  describe('Vector Search with Scope Filtering', () => {
    beforeEach(async () => {
      // Create entities with embeddings in different scopes
      const entities: Entity[] = [
        {
          id: 'e1',
          label: 'Person',
          properties: {
            name: 'Alice',
            scopeId: 'scope-1',
          },
        },
        {
          id: 'e2',
          label: 'Person',
          properties: {
            name: 'Bob',
            scopeId: 'scope-2',
          },
        },
        {
          id: 'e3',
          label: 'Person',
          properties: {
            name: 'Charlie',
            scopeId: 'scope-1',
          },
        },
      ];

      // Create similar embeddings for all entities
      const embeddings = [
        [0.1, 0.2, 0.3],
        [0.1, 0.2, 0.3],
        [0.1, 0.2, 0.3],
      ];

      await provider.createEntities(entities, embeddings);
    });

    it('should filter vector search results by scopeId', async () => {
      const queryEmbedding = [0.15, 0.25, 0.35];
      const results = await provider.findEntitiesByVector(queryEmbedding, 10, 0.5, 'scope-1');

      expect(results.length).toBe(2);
      expect(results.every(e => e.properties.scopeId === 'scope-1')).toBe(true);
      expect(results.some(e => e.properties.name === 'Alice')).toBe(true);
      expect(results.some(e => e.properties.name === 'Charlie')).toBe(true);
    });

    it('should not return entities from different scope in vector search', async () => {
      const queryEmbedding = [0.15, 0.25, 0.35];
      const results = await provider.findEntitiesByVector(queryEmbedding, 10, 0.5, 'scope-1');

      expect(results.every(e => e.properties.scopeId === 'scope-1')).toBe(true);
      expect(results.some(e => e.properties.name === 'Bob')).toBe(false);
    });

    it('should return different results when scopeId filter changes', async () => {
      const queryEmbedding = [0.15, 0.25, 0.35];
      const results = await provider.findEntitiesByVector(queryEmbedding, 10, 0.5, 'scope-2');

      expect(results.length).toBe(1);
      expect(results[0].properties.scopeId).toBe('scope-2');
      expect(results[0].properties.name).toBe('Bob');
    });
  });

  describe('Document Operations with Scope Filtering', () => {
    beforeEach(async () => {
      // Create documents in different scopes
      const doc1: Document = {
        id: 'd1',
        label: 'Document',
        properties: {
          text: 'Document 1',
          scopeId: 'scope-1',
        },
      };

      const doc2: Document = {
        id: 'd2',
        label: 'Document',
        properties: {
          text: 'Document 2',
          scopeId: 'scope-2',
        },
      };

      await provider.createDocument(doc1);
      await provider.createDocument(doc2);
    });

    it('should find document by ID with scopeId filter', async () => {
      const doc = await provider.findDocumentById('d1', 'scope-1');
      
      expect(doc).toBeDefined();
      expect(doc).not.toBeNull();
      // The id is stored in properties.id in LadybugDB
      expect(doc?.properties.id || doc?.id).toBe('d1');
      expect(doc?.properties.scopeId).toBe('scope-1');
    });

    it('should return null when document ID exists but scopeId does not match', async () => {
      const doc = await provider.findDocumentById('d1', 'scope-2');
      
      expect(doc).toBeNull();
    });

    it('should list documents filtered by scopeId', async () => {
      const docs = await provider.listDocuments(100, 0, 'scope-1');
      
      expect(docs.length).toBe(1);
      expect(docs[0].properties.scopeId).toBe('scope-1');
      // The id is stored in properties.id in LadybugDB
      expect(docs[0].properties.id || docs[0].id).toBe('d1');
    });
  });

  describe.skip('Relationship Operations with Scope Filtering', () => {
    // Skipped due to buffer manager exception - known issue with LadybugDB in test context
    beforeEach(async () => {
      // Create entities in different scopes
      const entities: Entity[] = [
        {
          id: 'e1',
          label: 'Person',
          properties: {
            name: 'Alice',
            scopeId: 'scope-1',
          },
        },
        {
          id: 'e2',
          label: 'Person',
          properties: {
            name: 'Bob',
            scopeId: 'scope-1',
          },
        },
        {
          id: 'e3',
          label: 'Person',
          properties: {
            name: 'Charlie',
            scopeId: 'scope-2',
          },
        },
      ];

      await provider.createEntities(entities);

      // Create relationships
      const relationships = [
        {
          from: 'e1',
          to: 'e2',
          type: 'KNOWS',
          properties: {
            scopeId: 'scope-1',
          },
        },
        {
          from: 'e1',
          to: 'e3',
          type: 'KNOWS',
          properties: {
            scopeId: 'scope-1', // Note: This relationship crosses scopes, but has scope-1
          },
        },
      ];

      await provider.createRelationships(relationships);
    });

    it('should find relationship by ID with scopeId filter', async () => {
      // First, we need to get the relationship ID
      const relationships = await provider.listRelationships(undefined, undefined, undefined, 100, 0, 'scope-1');
      
      expect(relationships.length).toBeGreaterThan(0);
      const relId = relationships[0].id;
      
      const rel = await provider.findRelationshipById(relId, 'scope-1');
      
      expect(rel).toBeDefined();
      expect(rel?.properties.scopeId).toBe('scope-1');
    });

    it('should list relationships filtered by scopeId', async () => {
      const relationships = await provider.listRelationships(undefined, undefined, undefined, 100, 0, 'scope-1');
      
      expect(relationships.length).toBeGreaterThan(0);
      expect(relationships.every(r => r.properties.scopeId === 'scope-1')).toBe(true);
    });
  });

  describe.skip('Subgraph Retrieval with Scope Filtering', () => {
    // Skipped due to buffer manager exception - known issue with LadybugDB in test context
    beforeEach(async () => {
      // Create entities in different scopes
      const entities: Entity[] = [
        {
          id: 'e1',
          label: 'Person',
          properties: {
            name: 'Alice',
            scopeId: 'scope-1',
          },
        },
        {
          id: 'e2',
          label: 'Person',
          properties: {
            name: 'Bob',
            scopeId: 'scope-1',
          },
        },
        {
          id: 'e3',
          label: 'Person',
          properties: {
            name: 'Charlie',
            scopeId: 'scope-2',
          },
        },
      ];

      await provider.createEntities(entities);

      // Create relationships within scope-1
      const relationships = [
        {
          from: 'e1',
          to: 'e2',
          type: 'KNOWS',
          properties: {
            scopeId: 'scope-1',
          },
        },
      ];

      await provider.createRelationships(relationships);
    });

    it('should retrieve subgraph filtered by scopeId', async () => {
      const subgraph = await provider.retrieveSubgraph(
        ['Person'],
        ['KNOWS'],
        1,
        100,
        ['e1'],
        'scope-1'
      );

      expect(subgraph.entities.length).toBeGreaterThan(0);
      expect(subgraph.entities.every(e => e.properties.scopeId === 'scope-1')).toBe(true);
      
      if (subgraph.relationships.length > 0) {
        expect(subgraph.relationships.every(r => r.properties.scopeId === 'scope-1')).toBe(true);
      }
    });

    it('should not return entities from different scope in subgraph', async () => {
      const subgraph = await provider.retrieveSubgraph(
        ['Person'],
        ['KNOWS'],
        1,
        100,
        ['e1'],
        'scope-1'
      );

      expect(subgraph.entities.every(e => e.properties.scopeId === 'scope-1')).toBe(true);
      expect(subgraph.entities.some(e => e.properties.name === 'Charlie')).toBe(false);
    });
  });

  describe.skip('Entity-to-Document Linking with Scope', () => {
    // Skipped due to buffer manager exception - known issue with LadybugDB in test context
    beforeEach(async () => {
      // Create entities and documents in same scope
      const entities: Entity[] = [
        {
          id: 'e1',
          label: 'Person',
          properties: {
            name: 'Alice',
            scopeId: 'scope-1',
          },
        },
      ];

      await provider.createEntities(entities);

      const doc: Document = {
        id: 'd1',
        label: 'Document',
        properties: {
          text: 'Alice works here',
          scopeId: 'scope-1',
        },
      };

      await provider.createDocument(doc);
    });

    it('should link entity to document when both are in same scope', async () => {
      const relationship = await provider.linkEntityToDocument('d1', 'e1', 'scope-1');
      
      expect(relationship).toBeDefined();
      expect(relationship.type).toBe('ContainsEntity');
      expect(relationship.from).toBe('d1');
      expect(relationship.to).toBe('e1');
      expect(relationship.properties.scopeId).toBe('scope-1');
    });

    it('should get entities from documents filtered by scopeId', async () => {
      await provider.linkEntityToDocument('d1', 'e1', 'scope-1');
      
      const entities = await provider.getEntitiesFromDocuments(['d1'], 'scope-1');
      
      expect(entities.length).toBe(1);
      expect(entities[0].id).toBe('e1');
      expect(entities[0].properties.scopeId).toBe('scope-1');
    });
  });
});

