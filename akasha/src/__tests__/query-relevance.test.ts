import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Akasha } from '../akasha';
import { createTestConfig, createMockEmbeddingProvider, createMockLLMProvider } from './test-helpers';

describe('Query Relevance Filtering', () => {
  let mockDatabaseProvider: any;
  let mockEmbeddingProvider: any;
  let mockLLMProvider: any;

  beforeEach(() => {
    mockDatabaseProvider = {
      connect: mock(() => Promise.resolve()),
      disconnect: mock(() => Promise.resolve()),
      ensureVectorIndex: mock(() => Promise.resolve()),
      findDocumentsByVector: mock(() => Promise.resolve([])),
      findEntitiesByVector: mock(() => Promise.resolve([])),
      retrieveSubgraph: mock(() => Promise.resolve({ entities: [], relationships: [] })),
      getEntitiesFromDocuments: mock(() => Promise.resolve([])),
      ping: mock(() => Promise.resolve(true)),
      createEntities: mock(() => Promise.resolve([])),
      createRelationships: mock(() => Promise.resolve([])),
      createDocument: mock(() => Promise.resolve({ id: 'doc1', label: 'Document', properties: {} })),
      linkEntityToDocument: mock(() => Promise.resolve({ id: 'rel1', type: 'CONTAINS_ENTITY', from: 'doc1', to: '1', properties: {} })),
      findEntityByName: mock(() => Promise.resolve(null)),
      findDocumentByText: mock(() => Promise.resolve(null)),
      updateDocumentContextIds: mock(() => Promise.resolve({ id: 'doc1', label: 'Document', properties: {} })),
      updateEntityContextIds: mock(() => Promise.resolve({ id: '1', label: 'Entity', properties: {} })),
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
    };

    mockEmbeddingProvider = createMockEmbeddingProvider();
    mockEmbeddingProvider.generateEmbedding = mock(() => Promise.resolve([0.1, 0.2, 0.3]));
    
    mockLLMProvider = createMockLLMProvider();
    mockLLMProvider.generateResponse = mock(() => Promise.resolve('Test answer'));
  });

  describe('should filter out irrelevant documents with low similarity', () => {
    it('should not return documents below similarity threshold', async () => {
      // Mock documents with varying similarity scores
      const irrelevantDocs = [
        {
          id: '1',
          label: 'Document' as const,
          properties: {
            text: 'Completely unrelated document about cooking recipes',
            _similarity: 0.3, // Below threshold
            scopeId: 'test',
          },
        },
        {
          id: '2',
          label: 'Document' as const,
          properties: {
            text: 'Another unrelated document about weather',
            _similarity: 0.4, // Below threshold
            scopeId: 'test',
          },
        },
      ];

      const relevantDocs = [
        {
          id: '3',
          label: 'Document' as const,
          properties: {
            text: 'Relevant document about the query topic',
            _similarity: 0.75, // Above threshold
            scopeId: 'test',
          },
        },
      ];

      // Mock findDocumentsByVector to return all docs (simulating current buggy behavior)
      mockDatabaseProvider.findDocumentsByVector = mock(() =>
        Promise.resolve([...irrelevantDocs, ...relevantDocs])
      );

      const kg = new Akasha(
        createTestConfig({
          scope: {
            id: 'test',
            type: 'test',
            name: 'Test',
          },
        }),
        mockDatabaseProvider,
        mockEmbeddingProvider,
        mockLLMProvider
      );

      await kg.initialize();

      const result = await kg.ask('What is the query topic?', {
        strategy: 'documents',
      });

      // Should only include relevant documents (similarity >= threshold)
      // The fix should ensure only documents with similarity >= 0.7 are included
      if (result.context.documents) {
        result.context.documents.forEach((doc) => {
          const similarity = doc.properties._similarity as number;
          expect(similarity).toBeGreaterThanOrEqual(0.7);
        });
      }

      await kg.cleanup();
    });

    it('should return empty results when all documents are below threshold', async () => {
      const irrelevantDocs = [
        {
          id: '1',
          label: 'Document' as const,
          properties: {
            text: 'Unrelated document',
            _similarity: 0.3,
            scopeId: 'test',
          },
        },
        {
          id: '2',
          label: 'Document' as const,
          properties: {
            text: 'Another unrelated document',
            _similarity: 0.4,
            scopeId: 'test',
          },
        },
      ];

      mockDatabaseProvider.findDocumentsByVector = mock(() =>
        Promise.resolve(irrelevantDocs)
      );

      const kg = new Akasha(
        createTestConfig({
          scope: {
            id: 'test',
            type: 'test',
            name: 'Test',
          },
        }),
        mockDatabaseProvider,
        mockEmbeddingProvider,
        mockLLMProvider
      );

      await kg.initialize();

      const result = await kg.ask('What is a completely unrelated topic?', {
        strategy: 'documents',
      });

      // Should return no results when all documents are irrelevant
      expect(result.context.documents).toEqual([]);
      expect(result.answer).toContain('could not find any relevant information');

      await kg.cleanup();
    });
  });

  describe('should filter out irrelevant entities with low similarity', () => {
    it('should not return entities below similarity threshold', async () => {
      const irrelevantEntities = [
        {
          id: '1',
          label: 'Person',
          properties: {
            name: 'Unrelated Person',
            _similarity: 0.3,
            scopeId: 'test',
          },
        },
        {
          id: '2',
          label: 'Company',
          properties: {
            name: 'Unrelated Company',
            _similarity: 0.4,
            scopeId: 'test',
          },
        },
      ];

      const relevantEntities = [
        {
          id: '3',
          label: 'Person',
          properties: {
            name: 'Relevant Person',
            _similarity: 0.8,
            scopeId: 'test',
          },
        },
      ];

      mockDatabaseProvider.findEntitiesByVector = mock(() =>
        Promise.resolve([...irrelevantEntities, ...relevantEntities])
      );

      const kg = new Akasha(
        createTestConfig({
          scope: {
            id: 'test',
            type: 'test',
            name: 'Test',
          },
        }),
        mockDatabaseProvider,
        mockEmbeddingProvider,
        mockLLMProvider
      );

      await kg.initialize();

      const result = await kg.ask('Who is the relevant person?', {
        strategy: 'entities',
      });

      // Should only include relevant entities
      result.context.entities.forEach((entity) => {
        const similarity = entity.properties._similarity as number;
        expect(similarity).toBeGreaterThanOrEqual(0.7);
      });

      await kg.cleanup();
    });
  });

  describe('should not retrieve all entities from documents when documents are irrelevant', () => {
    it('should only retrieve entities from relevant documents', async () => {
      // Simulate scenario where we have relevant and irrelevant documents
      const relevantDoc = {
        id: '1',
        label: 'Document' as const,
        properties: {
          text: 'Relevant document',
          _similarity: 0.8,
          scopeId: 'test',
        },
      };

      const irrelevantDoc = {
        id: '2',
        label: 'Document' as const,
        properties: {
          text: 'Irrelevant document',
          _similarity: 0.3, // Below threshold
          scopeId: 'test',
        },
      };

      // Mock: findDocumentsByVector should only return relevant docs after filtering
      mockDatabaseProvider.findDocumentsByVector = mock(() =>
        Promise.resolve([relevantDoc]) // Only relevant doc after filtering
      );

      // Mock getEntitiesFromDocuments to return entities from relevant documents
      mockDatabaseProvider.getEntitiesFromDocuments = mock(() =>
        Promise.resolve([
          { id: '10', label: 'Person', properties: { name: 'Alice', scopeId: 'test' } },
        ])
      );

      const kg = new Akasha(
        createTestConfig({
          scope: {
            id: 'test',
            type: 'test',
            name: 'Test',
          },
        }),
        mockDatabaseProvider,
        mockEmbeddingProvider,
        mockLLMProvider
      );

      await kg.initialize();

      const result = await kg.ask('What is in the relevant document?', {
        strategy: 'both',
      });

      // Should only retrieve entities from relevant documents
      // Verify getEntitiesFromDocuments was called with only relevant document IDs
      expect(mockDatabaseProvider.getEntitiesFromDocuments).toHaveBeenCalled();
      const call = mockDatabaseProvider.getEntitiesFromDocuments.mock.calls[0];
      const documentIds = call[0] as string[];
      // Should only query for entities from relevant document IDs (those above threshold)
      expect(documentIds).not.toContain('2'); // Irrelevant document should be excluded
      expect(documentIds.length).toBeGreaterThan(0); // Should have at least one relevant document

      await kg.cleanup();
    });
  });

  describe('similarity threshold configuration', () => {
    it('should use default threshold of 0.7 for better relevance', async () => {
      const kg = new Akasha(
        createTestConfig({
          scope: {
            id: 'test',
            type: 'test',
            name: 'Test',
          },
        }),
        mockDatabaseProvider,
        mockEmbeddingProvider,
        mockLLMProvider
      );

      await kg.initialize();

      // When calling ask(), it should use 0.7 as default threshold
      await kg.ask('Test query');

      // Verify findDocumentsByVector was called with threshold >= 0.7
      expect(mockDatabaseProvider.findDocumentsByVector).toHaveBeenCalled();
      const call = mockDatabaseProvider.findDocumentsByVector.mock.calls[0];
      const threshold = call[2]; // Third parameter is similarityThreshold
      expect(threshold).toBeGreaterThanOrEqual(0.7);

      await kg.cleanup();
    });

    it('should allow custom similarity threshold via QueryOptions', async () => {
      const kg = new Akasha(
        createTestConfig({
          scope: {
            id: 'test',
            type: 'test',
            name: 'Test',
          },
        }),
        mockDatabaseProvider,
        mockEmbeddingProvider,
        mockLLMProvider
      );

      await kg.initialize();

      await kg.ask('Test query', {
        similarityThreshold: 0.8, // Custom higher threshold
      });

      expect(mockDatabaseProvider.findDocumentsByVector).toHaveBeenCalled();
      const call = mockDatabaseProvider.findDocumentsByVector.mock.calls[0];
      const threshold = call[2];
      expect(threshold).toBe(0.8);

      await kg.cleanup();
    });
  });
});

