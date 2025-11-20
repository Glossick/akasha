import { describe, expect, it } from 'bun:test';
import type {
  EntityEvent,
  RelationshipEvent,
  DocumentEvent,
  LearnEvent,
  QueryEvent,
  BatchEvent,
  AkashaEvent,
} from '../../events/types';
import type { Entity, Relationship, Document, ExtractResult } from '../../types';

describe('Event Types', () => {
  describe('Entity Events', () => {
    it('should create entity.created event with correct payload', () => {
      const entity: Entity = {
        id: '1',
        label: 'Person',
        properties: { name: 'Alice', scopeId: 'tenant-1' },
      };

      const event: EntityEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        entity,
      };

      expect(event.type).toBe('entity.created');
      expect(event.entity).toEqual(entity);
      expect(event.scopeId).toBe('tenant-1');
      expect(event.timestamp).toBeDefined();
    });

    it('should create entity.updated event with correct payload', () => {
      const entity: Entity = {
        id: '1',
        label: 'Person',
        properties: { name: 'Alice Updated', scopeId: 'tenant-1' },
      };

      const event: EntityEvent = {
        type: 'entity.updated',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        entity,
      };

      expect(event.type).toBe('entity.updated');
      expect(event.entity).toEqual(entity);
    });

    it('should create entity.deleted event with correct payload', () => {
      const entity: Entity = {
        id: '1',
        label: 'Person',
        properties: { name: 'Alice', scopeId: 'tenant-1' },
      };

      const event: EntityEvent = {
        type: 'entity.deleted',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        entity,
      };

      expect(event.type).toBe('entity.deleted');
      expect(event.entity).toEqual(entity);
    });
  });

  describe('Relationship Events', () => {
    it('should create relationship.created event with correct payload', () => {
      const relationship: Relationship = {
        id: 'r1',
        type: 'WORKS_FOR',
        from: '1',
        to: '2',
        properties: { scopeId: 'tenant-1' },
      };

      const event: RelationshipEvent = {
        type: 'relationship.created',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        relationship,
      };

      expect(event.type).toBe('relationship.created');
      expect(event.relationship).toEqual(relationship);
    });

    it('should create relationship.updated event with correct payload', () => {
      const relationship: Relationship = {
        id: 'r1',
        type: 'WORKS_FOR',
        from: '1',
        to: '2',
        properties: { scopeId: 'tenant-1', updated: true },
      };

      const event: RelationshipEvent = {
        type: 'relationship.updated',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        relationship,
      };

      expect(event.type).toBe('relationship.updated');
      expect(event.relationship).toEqual(relationship);
    });

    it('should create relationship.deleted event with correct payload', () => {
      const relationship: Relationship = {
        id: 'r1',
        type: 'WORKS_FOR',
        from: '1',
        to: '2',
        properties: { scopeId: 'tenant-1' },
      };

      const event: RelationshipEvent = {
        type: 'relationship.deleted',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        relationship,
      };

      expect(event.type).toBe('relationship.deleted');
      expect(event.relationship).toEqual(relationship);
    });
  });

  describe('Document Events', () => {
    it('should create document.created event with correct payload', () => {
      const document: Document = {
        id: 'doc1',
        label: 'Document',
        properties: {
          text: 'Alice works for Acme Corp.',
          scopeId: 'tenant-1',
        },
      };

      const event: DocumentEvent = {
        type: 'document.created',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        document,
      };

      expect(event.type).toBe('document.created');
      expect(event.document).toEqual(document);
    });

    it('should create document.updated event with correct payload', () => {
      const document: Document = {
        id: 'doc1',
        label: 'Document',
        properties: {
          text: 'Alice works for Acme Corp.',
          scopeId: 'tenant-1',
          metadata: { updated: true },
        },
      };

      const event: DocumentEvent = {
        type: 'document.updated',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        document,
      };

      expect(event.type).toBe('document.updated');
      expect(event.document).toEqual(document);
    });

    it('should create document.deleted event with correct payload', () => {
      const document: Document = {
        id: 'doc1',
        label: 'Document',
        properties: {
          text: 'Alice works for Acme Corp.',
          scopeId: 'tenant-1',
        },
      };

      const event: DocumentEvent = {
        type: 'document.deleted',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        document,
      };

      expect(event.type).toBe('document.deleted');
      expect(event.document).toEqual(document);
    });
  });

  describe('Learning Events', () => {
    it('should create learn.started event with correct payload', () => {
      const event: LearnEvent = {
        type: 'learn.started',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        text: 'Alice works for Acme Corp.',
      };

      expect(event.type).toBe('learn.started');
      expect(event.text).toBe('Alice works for Acme Corp.');
      expect(event.result).toBeUndefined();
      expect(event.error).toBeUndefined();
    });

    it('should create learn.completed event with correct payload', () => {
      const result: ExtractResult = {
        context: {
          id: 'ctx1',
          scopeId: 'tenant-1',
          name: 'Test Context',
          source: 'Alice works for Acme Corp.',
        },
        document: {
          id: 'doc1',
          label: 'Document',
          properties: {
            text: 'Alice works for Acme Corp.',
            scopeId: 'tenant-1',
          },
        },
        entities: [],
        relationships: [],
        summary: 'Test summary',
        created: {
          document: 1,
          entities: 0,
          relationships: 0,
        },
      };

      const event: LearnEvent = {
        type: 'learn.completed',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        text: 'Alice works for Acme Corp.',
        result,
      };

      expect(event.type).toBe('learn.completed');
      expect(event.result).toEqual(result);
      expect(event.error).toBeUndefined();
    });

    it('should create learn.failed event with correct payload', () => {
      const error = new Error('Learning failed');

      const event: LearnEvent = {
        type: 'learn.failed',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        text: 'Alice works for Acme Corp.',
        error,
      };

      expect(event.type).toBe('learn.failed');
      expect(event.error).toEqual(error);
      expect(event.result).toBeUndefined();
    });
  });

  describe('Query Events', () => {
    it('should create query.started event with correct payload', () => {
      const event: QueryEvent = {
        type: 'query.started',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        query: 'Who works for Acme Corp?',
      };

      expect(event.type).toBe('query.started');
      expect(event.query).toBe('Who works for Acme Corp?');
    });

    it('should create query.completed event with correct payload', () => {
      const event: QueryEvent = {
        type: 'query.completed',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        query: 'Who works for Acme Corp?',
      };

      expect(event.type).toBe('query.completed');
      expect(event.query).toBe('Who works for Acme Corp?');
    });
  });

  describe('Batch Events', () => {
    it('should create batch.progress event with correct payload', () => {
      const event: BatchEvent = {
        type: 'batch.progress',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        progress: {
          current: 5,
          total: 10,
          completed: 4,
          failed: 1,
        },
      };

      expect(event.type).toBe('batch.progress');
      expect(event.progress.current).toBe(5);
      expect(event.progress.total).toBe(10);
    });

    it('should create batch.completed event with correct payload', () => {
      const event: BatchEvent = {
        type: 'batch.completed',
        timestamp: new Date().toISOString(),
        scopeId: 'tenant-1',
        summary: {
          total: 10,
          succeeded: 9,
          failed: 1,
        },
      };

      expect(event.type).toBe('batch.completed');
      expect(event.summary?.total).toBe(10);
      expect(event.summary?.succeeded).toBe(9);
    });
  });

  describe('Event Type Union', () => {
    it('should allow AkashaEvent to be any event type', () => {
      const entityEvent: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };

      const learnEvent: AkashaEvent = {
        type: 'learn.started',
        timestamp: new Date().toISOString(),
        text: 'Test',
      };

      expect(entityEvent.type).toBe('entity.created');
      expect(learnEvent.type).toBe('learn.started');
    });
  });
});

