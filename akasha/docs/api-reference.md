# API Reference

Complete reference for Akasha's public API.

## Factory Function

### `akasha(config: AkashaConfig): Akasha`

Creates and returns an Akasha instance.

**Parameters:**

- `config.neo4j` - Neo4j connection configuration
  - `uri: string` - Connection URI (e.g., `'bolt://localhost:7687'`)
  - `user: string` - Username
  - `password: string` - Password
  - `database?: string` - Database name (default: `'neo4j'`)
- `config.openai` - OpenAI configuration (optional)
  - `apiKey: string` - OpenAI API key (required if not in environment)
  - `model?: string` - LLM model (default: `'gpt-4'`)
  - `embeddingModel?: string` - Embedding model (default: `'text-embedding-3-small'`)
- `config.scope?: Scope` - Scope configuration for multi-tenancy
- `config.extractionPrompt?: Partial<ExtractionPromptTemplate>` - Custom extraction prompt template

**Returns:** `Akasha` instance

**Example:**

```typescript
const kg = akasha({
  neo4j: {
    uri: 'bolt://localhost:7687',
    user: 'neo4j',
    password: 'password',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
  },
  scope: {
    id: 'my-scope',
    type: 'project',
    name: 'My Project',
  },
});
```

---

## Akasha Class

### `static validateConfig(config: AkashaConfig): ConfigValidationResult`

Validates an Akasha configuration without creating an instance. Useful for validating configuration before instantiation.

**Parameters:**
- `config: AkashaConfig` - The configuration to validate

**Returns:** `ConfigValidationResult`
```typescript
{
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
```

**Example:**
```typescript
const config = {
  neo4j: {
    uri: 'bolt://localhost:7687',
    user: 'neo4j',
    password: 'password',
  },
  openai: {
    apiKey: 'sk-test-key',
  },
};

const validation = Akasha.validateConfig(config);

if (!validation.valid) {
  console.error('Configuration errors:');
  validation.errors.forEach(error => {
    console.error(`  ${error.field}: ${error.message}`);
  });
} else {
  const kg = akasha(config);
  await kg.initialize();
}
```

**Validation Rules:**
- **Neo4j** (required): `uri`, `user`, `password` must be non-empty strings
- **OpenAI** (optional): If provided, `apiKey` must be a non-empty string
- **Scope** (optional): If provided, `id`, `type`, and `name` must be non-empty strings
- **Warnings**: Non-standard Neo4j URI formats (not starting with `bolt://` or `neo4j://`) generate warnings but don't fail validation

---

### `validateConfig(): ConfigValidationResult`

Validates the current instance's configuration.

**Returns:** `ConfigValidationResult` - Same format as static method

**Example:**
```typescript
const kg = akasha({
  neo4j: { /* ... */ },
  // ...
});

const validation = kg.validateConfig();

if (!validation.valid) {
  console.error('Configuration is invalid:', validation.errors);
}
```

---

### `initialize(): Promise<void>`

Connects to Neo4j and ensures the vector index exists. Must be called before using `ask()` or `learn()`.

**Example:**
```typescript
await kg.initialize();
```

---

### `cleanup(): Promise<void>`

Closes the Neo4j connection. Call this when done with the instance.

**Example:**
```typescript
await kg.cleanup();
```

---

### `ask(query: string, options?: QueryOptions): Promise<GraphRAGResponse>`

Queries the knowledge graph semantically and returns an answer with context.

**Parameters:**

- `query: string` - Natural language question
- `options.maxDepth?: number` - Maximum graph traversal depth (default: `2`)
- `options.limit?: number` - Maximum entities to retrieve (default: `50`)
- `options.contexts?: string[]` - Context IDs to filter by (optional). When provided, only searches documents and entities that belong to at least one of the specified contexts. Uses strict filtering: entities/documents must have at least one matching contextId in their `contextIds` array.
- `options.strategy?: QueryStrategy` - Query strategy: `'documents'`, `'entities'`, or `'both'` (default: `'both'`)
  - `'documents'`: Searches only document nodes, then retrieves connected entities via graph traversal
  - `'entities'`: Searches only entity nodes (original behavior)
  - `'both'`: Searches both documents and entities, combining results
