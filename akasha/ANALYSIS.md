# Akasha Codebase Analysis

## Executive Summary

**Akasha** is a minimal, developer-friendly GraphRAG (Graph Retrieval-Augmented Generation) library that transforms natural language into structured knowledge graphs and enables semantic querying. It's built with TypeScript, uses Neo4j as the graph database, and supports multiple LLM/embedding providers through a pluggable provider architecture.

**Key Characteristics:**
- **Type**: Library/package (npm package: `@glossick/akasha`)
- **Runtime**: Currently requires Bun (v1.1.26+), Node.js compatibility in progress
- **Architecture**: Service-oriented with dependency injection
- **Database**: Neo4j (v5.0+ with vector index support)
- **Pattern**: GraphRAG (Graph + RAG)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Application Layer                      │
│  (User Code: learn(), ask(), batch operations, CRUD)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                      Akasha Class                             │
│  - Main orchestrator                                         │
│  - Coordinates services                                      │
│  - Handles scope/context management                          │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│ Neo4jService│  │ Embedding     │  │ LLM Provider │
│             │  │ Provider      │  │              │
│ - Graph ops │  │ - Vector gen │  │ - Text gen   │
│ - Vector    │  │ - OpenAI     │  │ - OpenAI     │
│   search    │  │ - DeepSeek    │  │ - Anthropic │
│ - CRUD      │  │              │  │ - DeepSeek   │
└─────────────┘  └──────────────┘  └──────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                        Neo4j Database                        │
│  - Entity nodes (with embeddings)                           │
│  - Document nodes (with embeddings)                         │
│  - Relationship edges                                        │
│  - Vector indexes (entity_vector_index, document_vector_index)│
└─────────────────────────────────────────────────────────────┘
```

### Core Components

1. **Akasha Class** (`src/akasha.ts`)
   - Main entry point for all operations
   - Orchestrates learning, querying, and graph management
   - Manages scope and context isolation

2. **Neo4jService** (`src/services/neo4j.service.ts`)
   - All Neo4j database operations
   - Vector similarity search
   - Graph traversal and subgraph retrieval
   - CRUD operations with scope filtering

3. **Provider System** (`src/services/providers/`)
   - Pluggable architecture for embeddings and LLMs
   - Interface-based design (`EmbeddingProvider`, `LLMProvider`)
   - Factory pattern for provider creation
   - Current providers: OpenAI, Anthropic, DeepSeek

4. **Utility Functions** (`src/utils/`)
   - Entity text generation for embeddings
   - Prompt template generation
   - Embedding scrubbing (removes from responses)
   - System metadata generation

---

## Design Patterns & Principles

### 1. Dependency Injection Pattern

**Location**: `Akasha` constructor, service constructors

**Implementation**:
```typescript
constructor(
  config: AkashaConfig,
  neo4jService?: Neo4jService,
  embeddingProvider?: EmbeddingProvider,
  llmProvider?: LLMProvider
) {
  // Use injected services or create from config
  this.neo4j = neo4jService || new Neo4jService(config.neo4j);
  // ...
}
```

**Benefits**:
- Testability: Easy to mock dependencies in tests
- Flexibility: Can swap implementations
- Follows ESLint architectural pattern for service layer

**ESLint Alignment**: ✅ Matches backend service layer pattern (DI in constructors)

### 2. Factory Pattern

**Location**: `src/factory.ts`, `src/services/providers/factory.ts`

**Implementation**:
```typescript
export function akasha(config: AkashaConfig): Akasha {
  return new Akasha(config);
}

