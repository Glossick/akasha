export interface Entity {
  id: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface Relationship {
  id: string;
  type: string;
  from: string;
  to: string;
  properties: Record<string, unknown>;
}

export interface Document {
  id: string;
  label: 'Document';
  properties: {
    text: string;
    scopeId: string;
    contextId?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface GraphContext {
  documents?: Document[]; // Documents found (if strategy includes documents)
  entities: Entity[];
  relationships: Relationship[];
  summary: string;
}

export type QueryStrategy = 'documents' | 'entities' | 'both';

export interface GraphRAGQuery {
  query: string;
  maxDepth?: number;
  limit?: number;
  strategy?: QueryStrategy; // Query strategy: 'documents', 'entities', or 'both' (default: 'both')
  includeEmbeddings?: boolean; // Include embeddings in returned entities/relationships (default: false)
}

export interface GraphRAGResponse {
  context: GraphContext;
  answer: string;
}

// Write operation types

export interface CreateEntityRequest {
  label: string;
  properties: Record<string, unknown>;
}

export interface CreateEntityResponse {
  id: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface UpdateEntityRequest {
  id: string;
  properties: Record<string, unknown>;
}

export interface CreateRelationshipRequest {
  from: string; // Entity ID
  to: string; // Entity ID
  type: string;
  properties?: Record<string, unknown>;
}

export interface CreateRelationshipResponse {
  id: string;
  type: string;
  from: string;
  to: string;
  properties: Record<string, unknown>;
}

export interface BatchCreateEntitiesRequest {
  entities: CreateEntityRequest[];
}

export interface BatchCreateEntitiesResponse {
  entities: CreateEntityResponse[];
  created: number;
}

export interface BatchCreateRelationshipsRequest {
  relationships: CreateRelationshipRequest[];
}

export interface BatchCreateRelationshipsResponse {
  relationships: CreateRelationshipResponse[];
  created: number;
}

// Text extraction types

export interface ExtractTextRequest {
  text: string;
}

export interface ExtractTextResponse {
  document: Document; // The document node created
  entities: Entity[];
  relationships: Relationship[];
  summary: string;
  created: {
    document: number; // 0 if document already existed (deduplicated), 1 if created
    entities: number;
    relationships: number;
  };
}