- `options.includeEmbeddings?: boolean` - Include embeddings in response (default: `false`)
- `options.validAt?: Date | string` - Only return facts valid at this time (optional). When provided, filters entities, documents, and relationships to only include those where `_validFrom <= validAt` and (`_validTo >= validAt` or `_validTo` is not set). Default: returns all facts regardless of validity period.
- `options.includeStats?: boolean` - Include query statistics in response (default: `false`). When `true`, the response includes a `statistics` object with timing and count information.
- `options.similarityThreshold?: number` - Minimum similarity score for documents/entities (default: `0.7`). Only documents and entities with similarity scores above this threshold are included in results. Higher values (e.g., `0.8`, `0.9`) provide stricter filtering and only return highly relevant results. Lower values (e.g., `0.5`, `0.6`) are more permissive but may include less relevant results. Range: `0.0` to `1.0`.

**Returns:** `GraphRAGResponse`
```typescript
{
  context: {
    documents?: Document[]; // Documents found (if strategy includes documents)
    entities: Entity[];
    relationships: Relationship[];
    summary: string;
  };
  answer: string;
  statistics?: QueryStatistics; // Included when includeStats: true
}
```

**Query Statistics** (when `includeStats: true`):
```typescript
{
  searchTimeMs: number; // Time spent on vector search
  subgraphRetrievalTimeMs: number; // Time spent retrieving subgraph
  llmGenerationTimeMs: number; // Time spent generating LLM response
  totalTimeMs: number; // Total query time
  documentsFound: number; // Number of documents found
  entitiesFound: number; // Number of entities found
  relationshipsFound: number; // Number of relationships found
  strategy: QueryStrategy; // Strategy used for this query
}
```

**Example:**
```typescript
const result = await kg.ask('What is the relationship between Alice and Bob?', {
  maxDepth: 3,
  limit: 100,
  strategy: 'both', // Search both documents and entities
  contexts: ['handbook-1', 'interviews-1'], // Filter by specific contexts
  validAt: new Date('2024-06-01'), // Only return facts valid on this date
  includeStats: true, // Include query statistics
});

console.log(result.answer);
console.log(result.context.documents); // Document nodes found
console.log(result.context.entities); // Entity nodes found

// Access statistics if requested
if (result.statistics) {
  console.log(`Query took ${result.statistics.totalTimeMs}ms`);
  console.log(`Found ${result.statistics.entitiesFound} entities`);
}
```

---

### `learn(text: string, options?: LearnOptions): Promise<ExtractResult>`

Extracts entities and relationships from natural language text and stores them in the knowledge graph. Creates a document node for the text (with deduplication), extracts entities and relationships, and links them together.

**⚠️ Important**: A scope must be configured when creating the Akasha instance. The `learn()` method will throw an error if no scope is provided.

**Parameters:**

- `text: string` - Natural language text to extract from
- `options.contextName?: string` - Name for the context (default: generated)
- `options.contextId?: string` - ID for the context (default: generated UUID). If a document with the same text already exists, this contextId is appended to the document's `contextIds` array. Same for entities: if an entity already exists, the contextId is appended to its `contextIds` array.
- `options.includeEmbeddings?: boolean` - Include embeddings in response (default: `false`)
- `options.validFrom?: Date | string` - When the fact becomes valid (optional). Default: current time (when `learn()` is called). Stored as `_validFrom` on documents, entities, and relationships.
- `options.validTo?: Date | string` - When the fact becomes invalid (optional). If not provided, the fact is considered ongoing (no expiration). Stored as `_validTo` on documents, entities, and relationships.

**Returns:** `ExtractResult`
```typescript
{
  context: Context; // Context metadata (id, scopeId, name, source)
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
```