export function createProvidersFromConfig(config: AkashaConfig): {
  embeddingProvider: EmbeddingProvider;
  llmProvider: LLMProvider;
}
```

**Benefits**:
- Simple API: `akasha(config)` instead of `new Akasha(config)`
- Provider creation abstracted from main class
- Type-safe provider resolution

**ESLint Alignment**: ✅ Factory functions are clean and type-safe

### 3. Provider Pattern (Strategy Pattern)

**Location**: `src/services/providers/interfaces.ts`, provider implementations

**Implementation**:
```typescript
export interface EmbeddingProvider {
  readonly dimensions: number;
  readonly provider: string;
  readonly model: string;
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

export interface LLMProvider {
  readonly provider: string;
  readonly model: string;
  generateResponse(...): Promise<string>;
}
```

**Benefits**:
- Pluggable providers (OpenAI, Anthropic, DeepSeek)
- Easy to add new providers
- Interface-based contracts
- Type-safe provider switching

**ESLint Alignment**: ✅ Interface-based contracts, explicit return types

### 4. Template Pattern

**Location**: `src/utils/prompt-template.ts`

**Implementation**:
- Default extraction prompt template
- Customizable via `extractionPrompt` config
- Merges custom with defaults (deep merge for arrays)

**Benefits**:
- Ontology customization without code changes
- Domain-specific extraction rules
- Backward compatible defaults

**ESLint Alignment**: ✅ Pure utility functions, no side effects

### 5. Scope-Based Multi-Tenancy

**Location**: Throughout codebase, `scopeId` filtering

**Implementation**:
- All entities/relationships/documents tagged with `scopeId`
- Queries automatically filter by scope
- No cross-scope data leakage

**Benefits**:
- Data isolation for multi-tenant apps
- Simple implementation (property-based filtering)
- No infrastructure overhead

**ESLint Alignment**: ✅ Consistent pattern across all queries

---

## Code Organization

### File Structure

```
akasha/
├── src/
│   ├── index.ts              # Public API exports
│   ├── akasha.ts             # Main Akasha class
│   ├── factory.ts             # Factory function
│   ├── types.ts               # TypeScript type definitions
│   ├── services/
│   │   ├── neo4j.service.ts  # Neo4j operations
│   │   ├── embedding.service.ts # Legacy (deprecated?)
│   │   └── providers/
│   │       ├── interfaces.ts  # Provider contracts
│   │       ├── factory.ts     # Provider factory
│   │       ├── embedding/
│   │       │   └── openai-embedding.provider.ts
│   │       └── llm/
│   │           ├── openai-llm.provider.ts
│   │           ├── anthropic-llm.provider.ts
│   │           └── deepseek-llm.provider.ts
│   └── utils/
│       ├── entity-embedding.ts    # Entity text generation
│       ├── prompt-template.ts     # Prompt generation
│       ├── scrub-embeddings.ts    # Remove embeddings from responses
│       └── system-metadata.ts     # System metadata generation
├── docs/                      # Documentation
├── examples/                  # Example usage
├── scripts/                   # Build/test scripts
└── dist/                      # Compiled output
```

### Module Boundaries

**Dependency Flow**:
```
akasha.ts
  ├── services/neo4j.service.ts
  ├── services/providers/factory.ts
  │   └── services/providers/*.provider.ts
  └── utils/*
      └── types.ts (shared types)
```

**ESLint Alignment**: ✅ Clear module boundaries, no circular dependencies

---

## Type System & Type Safety

### Type Definitions (`src/types.ts`)

**Key Types**:
- `AkashaConfig`: Configuration interface
- `Scope`: Multi-tenancy isolation boundary
- `Context`: Knowledge space within scope
- `Entity`, `Relationship`, `Document`: Graph primitives
- `GraphRAGQuery`, `GraphRAGResponse`: Query/response types
- `ExtractResult`, `LearnOptions`: Learning types
- Provider config types: `EmbeddingProviderConfig`, `LLMProviderConfig`

**Type Safety Features**:
- ✅ All public methods have explicit return types
- ✅ Interface-based contracts (providers)
- ✅ No `any` types in production code (tests allow `any` for mocks)
- ✅ Strict TypeScript configuration (`strict: true`)

**ESLint Alignment**: ✅ 
- `@typescript-eslint/explicit-module-boundary-types`: All exports typed
- `@typescript-eslint/no-explicit-any`: Warns on `any` (off in tests)
- Type safety prioritized

### Type Patterns

1. **Discriminated Unions**: Provider configs use `type` field
2. **Optional Properties**: Many configs use `?` for optional fields
3. **Generic Constraints**: Provider interfaces define contracts
4. **Utility Types**: `Omit`, `Partial` used for flexibility

---

## Development Patterns

### 1. Async/Await Pattern

**Pattern**: All async operations use `async/await`, never `.then()` chains

**Example**:
```typescript
async ask(query: string, options?: QueryOptions): Promise<GraphRAGResponse> {
  const queryEmbedding = await this.embeddingProvider.generateEmbedding(query);
  const documents = await this.neo4j.findDocumentsByVector(...);
  // ...
}
```

**ESLint Alignment**: ✅ 
- `@typescript-eslint/promise-function-async`: Warns on promise-returning functions
- `@typescript-eslint/no-floating-promises`: Error on unhandled promises
- Consistent async pattern

### 2. Error Handling

**Pattern**: Try/catch with meaningful error messages, structured error objects

**Example**:
```typescript
try {
  const result = await this.llmProvider.generateResponse(...);
  return result;
} catch (error) {
  console.error('Failed to parse LLM response:', error);
  throw new Error(`Failed to extract graph structure: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
```

**ESLint Alignment**: ✅ Explicit error handling, no silent failures

### 3. Configuration Validation

**Pattern**: Static validation method with detailed error reporting

**Example**:
```typescript
static validateConfig(config: AkashaConfig): ConfigValidationResult {
  const errors: Array<{ field: string; message: string }> = [];
  const warnings: Array<{ field: string; message: string }> = [];
  // ... validation logic
  return { valid: errors.length === 0, errors, warnings };
}
```

**ESLint Alignment**: ✅ Explicit return types, clear validation logic

### 4. Session Management

**Pattern**: Always close Neo4j sessions in `finally` blocks

**Example**:
```typescript
const session = this.getSession();
try {
  // ... operations
} finally {
  await session.close();
}
```

**ESLint Alignment**: ✅ Resource cleanup, no resource leaks

### 5. Deduplication Pattern

**Pattern**: Check for existing entities/documents before creating

**Example**:
```typescript
const existingDocument = await this.neo4j.findDocumentByText(text, scopeId);
if (existingDocument) {
  document = await this.neo4j.updateDocumentContextIds(existingDocument.id, contextId);
} else {
  document = await this.neo4j.createDocument(...);
}
```

**ESLint Alignment**: ✅ Efficient resource usage, prevents duplicates

### 6. Embedding Scrubbing

**Pattern**: Remove embeddings from responses by default (large arrays)

**Example**:
```typescript
const scrubbedData = options?.includeEmbeddings
  ? { entities: subgraph.entities, relationships: subgraph.relationships }
  : scrubEmbeddings({ entities: subgraph.entities, relationships: subgraph.relationships });
```

**ESLint Alignment**: ✅ Pure utility functions, no side effects

---

## Key Features & Capabilities

### 1. Learning (`learn()`)

**Process**:
1. Document node creation (with deduplication)
2. LLM-based entity/relationship extraction
3. Entity deduplication (by name)
4. Embedding generation
5. Graph storage with scope/context tracking
6. System metadata generation (temporal tracking)

**Features**:
- Document deduplication (same text = same document)
- Entity deduplication (same name = same entity)
- Multi-context tracking (`contextIds` array)
- Temporal tracking (`_validFrom`, `_validTo`)
- Batch learning with progress callbacks

### 2. Querying (`ask()`)

**Process**:
1. Query embedding generation
2. Vector similarity search (documents and/or entities)
3. Context/temporal filtering
4. Subgraph retrieval (graph traversal)
5. Context formatting for LLM
6. Answer generation

**Features**:
- Multiple query strategies (`documents`, `entities`, `both`)
- Similarity threshold filtering (default: 0.7)
- Context filtering (strict: must belong to at least one context)
- Temporal filtering (`validAt` for point-in-time queries)
- Query statistics (optional performance metrics)
- Embedding scrubbing (optional inclusion)

### 3. Graph Management

**CRUD Operations**:
- `findEntity()`, `findRelationship()`, `findDocument()`
- `updateEntity()`, `updateRelationship()`, `updateDocument()`
- `deleteEntity()`, `deleteRelationship()`, `deleteDocument()` (cascade)
- `listEntities()`, `listRelationships()`, `listDocuments()` (pagination)

**Features**:
- Scope-aware operations
- System metadata protection (can't update `_recordedAt`, `scopeId`, etc.)
- Cascade deletion for relationships
- Pagination support

### 4. Multi-Tenancy

**Scope System**:
- All data tagged with `scopeId`
- Automatic filtering in all queries
- No cross-scope data access
- Optional scope (can be undefined for global data)

**Context System**:
- Documents/entities belong to multiple contexts (`contextIds` array)
- Context filtering in queries (strict: must match at least one)
- Context tracking for provenance

### 5. Temporal Tracking

**System Metadata**:
- `_recordedAt`: When fact was recorded (always automatic)
- `_validFrom`: When fact becomes valid (defaults to `_recordedAt`)
- `_validTo`: When fact becomes invalid (optional, null = ongoing)

**Temporal Queries**:
- `validAt` option in queries: only return facts valid at that time
- Enables historical reasoning and point-in-time queries

### 6. Provider System

**Embedding Providers**:
- OpenAI (text-embedding-3-small, etc.)
- DeepSeek (mentioned in types, implementation may vary)

**LLM Providers**:
- OpenAI (GPT-4, GPT-4 Turbo, GPT-4o)
- Anthropic (Claude models)
- DeepSeek

**Provider Features**:
- Interface-based contracts
- Factory pattern for creation
- Type-safe configuration
- Easy to extend with new providers

---

## ESLint Compliance Analysis

### ✅ Fully Compliant Patterns

1. **Explicit Return Types**: All exported functions/methods have return types
2. **No `any` Types**: Production code avoids `any` (tests allow for mocks)
3. **Async/Await**: Consistent use, no `.then()` chains
4. **Error Handling**: Try/catch with meaningful errors
5. **Module Boundaries**: Clear dependency hierarchy
6. **Naming Conventions**: camelCase for functions, PascalCase for classes/types
7. **No Unused Variables**: Clean code, unused vars prefixed with `_`
8. **Type Safety**: Strict TypeScript, explicit types throughout

### ⚠️ Minor Deviations (Acceptable)

1. **Console Statements**: Uses `console.warn`/`console.error` (allowed by ESLint)
2. **Non-Null Assertions**: Rarely used, but present in some places (warned by ESLint)
3. **Empty Interfaces**: Some interfaces are minimal but serve as contracts (acceptable)

### 📝 Code Quality Highlights

1. **Self-Documenting**: Types serve as documentation
2. **Testable**: Dependency injection enables easy mocking
3. **Maintainable**: Clear patterns, predictable organization
4. **Extensible**: Provider system, template system, scope system all extensible
5. **Type-Safe**: Strong TypeScript usage throughout

---

## Testing Patterns

### Test Structure

**Location**: `src/__tests__/`

**Patterns**:
- Mock dependencies (Neo4jService, providers)
- Test isolation (beforeEach/afterEach)
- Type-safe mocks
- Integration tests separate from unit tests

**Example**:
```typescript
const mockNeo4jService = {
  connect: mock(() => Promise.resolve()),
  findEntitiesByVector: mock(() => Promise.resolve([...])),
  // ...
} as any; // 'any' allowed in tests per ESLint
```

**ESLint Alignment**: ✅ Tests allow `any` for mocks, console statements OK in tests

---

## Build & Distribution

### Build Process

**Scripts** (`package.json`):
- `build`: TypeScript compilation + ESM import fixes
- `prepublishOnly`: Build before publishing
- `test`: Bun test runner
- `test:integration`: Integration tests only
- `test:unit`: Unit tests only

**Output**:
- `dist/`: Compiled JavaScript + TypeScript declarations
- Source maps and declaration maps for debugging

**ESLint Alignment**: ✅ Build scripts are clean, no console.log in production

---

## Documentation

### Documentation Structure

**Location**: `docs/`

**Files**:
- `getting-started.md`: Quick start guide
- `core-concepts.md`: Technical architecture
- `philosophy.md`: Design principles
- `api-reference.md`: Complete API docs
- `examples.md`: Usage examples
- `ontologies.md`: Ontology customization
- `multi-tenancy.md`: Scope/context system
- `providers.md`: Provider configuration

**Quality**: Comprehensive, well-structured, includes examples

---

## Key Architectural Decisions

### 1. Document Nodes as First-Class Citizens

**Decision**: Documents are nodes in the graph, not just metadata

**Rationale**:
- Enables full-text retrieval in queries
- Deduplication by text content
- Semantic search over documents
- Clear provenance (entities linked to documents)

**Impact**: More storage, but better query capabilities

### 2. Scope Filtering at Query Time

**Decision**: Single Neo4j connection, scope filtering in queries

**Rationale**:
- Efficiency: Single connection pool
- Simplicity: No complex connection management
- Flexibility: Easy to add scopes

**Trade-off**: All scopes share same database (weaker isolation than separate databases)

### 3. Provider Abstraction

**Decision**: Interface-based provider system

**Rationale**:
- Pluggable providers (OpenAI, Anthropic, DeepSeek)
- Easy to add new providers
- Type-safe provider switching
- Testability (can mock providers)

**Impact**: More code, but better flexibility

### 4. Embedding Scrubbing by Default

**Decision**: Remove embeddings from responses unless explicitly requested

**Rationale**:
- Embeddings are large arrays (1536 dimensions)
- Not needed for most use cases
- Reduces response size significantly

**Impact**: Better performance, but requires `includeEmbeddings: true` when needed

### 5. Temporal Tracking

**Decision**: Automatic system metadata with optional temporal validity

**Rationale**:
- Enables historical reasoning
- Point-in-time queries
- "Map is not the territory" philosophy (facts recorded at one time, valid at another)

**Impact**: More metadata, but enables temporal queries

---

## Performance Considerations

### Optimizations

1. **Vector Indexes**: Uses Neo4j vector indexes for fast similarity search
2. **Fallback Search**: Property-based cosine similarity if vector indexes unavailable
3. **Deduplication**: Prevents duplicate documents/entities
4. **Embedding Scrubbing**: Reduces response size
5. **Connection Pooling**: Single Neo4j driver instance
6. **Batch Operations**: `learnBatch()` for efficient bulk processing

### Potential Bottlenecks

1. **LLM Calls**: Entity extraction and answer generation (external API calls)
2. **Embedding Generation**: Vector generation for each entity/document
3. **Graph Traversal**: Subgraph retrieval can be expensive for large graphs
4. **Context Size**: LLM context window limits (200k chars max)

---

## Security Considerations

### Current State

1. **API Keys**: Stored in config (should use environment variables)
2. **Scope Isolation**: Property-based filtering (not database-level)
3. **Input Validation**: Configuration validation, but limited input sanitization
4. **Cypher Injection**: Uses parameterized queries (safe)

### Recommendations

1. Use environment variables for API keys
2. Consider database-level scope isolation for stronger security
3. Add input sanitization for user-provided text
4. Rate limiting for LLM/embedding API calls

---

## Future Considerations

### Known Limitations

1. **Bun Runtime**: Currently requires Bun, Node.js compatibility in progress
2. **Provider Support**: Limited embedding providers (OpenAI primary)
3. **Vector Dimensions**: Fixed at 1536 (OpenAI default)
4. **Context Window**: 200k char limit for LLM context

### Potential Enhancements

1. **More Providers**: Additional embedding/LLM providers
2. **Custom Embeddings**: Support for user-provided embeddings
3. **Graph Analytics**: Built-in graph analysis features
4. **Query Optimization**: Better subgraph retrieval strategies
5. **Caching**: Embedding/query result caching
6. **Streaming**: Streaming responses for long queries

---

## Conclusion

Akasha is a well-architected GraphRAG library that demonstrates:

✅ **Strong Type Safety**: TypeScript strict mode, explicit types throughout
✅ **Clean Architecture**: Service layer, dependency injection, clear boundaries
✅ **ESLint Compliance**: Follows architectural patterns from `.eslintrc.cjs`
✅ **Extensibility**: Provider system, template system, scope system
✅ **Developer Experience**: Simple API (`learn()`, `ask()`), comprehensive docs
✅ **Production Ready**: Error handling, validation, resource management

The codebase follows modern TypeScript best practices and aligns well with the ESLint configuration's architectural principles. It's maintainable, testable, and designed for extension.

