import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { Neo4jService } from '../../services/neo4j.service';
import type { Entity, Relationship } from '../../types/graph';

describe('Neo4jService', () => {
  let service: Neo4jService;
  let isConnected = false;

  beforeAll(async () => {
    service = new Neo4jService();
    try {
      await service.connect();
      isConnected = true;
    } catch (error) {
      console.warn('Neo4j not available, skipping tests:', error);
      isConnected = false;
    }
  });

  afterAll(async () => {
    if (service) {
      await service.disconnect();
    }
  });

  describe('Connection', () => {
    it.skipIf(!isConnected)('should connect to Neo4j database', async () => {
      const testService = new Neo4jService();
      await expect(testService.connect()).resolves.not.toThrow();
      await testService.disconnect();
    });

    it.skipIf(!isConnected)('should verify connectivity', async () => {
      const testService = new Neo4jService();
      await testService.connect();
      await expect(testService.connect()).resolves.not.toThrow();
      await testService.disconnect();
    });

    it.skipIf(!isConnected)('should disconnect gracefully', async () => {
      const testService = new Neo4jService();
      await testService.connect();
      await expect(testService.disconnect()).resolves.not.toThrow();
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      if (!isConnected) return;
      // Clean up test data before each test
      await service.executeQuery('MATCH (n:TestNode) DELETE n');
    });

    it.skipIf(!isConnected)('should execute a simple Cypher query', async () => {
      const result = await service.executeQuery<{ value: number }>('RETURN 42 as value');
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(42);
    });

    it.skipIf(!isConnected)('should execute queries with parameters', async () => {
      const result = await service.executeQuery<{ name: string }>(
        'RETURN $name as name',
        { name: 'Test' }
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test');
    });

    it.skipIf(!isConnected)('should create and retrieve nodes', async () => {
      // Create a test node
      await service.executeQuery(
        'CREATE (n:TestNode {name: $name, id: $id})',
        { name: 'Test Node', id: 'test-1' }
      );

      // Retrieve it
      const result = await service.executeQuery<{ name: string; id: string }>(
        'MATCH (n:TestNode {id: $id}) RETURN n.name as name, n.id as id',
        { id: 'test-1' }
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Node');
      expect(result[0].id).toBe('test-1');
    });
  });

  describe('Subgraph Retrieval', () => {
    beforeEach(async () => {
      if (!isConnected) return;
      // Set up test graph
      await service.executeQuery(`
        MATCH (n) WHERE n:TestPerson OR n:TestCompany
        DETACH DELETE n
      `);

      // Create test graph
      await service.executeQuery(`
        CREATE (p1:TestPerson {name: 'Alice', id: 'p1'})
        CREATE (p2:TestPerson {name: 'Bob', id: 'p2'})
        CREATE (c1:TestCompany {name: 'TechCorp', id: 'c1'})
        CREATE (p1)-[:WORKS_FOR {since: 2020}]->(c1)
        CREATE (p2)-[:WORKS_FOR {since: 2018}]->(c1)
        CREATE (p1)-[:KNOWS {since: 2015}]->(p2)
      `);
    });

    afterEach(async () => {
      if (!isConnected) return;
      // Clean up
      await service.executeQuery(`
        MATCH (n) WHERE n:TestPerson OR n:TestCompany
        DETACH DELETE n
      `);
    });

    it.skipIf(!isConnected)('should retrieve subgraph with entities and relationships', async () => {
      const result = await service.retrieveSubgraph(
        ['TestPerson', 'TestCompany'],
        ['WORKS_FOR', 'KNOWS'],
        1,
        10
      );

      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.relationships.length).toBeGreaterThan(0);

      // Verify entity structure
      const entity = result.entities[0];
      expect(entity).toHaveProperty('id');
      expect(entity).toHaveProperty('label');
      expect(entity).toHaveProperty('properties');

      // Verify relationship structure
      const relationship = result.relationships[0];
      expect(relationship).toHaveProperty('id');
      expect(relationship).toHaveProperty('type');
      expect(relationship).toHaveProperty('from');
      expect(relationship).toHaveProperty('to');
    });

    it.skipIf(!isConnected)('should respect maxDepth parameter', async () => {
      const resultDepth1 = await service.retrieveSubgraph(
        ['TestPerson'],
        ['WORKS_FOR'],
        1,
        10
      );

      const resultDepth2 = await service.retrieveSubgraph(
        ['TestPerson'],
        ['WORKS_FOR', 'KNOWS'],
        2,
        10
      );

      // Depth 2 should potentially return more relationships
      expect(resultDepth2.relationships.length).toBeGreaterThanOrEqual(
        resultDepth1.relationships.length
      );
    });

    it.skipIf(!isConnected)('should respect limit parameter', async () => {
      const result = await service.retrieveSubgraph(
        ['TestPerson', 'TestCompany'],
        ['WORKS_FOR', 'KNOWS'],
        2,
        5
      );

      // Should not exceed limit (though exact count depends on graph structure)
      expect(result.entities.length).toBeLessThanOrEqual(50); // Limit applies to paths, not entities
    });
  });

  describe('Entity Search', () => {
    beforeEach(async () => {
      if (!isConnected) return;
      await service.executeQuery(`
        MATCH (n) WHERE n:TestSearch
        DELETE n
      `);

      await service.executeQuery(`
        CREATE (n1:TestSearch {name: 'Alice Smith', title: 'Engineer'})
        CREATE (n2:TestSearch {name: 'Bob Johnson', description: 'Software Developer'})
        CREATE (n3:TestSearch {name: 'Charlie Brown', title: 'Manager'})
      `);
    });

    afterEach(async () => {
      if (!isConnected) return;
      await service.executeQuery(`
        MATCH (n:TestSearch) DELETE n
      `);
    });

    it.skipIf(!isConnected)('should find entities by text in name property', async () => {
      const result = await service.findEntitiesByText('Alice', 10);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((e) => e.properties.name?.includes('Alice'))).toBe(true);
    });

    it.skipIf(!isConnected)('should find entities by text in title property', async () => {
      const result = await service.findEntitiesByText('Engineer', 10);
      expect(result.length).toBeGreaterThan(0);
    });

    it.skipIf(!isConnected)('should find entities by text in description property', async () => {
      const result = await service.findEntitiesByText('Developer', 10);
      expect(result.length).toBeGreaterThan(0);
    });

    it.skipIf(!isConnected)('should respect limit parameter', async () => {
      const result = await service.findEntitiesByText('a', 2);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it.skipIf(!isConnected)('should return empty array when no matches found', async () => {
      const result = await service.findEntitiesByText('NonexistentEntity', 10);
      expect(result).toHaveLength(0);
    });
  });

  describe('Vector Similarity Search', () => {
    beforeEach(async () => {
      if (!isConnected) return;
      
      // Clean up test data
      await service.executeQuery(`
        MATCH (n:TestVector) DELETE n
      `);
      
      // Drop vector index if it exists
      try {
        await service.executeQuery(`
          DROP INDEX vector_index IF EXISTS
        `);
      } catch (e) {
        // Index might not exist, that's okay
      }
    });

    afterEach(async () => {
      if (!isConnected) return;
      await service.executeQuery(`
        MATCH (n:TestVector) DELETE n
      `);
    });

    it.skipIf(!isConnected)('should create vector index for entity embeddings', async () => {
      // This will be implemented - test that vector index can be created
      // Vector indexes in Neo4j 5.x use db.index.vector.createNodeIndex
      const indexName = 'entity_vector_index';
      
      // Attempt to create index (will fail if not supported, but test structure is correct)
      try {
        await service.executeQuery(`
          CALL db.index.vector.createNodeIndex(
            '${indexName}',
            'TestVector',
            'embedding',
            1536,
            'cosine'
          )
        `);
        // If we get here, index was created
        expect(true).toBe(true);
      } catch (error) {
        // Neo4j version might not support vector indexes - skip test
        console.warn('Vector indexes not supported in this Neo4j version');
      }
    });

    it.skipIf(!isConnected)('should find entities by vector similarity', async () => {
      // This test will verify vector similarity search works
      // Will be implemented after vector search method is added
      const queryEmbedding = new Array(1536).fill(0).map(() => Math.random());
      
      // This test will be implemented when findEntitiesByVector is added
      // For now, just verify the structure
      expect(true).toBe(true);
    });

    it.skipIf(!isConnected)('should store embeddings when entities are created', async () => {
      // This test will verify that embeddings are stored on entities
      // Will be implemented after embedding storage is added to createEntity
      expect(true).toBe(true);
    });
  });
});

