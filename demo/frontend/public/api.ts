// API service for backend communication

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

export interface Document {
  id: string;
  label: 'Document';
  properties: {
    text: string; // Full text content
    scopeId: string;
    contextIds?: string[]; // Array of context IDs this document belongs to
    contextId?: string; // DEPRECATED: Use contextIds instead (for backward compatibility)
    metadata?: Record<string, unknown>;
  };
}

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

export interface GraphContext {
  documents?: Document[]; // Documents found (if strategy includes documents)
  entities: Entity[];
  relationships: Relationship[];
  summary: string;
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

export interface ApiError {
  error: string;
  message: string;
  hint?: string;
}

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

export interface Neo4jTestResponse {
  status: string;
  message: string;
  test?: unknown;
  hint?: string;
}

const API_BASE = '/api';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function queryGraphRAG(
  query: GraphRAGQuery
): Promise<GraphRAGResponse | ApiError> {
  return fetchApi<GraphRAGResponse | ApiError>('/graphrag/query', {
    method: 'POST',
    body: JSON.stringify(query),
  });
}

export async function checkHealth(): Promise<HealthStatus> {
  return fetchApi<HealthStatus>('/health');
}

export async function testNeo4j(): Promise<Neo4jTestResponse> {
  return fetchApi<Neo4jTestResponse>('/neo4j/test');
}

// Graph write operation types (matching backend)

export interface CreateEntityRequest {
  label: string;
  properties: Record<string, unknown>;
}

export interface CreateEntityResponse extends Entity {
  // Entity already has id, label, properties
}

export interface UpdateEntityRequest {
  id: string;
  properties: Record<string, unknown>;
}

export interface CreateRelationshipRequest {
  from: string;
  to: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface CreateRelationshipResponse extends Relationship {
  // Relationship already has id, type, from, to, properties
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

// Graph write operation API functions

export async function createEntity(
  request: CreateEntityRequest
): Promise<CreateEntityResponse | ApiError> {
  return fetchApi<CreateEntityResponse | ApiError>('/graph/entities', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getEntity(id: string): Promise<Entity | ApiError> {
  return fetchApi<Entity | ApiError>(`/graph/entities/${id}`);
}

export async function updateEntity(
  id: string,
  properties: Record<string, unknown>
): Promise<Entity | ApiError> {
  return fetchApi<Entity | ApiError>(`/graph/entities/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ id, properties }),
  });
}

export async function deleteEntity(id: string): Promise<{ success: boolean; message: string } | ApiError> {
  return fetchApi<{ success: boolean; message: string } | ApiError>(`/graph/entities/${id}`, {
    method: 'DELETE',
  });
}

export async function createRelationship(
  request: CreateRelationshipRequest
): Promise<CreateRelationshipResponse | ApiError> {
  return fetchApi<CreateRelationshipResponse | ApiError>('/graph/relationships', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function deleteRelationship(
  id: string
): Promise<{ success: boolean; message: string } | ApiError> {
  return fetchApi<{ success: boolean; message: string } | ApiError>(`/graph/relationships/${id}`, {
    method: 'DELETE',
  });
}

export async function batchCreateEntities(
  request: BatchCreateEntitiesRequest
): Promise<BatchCreateEntitiesResponse | ApiError> {
  return fetchApi<BatchCreateEntitiesResponse | ApiError>('/graph/entities/batch', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function batchCreateRelationships(
  request: BatchCreateRelationshipsRequest
): Promise<BatchCreateRelationshipsResponse | ApiError> {
  return fetchApi<BatchCreateRelationshipsResponse | ApiError>('/graph/relationships/batch', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// Text extraction types and API

export interface ExtractTextRequest {
  text: string;
}

export interface ExtractTextResponse {
  document: Document; // The document node created/reused
  entities: Entity[];
  relationships: Relationship[];
  summary: string;
  created: {
    document: number; // 0 if document already existed (deduplicated), 1 if created
    entities: number;
    relationships: number;
  };
}

export async function extractTextToGraph(
  text: string,
  options?: {
    validFrom?: Date | string;
    validTo?: Date | string;
  }
): Promise<ExtractTextResponse | ApiError> {
  return fetchApi<ExtractTextResponse | ApiError>('/graph/extract', {
    method: 'POST',
    body: JSON.stringify({
      text,
      validFrom: options?.validFrom,
      validTo: options?.validTo,
    }),
  });
}

// Batch learning types and API

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

export async function batchExtractTextToGraph(
  request: BatchLearnRequest
): Promise<BatchLearnResponse | ApiError> {
  return fetchApi<BatchLearnResponse | ApiError>('/graph/extract/batch', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// List operations

export interface ListEntitiesOptions {
  label?: string;
  limit?: number;
  offset?: number;
  includeEmbeddings?: boolean;
}

export interface ListRelationshipsOptions {
  type?: string;
  fromId?: string;
  toId?: string;
  limit?: number;
  offset?: number;
  includeEmbeddings?: boolean;
}

export interface ListDocumentsOptions {
  limit?: number;
  offset?: number;
  includeEmbeddings?: boolean;
}

export async function listEntities(
  options?: ListEntitiesOptions
): Promise<Entity[] | ApiError> {
  const params = new URLSearchParams();
  if (options?.label) params.append('label', options.label);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.includeEmbeddings) params.append('includeEmbeddings', 'true');

  return fetchApi<Entity[] | ApiError>(`/graph/entities?${params.toString()}`);
}

export async function listRelationships(
  options?: ListRelationshipsOptions
): Promise<Relationship[] | ApiError> {
  const params = new URLSearchParams();
  if (options?.type) params.append('type', options.type);
  if (options?.fromId) params.append('fromId', options.fromId);
  if (options?.toId) params.append('toId', options.toId);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.includeEmbeddings) params.append('includeEmbeddings', 'true');

  return fetchApi<Relationship[] | ApiError>(`/graph/relationships?${params.toString()}`);
}

export async function listDocuments(
  options?: ListDocumentsOptions
): Promise<Document[] | ApiError> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.includeEmbeddings) params.append('includeEmbeddings', 'true');

  return fetchApi<Document[] | ApiError>(`/graph/documents?${params.toString()}`);
}

// Find operations

export async function findRelationship(
  id: string
): Promise<Relationship | ApiError> {
  return fetchApi<Relationship | ApiError>(`/graph/relationships/${id}`);
}

export async function findDocument(
  id: string
): Promise<Document | ApiError> {
  return fetchApi<Document | ApiError>(`/graph/documents/${id}`);
}

// Update operations

export interface UpdateRelationshipRequest {
  properties: Record<string, unknown>;
}

export interface UpdateDocumentRequest {
  properties: Record<string, unknown>;
}

export async function updateRelationship(
  id: string,
  properties: Record<string, unknown>
): Promise<Relationship | ApiError> {
  return fetchApi<Relationship | ApiError>(`/graph/relationships/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ properties }),
  });
}

export async function updateDocument(
  id: string,
  properties: Record<string, unknown>
): Promise<Document | ApiError> {
  return fetchApi<Document | ApiError>(`/graph/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ properties }),
  });
}

// Delete operations

export async function deleteDocument(
  id: string
): Promise<{ success: boolean; message: string; relatedRelationshipsDeleted?: number } | ApiError> {
  return fetchApi<{ success: boolean; message: string; relatedRelationshipsDeleted?: number } | ApiError>(
    `/graph/documents/${id}`,
    {
      method: 'DELETE',
    }
  );
}

// Configuration validation

export interface ConfigValidationRequest {
  neo4j: {
    uri: string;
    user: string;
    password: string;
    database?: string;
  };
  openai?: {
    apiKey: string;
    model?: string;
    embeddingModel?: string;
  };
  scope?: {
    id: string;
    type: string;
    name: string;
    metadata?: Record<string, unknown>;
  };
  extractionPrompt?: Record<string, unknown>;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
  warnings?: Array<{
    field: string;
    message: string;
  }>;
}

export async function validateConfig(
  config: ConfigValidationRequest
): Promise<ConfigValidationResult | ApiError> {
  return fetchApi<ConfigValidationResult | ApiError>('/config/validate', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}
