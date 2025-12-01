import { Neo4jService } from '../../neo4j.service';
import type { DatabaseProvider } from './interfaces';
import type { Entity, Relationship, Document, DeleteResult } from '../../../types';

/**
 * Neo4j implementation of DatabaseProvider
 * Wraps Neo4jService to implement the database-agnostic interface
 */
export class Neo4jProvider implements DatabaseProvider {
  private neo4jService: Neo4jService;

  constructor(config: { uri: string; user: string; password: string; database?: string }) {
    this.neo4jService = new Neo4jService(config);
  }

  // Connection & Setup
  async connect(): Promise<void> {
    return this.neo4jService.connect();
  }

  async disconnect(): Promise<void> {
    return this.neo4jService.disconnect();
  }

  async ensureVectorIndex(indexName?: string): Promise<void> {
    return this.neo4jService.ensureVectorIndex(indexName);
  }

  // Vector Search
  async findEntitiesByVector(
    queryEmbedding: number[],
    limit: number = 10,
    similarityThreshold: number = 0.5,
    scopeId?: string,
    contexts?: string[],
    validAt?: string
  ): Promise<Entity[]> {
    return this.neo4jService.findEntitiesByVector(
      queryEmbedding,
      limit,
      similarityThreshold,
      scopeId,
      contexts,
      validAt
    );
  }

  async findDocumentsByVector(
    queryEmbedding: number[],
    limit: number = 10,
    similarityThreshold: number = 0.5,
    scopeId?: string,
    contexts?: string[],
    validAt?: string
  ): Promise<Document[]> {
    return this.neo4jService.findDocumentsByVector(
      queryEmbedding,
      limit,
      similarityThreshold,
      scopeId,
      contexts,
      validAt
    );
  }

  // Graph Operations
  async retrieveSubgraph(
    entityLabels: string[],
    relationshipTypes: string[],
    maxDepth: number,
    limit: number,
    startEntityIds?: string[],
    scopeId?: string
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    return this.neo4jService.retrieveSubgraph(
      entityLabels,
      relationshipTypes,
      maxDepth,
      limit,
      startEntityIds,
      scopeId
    );
  }

  // Entity CRUD
  async createEntities(
    entities: Array<{ label: string; properties: Record<string, unknown> }>,
    embeddings: number[][]
  ): Promise<Entity[]> {
    return this.neo4jService.createEntities(entities, embeddings);
  }

  async findEntityByName(name: string, scopeId: string): Promise<Entity | null> {
    return this.neo4jService.findEntityByName(name, scopeId);
  }

  async findEntityById(entityId: string, scopeId?: string): Promise<Entity | null> {
    return this.neo4jService.findEntityById(entityId, scopeId);
  }

  async updateEntity(entityId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Entity> {
    return this.neo4jService.updateEntity(entityId, properties, scopeId);
  }

  async updateEntityContextIds(entityId: string, contextId: string): Promise<Entity> {
    return this.neo4jService.updateEntityContextIds(entityId, contextId);
  }

  async deleteEntity(entityId: string, scopeId?: string): Promise<DeleteResult> {
    return this.neo4jService.deleteEntity(entityId, scopeId);
  }

  async listEntities(label?: string, limit: number = 100, offset: number = 0, scopeId?: string): Promise<Entity[]> {
    return this.neo4jService.listEntities(label, limit, offset, scopeId);
  }

  // Relationship CRUD
  async createRelationships(
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, unknown>;
    }>
  ): Promise<Relationship[]> {
    return this.neo4jService.createRelationships(relationships);
  }

  async findRelationshipById(relationshipId: string, scopeId?: string): Promise<Relationship | null> {
    return this.neo4jService.findRelationshipById(relationshipId, scopeId);
  }

  async updateRelationship(relationshipId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Relationship> {
    return this.neo4jService.updateRelationship(relationshipId, properties, scopeId);
  }

  async deleteRelationship(relationshipId: string, scopeId?: string): Promise<DeleteResult> {
    return this.neo4jService.deleteRelationship(relationshipId, scopeId);
  }

  async listRelationships(
    type?: string,
    fromId?: string,
    toId?: string,
    limit: number = 100,
    offset: number = 0,
    scopeId?: string
  ): Promise<Relationship[]> {
    return this.neo4jService.listRelationships(type, fromId, toId, limit, offset, scopeId);
  }

  // Document CRUD
  async createDocument(
    document: { properties: Document['properties'] },
    embedding: number[]
  ): Promise<Document> {
    return this.neo4jService.createDocument(document, embedding);
  }

  async findDocumentByText(text: string, scopeId: string): Promise<Document | null> {
    return this.neo4jService.findDocumentByText(text, scopeId);
  }

  async findDocumentById(documentId: string, scopeId?: string): Promise<Document | null> {
    return this.neo4jService.findDocumentById(documentId, scopeId);
  }

  async updateDocument(documentId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Document> {
    return this.neo4jService.updateDocument(documentId, properties, scopeId);
  }

  async updateDocumentContextIds(documentId: string, contextId: string): Promise<Document> {
    return this.neo4jService.updateDocumentContextIds(documentId, contextId);
  }

  async deleteDocument(documentId: string, scopeId?: string): Promise<DeleteResult> {
    return this.neo4jService.deleteDocument(documentId, scopeId);
  }

  async listDocuments(limit: number = 100, offset: number = 0, scopeId?: string): Promise<Document[]> {
    return this.neo4jService.listDocuments(limit, offset, scopeId);
  }

  // Linking
  async linkEntityToDocument(documentId: string, entityId: string, scopeId: string): Promise<Relationship> {
    return this.neo4jService.linkEntityToDocument(documentId, entityId, scopeId);
  }

  // Additional methods
  async getEntitiesFromDocuments(documentIds: string[], scopeId?: string): Promise<Entity[]> {
    return this.neo4jService.getEntitiesFromDocuments(documentIds, scopeId);
  }

  async ping(): Promise<boolean> {
    return this.neo4jService.ping();
  }
}

