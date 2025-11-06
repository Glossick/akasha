import { describe, it, expect } from 'bun:test';
import {
  scrubEntityEmbeddings,
  scrubEntitiesEmbeddings,
  scrubRelationshipEmbeddings,
  scrubRelationshipsEmbeddings,
  scrubEmbeddings,
} from '../utils/scrub-embeddings';
import type { Entity, Relationship } from '../types';

describe('Scrub Embeddings', () => {
  describe('scrubEntityEmbeddings', () => {
    it('should remove embedding from entity properties', () => {
      const entity: Entity = {
        id: '1',
        label: 'Person',
        properties: {
          name: 'Alice',
          age: 30,
          embedding: [0.1, 0.2, 0.3],
        },
      };

      const scrubbed = scrubEntityEmbeddings(entity);

      expect(scrubbed.properties.embedding).toBeUndefined();
      expect(scrubbed.properties.name).toBe('Alice');
      expect(scrubbed.properties.age).toBe(30);
      expect(scrubbed.id).toBe('1');
      expect(scrubbed.label).toBe('Person');
    });

    it('should not modify entity if no embedding exists', () => {
      const entity: Entity = {
        id: '1',
        label: 'Person',
        properties: {
          name: 'Alice',
          age: 30,
        },
      };

      const scrubbed = scrubEntityEmbeddings(entity);

      expect(scrubbed).toEqual(entity);
    });
  });

  describe('scrubEntitiesEmbeddings', () => {
    it('should remove embeddings from multiple entities', () => {
      const entities: Entity[] = [
        {
          id: '1',
          label: 'Person',
          properties: {
            name: 'Alice',
            embedding: [0.1, 0.2],
          },
        },
        {
          id: '2',
          label: 'Company',
          properties: {
            name: 'Acme',
            embedding: [0.3, 0.4],
          },
        },
      ];

      const scrubbed = scrubEntitiesEmbeddings(entities);

      expect(scrubbed.length).toBe(2);
      expect(scrubbed[0].properties.embedding).toBeUndefined();
      expect(scrubbed[1].properties.embedding).toBeUndefined();
      expect(scrubbed[0].properties.name).toBe('Alice');
      expect(scrubbed[1].properties.name).toBe('Acme');
    });
  });

  describe('scrubRelationshipEmbeddings', () => {
    it('should remove embedding from relationship properties', () => {
      const relationship: Relationship = {
        id: 'r1',
        type: 'WORKS_FOR',
        from: '1',
        to: '2',
        properties: {
          since: '2020',
          embedding: [0.1, 0.2, 0.3],
        },
      };

      const scrubbed = scrubRelationshipEmbeddings(relationship);

      expect(scrubbed.properties.embedding).toBeUndefined();
      expect(scrubbed.properties.since).toBe('2020');
      expect(scrubbed.id).toBe('r1');
      expect(scrubbed.type).toBe('WORKS_FOR');
    });

    it('should not modify relationship if no embedding exists', () => {
      const relationship: Relationship = {
        id: 'r1',
        type: 'WORKS_FOR',
        from: '1',
        to: '2',
        properties: {
          since: '2020',
        },
      };

      const scrubbed = scrubRelationshipEmbeddings(relationship);

      expect(scrubbed).toEqual(relationship);
    });
  });

  describe('scrubRelationshipsEmbeddings', () => {
    it('should remove embeddings from multiple relationships', () => {
      const relationships: Relationship[] = [
        {
          id: 'r1',
          type: 'WORKS_FOR',
          from: '1',
          to: '2',
          properties: {
            embedding: [0.1, 0.2],
          },
        },
        {
          id: 'r2',
          type: 'KNOWS',
          from: '1',
          to: '3',
          properties: {
            embedding: [0.3, 0.4],
          },
        },
      ];

      const scrubbed = scrubRelationshipsEmbeddings(relationships);

      expect(scrubbed.length).toBe(2);
      expect(scrubbed[0].properties.embedding).toBeUndefined();
      expect(scrubbed[1].properties.embedding).toBeUndefined();
    });
  });

  describe('scrubEmbeddings', () => {
    it('should remove embeddings from both entities and relationships', () => {
      const data = {
        entities: [
          {
            id: '1',
            label: 'Person',
            properties: {
              name: 'Alice',
              embedding: [0.1, 0.2],
            },
          },
        ],
        relationships: [
          {
            id: 'r1',
            type: 'WORKS_FOR',
            from: '1',
            to: '2',
            properties: {
              embedding: [0.3, 0.4],
            },
          },
        ],
      };

      const scrubbed = scrubEmbeddings(data);

      expect(scrubbed.entities[0].properties.embedding).toBeUndefined();
      expect(scrubbed.relationships[0].properties.embedding).toBeUndefined();
      expect(scrubbed.entities[0].properties.name).toBe('Alice');
    });
  });
});

