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
    contextIds?: string[]; // Array of context IDs this document belongs to
    contextId?: string; // DEPRECATED: Use contextIds instead (for backward compatibility)
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
  validAt?: Date | string; // Only return facts valid at this time (optional)
  includeStats?: boolean; // Include query statistics in response (default: false)
}

export interface QueryStatistics {
  searchTimeMs: number;
  subgraphRetrievalTimeMs: number;
  llmGenerationTimeMs: number;
  totalTimeMs: number;
  documentsFound: number;
  entitiesFound: number;
  relationshipsFound: number;
  strategy: QueryStrategy;
}

export interface GraphRAGResponse {
  context: GraphContext;
  answer: string;
  statistics?: QueryStatistics; // Included when includeStats: true
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
  validFrom?: Date | string; // When fact becomes valid (optional, defaults to now)
  validTo?: Date | string; // When fact becomes invalid (optional, no expiration if omitted)
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

// Batch learning types
export interface BatchLearnItem {
  text: string;
  contextId?: string;
  contextName?: string;
  validFrom?: Date | string;
  validTo?: Date | string;
}

export interface BatchLearnRequest {
  items: string[] | BatchLearnItem[];
  contextName?: string;
  validFrom?: Date | string;
  validTo?: Date | string;
  includeEmbeddings?: boolean;
}

export interface BatchLearnResponse {
  results: ExtractTextResponse[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    totalDocumentsCreated: number;
    totalDocumentsReused: number;
    totalEntitiesCreated: number;
    totalRelationshipsCreated: number;
  };
  errors?: Array<{
    index: number;
    text: string;
    error: string;
  }>;
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  neo4j: {
    connected: boolean;
    error?: string;
  };
  openai: {
    available: boolean;
    error?: string;
  };
  timestamp: string;
}

