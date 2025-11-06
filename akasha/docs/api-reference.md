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
- `options.contexts?: string[]` - Context IDs to filter by (optional)
- `options.includeEmbeddings?: boolean` - Include embeddings in response (default: `false`)

**Returns:** `GraphRAGResponse`
```typescript
{
  context: {
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
});

console.log(result.answer);
console.log(result.context.entities);
```

---

### `learn(text: string, options?: LearnOptions): Promise<ExtractResult>`

Extracts entities and relationships from natural language text and stores them in the knowledge graph.

**Parameters:**

- `text: string` - Natural language text to extract from
- `options.contextName?: string` - Name for the context (default: generated)
- `options.contextId?: string` - ID for the context (default: generated UUID)
- `options.includeEmbeddings?: boolean` - Include embeddings in response (default: `false`)

**Returns:** `ExtractResult`
```typescript
{
  context: Context;
  entities: Entity[];
  relationships: Relationship[];
  summary: string;
  created: {
    entities: number;
    relationships: number;
  };
}
```

**Example:**
```typescript
const result = await kg.learn(
  'Alice works for Acme Corp. Bob works for TechCorp.',
  {
    contextName: 'Team Introduction',
    contextId: 'team-intro-1',
  }
);

console.log(`Created ${result.created.entities} entities`);
console.log(`Created ${result.created.relationships} relationships`);
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

### `Entity`

A node in the knowledge graph.

```typescript
interface Entity {
  id: string;
  label: string;
  properties: Record<string, unknown>;
}
```

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
    entities: Entity[];
    relationships: Relationship[];
    summary: string;
  };
  answer: string;
}
```

### `ExtractResult`

Response from `learn()` method.

```typescript
interface ExtractResult {
  context: Context;
  entities: Entity[];
  relationships: Relationship[];
  summary: string;
  created: {
    entities: number;
    relationships: number;
  };
}
```

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

