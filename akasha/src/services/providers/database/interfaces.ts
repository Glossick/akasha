import type { Entity, Relationship, Document, DeleteResult } from '../../../types';

/**
 * Database Provider Interface
 * 
 * Abstracts database operations to support multiple graph databases (Neo4j, Kuzu, etc.)
 */
export interface DatabaseProvider {
  // Connection & Setup
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ensureVectorIndex(indexName?: string): Promise<void>;
  
  // Vector Search
  findEntitiesByVector(
    queryEmbedding: number[],
    limit: number,
    similarityThreshold: number,
    scopeId?: string,
    contexts?: string[],
    validAt?: string
  ): Promise<Entity[]>;
  
  findDocumentsByVector(
    queryEmbedding: number[],
    limit: number,
    similarityThreshold: number,
    scopeId?: string,
    contexts?: string[],
    validAt?: string
  ): Promise<Document[]>;
  
  // Graph Operations
  retrieveSubgraph(
    entityLabels: string[],
    relationshipTypes: string[],
    maxDepth: number,
    limit: number,
    startEntityIds?: string[],
    scopeId?: string
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }>;
  
  // Entity CRUD
  createEntities(
    entities: Array<{ label: string; properties: Record<string, unknown> }>,
    embeddings: number[][]
  ): Promise<Entity[]>;
  
  findEntityByName(name: string, scopeId: string): Promise<Entity | null>;
  findEntityById(entityId: string, scopeId?: string): Promise<Entity | null>;
  updateEntity(entityId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Entity>;
  updateEntityContextIds(entityId: string, contextId: string): Promise<Entity>;
  deleteEntity(entityId: string, scopeId?: string): Promise<DeleteResult>;
  listEntities(label?: string, limit?: number, offset?: number, scopeId?: string): Promise<Entity[]>;
  
  // Relationship CRUD
  createRelationships(
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, unknown>;
    }>
  ): Promise<Relationship[]>;
  
  findRelationshipById(relationshipId: string, scopeId?: string): Promise<Relationship | null>;
  updateRelationship(relationshipId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Relationship>;
  deleteRelationship(relationshipId: string, scopeId?: string): Promise<DeleteResult>;
  listRelationships(
    type?: string,
    fromId?: string,
    toId?: string,
    limit?: number,
    offset?: number,
    scopeId?: string
  ): Promise<Relationship[]>;
  
  // Document CRUD
  createDocument(
    document: { properties: Document['properties'] },
    embedding: number[]
  ): Promise<Document>;
  
  findDocumentByText(text: string, scopeId: string): Promise<Document | null>;
  findDocumentById(documentId: string, scopeId?: string): Promise<Document | null>;
  updateDocument(documentId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Document>;
  updateDocumentContextIds(documentId: string, contextId: string): Promise<Document>;
  deleteDocument(documentId: string, scopeId?: string): Promise<DeleteResult>;
  listDocuments(limit?: number, offset?: number, scopeId?: string): Promise<Document[]>;
  
  // Linking
  linkEntityToDocument(documentId: string, entityId: string, scopeId: string): Promise<Relationship>;
  
  // Additional methods (replacing getSession())
  getEntitiesFromDocuments(documentIds: string[], scopeId?: string): Promise<Entity[]>;
  ping(): Promise<boolean>; // For health checks
}

