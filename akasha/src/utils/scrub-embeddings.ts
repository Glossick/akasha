import type { Entity, Relationship } from '../types';

/**
 * Remove embedding arrays from entity properties
 */
export function scrubEntityEmbeddings(entity: Entity): Entity {
  const { embedding, ...properties } = entity.properties;
  return {
    ...entity,
    properties,
  };
}

/**
 * Remove embedding arrays from multiple entities
 */
export function scrubEntitiesEmbeddings(entities: Entity[]): Entity[] {
  return entities.map(scrubEntityEmbeddings);
}

/**
 * Remove embedding arrays from relationship properties
 */
export function scrubRelationshipEmbeddings(relationship: Relationship): Relationship {
  const { embedding, ...properties } = relationship.properties;
  return {
    ...relationship,
    properties,
  };
}

/**
 * Remove embedding arrays from multiple relationships
 */
export function scrubRelationshipsEmbeddings(relationships: Relationship[]): Relationship[] {
  return relationships.map(scrubRelationshipEmbeddings);
}

/**
 * Scrub embeddings from both entities and relationships
 */
export function scrubEmbeddings(data: {
  entities: Entity[];
  relationships: Relationship[];
}): {
  entities: Entity[];
  relationships: Relationship[];
} {
  return {
    entities: scrubEntitiesEmbeddings(data.entities),
    relationships: scrubRelationshipsEmbeddings(data.relationships),
  };
}

