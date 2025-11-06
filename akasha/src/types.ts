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
    contextId?: string; // Optional link to Context metadata
    metadata?: Record<string, unknown>;
  };
}

/**
 * Entity
 */
export interface Entity {
  id: string;
  label: string;
  properties: Record<string, unknown>;
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
}
