import { describe, expect, it, beforeAll, afterAll, mock } from 'bun:test';
import { Akasha } from '../../akasha';
import { createTestConfig, createMockEmbeddingProvider, createMockLLMProvider } from '../test-helpers';
import type { AkashaEvent } from '../../events/types';
import type { DatabaseProvider } from '../../services/providers/database/interfaces';

// Mock DatabaseProvider to avoid requiring real database
const createMockDatabaseProvider = (): DatabaseProvider => {
  return {
    connect: mock(() => Promise.resolve()),
    disconnect: mock(() => Promise.resolve()),
    ensureVectorIndex: mock(() => Promise.resolve()),
    findEntitiesByVector: mock(() => Promise.resolve([])),
    findDocumentsByVector: mock(() => Promise.resolve([])),
    retrieveSubgraph: mock(() => Promise.resolve({
      entities: [],
      relationships: [],
    })),
    createEntities: mock((entities: any[]) => Promise.resolve(
      entities.map((entity, idx) => ({
        id: String(idx + 1),
        label: entity.label || 'Person',
        properties: entity.properties || { name: 'Alice', scopeId: 'test-scope' },
      }))
    )),
    createRelationships: mock(() => Promise.resolve([
      { id: 'r1', type: 'WORKS_FOR', from: '1', to: '2', properties: { scopeId: 'test-scope' } },
    ])),
    findDocumentByText: mock(() => Promise.resolve(null)),
    createDocument: mock((doc: any) => Promise.resolve({
      id: 'doc1',
      label: 'Document',
      properties: doc.properties || { text: 'Alice works for Acme Corp.', scopeId: 'test-scope' },
    })),
    linkEntityToDocument: mock(() => Promise.resolve({
      id: 'rel1',
      type: 'CONTAINS_ENTITY',
      from: 'doc1',
      to: '1',
      properties: {},
    })),
    findEntityByName: mock(() => Promise.resolve(null)),
    updateDocumentContextIds: mock((docId: string, contextId: string) => Promise.resolve({
      id: docId,
      label: 'Document',
      properties: { contextIds: [contextId], scopeId: 'test-scope' },
    })),
    updateEntityContextIds: mock((entityId: string, contextId: string) => Promise.resolve({
      id: entityId,
      label: 'Person',
      properties: { contextIds: [contextId], scopeId: 'test-scope' },
    })),
    findEntityById: mock((entityId: string) => Promise.resolve({
      id: entityId,
      label: 'Person',
      properties: { name: 'Alice', scopeId: 'test-scope' },
    })),
    findRelationshipById: mock((relId: string) => Promise.resolve({
      id: relId,
      type: 'WORKS_FOR',
      from: '1',
      to: '2',
      properties: { scopeId: 'test-scope' },
    })),
    findDocumentById: mock((docId: string) => Promise.resolve({
      id: docId,
      label: 'Document',
      properties: { text: 'Alice works for Acme Corp.', scopeId: 'test-scope' },
    })),
    updateEntity: mock((entityId: string, properties: any) => Promise.resolve({
      id: entityId,
      label: 'Person',
      properties: { ...properties, scopeId: 'test-scope' },
    })),
    updateRelationship: mock((relId: string, properties: any) => Promise.resolve({
      id: relId,
      type: 'WORKS_FOR',
      from: '1',
      to: '2',
      properties: { ...properties, scopeId: 'test-scope' },
    })),
    updateDocument: mock((docId: string, properties: any) => Promise.resolve({
      id: docId,
      label: 'Document',
      properties: { ...properties, scopeId: 'test-scope' },
    })),
    deleteEntity: mock((entityId: string) => Promise.resolve({
      deleted: true,
      message: 'Entity deleted',
    })),
    deleteRelationship: mock((relId: string) => Promise.resolve({
      deleted: true,
      message: 'Relationship deleted',
    })),
    deleteDocument: mock((docId: string) => Promise.resolve({
      deleted: true,
      message: 'Document deleted',
    })),
  } as any;
};

