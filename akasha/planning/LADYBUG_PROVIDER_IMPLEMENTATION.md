# LadybugDB Provider Implementation Plan

## Overview

This document outlines the implementation plan for creating a `LadybugProvider` that implements the `DatabaseProvider` interface, enabling Akasha to work with [LadybugDB](https://ladybugdb.com/) instead of Neo4j.

**Key Facts:**
- **Latest Version:** 0.12.2 (as of December 2024)
- **Description:** An in-process property graph database management system built for query speed and scalability
- LadybugDB is built on top of KuzuDB (inherits robust Cypher implementation)
- Embedded graph database (runs in-process, no separate server)
- Uses Cypher query language (similar to Neo4j, with some differences)
- Supports vector search capabilities
- Has LLM extension with `CREATE_EMBEDDING` function (can generate embeddings directly in Cypher)
- Node.js package: [`lbug`](https://www.npmjs.com/package/lbug)
- MIT licensed, open source
- Focus on object storage and separation of compute/storage

## References

- **Website:** https://ladybugdb.com/
- **Documentation:** https://docs.ladybugdb.com/
- **NPM Package:** https://www.npmjs.com/package/lbug (v0.12.2)
- **Node.js API Docs:** https://docs.ladybugdb.com/use-client-apis/nodejs/
- **LLM Extension:** https://docs.ladybugdb.com/extensions/llm/
- **Vector Search:** https://docs.ladybugdb.com/extensions/vector-search/
- **Cypher Manual:** https://docs.ladybugdb.com/cypher-manual/
- **Blog/Release Notes:** https://blog.ladybugdb.com/post/ladybug-release/

## Phase 1: Research & Setup

### Step 1.1: Install and Explore LadybugDB

**Actions:**
1. Install the package:
   ```bash
   bun add lbug
   ```
   Current version: 0.12.2

2. Review Node.js API documentation:
   - Connection patterns (embedded, file path based)
   - Cypher query execution
   - Vector index creation
   - Transaction handling
   - Data type mappings
   - LLM extension usage (`CREATE_EMBEDDING`)

3. Test basic connectivity:
   ```typescript
   import { Database, Connection } from 'lbug';
   
   const db = new Database('./test-db');
   const conn = new Connection(db);
   const result = await conn.query('RETURN 1 as value');
   // Process result
   ```

4. **Key Discovery:** LadybugDB has an LLM extension that can generate embeddings directly:
   ```cypher
   CALL llm.create_embedding('text to embed', 'openai')
   ```
   This could potentially simplify embedding generation, though we'll still use our existing EmbeddingProvider for consistency.

**Deliverables:**
- [ ] Package installed
- [ ] Basic connection test working
- [ ] API patterns documented

### Step 1.2: Understand Key Differences from Neo4j

**Research Areas:**

1. **Connection Model:**
   - Neo4j: Server-based (URI, user, password)
   - LadybugDB: Embedded (file path only)

2. **ID System:**
   - Neo4j: Uses internal integer IDs (`id(node)`)
   - LadybugDB: May use different ID system (verify in docs)

3. **Vector Index Creation:**
   - Neo4j: `CALL db.index.vector.createNodeIndex(...)`
   - LadybugDB: Check documentation at https://docs.ladybugdb.com/extensions/vector-search/
   - May use different syntax or DDL commands

4. **Vector Similarity Search:**
   - Neo4j: `db.index.vector.queryNodes(...)`
   - LadybugDB: Verify vector search query syntax in documentation
   - May use different similarity functions or query patterns

5. **LLM Extension:**
   - LadybugDB has built-in `CREATE_EMBEDDING` function via LLM extension
   - Can generate embeddings directly in Cypher queries
   - Supports OpenAI, Google Gemini, Amazon Bedrock, VoyageAI, Ollama
   - Requires environment variables (e.g., `OPENAI_API_KEY`)
   - **Note:** We may not use this since we have our own EmbeddingProvider, but it's good to know it exists

5. **Data Types:**
   - Verify how embeddings are stored (FLOAT[] vs LIST<FLOAT>)
   - Verify property types match

**Deliverables:**
- [ ] Differences document created
- [ ] Vector search syntax verified
- [ ] ID handling strategy defined

## Phase 2: Create LadybugProvider Class

### Step 2.1: Create Base Class Structure

**File:** `src/services/providers/database/ladybug-provider.ts`

**Structure:**
```typescript
import { Database, Connection } from 'lbug';
import type { DatabaseProvider } from './interfaces';
import type { Entity, Relationship, Document, DeleteResult } from '../../../types';

export class LadybugProvider implements DatabaseProvider {
  private db: Database;
  private conn: Connection;
  private databasePath: string;

  constructor(config: { databasePath: string }) {
    this.databasePath = config.databasePath;
    this.db = new Database(this.databasePath);
    this.conn = new Connection(this.db);
  }

  // Implement all 27 methods from DatabaseProvider interface
}
```

**Key Considerations:**
- Connection is created in constructor (embedded DB)
- No separate `connect()` needed, but keep for interface compliance
- Store connection for reuse across queries

**Deliverables:**
- [ ] Class file created
- [ ] Constructor implemented
- [ ] All method signatures added (stubs)

### Step 2.2: Implement Connection & Setup Methods

**Methods to implement:**

1. **`connect()`:**
   ```typescript
   async connect(): Promise<void> {
     // Connection already established in constructor
     // Verify connectivity with a simple query
     await this.conn.query('RETURN 1');
   }
   ```

2. **`disconnect()`:**
   ```typescript
   async disconnect(): Promise<void> {
     // Close connection if API supports it
     // LadybugDB may not need explicit close (embedded)
     this.conn.close?.();
   }
   ```

3. **`ensureVectorIndex(indexName?: string)`:**
   ```typescript
   async ensureVectorIndex(indexName?: string): Promise<void> {
     const entityIndexName = indexName || 'entity_vector_index';
     const docIndexName = 'document_vector_index';
     
     // Check if indexes exist
     // Create if they don't
     // Use LadybugDB's vector index creation syntax
     // Verify: https://docs.ladybugdb.com/cypher-manual/...
   }
   ```

**Research Needed:**
- Vector index creation syntax in LadybugDB (check https://docs.ladybugdb.com/extensions/vector-search/)
- How to check if index exists
- Embedding dimension configuration (1536 for OpenAI)
- Vector data type (LIST<FLOAT> vs FLOAT[] vs other)
- Similarity function options (cosine, euclidean, etc.)

**Documentation Links:**
- Vector Search Extension: https://docs.ladybugdb.com/extensions/vector-search/
- LLM Extension: https://docs.ladybugdb.com/extensions/llm/
- Cypher Manual: https://docs.ladybugdb.com/cypher-manual/

**Deliverables:**
- [ ] `connect()` implemented
- [ ] `disconnect()` implemented
- [ ] `ensureVectorIndex()` implemented with vector support

## Phase 3: Implement Vector Search

### Step 3.1: Implement `findEntitiesByVector()`

**Reference Implementation (Neo4j):**
- Uses `db.index.vector.queryNodes()` procedure
- Filters by similarity threshold
- Applies scope and context filters
- Returns entities with `_similarity` property

**LadybugDB Implementation:**
```typescript
async findEntitiesByVector(
  queryEmbedding: number[],
  limit: number = 10,
  similarityThreshold: number = 0.5,
  scopeId?: string,
  contexts?: string[],
  validAt?: string
): Promise<Entity[]> {
  // 1. Convert embedding array to LadybugDB format
  // 2. Build Cypher query for vector search
  // 3. Apply scope filter if provided
  // 4. Apply context filter if provided
  // 5. Apply temporal filter if validAt provided
  // 6. Filter by similarity threshold
  // 7. Return entities with _similarity property
}
```

**Key Challenges:**
- Vector search query syntax (verify in docs)
- Embedding array format (may need LIST<FLOAT>)
- Similarity function (cosine, euclidean, etc.)

**Deliverables:**
- [ ] Vector search query working
- [ ] Similarity threshold filtering
- [ ] Scope/context/temporal filters applied

### Step 3.2: Implement `findDocumentsByVector()`

**Similar to `findEntitiesByVector()` but:**
- Targets `Document` nodes instead of `Entity`
- Uses `document_vector_index` instead of `entity_vector_index`

**Deliverables:**
- [ ] Document vector search implemented
- [ ] All filters working

## Phase 4: Implement CRUD Operations

### Step 4.1: Entity CRUD

**Methods:**
1. `createEntities()` - Batch create with embeddings
2. `findEntityByName()` - Find by name property
3. `findEntityById()` - Find by ID (verify ID format)
4. `updateEntity()` - Update properties
5. `updateEntityContextIds()` - Update contextIds array
6. `deleteEntity()` - Delete with cascade
7. `listEntities()` - List with pagination and filters

**Key Implementation Notes:**

**`createEntities()`:**
```typescript
async createEntities(
  entities: Array<{ label: string; properties: Record<string, unknown> }>,
  embeddings: number[][]
): Promise<Entity[]> {
  // 1. Build batch CREATE query
  // 2. Include embedding property (format as LIST<FLOAT>)
  // 3. Include scopeId, _recordedAt, etc.
  // 4. Execute query
  // 5. Return created entities with IDs
}
```

**ID Handling:**
- Neo4j uses `id(node)` which returns integer
- LadybugDB may use different ID system
- May need to use primary key or generate UUIDs
- Verify in documentation

**Deliverables:**
- [ ] All entity CRUD methods implemented
- [ ] ID handling verified
- [ ] Embedding storage working

### Step 4.2: Relationship CRUD

**Methods:**
1. `createRelationships()` - Batch create
2. `findRelationshipById()` - Find by ID
3. `updateRelationship()` - Update properties
4. `deleteRelationship()` - Delete
5. `listRelationships()` - List with filters

**Implementation Notes:**
- Relationship creation uses `CREATE` or `MERGE`
- Verify relationship ID format
- Handle scope filtering

**Deliverables:**
- [ ] All relationship CRUD methods implemented

### Step 4.3: Document CRUD

**Methods:**
1. `createDocument()` - Create with embedding
2. `findDocumentByText()` - Find by text property
3. `findDocumentById()` - Find by ID
4. `updateDocument()` - Update properties
5. `updateDocumentContextIds()` - Update contextIds
6. `deleteDocument()` - Delete
7. `listDocuments()` - List with pagination

**Deliverables:**
- [ ] All document CRUD methods implemented

## Phase 5: Implement Graph Operations

### Step 5.1: Implement `retrieveSubgraph()`

**Purpose:** Retrieve entities and relationships within a subgraph

**Implementation:**
```typescript
async retrieveSubgraph(
  entityLabels: string[],
  relationshipTypes: string[],
  maxDepth: number,
  limit: number,
  startEntityIds?: string[],
  scopeId?: string
): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
  // Build Cypher query:
  // MATCH path = (start:Entity)-[*1..maxDepth]-(end:Entity)
  // WHERE start.id IN startEntityIds
  // AND type(rel) IN relationshipTypes
  // AND labels(node) IN entityLabels
  // AND node.scopeId = scopeId
  // RETURN entities, relationships
  // LIMIT limit
}
```

**Deliverables:**
- [ ] Subgraph retrieval working
- [ ] Depth limiting working
- [ ] Label and type filtering working

### Step 5.2: Implement `linkEntityToDocument()`

**Purpose:** Create CONTAINS_ENTITY relationship

**Implementation:**
```typescript
async linkEntityToDocument(
  documentId: string,
  entityId: string,
  scopeId: string
): Promise<Relationship> {
  // MERGE (d:Document)-[r:CONTAINS_ENTITY]->(e:Entity)
  // WHERE id(d) = documentId AND id(e) = entityId
  // SET r.scopeId = scopeId
  // RETURN r
}
```

**Deliverables:**
- [ ] Linking working
- [ ] Scope filtering applied

### Step 5.3: Implement `getEntitiesFromDocuments()`

**Purpose:** Get entities connected to documents via CONTAINS_ENTITY

**Implementation:**
```typescript
async getEntitiesFromDocuments(
  documentIds: string[],
  scopeId?: string
): Promise<Entity[]> {
  // MATCH (d:Document)-[:CONTAINS_ENTITY]->(e:Entity)
  // WHERE id(d) IN documentIds
  // AND d.scopeId = scopeId
  // AND e.scopeId = scopeId
  // RETURN DISTINCT e
}
```

**Deliverables:**
- [ ] Entity retrieval from documents working

## Phase 6: Implement Helper Methods

### Step 6.1: Implement `ping()`

**Purpose:** Health check connectivity

```typescript
async ping(): Promise<boolean> {
  try {
    await this.conn.query('RETURN 1');
    return true;
  } catch {
    return false;
  }
}
```

**Deliverables:**
- [ ] Ping method working

## Phase 7: Update Configuration & Factory

### Step 7.1: Update Types

**File:** `src/types.ts`

Already has `KuzuConfig` - we can reuse or create `LadybugConfig`:

```typescript
export interface LadybugConfig {
  databasePath: string;
}

export type DatabaseConfig = 
  | { type: 'neo4j'; config: Neo4jConfig }
  | { type: 'kuzu'; config: KuzuConfig }
  | { type: 'ladybug'; config: LadybugConfig };
```

**Decision:** Use `ladybug` type or extend `kuzu`? Since LadybugDB is a fork, we might want a separate type.

**Deliverables:**
- [ ] Types updated
- [ ] Config validation updated

### Step 7.2: Update Factory

**File:** `src/services/providers/database/factory.ts`

```typescript
import { LadybugProvider } from './ladybug-provider';

export function createDatabaseProvider(config: DatabaseConfig): DatabaseProvider {
  if (config.type === 'neo4j') {
    return new Neo4jProvider(config.config);
  } else if (config.type === 'ladybug') {
    return new LadybugProvider(config.config);
  } else if (config.type === 'kuzu') {
    return new KuzuProvider(config.config);
  } else {
    throw new Error(`Unknown database type: ${(config as any).type}`);
  }
}
```

**Deliverables:**
- [ ] Factory updated
- [ ] Provider creation working

## Phase 8: Testing

**⚠️ IMPORTANT:** See `LADYBUG_TEST_IMPACT_ANALYSIS.md` for detailed test impact analysis.

### Test Impact Summary

**Total Test Files:** 28 files  
**Test Cases:** ~450 test cases  
**Impact Level:** Medium

**Key Findings:**
- **9 files (258 tests):** Already database-agnostic, no changes needed ✅
- **2 files (17 tests):** Neo4j-specific, keep as-is, create equivalents ⚠️
- **3 files (150+ tests):** Integration tests, need updates for database selection 🔴
- **5 files:** Provider/event tests, no impact ✅

### Step 8.1: Create Unit Tests for LadybugProvider

**File:** `src/__tests__/providers/database/ladybug-provider.test.ts`

**Test Coverage:**
- Connection/disconnection
- Vector index creation
- Vector search (entities and documents)
- CRUD operations (entities, relationships, documents)
- Subgraph retrieval
- Scope filtering
- Context filtering
- Temporal filtering
- Error handling
- Edge cases

**Note:** These tests use **real LadybugDB** (not mocks) since it's embedded.

**Deliverables:**
- [ ] Unit test file created
- [ ] All 27 methods tested
- [ ] All tests passing with real LadybugDB

### Step 8.2: Create Provider-Specific Tests

**File 1:** `src/__tests__/ladybug-vector-filtering.test.ts`

**Purpose:** Test LadybugDB-specific vector search query structure (equivalent to `neo4j-vector-filtering.test.ts`)

**Test Coverage:**
- WHERE clause insertion with scopeId
- WHERE clause insertion with contexts
- WHERE clause insertion with validAt
- Combined filters
- Query structure validation

**File 2:** `src/__tests__/ladybug-scope.test.ts`

**Purpose:** Test LadybugDB-specific scope filtering (equivalent to `neo4j-scope.test.ts`)

**Test Coverage:**
- Scope filter application
- Query modification for scope
- Scope in CRUD operations

**Deliverables:**
- [ ] Vector filtering tests created
- [ ] Scope filtering tests created
- [ ] All tests passing

### Step 8.3: Update Integration Tests

**Files to Update:**
1. `src/__tests__/integration/akasha-integration.test.ts`
2. `src/__tests__/integration/multi-provider.test.ts`

**Required Changes:**

1. **Add database type selection:**
   ```typescript
   const dbType = process.env.TEST_DB_TYPE || 'neo4j'; // 'neo4j' | 'ladybug'
   const shouldRunIntegrationTests = 
     (dbType === 'neo4j' && process.env.NEO4J_URI && process.env.NEO4J_USER && process.env.NEO4J_PASSWORD) ||
     (dbType === 'ladybug' && process.env.LADYBUG_DB_PATH);
   ```

2. **Create database-agnostic config helper:**
   ```typescript
   function createTestConfig(): AkashaConfig {
     const dbType = process.env.TEST_DB_TYPE || 'neo4j';
     if (dbType === 'neo4j') {
       return {
         database: {
           type: 'neo4j',
           config: {
             uri: process.env.NEO4J_URI!,
             user: process.env.NEO4J_USER!,
             password: process.env.NEO4J_PASSWORD!,
           },
         },
         // ...
       };
     } else {
       return {
         database: {
           type: 'ladybug',
           config: {
             databasePath: process.env.LADYBUG_DB_PATH || './test-ladybug-db',
           },
         },
         // ...
       };
     }
   }
   ```

3. **Update all test cases** to use `createTestConfig()`

**Deliverables:**
- [ ] Integration tests support both databases
- [ ] Tests can run with `TEST_DB_TYPE=neo4j` or `TEST_DB_TYPE=ladybug`
- [ ] All integration tests passing for both databases

### Step 8.4: Update Config Validation Tests

**File:** `src/__tests__/config-validation.test.ts`

**Required Changes:**
- Add test cases for LadybugDB config validation
- Test valid LadybugDB config
- Test invalid LadybugDB config (missing databasePath)
- Test config with both database types

**Deliverables:**
- [ ] Config validation tests updated
- [ ] All validation tests passing

### Step 8.5: Update Test Helpers

**File:** `src/__tests__/test-helpers.ts`

**Required Changes:**
- Add `createTestConfig()` with database type parameter
- Support both 'neo4j' and 'ladybug' types
- Update existing helpers if needed

**Deliverables:**
- [ ] Test helpers updated
- [ ] Database-agnostic helpers available

### Step 8.6: Update Example

**File:** `examples/ladybug-example.ts`

Update the example to use LadybugDB:

```typescript
const config: AkashaConfig = {
  database: {
    type: 'ladybug',
    config: {
      databasePath: './ladybug-db-example',
    },
  },
  // ... providers
};
```

**Deliverables:**
- [ ] Example updated
- [ ] Example working end-to-end

## Phase 9: Documentation

### Step 9.1: Update README

**Sections to add:**
- LadybugDB as supported database
- Installation instructions
- Configuration example
- Differences from Neo4j

**Deliverables:**
- [ ] README updated
- [ ] Configuration examples added

### Step 9.2: Create Implementation Guide

**File:** `docs/LADYBUG_IMPLEMENTATION.md`

Document:
- Architecture decisions
- Key differences from Neo4j
- Vector search implementation details
- Performance considerations

**Deliverables:**
- [ ] Implementation guide created

## Test Impact Reference

**See:** `LADYBUG_TEST_IMPACT_ANALYSIS.md` for detailed breakdown of:
- Which tests need updates
- Which tests can remain unchanged
- New tests required
- Test execution strategy
- Risk assessment

## Implementation Checklist

### Research Phase
- [ ] Install `lbug` package
- [ ] Review Node.js API documentation
- [ ] Test basic connectivity
- [ ] Document API patterns
- [ ] Verify vector index syntax
- [ ] Verify vector search syntax
- [ ] Understand ID system
- [ ] Document differences from Neo4j

### Implementation Phase
- [ ] Create `LadybugProvider` class
- [ ] Implement `connect()` / `disconnect()`
- [ ] Implement `ensureVectorIndex()`
- [ ] Implement `findEntitiesByVector()`
- [ ] Implement `findDocumentsByVector()`
- [ ] Implement `createEntities()`
- [ ] Implement `findEntityByName()` / `findEntityById()`
- [ ] Implement `updateEntity()` / `updateEntityContextIds()`
- [ ] Implement `deleteEntity()`
- [ ] Implement `listEntities()`
- [ ] Implement `createRelationships()`
- [ ] Implement `findRelationshipById()` / `updateRelationship()` / `deleteRelationship()`
- [ ] Implement `listRelationships()`
- [ ] Implement `createDocument()`
- [ ] Implement `findDocumentByText()` / `findDocumentById()`
- [ ] Implement `updateDocument()` / `updateDocumentContextIds()`
- [ ] Implement `deleteDocument()`
- [ ] Implement `listDocuments()`
- [ ] Implement `linkEntityToDocument()`
- [ ] Implement `retrieveSubgraph()`
- [ ] Implement `getEntitiesFromDocuments()`
- [ ] Implement `ping()`

### Integration Phase
- [ ] Update `DatabaseConfig` type
- [ ] Update factory function
- [ ] Update config validation
- [ ] Update exports

### Testing Phase
- [ ] Create unit tests
- [ ] Create integration tests
- [ ] Update example
- [ ] Run full test suite

### Documentation Phase
- [ ] Update README
- [ ] Create implementation guide
- [ ] Add code comments
- [ ] Update API docs

## Key Challenges & Solutions

### Challenge 1: Vector Index Syntax
**Problem:** LadybugDB may use different syntax for vector indexes than Neo4j.

**Solution:** 
- Research LadybugDB vector index documentation
- Test index creation with sample queries
- Adapt syntax to match LadybugDB API

### Challenge 2: ID System
**Problem:** Neo4j uses integer IDs, LadybugDB may use different system.

**Solution:**
- Verify ID format in LadybugDB docs
- May need to use primary keys or generate UUIDs
- Update ID handling throughout implementation

### Challenge 3: Vector Search Query Syntax
**Problem:** Vector similarity search syntax may differ.

**Solution:**
- Research vector search functions in LadybugDB
- Test similarity search queries
- Adapt to LadybugDB's vector search API

### Challenge 4: Embedding Storage Format
**Problem:** How to store embedding arrays (LIST<FLOAT> vs FLOAT[]).

**Solution:**
- Verify data type in LadybugDB docs
- Test embedding storage and retrieval
- Ensure compatibility with vector search

## Estimated Timeline

- **Phase 1 (Research):** 2-4 hours
- **Phase 2-6 (Implementation):** 16-24 hours
- **Phase 7 (Integration):** 2-3 hours
- **Phase 8 (Testing):** 21-30 hours
  - Unit tests: 8-12 hours
  - Provider-specific tests: 5-7 hours
  - Integration test updates: 4-6 hours
  - Config validation updates: 1 hour
  - Test helpers: 1 hour
  - Example: 1 hour
- **Phase 9 (Documentation):** 2-4 hours

**Total:** 43-65 hours

**Note:** Testing phase is longer because:
- Need to create equivalent tests for Neo4j-specific functionality
- Integration tests need to support both databases
- Real database testing (no mocks) takes longer

## Success Criteria

- [ ] All 27 `DatabaseProvider` methods implemented
- [ ] Vector search working (entities and documents)
- [ ] All CRUD operations working
- [ ] Scope filtering working
- [ ] Context filtering working
- [ ] Temporal filtering working
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Example working end-to-end
- [ ] Documentation complete
- [ ] Performance acceptable (comparable to Neo4j)

## Next Steps

1. **Start with Phase 1:** Install package and explore API
2. **Create stub implementation:** All methods with TODOs
3. **Implement incrementally:** One method at a time, test as you go
4. **Test thoroughly:** Unit tests for each method
5. **Integration test:** Full workflow with real data

## References

- [LadybugDB Website](https://ladybugdb.com/)
- [LadybugDB Documentation](https://docs.ladybugdb.com/)
- [NPM Package: lbug](https://www.npmjs.com/package/lbug) (v0.12.2)
- [Node.js API Documentation](https://docs.ladybugdb.com/use-client-apis/nodejs/)
- [Cypher Manual](https://docs.ladybugdb.com/cypher-manual/)
- [Vector Search Extension](https://docs.ladybugdb.com/extensions/vector-search/)
- [LLM Extension](https://docs.ladybugdb.com/extensions/llm/)
- [Release Notes (v0.12.0)](https://blog.ladybugdb.com/post/ladybug-release/)
- [Roadmap](https://ladybugdb.com/roadmap.html)

## Latest Updates (December 2024)

- **Version 0.12.2** is the current stable release
- Functionality equivalent to Kuzu v0.11.3
- CI/CD migrated to GitHub runners
- Focus on stabilizing codebase and storage engine
- Future: "DuckDB for Graphs" - lightweight, efficient graph database
- Future: Enhanced Agentic AI use cases
- Future: Lake house functionality

## Important Notes

1. **LLM Extension Available:** LadybugDB has a built-in `CREATE_EMBEDDING` function that can generate embeddings directly in Cypher. While we'll use our existing EmbeddingProvider for consistency, this could be useful for future optimizations.

2. **Embedded Database:** No separate server process - runs in-process. Connection is just file path initialization.

3. **Cypher Compatibility:** Inherits from KuzuDB, so Cypher syntax should be very similar to Neo4j, but verify differences in documentation.

4. **Vector Search:** Has dedicated vector search extension - verify exact syntax and capabilities.