**Document Deduplication:**
If the same text is learned multiple times, Akasha reuses the existing document node and appends the new `contextId` to the document's `contextIds` array. This enables:
- Efficient storage (no duplicate documents)
- Multi-context tracking (same document can belong to multiple contexts)
- Entity reuse across documents (entities are also deduplicated and can belong to multiple contexts)

**System Metadata:**
All learned facts (documents, entities, relationships) automatically receive system metadata:
- `_recordedAt`: ISO timestamp when the fact was recorded (always present)
- `_validFrom`: ISO timestamp when the fact becomes valid (defaults to `_recordedAt` if not provided)
- `_validTo`: ISO timestamp when the fact becomes invalid (optional, omitted for ongoing facts)

This temporal metadata enables querying facts by their validity period using the `validAt` option in `ask()`.

**Example:**
```typescript
const result = await kg.learn(
  'Alice works for Acme Corp. Bob works for TechCorp.',
  {
    contextName: 'Team Introduction',
    contextId: 'team-intro-1',
  }
);

console.log(`Document: ${result.document.id} (${result.created.document === 1 ? 'created' : 'reused'})`);
console.log(`Created ${result.created.entities} entities`);
console.log(`Created ${result.created.relationships} relationships`);

// Learn same text again with different context
const result2 = await kg.learn(
  'Alice works for Acme Corp. Bob works for TechCorp.',
  {
    contextId: 'team-intro-2', // Different context
  }
);
// result2.document.id === result.document.id (same document reused)
// result2.created.document === 0 (document was deduplicated)
// result2.document.properties.contextIds includes both 'team-intro-1' and 'team-intro-2'
```

---

### `getScope(): Scope | undefined`

Returns the current scope configuration, or `undefined` if no scope is configured.

**Returns:** `Scope | undefined`

**Example:**
```typescript
const scope = kg.getScope();
if (scope) {
  console.log(`Current scope: ${scope.name}`);
}
```

---

### `learnBatch(items: string[] | BatchLearnItem[], options?: BatchLearnOptions): Promise<BatchLearnResult>`

Learn from multiple texts in batch. Processes each text sequentially and aggregates results.

**Parameters:**

- `items: string[] | BatchLearnItem[]` - Array of text strings or batch learn items with per-item options
- `options.contextName?: string` - Shared context name for all items (optional)
- `options.validFrom?: Date | string` - Shared validFrom for all items (optional)
- `options.validTo?: Date | string` - Shared validTo for all items (optional)
- `options.includeEmbeddings?: boolean` - Include embeddings in response (default: `false`)
- `options.onProgress?: BatchProgressCallback` - Progress callback called after each item is processed

**Returns:** `BatchLearnResult`
```typescript
{
  results: ExtractResult[]; // Individual results for each item
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
  }>; // Only present if any items failed
}
```

**Example:**
```typescript
// Simple batch with string array
const result = await kg.learnBatch([
  'Alice works for Acme Corp.',
  'Bob works for TechCorp.',
  'Charlie works for StartupCo.',
], {
  contextName: 'Batch Import',
});

console.log(`Processed ${result.summary.succeeded} of ${result.summary.total} texts`);
console.log(`Created ${result.summary.totalEntitiesCreated} entities`);

// Batch with per-item options
const items = [
  {
    text: 'Alice works for Acme Corp.',
    contextId: 'context-1',
    contextName: 'Item 1',
  },
  {
    text: 'Bob works for TechCorp.',
    contextId: 'context-2',
    contextName: 'Item 2',
    validFrom: new Date('2024-01-01'),
  },
];

const result2 = await kg.learnBatch(items);
```

**With Progress Callback:**
```typescript
const texts = [
  'Alice works for Acme Corp.',
  'Bob works for TechCorp.',
  'Charlie works for StartupCo.',
];

const result = await kg.learnBatch(texts, {
  onProgress: (progress) => {
    console.log(`Progress: ${progress.completed}/${progress.total} completed`);
    console.log(`Failed: ${progress.failed}`);
    if (progress.estimatedTimeRemainingMs) {
      const seconds = Math.round(progress.estimatedTimeRemainingMs / 1000);
      console.log(`Estimated time remaining: ${seconds}s`);
    }
  },
});
```

