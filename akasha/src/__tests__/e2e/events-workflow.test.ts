import { describe, expect, it, beforeAll, afterAll, mock } from 'bun:test';
import { Akasha } from '../../akasha';
import { createTestConfig, createMockEmbeddingProvider, createMockLLMProvider } from '../test-helpers';
import type { AkashaEvent } from '../../events/types';
import { Neo4jService } from '../../services/neo4j.service';

// Mock Neo4j service
const createMockNeo4jService = () => {
  const mockSession = {
    run: mock(() => Promise.resolve({
      records: [],
    })),
    close: mock(() => Promise.resolve()),
  } as any;

  return {
    connect: mock(() => Promise.resolve()),
    disconnect: mock(() => Promise.resolve()),
    ensureVectorIndex: mock(() => Promise.resolve()),
    getSession: mock(() => mockSession),
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
  } as any;
};

describe('Events E2E Workflows', () => {
  let kg: Akasha;
  const config = createTestConfig({
    scope: {
      id: 'test-scope',
      type: 'test',
      name: 'Test Scope',
    },
  });

  beforeAll(async () => {
    const mockNeo4j = createMockNeo4jService();
    kg = new Akasha(
      config,
      mockNeo4j as unknown as Neo4jService,
      createMockEmbeddingProvider(),
      createMockLLMProvider()
    );
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should handle complete event workflow with multiple handlers', async () => {
    const entityEvents: AkashaEvent[] = [];
    const learnEvents: AkashaEvent[] = [];
    const allEvents: AkashaEvent[] = [];

    // Register multiple handlers
    kg.on('entity.created', (e) => {
      entityEvents.push(e);
      allEvents.push(e);
    });

    kg.on('learn.started', (e) => {
      learnEvents.push(e);
      allEvents.push(e);
    });

    kg.on('learn.completed', (e) => {
      learnEvents.push(e);
      allEvents.push(e);
    });

    // Perform learning
    await kg.learn('Alice works for Acme Corp.');
    
    // Wait for async event handlers
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify events were emitted
    expect(learnEvents.length).toBeGreaterThan(0);
    expect(learnEvents.some(e => e.type === 'learn.started')).toBe(true);
    expect(learnEvents.some(e => e.type === 'learn.completed')).toBe(true);
    
    // Entity events may or may not be emitted depending on extraction
    expect(allEvents.length).toBeGreaterThan(0);
  });

  it('should handle batch learning with events', async () => {
    const events: AkashaEvent[] = [];
    
    kg.on('entity.created', (e) => events.push(e));
    kg.on('learn.completed', (e) => events.push(e));
    kg.on('batch.progress', (e) => events.push(e));
    kg.on('batch.completed', (e) => events.push(e));
    
    await kg.learnBatch([
      'Alice works for Acme Corp.',
      'Bob works for TechCorp.',
    ]);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should have batch events
    const batchProgressEvents = events.filter(e => e.type === 'batch.progress');
    const batchCompletedEvents = events.filter(e => e.type === 'batch.completed');
    
    expect(batchProgressEvents.length).toBeGreaterThan(0);
    expect(batchCompletedEvents.length).toBe(1);
    
    // Should have learn.completed events for each item
    const learnCompletedEvents = events.filter(e => e.type === 'learn.completed');
    expect(learnCompletedEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('should support event handler removal', async () => {
    const events: AkashaEvent[] = [];
    
    const handler = (e: AkashaEvent) => {
      events.push(e);
    };
    
    kg.on('entity.created', handler);
    
    // First learn - handler should be called
    await kg.learn('Alice works for Acme Corp.');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const firstCount = events.length;
    
    // Remove handler
    kg.off('entity.created', handler);
    
    // Second learn - handler should NOT be called
    await kg.learn('Bob works for TechCorp.');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Event count should not have increased
    expect(events.length).toBe(firstCount);
  });

  it('should support once() handler', async () => {
    const events: AkashaEvent[] = [];
    
    kg.once('learn.completed', (e) => {
      events.push(e);
    });
    
    // First learn - handler should be called
    await kg.learn('Alice works for Acme Corp.');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(events.length).toBe(1);
    
    // Second learn - handler should NOT be called again
    await kg.learn('Bob works for TechCorp.');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Event count should still be 1
    expect(events.length).toBe(1);
  });

  it('should handle async event handlers without blocking', async () => {
    let handlerCompleted = false;
    
    kg.on('entity.created', async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      handlerCompleted = true;
    });
    
    const start = Date.now();
    await kg.learn('Alice works for Acme Corp.');
    const duration = Date.now() - start;
    
    // Main operation should complete quickly
    expect(duration).toBeLessThan(100);
    
    // Handler should complete eventually
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(handlerCompleted).toBe(true);
  });
});

