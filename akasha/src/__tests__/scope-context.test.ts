import { describe, expect, it } from 'bun:test';
import type { Scope, Context } from '../types';

describe('Scope and Context Types', () => {
  describe('Scope', () => {
    it('should have required properties', () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      expect(scope.id).toBe('tenant-1');
      expect(scope.type).toBe('tenant');
      expect(scope.name).toBe('Test Tenant');
    });

    it('should support optional metadata', () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
        metadata: {
          description: 'Test description',
          created: new Date(),
        },
      };

      expect(scope.metadata).toBeDefined();
      expect(scope.metadata?.description).toBe('Test description');
    });

    it('should support custom scope types', () => {
      const scope: Scope = {
        id: 'custom-1',
        type: 'custom-type',
        name: 'Custom Scope',
      };

      expect(scope.type).toBe('custom-type');
    });
  });

  describe('Context', () => {
    it('should have required properties', () => {
      const context: Context = {
        id: 'context-1',
        scopeId: 'tenant-1',
        name: 'Test Context',
        source: 'Test text content',
      };

      expect(context.id).toBe('context-1');
      expect(context.scopeId).toBe('tenant-1');
      expect(context.name).toBe('Test Context');
      expect(context.source).toBe('Test text content');
    });

    it('should support optional metadata', () => {
      const context: Context = {
        id: 'context-1',
        scopeId: 'tenant-1',
        name: 'Test Context',
        source: 'Test text',
        metadata: {
          author: 'Test Author',
          date: new Date(),
        },
      };

      expect(context.metadata).toBeDefined();
      expect(context.metadata?.author).toBe('Test Author');
    });

    it('should belong to a scope', () => {
      const context: Context = {
        id: 'context-1',
        scopeId: 'tenant-1',
        name: 'Test Context',
        source: 'Test text',
      };

      // Context must have a scopeId
      expect(context.scopeId).toBe('tenant-1');
    });
  });

  describe('Scope-Context Relationship', () => {
    it('should enforce that contexts belong to scopes', () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      const context: Context = {
        id: 'context-1',
        scopeId: scope.id, // Context belongs to scope
        name: 'Test Context',
        source: 'Test text',
      };

      expect(context.scopeId).toBe(scope.id);
    });

    it('should allow multiple contexts per scope', () => {
      const scope: Scope = {
        id: 'tenant-1',
        type: 'tenant',
        name: 'Test Tenant',
      };

      const context1: Context = {
        id: 'context-1',
        scopeId: scope.id,
        name: 'Context 1',
        source: 'Text 1',
      };

      const context2: Context = {
        id: 'context-2',
        scopeId: scope.id,
        name: 'Context 2',
        source: 'Text 2',
      };

      expect(context1.scopeId).toBe(scope.id);
      expect(context2.scopeId).toBe(scope.id);
      expect(context1.id).not.toBe(context2.id);
    });
  });
});