**Error Handling:**
If any item fails, it's recorded in the `errors` array and processing continues. The `summary.failed` count indicates how many items failed.

---

### `healthCheck(): Promise<HealthStatus>`

Check the health status of Neo4j and OpenAI services.

**Returns:** `HealthStatus`
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  neo4j: {
    connected: boolean;
    error?: string;
  };
  openai: {
    available: boolean;
    error?: string;
  };
  timestamp: string; // ISO timestamp
}
```

**Status Values:**
- `'healthy'`: Both Neo4j and OpenAI are available
- `'degraded'`: One service is unavailable
- `'unhealthy'`: Both services are unavailable

**Example:**
```typescript
const health = await kg.healthCheck();

if (health.status === 'healthy') {
  console.log('All services operational');
} else if (health.status === 'degraded') {
  if (!health.neo4j.connected) {
    console.error('Neo4j unavailable:', health.neo4j.error);
  }
  if (!health.openai.available) {
    console.error('OpenAI unavailable:', health.openai.error);
  }
} else {
  console.error('All services unavailable');
}
```

---

### `deleteEntity(entityId: string): Promise<DeleteResult>`

Deletes an entity by ID. Cascade deletes all relationships connected to the entity.

**Parameters:**
- `entityId: string` - The ID of the entity to delete

**Returns:** `DeleteResult`
```typescript
{
  deleted: boolean;
  message: string;
  relatedRelationshipsDeleted?: number; // Number of relationships deleted
}
```

**Example:**
```typescript
const result = await kg.deleteEntity('entity-123');

if (result.deleted) {
  console.log(`Entity deleted. Removed ${result.relatedRelationshipsDeleted} relationships.`);
} else {
  console.error('Failed to delete:', result.message);
}
```

**Note:** This operation respects scope boundaries. You can only delete entities within your configured scope.

---

### `deleteRelationship(relationshipId: string): Promise<DeleteResult>`

Deletes a relationship by ID.

**Parameters:**
- `relationshipId: string` - The ID of the relationship to delete

**Returns:** `DeleteResult`
```typescript
{
  deleted: boolean;
  message: string;
}
```

**Example:**
```typescript
const result = await kg.deleteRelationship('rel-456');

if (result.deleted) {
  console.log('Relationship deleted successfully');
} else {
  console.error('Failed to delete:', result.message);
}
```

**Note:** This operation respects scope boundaries. You can only delete relationships within your configured scope.

---

### `deleteDocument(documentId: string): Promise<DeleteResult>`

Deletes a document by ID. Cascade deletes all `CONTAINS_ENTITY` relationships connected to the document.

**Parameters:**
- `documentId: string` - The ID of the document to delete

**Returns:** `DeleteResult`
```typescript
{
  deleted: boolean;
  message: string;
  relatedRelationshipsDeleted?: number; // Number of CONTAINS_ENTITY relationships deleted
}
```

**Example:**
```typescript
const result = await kg.deleteDocument('doc-789');

if (result.deleted) {
  console.log(`Document deleted. Removed ${result.relatedRelationshipsDeleted} entity links.`);
} else {
  console.error('Failed to delete:', result.message);
}
```

**Note:** This operation respects scope boundaries. You can only delete documents within your configured scope.

---

### `findEntity(entityId: string): Promise<Entity | null>`

Finds an entity by ID.

**Parameters:**
- `entityId: string` - The ID of the entity to find

**Returns:** `Entity | null` - The entity if found, `null` otherwise

**Example:**
```typescript
const entity = await kg.findEntity('entity-123');

