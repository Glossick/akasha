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
}
```

**Example:**
```typescript
const result = await kg.ask('What is the relationship between Alice and Bob?', {
  maxDepth: 3,
  limit: 100,
  strategy: 'both', // Search both documents and entities
  contexts: ['handbook-1', 'interviews-1'], // Filter by specific contexts
});

console.log(result.answer);
console.log(result.context.documents); // Document nodes found
console.log(result.context.entities); // Entity nodes found
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