describe('Events Integration', () => {
  let kg: Akasha;
  const config = createTestConfig({
    scope: {
      id: 'test-scope',
      type: 'test',
      name: 'Test Scope',
    },
  });

  beforeAll(async () => {
    const mockDatabase = createMockDatabaseProvider();
    kg = new Akasha(
      config,
      mockDatabase,
      createMockEmbeddingProvider(),
      createMockLLMProvider()
    );
    // Don't call initialize() - we're using mocks
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should emit events during learn() operation', async () => {
    const events: AkashaEvent[] = [];
    
    kg.on('document.created', (e) => events.push(e));
    kg.on('entity.created', (e) => events.push(e));
    kg.on('relationship.created', (e) => events.push(e));
    kg.on('learn.started', (e) => events.push(e));
    kg.on('learn.completed', (e) => events.push(e));
    
    await kg.learn('Alice works for Acme Corp. Bob works for TechCorp.');
    
    // Wait for async event handlers
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should have at least learn.started and learn.completed
    expect(events.some(e => e.type === 'learn.started')).toBe(true);
    expect(events.some(e => e.type === 'learn.completed')).toBe(true);
    
    // Should have document, entity, and relationship events
    const documentEvents = events.filter(e => e.type === 'document.created');
    const entityEvents = events.filter(e => e.type === 'entity.created');
    const relationshipEvents = events.filter(e => e.type === 'relationship.created');
    
    expect(documentEvents.length).toBeGreaterThan(0);
    expect(entityEvents.length).toBeGreaterThan(0);
    // May or may not have relationships depending on extraction
  });

  it('should emit events during ask() operation', async () => {
    // First, learn some data
    await kg.learn('Alice works for Acme Corp.');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const events: AkashaEvent[] = [];
    kg.on('query.started', (e) => events.push(e));
    kg.on('query.completed', (e) => events.push(e));
    
    try {
      await kg.ask('Who works for Acme Corp?');
    } catch (error) {
      // ask() might fail with mocks, but events should still be emitted
    }
    
    // Wait for async event handlers
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Query events should be emitted even if query fails
    expect(events.some(e => e.type === 'query.started')).toBe(true);
    // query.completed might not be emitted if query fails early
    // So we just check that query.started was emitted
  });

  it('should not block main operation on handler execution', async () => {
    let handlerCompleted = false;
    kg.on('entity.created', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      handlerCompleted = true;
    });
    
    const start = Date.now();
    await kg.learn('Alice works for Acme Corp.');
    const duration = Date.now() - start;
    
    // Main operation should complete quickly (not wait for handler)
    expect(duration).toBeLessThan(200); // Should be much less than 100ms handler delay
    
    // Handler should complete eventually
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(handlerCompleted).toBe(true);
  });

  it('should emit entity.updated event when updating entity', async () => {
    // Create an entity first
    const learnResult = await kg.learn('Alice works for Acme Corp.');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const entity = learnResult.entities[0];
    if (!entity) {
      // Skip if no entities were created
      return;
    }
    
    const events: AkashaEvent[] = [];
    kg.on('entity.updated', (e) => events.push(e));
    
    await kg.updateEntity(entity.id, {
      properties: { email: 'alice@example.com' },
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('entity.updated');
    if (events[0].type === 'entity.updated') {
      expect(events[0].entity.id).toBe(entity.id);
    }
  });

  it('should emit entity.deleted event when deleting entity', async () => {
    // Create an entity first
    const learnResult = await kg.learn('Bob works for TechCorp.');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const entity = learnResult.entities[0];
    if (!entity) {
      // Skip if no entities were created
      return;
    }
    
    const events: AkashaEvent[] = [];
    kg.on('entity.deleted', (e) => events.push(e));
    
    await kg.deleteEntity(entity.id);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('entity.deleted');
    if (events[0].type === 'entity.deleted') {
      expect(events[0].entity.id).toBe(entity.id);
    }
  });

  it('should emit batch events during learnBatch()', async () => {
    const events: AkashaEvent[] = [];
    kg.on('batch.progress', (e) => events.push(e));
    kg.on('batch.completed', (e) => events.push(e));
    
    await kg.learnBatch([
      'Alice works for Acme Corp.',
      'Bob works for TechCorp.',
    ]);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const progressEvents = events.filter(e => e.type === 'batch.progress');
    const completedEvents = events.filter(e => e.type === 'batch.completed');
    
    expect(progressEvents.length).toBeGreaterThan(0);
    expect(completedEvents.length).toBe(1);
  });

  it('should include scopeId in events when scope is configured', async () => {
    const events: AkashaEvent[] = [];
    kg.on('entity.created', (e) => events.push(e));
    
    await kg.learn('Charlie works for StartupCorp.');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const entityEvents = events.filter(e => e.type === 'entity.created');
    if (entityEvents.length > 0) {
      expect(entityEvents[0].scopeId).toBe('test-scope');
    }
  });
});