if (entity) {
  console.log(`Found entity: ${entity.label} - ${entity.properties.name}`);
} else {
  console.log('Entity not found');
}
```

**Note:** This operation respects scope boundaries. You can only find entities within your configured scope.

---

### `findRelationship(relationshipId: string): Promise<Relationship | null>`

Finds a relationship by ID.

**Parameters:**
- `relationshipId: string` - The ID of the relationship to find

**Returns:** `Relationship | null` - The relationship if found, `null` otherwise

**Example:**
```typescript
const relationship = await kg.findRelationship('rel-456');

if (relationship) {
  console.log(`Found relationship: ${relationship.type} from ${relationship.from} to ${relationship.to}`);
} else {
  console.log('Relationship not found');
}
```

**Note:** This operation respects scope boundaries. You can only find relationships within your configured scope.

---

### `findDocument(documentId: string): Promise<Document | null>`

Finds a document by ID.

**Parameters:**
- `documentId: string` - The ID of the document to find

**Returns:** `Document | null` - The document if found, `null` otherwise

**Example:**
```typescript
const document = await kg.findDocument('doc-789');

if (document) {
  console.log(`Found document: ${document.properties.text.substring(0, 100)}...`);
} else {
  console.log('Document not found');
}
```

**Note:** This operation respects scope boundaries. You can only find documents within your configured scope.

---

### `updateEntity(entityId: string, options: UpdateEntityOptions): Promise<Entity>`

Updates entity properties. System metadata fields (`_recordedAt`, `_validFrom`, `_validTo`, `scopeId`, `contextIds`, `embedding`) are automatically protected and cannot be updated.

**Parameters:**
- `entityId: string` - The ID of the entity to update
- `options.properties?: Record<string, unknown>` - Properties to update (system metadata fields are filtered out)

**Returns:** `Entity` - The updated entity

**Example:**
```typescript
const updated = await kg.updateEntity('entity-123', {
  properties: {
    name: 'Alice Updated',
    age: 30,
    role: 'Senior Engineer',
  },
});

console.log(`Updated: ${updated.properties.name}`);
```

**Note:** 
- This operation respects scope boundaries. You can only update entities within your configured scope.
- System metadata fields are automatically filtered out and cannot be changed.
- Entity labels cannot be changed (would require node recreation).

---

### `updateRelationship(relationshipId: string, options: UpdateRelationshipOptions): Promise<Relationship>`

Updates relationship properties. System metadata fields (`_recordedAt`, `_validFrom`, `_validTo`, `scopeId`) are automatically protected and cannot be updated.

**Parameters:**
- `relationshipId: string` - The ID of the relationship to update
- `options.properties?: Record<string, unknown>` - Properties to update (system metadata fields are filtered out)

**Returns:** `Relationship` - The updated relationship

**Example:**
```typescript
const updated = await kg.updateRelationship('rel-456', {
  properties: {
    since: '2019-01-01',
    role: 'Manager',
    department: 'Engineering',
  },
});

console.log(`Updated relationship: ${updated.type}`);
```

**Note:** 
- This operation respects scope boundaries. You can only update relationships within your configured scope.
- System metadata fields are automatically filtered out and cannot be changed.
- Relationship type, from, and to cannot be changed (would require deletion + recreation).

---

### `updateDocument(documentId: string, options: UpdateDocumentOptions): Promise<Document>`

Updates document properties. System metadata fields and the `text` property are automatically protected and cannot be updated.

**Parameters:**
- `documentId: string` - The ID of the document to update
- `options.properties?: Record<string, unknown>` - Properties to update (system metadata fields and `text` are filtered out)

**Returns:** `Document` - The updated document

**Example:**
```typescript
const updated = await kg.updateDocument('doc-789', {
  properties: {
    metadata: {
      source: 'updated-source',
      author: 'Test Author',
      version: 2,
    },
  },
});

