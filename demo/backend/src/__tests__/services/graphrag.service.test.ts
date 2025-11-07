import { describe, expect, it, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import { GraphRAGService } from '../../services/graphrag.service';
import { Neo4jService } from '../../services/neo4j.service';
import { EmbeddingService } from '../../services/embedding.service';
import type { GraphRAGQuery } from '../../types/graph';

// Mock the services
const mockNeo4jService = {
  connect: mock(() => Promise.resolve()),
  disconnect: mock(() => Promise.resolve()),
  ensureVectorIndex: mock(() => Promise.resolve()),
  findEntitiesByVector: mock(() => Promise.resolve([
    { id: '1', label: 'Person', properties: { name: 'Alice' } },
    { id: '2', label: 'Person', properties: { name: 'Bob' } },
  ])),
  retrieveSubgraph: mock(() => Promise.resolve({
    entities: [
      { id: '1', label: 'Person', properties: { name: 'Alice' } },
      { id: '2', label: 'Person', properties: { name: 'Bob' } },
    ],
    relationships: [
      { id: 'r1', type: 'KNOWS', from: '1', to: '2', properties: {} },
    ],
  })),
  createEntities: mock(() => Promise.resolve([])),
  createRelationships: mock(() => Promise.resolve([])),
} as any;

const mockEmbeddingService = {
  generateEmbedding: mock(() => Promise.resolve(new Array(1536).fill(0.1))),
  generateEmbeddings: mock(() => Promise.resolve([new Array(1536).fill(0.1)])),
  generateResponse: mock(() => Promise.resolve('Alice and Bob know each other.')),
} as any;

describe('GraphRAGService', () => {
  let service: GraphRAGService;

  beforeAll(() => {
    // Create service with mocked dependencies using dependency injection
    service = new GraphRAGService(
      mockNeo4jService as any,
      mockEmbeddingService as any
    );
  });

  describe('Initialization', () => {
    it('should initialize Neo4j connection', async () => {
      await service.initialize();
      expect(mockNeo4jService.connect).toHaveBeenCalled();
    });

    it('should cleanup Neo4j connection', async () => {
      await service.cleanup();
      expect(mockNeo4jService.disconnect).toHaveBeenCalled();
    });
  });

  describe('Query', () => {
    beforeEach(() => {
      // Reset mocks
      if (mockNeo4jService.findEntitiesByVector.mockClear) {
        mockNeo4jService.findEntitiesByVector.mockClear();
      }
      if (mockNeo4jService.retrieveSubgraph.mockClear) {
        mockNeo4jService.retrieveSubgraph.mockClear();
      }
      if (mockEmbeddingService.generateEmbedding.mockClear) {
        mockEmbeddingService.generateEmbedding.mockClear();
      }
      if (mockEmbeddingService.generateResponse.mockClear) {
        mockEmbeddingService.generateResponse.mockClear();
      }
    });

    it('should process a GraphRAG query', async () => {
      const query: GraphRAGQuery = {
        query: 'What is the relationship between Alice and Bob?',
      };

      const result = await service.query(query);

      expect(result).toHaveProperty('context');
      expect(result).toHaveProperty('answer');
      expect(result.context).toHaveProperty('entities');
      expect(result.context).toHaveProperty('relationships');
      expect(result.context).toHaveProperty('summary');
      expect(typeof result.answer).toBe('string');
    });

    it('should find entities before retrieving subgraph', async () => {
      const query: GraphRAGQuery = {
        query: 'Alice',
      };

      await service.query(query);

      expect(mockNeo4jService.findEntitiesByVector).toHaveBeenCalled();
      expect(mockNeo4jService.retrieveSubgraph).toHaveBeenCalled();
    });

    it('should use default maxDepth and limit when not provided', async () => {
      const query: GraphRAGQuery = {
        query: 'Test query',
      };

      await service.query(query);

      expect(mockNeo4jService.retrieveSubgraph).toHaveBeenCalled();
      const subgraphCall = (mockNeo4jService.retrieveSubgraph as any).mock.calls[0];
      if (subgraphCall) {
        expect(subgraphCall[2]).toBe(2); // maxDepth default
        expect(subgraphCall[3]).toBe(50); // limit default
      }
    });

    it('should use custom maxDepth and limit when provided', async () => {
      const query: GraphRAGQuery = {
        query: 'Test query',
        maxDepth: 3,
        limit: 100,
      };

      await service.query(query);

      expect(mockNeo4jService.retrieveSubgraph).toHaveBeenCalled();
      const subgraphCall = (mockNeo4jService.retrieveSubgraph as any).mock.calls[0];
      if (subgraphCall) {
        expect(subgraphCall[2]).toBe(3); // maxDepth
        expect(subgraphCall[3]).toBe(100); // limit
      }
    });

    it('should return appropriate response when no entities found', async () => {
      // Create a new mock for this test
      const mockFindEmpty = mock(() => Promise.resolve([]));
      const testService = new GraphRAGService(
        { ...mockNeo4jService, findEntitiesByVector: mockFindEmpty } as any,
        mockEmbeddingService as any
      );

      const query: GraphRAGQuery = {
        query: 'Nonexistent entity',
      };

      const result = await testService.query(query);

      expect(result.context.entities).toHaveLength(0);
      expect(result.context.relationships).toHaveLength(0);
      expect(result.answer).toContain('could not find');
    });

    it('should format graph context for LLM', async () => {
      const query: GraphRAGQuery = {
        query: 'Test',
      };

      await service.query(query);

      expect(mockEmbeddingService.generateResponse).toHaveBeenCalled();
      const responseCall = (mockEmbeddingService.generateResponse as any).mock.calls[0];
      if (responseCall) {
        expect(responseCall[1]).toContain('Knowledge Graph Context');
        expect(responseCall[1]).toContain('Entities');
        expect(responseCall[1]).toContain('Relationships');
      }
    });

    it('should include query in LLM prompt', async () => {
      const query: GraphRAGQuery = {
        query: 'What is the relationship?',
      };

      await service.query(query);

      expect(mockEmbeddingService.generateResponse).toHaveBeenCalled();
      const responseCall = (mockEmbeddingService.generateResponse as any).mock.calls[0];
      if (responseCall) {
        expect(responseCall[0]).toBe('What is the relationship?');
      }
    });
  });

  describe('formatGraphContext - Property Filtering', () => {
    beforeEach(() => {
      // Reset mocks
      if (mockNeo4jService.findEntitiesByVector) {
        mockNeo4jService.findEntitiesByVector.mockClear();
      }
      if (mockNeo4jService.retrieveSubgraph) {
        mockNeo4jService.retrieveSubgraph.mockClear();
      }
      if (mockEmbeddingService.generateEmbedding) {
        mockEmbeddingService.generateEmbedding.mockClear();
      }
      if (mockEmbeddingService.generateResponse) {
        mockEmbeddingService.generateResponse.mockClear();
      }
    });

    it('should filter out embedding arrays from LLM context', async () => {
      // Create a large embedding array (1536 floats)
      const largeEmbedding = new Array(1536).fill(0.123456789);
      
      const mockNeo4jWithEmbeddings = {
        ...mockNeo4jService,
        findEntitiesByVector: mock(() => Promise.resolve([
          { id: '1', label: 'Person', properties: { name: 'Alice', embedding: largeEmbedding } },
        ])),
        retrieveSubgraph: mock(() => Promise.resolve({
          entities: [
            { id: '1', label: 'Person', properties: { name: 'Alice', embedding: largeEmbedding } },
          ],
          relationships: [],
        })),
      };

      const testService = new GraphRAGService(
        mockNeo4jWithEmbeddings as any,
        mockEmbeddingService as any
      );

      const query: GraphRAGQuery = {
        query: 'Tell me about Alice',
      };

      await testService.query(query);

      // Verify that generateResponse was called
      expect(mockEmbeddingService.generateResponse).toHaveBeenCalled();
      const responseCall = (mockEmbeddingService.generateResponse as any).mock.calls[0];
      
      if (responseCall) {
        const context = responseCall[1] as string;
        
        // Critical: Embedding should NOT be in the context
        expect(context).not.toContain('embedding');
        expect(context).not.toContain('0.123456789');
        expect(context).not.toContain('[0');
        
        // But name should still be there
        expect(context).toContain('Alice');
        expect(context).toContain('name: Alice');
      }
    });

    it('should filter out _similarity scores from LLM context', async () => {
      const mockNeo4jWithSimilarity = {
        ...mockNeo4jService,
        findEntitiesByVector: mock(() => Promise.resolve([
          { id: '1', label: 'Person', properties: { name: 'Bob', _similarity: 0.85 } },
        ])),
        retrieveSubgraph: mock(() => Promise.resolve({
          entities: [
            { id: '1', label: 'Person', properties: { name: 'Bob', _similarity: 0.85 } },
          ],
          relationships: [],
        })),
      };

      const testService = new GraphRAGService(
        mockNeo4jWithSimilarity as any,
        mockEmbeddingService as any
      );

      const query: GraphRAGQuery = {
        query: 'Tell me about Bob',
      };

      await testService.query(query);

      expect(mockEmbeddingService.generateResponse).toHaveBeenCalled();
      const responseCall = (mockEmbeddingService.generateResponse as any).mock.calls[0];
      
      if (responseCall) {
        const context = responseCall[1] as string;
        
        // Critical: _similarity should NOT be in the context
        expect(context).not.toContain('_similarity');
        expect(context).not.toContain('0.85');
        
        // But name should still be there
        expect(context).toContain('Bob');
        expect(context).toContain('name: Bob');
      }
    });

    it('should filter out both embedding and _similarity when both are present', async () => {
      const largeEmbedding = new Array(1536).fill(0.5);
      
      const mockNeo4jWithBoth = {
        ...mockNeo4jService,
        findEntitiesByVector: mock(() => Promise.resolve([
          { 
            id: '1', 
            label: 'Person', 
            properties: { 
              name: 'Charlie', 
              age: 30,
              embedding: largeEmbedding,
              _similarity: 0.92 
            } 
          },
        ])),
        retrieveSubgraph: mock(() => Promise.resolve({
          entities: [
            { 
              id: '1', 
              label: 'Person', 
              properties: { 
                name: 'Charlie',
                age: 30,
                embedding: largeEmbedding,
                _similarity: 0.92 
              } 
            },
          ],
          relationships: [],
        })),
      };

      const testService = new GraphRAGService(
        mockNeo4jWithBoth as any,
        mockEmbeddingService as any
      );

      const query: GraphRAGQuery = {
        query: 'Tell me about Charlie',
      };

      await testService.query(query);

      expect(mockEmbeddingService.generateResponse).toHaveBeenCalled();
      const responseCall = (mockEmbeddingService.generateResponse as any).mock.calls[0];
      
      if (responseCall) {
        const context = responseCall[1] as string;
        
        // Critical: Both should be filtered out
        expect(context).not.toContain('embedding');
        expect(context).not.toContain('_similarity');
        expect(context).not.toContain('0.92');
        
        // But legitimate properties should remain
        expect(context).toContain('Charlie');
        expect(context).toContain('name: Charlie');
        expect(context).toContain('age: 30');
      }
    });

    it('should preserve legitimate entity properties', async () => {
      const mockNeo4jWithProps = {
        ...mockNeo4jService,
        findEntitiesByVector: mock(() => Promise.resolve([
          { 
            id: '1', 
            label: 'Person', 
            properties: { 
              name: 'David',
              age: 25,
              occupation: 'Engineer',
              location: 'San Francisco'
            } 
          },
        ])),
        retrieveSubgraph: mock(() => Promise.resolve({
          entities: [
            { 
              id: '1', 
              label: 'Person', 
              properties: { 
                name: 'David',
                age: 25,
                occupation: 'Engineer',
                location: 'San Francisco'
              } 
            },
          ],
          relationships: [],
        })),
      };

      const testService = new GraphRAGService(
        mockNeo4jWithProps as any,
        mockEmbeddingService as any
      );

      const query: GraphRAGQuery = {
        query: 'Tell me about David',
      };

      await testService.query(query);

      expect(mockEmbeddingService.generateResponse).toHaveBeenCalled();
      const responseCall = (mockEmbeddingService.generateResponse as any).mock.calls[0];
      
      if (responseCall) {
        const context = responseCall[1] as string;
        
        // All legitimate properties should be present
        expect(context).toContain('name: David');
        expect(context).toContain('age: 25');
        expect(context).toContain('occupation: Engineer');
        expect(context).toContain('location: San Francisco');
      }
    });

    it('should truncate long property values', async () => {
      const longDescription = 'A'.repeat(500); // Very long description
      
      const mockNeo4jWithLongValue = {
        ...mockNeo4jService,
        ensureVectorIndex: mock(() => Promise.resolve()),
        findEntitiesByVector: mock(() => Promise.resolve([
          { 
            id: '1', 
            label: 'Person', 
            properties: { 
              name: 'Eve',
              description: longDescription
            } 
          },
        ])),
        retrieveSubgraph: mock(() => Promise.resolve({
          entities: [
            { 
              id: '1', 
              label: 'Person', 
              properties: { 
                name: 'Eve',
                description: longDescription
              } 
            },
          ],
          relationships: [],
        })),
      };

      const testService = new GraphRAGService(
        mockNeo4jWithLongValue as any,
        mockEmbeddingService as any
      );

      const query: GraphRAGQuery = {
        query: 'Tell me about Eve',
      };

      await testService.query(query);

      expect(mockEmbeddingService.generateResponse).toHaveBeenCalled();
      const responseCall = (mockEmbeddingService.generateResponse as any).mock.calls[0];
      
      if (responseCall) {
        const context = responseCall[1] as string;
        
        // Description should be truncated - check it doesn't contain the full 500 chars
        // The format is "description: <value>", so we need to extract just the value part
        const descriptionMatch = context.match(/description: ([^,\n]+)/);
        if (descriptionMatch) {
          const description = descriptionMatch[1].trim();
          // Should be truncated to 200 chars + '...' = 203 max, but allow some buffer for formatting
          expect(description.length).toBeLessThanOrEqual(250); // Allow some buffer
          // If it's long, it should end with '...'
          if (description.length > 200) {
            expect(description).toEndWith('...');
          }
          // Should NOT contain all 500 'A's
          expect(description).not.toContain('A'.repeat(250));
        }
      }
    });

    it('should limit context size to prevent token limit errors', async () => {
      // Create many entities with properties
      const manyEntities = Array.from({ length: 150 }, (_, i) => ({
        id: `${i}`,
        label: 'Person',
        properties: {
          name: `Person${i}`,
          description: 'A person with a description'.repeat(10), // Long description
          age: i,
        },
      }));

      const mockNeo4jWithMany = {
        ...mockNeo4jService,
        findEntitiesByVector: mock(() => Promise.resolve(manyEntities.slice(0, 10))),
        retrieveSubgraph: mock(() => Promise.resolve({
          entities: manyEntities,
          relationships: [],
        })),
      };

      const testService = new GraphRAGService(
        mockNeo4jWithMany as any,
        mockEmbeddingService as any
      );

      const query: GraphRAGQuery = {
        query: 'Tell me about people',
      };

      await testService.query(query);

      expect(mockEmbeddingService.generateResponse).toHaveBeenCalled();
      const responseCall = (mockEmbeddingService.generateResponse as any).mock.calls[0];
      
      if (responseCall) {
        const context = responseCall[1] as string;
        
        // Context should be limited (should not include all 150 entities)
        // Should be limited to ~200,000 chars max
        expect(context.length).toBeLessThanOrEqual(250000); // Some buffer for headers
        
        // Should indicate truncation if entities were limited
        if (manyEntities.length > 100) {
          expect(context).toContain('of 150 total');
        }
      }
    });

    it('should include relationship information in context', async () => {
      const mockNeo4jWithRels = {
        ...mockNeo4jService,
        findEntitiesByVector: mock(() => Promise.resolve([
          { id: '1', label: 'Person', properties: { name: 'Alice' } },
          { id: '2', label: 'Person', properties: { name: 'Bob' } },
        ])),
        retrieveSubgraph: mock(() => Promise.resolve({
          entities: [
            { id: '1', label: 'Person', properties: { name: 'Alice' } },
            { id: '2', label: 'Person', properties: { name: 'Bob' } },
          ],
          relationships: [
            { id: 'r1', type: 'KNOWS', from: '1', to: '2', properties: { since: 2020 } },
          ],
        })),
      };

      const testService = new GraphRAGService(
        mockNeo4jWithRels as any,
        mockEmbeddingService as any
      );

      const query: GraphRAGQuery = {
        query: 'What relationships exist?',
      };

      await testService.query(query);

      expect(mockEmbeddingService.generateResponse).toHaveBeenCalled();
      const responseCall = (mockEmbeddingService.generateResponse as any).mock.calls[0];
      
      if (responseCall) {
        const context = responseCall[1] as string;
        
        // Should include relationship information
        expect(context).toContain('Relationships');
        expect(context).toContain('KNOWS');
        expect(context).toContain('Alice');
        expect(context).toContain('Bob');
      }
    });
  });

  describe('extractEntitiesAndRelationships', () => {
    beforeEach(() => {
      // Reset mocks
      if (mockEmbeddingService.generateResponse.mockClear) {
        mockEmbeddingService.generateResponse.mockClear();
      }
    });

    it('should extract entities and relationships from text', async () => {
      const mockLLMResponse = JSON.stringify({
        entities: [
          { label: 'Person', properties: { name: 'Alice', age: 30 } },
          { label: 'Company', properties: { name: 'TechCorp' } },
        ],
        relationships: [
          { from: 'Alice', to: 'TechCorp', type: 'WORKS_FOR' },
        ],
      });

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      const result = await service.extractEntitiesAndRelationships(
        'Alice works at TechCorp. She is 30 years old.'
      );

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].label).toBe('Person');
      expect(result.entities[0].properties.name).toBe('Alice');
      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0].type).toBe('WORKS_FOR');
    });

    it('should filter out self-referential relationships', async () => {
      const mockLLMResponse = JSON.stringify({
        entities: [
          { label: 'Person', properties: { name: 'Alice' } },
        ],
        relationships: [
          { from: 'Alice', to: 'Alice', type: 'KNOWS' }, // Self-referential
        ],
      });

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      const result = await service.extractEntitiesAndRelationships('Alice knows herself.');

      expect(result.entities).toHaveLength(1);
      expect(result.relationships).toHaveLength(0); // Should be filtered out
    });

    it('should filter out duplicate relationships', async () => {
      const mockLLMResponse = JSON.stringify({
        entities: [
          { label: 'Person', properties: { name: 'Alice' } },
          { label: 'Person', properties: { name: 'Bob' } },
        ],
        relationships: [
          { from: 'Alice', to: 'Bob', type: 'KNOWS' },
          { from: 'Alice', to: 'Bob', type: 'KNOWS' }, // Duplicate
        ],
      });

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      const result = await service.extractEntitiesAndRelationships('Alice knows Bob.');

      expect(result.relationships).toHaveLength(1); // Duplicate filtered out
    });

    it('should filter out invalid relationship types', async () => {
      const mockLLMResponse = JSON.stringify({
        entities: [
          { label: 'Person', properties: { name: 'Alice' } },
          { label: 'Person', properties: { name: 'Bob' } },
        ],
        relationships: [
          { from: 'Alice', to: 'Bob', type: 'knows' }, // Lowercase, invalid
          { from: 'Alice', to: 'Bob', type: 'KNOWS' }, // Valid
        ],
      });

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      const result = await service.extractEntitiesAndRelationships('Alice knows Bob.');

      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0].type).toBe('KNOWS');
    });

    it('should handle markdown-wrapped JSON response', async () => {
      const mockLLMResponse = `Here is the extracted graph:
\`\`\`json
{
  "entities": [
    { "label": "Person", "properties": { "name": "Alice" } }
  ],
  "relationships": []
}
\`\`\``;

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      const result = await service.extractEntitiesAndRelationships('Alice exists.');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].properties.name).toBe('Alice');
    });

    it('should handle JSON wrapped in text', async () => {
      const mockLLMResponse = `The extracted entities are:
{
  "entities": [
    { "label": "Person", "properties": { "name": "Bob" } }
  ],
  "relationships": []
}
This is the complete structure.`;

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      const result = await service.extractEntitiesAndRelationships('Bob exists.');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].properties.name).toBe('Bob');
    });

    it('should validate entities have required name or title property', async () => {
      const mockLLMResponse = JSON.stringify({
        entities: [
          { label: 'Person', properties: { name: 'Alice' } }, // Valid
          { label: 'Person', properties: { age: 30 } }, // Missing name/title
        ],
        relationships: [],
      });

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      await expect(
        service.extractEntitiesAndRelationships('Some text')
      ).rejects.toThrow('missing name/title property');
    });

    it('should throw error if LLM response is not valid JSON', async () => {
      mockEmbeddingService.generateResponse.mockResolvedValueOnce('Not valid JSON');

      await expect(
        service.extractEntitiesAndRelationships('Some text')
      ).rejects.toThrow('Failed to extract graph structure');
    });

    it('should throw error if response missing entities array', async () => {
      const mockLLMResponse = JSON.stringify({
        relationships: [],
      });

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      await expect(
        service.extractEntitiesAndRelationships('Some text')
      ).rejects.toThrow('missing entities array');
    });

    it('should throw error if response missing relationships array', async () => {
      const mockLLMResponse = JSON.stringify({
        entities: [{ label: 'Person', properties: { name: 'Alice' } }],
      });

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      await expect(
        service.extractEntitiesAndRelationships('Some text')
      ).rejects.toThrow('missing relationships array');
    });
  });

  describe('extractAndCreate', () => {
    beforeEach(() => {
      // Reset mocks
      if (mockNeo4jService.createEntities.mockClear) {
        mockNeo4jService.createEntities.mockClear();
      }
      if (mockNeo4jService.createRelationships.mockClear) {
        mockNeo4jService.createRelationships.mockClear();
      }
      if (mockEmbeddingService.generateResponse.mockClear) {
        mockEmbeddingService.generateResponse.mockClear();
      }
      if (mockEmbeddingService.generateEmbeddings.mockClear) {
        mockEmbeddingService.generateEmbeddings.mockClear();
      }
    });

    it('should extract and create entities and relationships', async () => {
      const mockLLMResponse = JSON.stringify({
        entities: [
          { label: 'Person', properties: { name: 'Alice' } },
          { label: 'Company', properties: { name: 'TechCorp' } },
        ],
        relationships: [
          { from: 'Alice', to: 'TechCorp', type: 'WORKS_FOR' },
        ],
      });

      const mockCreatedEntities = [
        { id: '1', label: 'Person', properties: { name: 'Alice' } },
        { id: '2', label: 'Company', properties: { name: 'TechCorp' } },
      ];

      const mockCreatedRelationships = [
        { id: 'r1', type: 'WORKS_FOR', from: '1', to: '2', properties: {} },
      ];

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);
      mockEmbeddingService.generateEmbeddings.mockResolvedValueOnce([
        new Array(1536).fill(0.1),
        new Array(1536).fill(0.2),
      ]);
      mockNeo4jService.createEntities.mockResolvedValueOnce(mockCreatedEntities);
      mockNeo4jService.createRelationships.mockResolvedValueOnce(mockCreatedRelationships);

      const result = await service.extractAndCreate('Alice works at TechCorp.');

      expect(result.entities).toHaveLength(2);
      expect(result.relationships).toHaveLength(1);
      expect(result.created.entities).toBe(2);
      expect(result.created.relationships).toBe(1);
      expect(result.summary).toContain('2 entities');
      expect(result.summary).toContain('1 relationships');
    });

    it('should filter relationships where entities are not found', async () => {
      const mockLLMResponse = JSON.stringify({
        entities: [
          { label: 'Person', properties: { name: 'Alice' } },
        ],
        relationships: [
          { from: 'Alice', to: 'Nonexistent', type: 'KNOWS' },
        ],
      });

      const mockCreatedEntities = [
        { id: '1', label: 'Person', properties: { name: 'Alice' } },
      ];

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);
      mockEmbeddingService.generateEmbeddings.mockResolvedValueOnce([
        new Array(1536).fill(0.1),
      ]);
      mockNeo4jService.createEntities.mockResolvedValueOnce(mockCreatedEntities);
      mockNeo4jService.createRelationships.mockResolvedValueOnce([]);

      const result = await service.extractAndCreate('Alice knows someone.');

      expect(result.entities).toHaveLength(1);
      expect(result.relationships).toHaveLength(0); // Relationship filtered out
      expect(result.created.relationships).toBe(0);
    });

    it('should filter self-referential relationships by entity ID', async () => {
      const mockLLMResponse = JSON.stringify({
        entities: [
          { label: 'Person', properties: { name: 'Alice' } },
        ],
        relationships: [
          { from: 'Alice', to: 'Alice', type: 'KNOWS' },
        ],
      });

      const mockCreatedEntities = [
        { id: '1', label: 'Person', properties: { name: 'Alice' } },
      ];

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);
      mockEmbeddingService.generateEmbeddings.mockResolvedValueOnce([
        new Array(1536).fill(0.1),
      ]);
      mockNeo4jService.createEntities.mockResolvedValueOnce(mockCreatedEntities);
      mockNeo4jService.createRelationships.mockResolvedValueOnce([]);

      const result = await service.extractAndCreate('Alice knows herself.');

      expect(result.relationships).toHaveLength(0); // Self-ref filtered out
    });

    it('should filter semantically invalid relationships', async () => {
      const mockLLMResponse = JSON.stringify({
        entities: [
          { label: 'Film', properties: { title: 'Inception' } },
          { label: 'Person', properties: { name: 'Alice' } },
        ],
        relationships: [
          { from: 'Inception', to: 'Alice', type: 'FATHER_OF' }, // Invalid: Film cannot have FATHER_OF
        ],
      });

      const mockCreatedEntities = [
        { id: '1', label: 'Film', properties: { title: 'Inception' } },
        { id: '2', label: 'Person', properties: { name: 'Alice' } },
      ];

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);
      mockEmbeddingService.generateEmbeddings.mockResolvedValueOnce([
        new Array(1536).fill(0.1),
        new Array(1536).fill(0.2),
      ]);
      mockNeo4jService.createEntities.mockResolvedValueOnce(mockCreatedEntities);
      mockNeo4jService.createRelationships.mockResolvedValueOnce([]);

      const result = await service.extractAndCreate('Inception is the father of Alice.');

      expect(result.relationships).toHaveLength(0); // Invalid relationship filtered out
    });

    it('should generate embeddings for all entities', async () => {
      const mockLLMResponse = JSON.stringify({
        entities: [
          { label: 'Person', properties: { name: 'Bob' } },
          { label: 'Person', properties: { name: 'Charlie' } },
        ],
        relationships: [],
      });

      const mockCreatedEntities = [
        { id: '1', label: 'Person', properties: { name: 'Bob' } },
        { id: '2', label: 'Person', properties: { name: 'Charlie' } },
      ];

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);
      mockEmbeddingService.generateEmbeddings.mockResolvedValueOnce([
        new Array(1536).fill(0.1),
        new Array(1536).fill(0.2),
      ]);
      mockNeo4jService.createEntities.mockResolvedValueOnce(mockCreatedEntities);

      await service.extractAndCreate('Bob and Charlie exist.');

      expect(mockEmbeddingService.generateEmbeddings).toHaveBeenCalled();
      const call = (mockEmbeddingService.generateEmbeddings as any).mock.calls[0];
      expect(call[0]).toHaveLength(2); // Should generate embeddings for 2 entities
    });

    it('should create relationships with correct entity IDs', async () => {
      const mockLLMResponse = JSON.stringify({
        entities: [
          { label: 'Person', properties: { name: 'Alice' } },
          { label: 'Person', properties: { name: 'Bob' } },
        ],
        relationships: [
          { from: 'Alice', to: 'Bob', type: 'KNOWS' },
        ],
      });

      const mockCreatedEntities = [
        { id: '1', label: 'Person', properties: { name: 'Alice' } },
        { id: '2', label: 'Person', properties: { name: 'Bob' } },
      ];

      const mockCreatedRelationships = [
        { id: 'r1', type: 'KNOWS', from: '1', to: '2', properties: {} },
      ];

      mockEmbeddingService.generateResponse.mockResolvedValueOnce(mockLLMResponse);
      mockEmbeddingService.generateEmbeddings.mockResolvedValueOnce([
        new Array(1536).fill(0.1),
        new Array(1536).fill(0.2),
      ]);
      mockNeo4jService.createEntities.mockResolvedValueOnce(mockCreatedEntities);
      mockNeo4jService.createRelationships.mockResolvedValueOnce(mockCreatedRelationships);

      await service.extractAndCreate('Alice knows Bob.');

      expect(mockNeo4jService.createRelationships).toHaveBeenCalled();
      const call = (mockNeo4jService.createRelationships as any).mock.calls[0];
      expect(call[0][0].from).toBe('1'); // Should use entity ID, not name
      expect(call[0][0].to).toBe('2');
      expect(call[0][0].type).toBe('KNOWS');
    });
  });
});

