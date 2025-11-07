/**
 * Scope represents an isolation boundary (tenant, workspace, project, etc.)
 */
export interface Scope {
  id: string;
  type: 'tenant' | 'workspace' | 'project' | 'organization' | 'user' | string;
  name: string;
  metadata?: Record<string, unknown>;
}

/**
 * Context represents a knowledge space within a scope (from a text/document)
 */
export interface Context {
  id: string;
  scopeId: string;
  name: string;
  source: string; // Original text/document
  metadata?: Record<string, unknown>;
}

/**
 * Entity type definition for ontology
 */
export interface EntityTypeDefinition {
  label: string;
  description?: string;
  examples?: string[];
  requiredProperties?: string[];
  optionalProperties?: string[];
}

/**
 * Relationship type definition for ontology
 */
export interface RelationshipTypeDefinition {
  type: string;
  description?: string;
  from: string[]; // Valid source entity labels
  to: string[];   // Valid target entity labels
  examples?: string[];
  constraints?: string[];
}

/**
 * Extraction prompt template configuration
 */
export interface ExtractionPromptTemplate {
  // Core structure
  role?: string;
  task?: string;
  formatRules?: string[];
  extractionConstraints?: string[];
  
  // Domain-specific
  entityTypes?: EntityTypeDefinition[];
  relationshipTypes?: RelationshipTypeDefinition[];
  semanticConstraints?: string[];
  
  // Output
  outputFormat?: string;
}

/**
 * Akasha configuration
 */
export interface AkashaConfig {
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
  scope?: Scope;
  extractionPrompt?: Partial<ExtractionPromptTemplate>;
}

/**
 * Configuration validation result
 */
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

/**
 * Query strategy for ask() method
 */
export type QueryStrategy = 'documents' | 'entities' | 'both';

/**
 * Query options
 */
export interface QueryOptions {
  maxDepth?: number;
  limit?: number;
  contexts?: string[]; // Context IDs to filter by
  includeEmbeddings?: boolean; // Include embeddings in returned entities/relationships (default: false)
  strategy?: QueryStrategy; // Query strategy: 'documents', 'entities', or 'both' (default: 'both')
  validAt?: Date | string; // Only return facts valid at this time (default: all facts)
  includeStats?: boolean; // Include query statistics in response (default: false)
  similarityThreshold?: number; // Minimum similarity score for documents/entities (default: 0.7). Higher values = more strict filtering.
}

/**
 * GraphRAG query
 */
export interface GraphRAGQuery {
  query: string;
  maxDepth?: number;
  limit?: number;
  contexts?: string[];
}

/**
 * GraphRAG response
 */
export interface GraphRAGResponse {
  context: {
    documents?: Document[]; // Documents found (if strategy includes documents)
    entities: Entity[];
    relationships: Relationship[];
    summary: string;
  };
  answer: string;
  statistics?: QueryStatistics; // Included when includeStats: true in QueryOptions
}

/**
 * Document represents a canonical text node in the knowledge graph
 */
export interface Document {
  id: string;
  label: 'Document';
  properties: {
    text: string; // Full text content
    scopeId: string;
    contextIds?: string[]; // Array of context IDs this document belongs to
    contextId?: string; // DEPRECATED: Use contextIds instead (for backward compatibility)
    metadata?: Record<string, unknown>;
    _similarity?: number; // Similarity score from vector search (added at runtime)
    _recordedAt?: string; // System metadata
    _validFrom?: string; // System metadata
    _validTo?: string; // System metadata
    embedding?: number[]; // Vector embedding (optional, scrubbed by default)
  };
}

/**
 * Entity
 */
export interface Entity {
  id: string;
  label: string;
  properties: Record<string, unknown> & {
    contextIds?: string[]; // Array of context IDs this entity belongs to
  };
}

/**
 * Relationship
 */
export interface Relationship {
  id: string;
  type: string;
  from: string;
  to: string;
  properties: Record<string, unknown>;
}

/**
 * Extract result
 */
export interface ExtractResult {
  context: Context;
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

/**
 * Learn options (extract and create)
 */
export interface LearnOptions {
  contextName?: string;
  contextId?: string;
  includeEmbeddings?: boolean; // Include embeddings in returned entities/relationships (default: false)
  validFrom?: Date | string; // When fact becomes valid (default: now, when learn() is called)
  validTo?: Date | string; // When fact becomes invalid (default: null = ongoing)
}

/**
 * Batch progress information
 */
export interface BatchProgress {
  current: number; // Current item index (0-based)
  total: number; // Total items
  completed: number; // Successfully completed
  failed: number; // Failed so far
  currentText?: string; // Current item text (truncated if long)
  estimatedTimeRemainingMs?: number; // Estimated time remaining in milliseconds
}

/**
 * Batch progress callback function
 */
export type BatchProgressCallback = (progress: BatchProgress) => void | Promise<void>;

/**
 * Batch learn options
 */
export interface BatchLearnOptions extends Omit<LearnOptions, 'contextId'> {
  contextName?: string; // Shared context name for all texts (optional)
  // Each text can have its own contextId via BatchLearnItem
  onProgress?: BatchProgressCallback; // Progress callback (called after each item)
}

/**
 * Individual item in batch learn operation
 */
export interface BatchLearnItem {
  text: string;
  contextId?: string; // Optional per-item context ID
  contextName?: string; // Optional per-item context name
  validFrom?: Date | string;
  validTo?: Date | string;
}

/**
 * Batch learn result
 */
export interface BatchLearnResult {
  results: ExtractResult[];
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

/**
 * Health check status
 */
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

/**
 * Query statistics
 */
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

/**
 * Delete operation result
 */
export interface DeleteResult {
  deleted: boolean;
  message: string;
  relatedRelationshipsDeleted?: number; // For entity/document deletion (cascade relationships)
}

/**
 * Update entity options
 */
export interface UpdateEntityOptions {
  properties?: Record<string, unknown>;
  // Note: Can't change label (would require node recreation)
}

/**
 * Update relationship options
 */
export interface UpdateRelationshipOptions {
  properties?: Record<string, unknown>;
  // Note: Can't change type, from, to (would require deletion + recreation)
}

/**
 * Update document options
 */
export interface UpdateDocumentOptions {
  properties?: Record<string, unknown>;
  // Note: Can't change text (would break deduplication)
}

/**
 * List entities options
 */
export interface ListEntitiesOptions {
  label?: string; // Filter by entity label
  limit?: number; // Default: 100
  offset?: number; // Default: 0
  includeEmbeddings?: boolean; // Default: false
}

/**
 * List relationships options
 */
export interface ListRelationshipsOptions {
  type?: string; // Filter by relationship type
  fromId?: string; // Filter by source entity ID
  toId?: string; // Filter by target entity ID
  limit?: number; // Default: 100
  offset?: number; // Default: 0
  includeEmbeddings?: boolean; // Default: false
}

/**
 * List documents options
 */
export interface ListDocumentsOptions {
  limit?: number; // Default: 100
  offset?: number; // Default: 0
  includeEmbeddings?: boolean; // Default: false
}