console.log(`Updated document metadata: ${JSON.stringify(updated.properties.metadata)}`);
```

**Note:** 
- This operation respects scope boundaries. You can only update documents within your configured scope.
- System metadata fields (`_recordedAt`, `_validFrom`, `_validTo`, `scopeId`, `contextIds`, `embedding`) are automatically filtered out.
- The `text` property cannot be changed (would break document deduplication).

---

### `listEntities(options?: ListEntitiesOptions): Promise<Entity[]>`

Lists entities with optional filtering by label and pagination.

**Parameters:**
- `options.label?: string` - Filter by entity label (e.g., `'Person'`, `'Company'`)
- `options.limit?: number` - Maximum number of entities to return (default: `100`)
- `options.offset?: number` - Number of entities to skip (default: `0`)
- `options.includeEmbeddings?: boolean` - Include embeddings in response (default: `false`)

**Returns:** `Entity[]` - Array of entities

**Example:**
```typescript
// List all entities
const allEntities = await kg.listEntities();

// Filter by label
const people = await kg.listEntities({ label: 'Person' });

// Pagination
const page1 = await kg.listEntities({ limit: 50, offset: 0 });
const page2 = await kg.listEntities({ limit: 50, offset: 50 });
```

**Note:** This operation respects scope boundaries. You can only list entities within your configured scope.

---

### `listRelationships(options?: ListRelationshipsOptions): Promise<Relationship[]>`

Lists relationships with optional filtering by type, source, or target entity, and pagination.

**Parameters:**
- `options.type?: string` - Filter by relationship type (e.g., `'WORKS_FOR'`, `'KNOWS'`)
- `options.fromId?: string` - Filter by source entity ID
- `options.toId?: string` - Filter by target entity ID
- `options.limit?: number` - Maximum number of relationships to return (default: `100`)
- `options.offset?: number` - Number of relationships to skip (default: `0`)
- `options.includeEmbeddings?: boolean` - Include embeddings in response (default: `false`)

**Returns:** `Relationship[]` - Array of relationships

**Example:**
```typescript
// List all relationships
const allRels = await kg.listRelationships();

// Filter by type
const worksForRels = await kg.listRelationships({ type: 'WORKS_FOR' });

// Filter by source entity
const fromEntity = await kg.listRelationships({ fromId: 'entity-123' });

// Filter by target entity
const toEntity = await kg.listRelationships({ toId: 'entity-456' });

// Combine filters
const specific = await kg.listRelationships({
  type: 'WORKS_FOR',
  fromId: 'entity-123',
  limit: 10,
});
```

**Note:** This operation respects scope boundaries. You can only list relationships within your configured scope.

---

### `listDocuments(options?: ListDocumentsOptions): Promise<Document[]>`

Lists documents with optional pagination.

**Parameters:**
- `options.limit?: number` - Maximum number of documents to return (default: `100`)
- `options.offset?: number` - Number of documents to skip (default: `0`)
- `options.includeEmbeddings?: boolean` - Include embeddings in response (default: `false`)

**Returns:** `Document[]` - Array of documents

**Example:**
```typescript
// List all documents
const allDocs = await kg.listDocuments();

