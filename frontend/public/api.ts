// API service for backend communication

export type QueryStrategy = 'documents' | 'entities' | 'both';

export interface GraphRAGQuery {
  query: string;
  maxDepth?: number;
  limit?: number;
  strategy?: QueryStrategy; // Query strategy: 'documents', 'entities', or 'both' (default: 'both')
  includeEmbeddings?: boolean; // Include embeddings in returned entities/relationships (default: false)
}

export interface Document {
  id: string;
  label: 'Document';
  properties: {
    text: string; // Full text content
    scopeId: string;
    contextId?: string; // Optional link to Context metadata
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

export interface GraphRAGResponse {
  context: GraphContext;
  answer: string;
}

export interface ApiError {
  error: string;
  message: string;
  hint?: string;
}

export interface HealthStatus {
  status: string;
  service: string;
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
  text: string
): Promise<ExtractTextResponse | ApiError> {
  return fetchApi<ExtractTextResponse | ApiError>('/graph/extract', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}
