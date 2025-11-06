import { describe, expect, it, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import type {
  CreateEntityRequest,
  CreateRelationshipRequest,
  Entity,
  Relationship,
} from '../api.ts';

// Mock global fetch
const originalFetch = global.fetch;

describe('Graph API Service Functions', () => {
  let fetchSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    // Create a mock function for fetch
    fetchSpy = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    if (fetchSpy) {
      fetchSpy.mockClear();
    }
  });

  describe('createEntity', () => {
    it('should call correct endpoint with POST method', async () => {
      const mockEntity: Entity = {
        id: '123',
        label: 'Person',
        properties: { name: 'Alice', age: 30 },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockEntity), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Import after mocking fetch
      const { createEntity } = await import('../api.ts');

      const request: CreateEntityRequest = {
        label: 'Person',
        properties: { name: 'Alice', age: 30 },
      };

      const result = await createEntity(request);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toBe('/api/graph/entities');
      expect(call[1]?.method).toBe('POST');
      expect(call[1]?.headers?.['Content-Type']).toBe('application/json');

      const body = JSON.parse(call[1]?.body as string);
      expect(body.label).toBe('Person');
      expect(body.properties).toEqual({ name: 'Alice', age: 30 });
    });

    it('should return created entity with ID', async () => {
      const mockEntity: Entity = {
        id: '456',
        label: 'Company',
        properties: { name: 'TechCorp', industry: 'Technology' },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockEntity), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { createEntity } = await import('../api.ts');

      const result = await createEntity({
        label: 'Company',
        properties: { name: 'TechCorp', industry: 'Technology' },
      });

      if (!('error' in result)) {
        expect(result.id).toBe('456');
        expect(result.label).toBe('Company');
        expect(result.properties.name).toBe('TechCorp');
      }
    });

    it('should handle API errors', async () => {
      const errorResponse = {
        error: 'Invalid request',
        message: 'Label is required and must be a string',
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { createEntity } = await import('../api.ts');

      const result = await createEntity({
        label: '',
        properties: {},
      });

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('Invalid request');
      }
    });
  });

  describe('createRelationship', () => {
    it('should call correct endpoint with POST method', async () => {
      const mockRelationship: Relationship = {
        id: '789',
        type: 'WORKS_FOR',
        from: '123',
        to: '456',
        properties: { since: 2020 },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockRelationship), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { createRelationship } = await import('../api.ts');

      const request: CreateRelationshipRequest = {
        from: '123',
        to: '456',
        type: 'WORKS_FOR',
        properties: { since: 2020 },
      };

      const result = await createRelationship(request);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toBe('/api/graph/relationships');
      expect(call[1]?.method).toBe('POST');

      const body = JSON.parse(call[1]?.body as string);
      expect(body.from).toBe('123');
      expect(body.to).toBe('456');
      expect(body.type).toBe('WORKS_FOR');
    });

    it('should handle optional relationship properties', async () => {
      const mockRelationship: Relationship = {
        id: '789',
        type: 'KNOWS',
        from: '123',
        to: '456',
        properties: {},
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockRelationship), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { createRelationship } = await import('../api.ts');

      const result = await createRelationship({
        from: '123',
        to: '456',
        type: 'KNOWS',
      });

      if (!('error' in result)) {
        expect(result.type).toBe('KNOWS');
        expect(result.properties).toEqual({});
      }
    });
  });

  describe('getEntity', () => {
    it('should call GET endpoint with entity ID', async () => {
      const mockEntity: Entity = {
        id: '123',
        label: 'Person',
        properties: { name: 'Alice' },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockEntity), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { getEntity } = await import('../api.ts');

      const result = await getEntity('123');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toBe('/api/graph/entities/123');
      expect(call[1]?.method).toBeUndefined(); // GET is default
    });
  });

  describe('updateEntity', () => {
    it('should call PUT endpoint with entity ID and properties', async () => {
      const mockEntity: Entity = {
        id: '123',
        label: 'Person',
        properties: { name: 'Alice', age: 31 },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockEntity), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { updateEntity } = await import('../api.ts');

      const result = await updateEntity('123', { age: 31 });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toBe('/api/graph/entities/123');
      expect(call[1]?.method).toBe('PUT');

      const body = JSON.parse(call[1]?.body as string);
      expect(body.properties).toEqual({ age: 31 });
      expect(body.id).toBe('123');
    });
  });

  describe('deleteEntity', () => {
    it('should call DELETE endpoint with entity ID', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, message: 'Entity deleted' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      const { deleteEntity } = await import('../api.ts');

      await deleteEntity('123');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toBe('/api/graph/entities/123');
      expect(call[1]?.method).toBe('DELETE');
    });
  });

  describe('batchCreateEntities', () => {
    it('should call batch endpoint with entities array', async () => {
      const mockResponse = {
        entities: [
          { id: '1', label: 'Person', properties: { name: 'Alice' } },
          { id: '2', label: 'Person', properties: { name: 'Bob' } },
        ],
        created: 2,
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { batchCreateEntities } = await import('../api.ts');

      const result = await batchCreateEntities({
        entities: [
          { label: 'Person', properties: { name: 'Alice' } },
          { label: 'Person', properties: { name: 'Bob' } },
        ],
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toBe('/api/graph/entities/batch');
      expect(call[1]?.method).toBe('POST');

      const body = JSON.parse(call[1]?.body as string);
      expect(body.entities).toHaveLength(2);
      if (!('error' in result)) {
        expect(result.created).toBe(2);
      }
    });
  });
});