// Pagination
const page1 = await kg.listDocuments({ limit: 20, offset: 0 });
const page2 = await kg.listDocuments({ limit: 20, offset: 20 });
```

**Note:** This operation respects scope boundaries. You can only list documents within your configured scope.

---

## Types

### `Scope`

Represents an isolation boundary for multi-tenancy.

```typescript
interface Scope {
  id: string;
  type: 'tenant' | 'workspace' | 'project' | 'organization' | 'user' | string;
  name: string;
  metadata?: Record<string, unknown>;
}
```

### `Context`

Represents a knowledge space within a scope.

```typescript
interface Context {
  id: string;
  scopeId: string;
  name: string;
  source: string; // Original text
  metadata?: Record<string, unknown>;
}
```

### `Document`

A first-class document node in the knowledge graph, representing the full text content.

```typescript
interface Document {
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
```

Documents are:
- Created for each unique text learned
- Deduplicated by text content (same text = same document node)
- Linked to entities via `CONTAINS_ENTITY` relationships
- Searchable via vector similarity search
- Can belong to multiple contexts (via `contextIds` array)

### `Entity`

A node in the knowledge graph.

```typescript
interface Entity {
  id: string;
  label: string;
  properties: Record<string, unknown> & {
    contextIds?: string[]; // Array of context IDs this entity belongs to
  };
}
```

Entities:
- Are extracted from document text
- Are deduplicated by name (same entity name = same entity node)
- Can belong to multiple contexts (via `contextIds` array)
- Are linked to documents via `CONTAINS_ENTITY` relationships
- Are searchable via vector similarity search

### `Relationship`

An edge in the knowledge graph.

```typescript
interface Relationship {
  id: string;
  type: string;
  from: string; // Entity ID
  to: string;   // Entity ID
  properties: Record<string, unknown>;
}
```

### `GraphRAGResponse`

Response from `ask()` method.

```typescript
interface GraphRAGResponse {
  context: {
    documents?: Document[]; // Documents found (if strategy includes documents)
    entities: Entity[];
    relationships: Relationship[];
    summary: string;
  };
  answer: string;
}
```

The `documents` array is included when:
- `strategy` is `'documents'` or `'both'`
- Documents are found via vector similarity search

### `ExtractResult`

Response from `learn()` method.

```typescript
interface ExtractResult {
  context: Context; // Context metadata (id, scopeId, name, source)
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
```

### `QueryStrategy`

Query strategy for `ask()` method.

```typescript
type QueryStrategy = 'documents' | 'entities' | 'both';
```

- `'documents'`: Search document nodes first, then retrieve connected entities
- `'entities'`: Search entity nodes only (original behavior)
- `'both'`: Search both documents and entities, combining results (default)

### `ExtractionPromptTemplate`

Configuration for custom extraction prompts. See [Ontologies](./ontologies.md) for details.

```typescript
interface ExtractionPromptTemplate {
  role?: string;
  task?: string;
  formatRules?: string[];
  extractionConstraints?: string[];
  entityTypes?: EntityTypeDefinition[];
  relationshipTypes?: RelationshipTypeDefinition[];
  semanticConstraints?: string[];
  outputFormat?: string;
}
```

### `DeleteResult`

Result of a delete operation.

```typescript
interface DeleteResult {
  deleted: boolean;
  message: string;
  relatedRelationshipsDeleted?: number; // For entity/document deletion
}
```

- `deleted: boolean` - Whether the deletion was successful
- `message: string` - Human-readable message describing the result
- `relatedRelationshipsDeleted?: number` - Number of relationships that were cascade-deleted (only for entity/document deletion)

### `UpdateEntityOptions`

Options for updating an entity.

```typescript
interface UpdateEntityOptions {
  properties?: Record<string, unknown>;
  // Note: Can't change label (would require node recreation)
}
```

### `UpdateRelationshipOptions`

Options for updating a relationship.

```typescript
interface UpdateRelationshipOptions {
  properties?: Record<string, unknown>;
  // Note: Can't change type, from, to (would require deletion + recreation)
}
```

### `UpdateDocumentOptions`

Options for updating a document.

```typescript
interface UpdateDocumentOptions {
  properties?: Record<string, unknown>;
  // Note: Can't change text (would break deduplication)
}
```

---

## Error Handling

Akasha methods may throw errors in these cases:

- **Connection errors**: Neo4j connection fails
- **API errors**: OpenAI API calls fail
- **Validation errors**: Invalid configuration or parameters
- **Extraction errors**: LLM fails to extract valid JSON

Always wrap calls in try-catch blocks:


```typescript
try {
  await kg.initialize();
  const result = await kg.ask('Your question');
} catch (error) {
  if (error instanceof Error) {
    console.error('Error:', error.message);
  }
} finally {
  await kg.cleanup();
}
```

---

**Next**: Read [Ontologies](./ontologies.md) to customize extraction behavior, or [Multi-Tenancy](./multi-tenancy.md) for scope management patterns.

