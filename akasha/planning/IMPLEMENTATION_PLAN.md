# Database Provider Pattern - Implementation Plan

## File Structure

```
src/
├── services/
│   ├── providers/
│   │   ├── database/
│   │   │   ├── interfaces.ts          # DatabaseProvider interface
│   │   │   ├── factory.ts             # createDatabaseProvider()
│   │   │   ├── neo4j-provider.ts      # Neo4jProvider implementation
│   │   │   └── kuzu-provider.ts       # KuzuProvider (future)
│   │   ├── embedding/
│   │   ├── llm/
│   │   └── factory.ts                 # Existing provider factory
│   └── neo4j.service.ts               # Existing (wrapped by Neo4jProvider)
├── types.ts                           # Update AkashaConfig, HealthStatus
├── akasha.ts                          # Update to use DatabaseProvider
├── factory.ts                         # Update to use database factory
└── index.ts                           # Export new types
```

## Phase 1: Interface Definition

### Step 1.1: Create DatabaseProvider Interface

**File:** `src/services/providers/database/interfaces.ts`

```typescript
import type { Entity, Relationship, Document, DeleteResult } from '../../types';

/**
 * Database Provider Interface
 * 
 * Abstracts database operations to support multiple graph databases (Neo4j, Kuzu, etc.)
 */
export interface DatabaseProvider {
  // Connection & Setup
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ensureVectorIndex(indexName?: string): Promise<void>;
  
  // Vector Search
  findEntitiesByVector(
    queryEmbedding: number[],
    limit: number,
    similarityThreshold: number,
    scopeId?: string,
    contexts?: string[],
    validAt?: string
  ): Promise<Entity[]>;
  
  findDocumentsByVector(
    queryEmbedding: number[],
    limit: number,
    similarityThreshold: number,
    scopeId?: string,
    contexts?: string[],
    validAt?: string
  ): Promise<Document[]>;
  
  // Graph Operations
  retrieveSubgraph(
    entityLabels: string[],
    relationshipTypes: string[],
    maxDepth: number,
    limit: number,
    startEntityIds?: string[],
    scopeId?: string
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }>;
  
  // Entity CRUD
  createEntities(
    entities: Array<{ label: string; properties: Record<string, unknown> }>,
    embeddings: number[][]
  ): Promise<Entity[]>;
  
  findEntityByName(name: string, scopeId: string): Promise<Entity | null>;
  findEntityById(entityId: string, scopeId?: string): Promise<Entity | null>;
  updateEntity(entityId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Entity>;
  updateEntityContextIds(entityId: string, contextId: string): Promise<Entity>;
  deleteEntity(entityId: string, scopeId?: string): Promise<DeleteResult>;
  listEntities(label?: string, limit?: number, offset?: number, scopeId?: string): Promise<Entity[]>;
  
  // Relationship CRUD
  createRelationships(
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, unknown>;
    }>
  ): Promise<Relationship[]>;
  
  findRelationshipById(relationshipId: string, scopeId?: string): Promise<Relationship | null>;
  updateRelationship(relationshipId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Relationship>;
  deleteRelationship(relationshipId: string, scopeId?: string): Promise<DeleteResult>;
  listRelationships(
    type?: string,
    fromId?: string,
    toId?: string,
    limit?: number,
    offset?: number,
    scopeId?: string
  ): Promise<Relationship[]>;
  
  // Document CRUD
  createDocument(
    document: { properties: Document['properties'] },
    embedding: number[]
  ): Promise<Document>;
  
  findDocumentByText(text: string, scopeId: string): Promise<Document | null>;
  findDocumentById(documentId: string, scopeId?: string): Promise<Document | null>;
  updateDocument(documentId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Document>;
  updateDocumentContextIds(documentId: string, contextId: string): Promise<Document>;
  deleteDocument(documentId: string, scopeId?: string): Promise<DeleteResult>;
  listDocuments(limit?: number, offset?: number, scopeId?: string): Promise<Document[]>;
  
  // Linking
  linkEntityToDocument(documentId: string, entityId: string, scopeId: string): Promise<Relationship>;
  
  // Additional methods (replacing getSession())
  getEntitiesFromDocuments(documentIds: string[], scopeId?: string): Promise<Entity[]>;
  ping(): Promise<boolean>; // For health checks
}
```

**Action:**
1. Create directory: `src/services/providers/database/`
2. Create file with interface above
3. Verify TypeScript compiles: `bun run build`

---

### Step 1.2: Update HealthStatus Interface

**File:** `src/types.ts` (Line 328)

**Change:**
```typescript
// BEFORE:
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  neo4j: {
    connected: boolean;
    error?: string;
  };
  // ...
}

// AFTER:
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {  // Changed from neo4j
    connected: boolean;
    error?: string;
  };
  openai: {
    available: boolean;
    error?: string;
  };
  timestamp: string;
}
```

**Action:**
1. Update interface
2. Run test: `bun test src/__tests__/health-check.test.ts`
3. Fix test assertions: `health.neo4j` → `health.database`

---

### Step 1.3: Update AkashaConfig Interface

**File:** `src/types.ts` (Line 118)

**Change:**
```typescript
// BEFORE:
export interface AkashaConfig {
  neo4j: {
    uri: string;
    user: string;
    password: string;
    database?: string;
  };
  providers: ProvidersConfig;
  scope?: Scope;
  // ...
}

// AFTER:
export type DatabaseType = 'neo4j' | 'kuzu';

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
  database?: string;
}

export interface KuzuConfig {
  databasePath: string; // Kuzu uses file path, not connection string
}

export type DatabaseConfig = 
  | { type: 'neo4j'; config: Neo4jConfig }
  | { type: 'kuzu'; config: KuzuConfig };

export interface AkashaConfig {
  database: DatabaseConfig;
  providers: ProvidersConfig;
  scope?: Scope;
  extractionPrompt?: Partial<ExtractionPromptTemplate>;
  events?: EventsConfig;
}
```

**Action:**
1. Add new types above `AkashaConfig`
2. Update `AkashaConfig` interface
3. Run test: `bun test src/__tests__/config-validation.test.ts`
4. Update validation logic (see Step 1.4)

---

### Step 1.4: Update Config Validation

**File:** `src/akasha.ts` (Line 92, `validateConfig` method)

**Change:**
```typescript
// BEFORE:
if (!config.neo4j) {
  errors.push({ field: 'neo4j', message: 'Neo4j configuration is required' });
} else {
  if (!config.neo4j.uri || ...) {
    errors.push({ field: 'neo4j.uri', message: '...' });
  }
  // ...
}

// AFTER:
if (!config.database) {
  errors.push({ field: 'database', message: 'Database configuration is required' });
} else {
  if (config.database.type === 'neo4j') {
    const dbConfig = config.database.config;
    if (!dbConfig.uri || typeof dbConfig.uri !== 'string' || dbConfig.uri.trim() === '') {
      errors.push({
        field: 'database.config.uri',
        message: 'Neo4j URI is required and must be a non-empty string',
      });
    } else if (!dbConfig.uri.startsWith('bolt://') && !dbConfig.uri.startsWith('neo4j://')) {
      warnings.push({
        field: 'database.config.uri',
        message: 'Neo4j URI should start with "bolt://" or "neo4j://"',
      });
    }
    
    if (!dbConfig.user || typeof dbConfig.user !== 'string' || dbConfig.user.trim() === '') {
      errors.push({
        field: 'database.config.user',
        message: 'Neo4j user is required and must be a non-empty string',
      });
    }
    
    if (!dbConfig.password || typeof dbConfig.password !== 'string' || dbConfig.password.trim() === '') {
      errors.push({
        field: 'database.config.password',
        message: 'Neo4j password is required and must be a non-empty string',
      });
    }
  } else if (config.database.type === 'kuzu') {
    const dbConfig = config.database.config;
    if (!dbConfig.databasePath || typeof dbConfig.databasePath !== 'string' || dbConfig.databasePath.trim() === '') {
      errors.push({
        field: 'database.config.databasePath',
        message: 'Kuzu database path is required and must be a non-empty string',
      });
    }
  } else {
    errors.push({
      field: 'database.type',
      message: `Unknown database type: "${config.database.type}". Must be one of: neo4j, kuzu`,
    });
  }
}
```

**Action:**
1. Replace validation logic
2. Run test: `bun test src/__tests__/config-validation.test.ts`
3. Update test expectations for new field paths

---

### Step 1.5: Update EmbeddingProvider Comment

**File:** `src/services/providers/interfaces.ts` (Line 17)

**Change:**
```typescript
// BEFORE:
/**
 * Must match the Neo4j vector index configuration
 */
readonly dimensions: number;

// AFTER:
/**
 * Must match the database vector index configuration
 */
readonly dimensions: number;
```

**Action:**
1. Update comment
2. Verify: `bun run build`

---

## Phase 2: Add Methods to Neo4jService

### Step 2.1: Add getEntitiesFromDocuments() Method

**File:** `src/services/neo4j.service.ts`

**Add new method (after `linkEntityToDocument`):**
```typescript
/**
 * Get entities connected to documents via CONTAINS_ENTITY relationships
 * Replaces direct getSession() usage in akasha.ts
 */
async getEntitiesFromDocuments(documentIds: string[], scopeId?: string): Promise<Entity[]> {
  const session = this.getSession();
  try {
    if (documentIds.length === 0) {
      return [];
    }

    const docIdsList = documentIds.map(id => neo4j.int(id).toString()).join(', ');
    let query = `
      MATCH (d:Document)-[:CONTAINS_ENTITY]->(e:Entity)
      WHERE id(d) IN [${docIdsList}]
    `;
    
    if (scopeId) {
      query += ` AND d.scopeId = $scopeId AND e.scopeId = $scopeId`;
    }
    
    query += `
      RETURN DISTINCT id(e) as id, labels(e) as labels, properties(e) as properties
    `;

    const result = await session.run(query, scopeId ? { scopeId } : {});
    
    return result.records.map((record: any) => ({
      id: record.get('id').toString(),
      label: record.get('labels')[0] || 'Unknown',
      properties: record.get('properties') || {},
    }));
  } finally {
    await session.close();
  }
}
```

**Action:**
1. Add method to Neo4jService
2. Verify: `bun run build`

---

### Step 2.2: Add ping() Method

**File:** `src/services/neo4j.service.ts`

**Add new method (after `getEntitiesFromDocuments`):**
```typescript
/**
 * Simple connectivity check for health checks
 * Replaces getSession() + session.run('RETURN 1') usage
 */
async ping(): Promise<boolean> {
  try {
    const session = this.getSession();
    try {
      await session.run('RETURN 1');
      return true;
    } finally {
      await session.close();
    }
  } catch (error) {
    return false;
  }
}
```

**Action:**
1. Add method to Neo4jService
2. Run test: `bun test src/__tests__/health-check.test.ts`
3. Update health check to use `ping()` (see Phase 3)

---

## Phase 3: Create Neo4jProvider

### Step 3.1: Create Neo4jProvider Class

**File:** `src/services/providers/database/neo4j-provider.ts`

```typescript
import { Neo4jService } from '../../neo4j.service';
import type { DatabaseProvider } from './interfaces';
import type { Entity, Relationship, Document, DeleteResult } from '../../../types';

/**
 * Neo4j implementation of DatabaseProvider
 * Wraps Neo4jService to implement the database-agnostic interface
 */
export class Neo4jProvider implements DatabaseProvider {
  private neo4jService: Neo4jService;

  constructor(config: { uri: string; user: string; password: string; database?: string }) {
    this.neo4jService = new Neo4jService(config);
  }

  // Connection & Setup
  async connect(): Promise<void> {
    return this.neo4jService.connect();
  }

  async disconnect(): Promise<void> {
    return this.neo4jService.disconnect();
  }

  async ensureVectorIndex(indexName?: string): Promise<void> {
    return this.neo4jService.ensureVectorIndex(indexName);
  }

  // Vector Search
  async findEntitiesByVector(
    queryEmbedding: number[],
    limit: number = 10,
    similarityThreshold: number = 0.5,
    scopeId?: string,
    contexts?: string[],
    validAt?: string
  ): Promise<Entity[]> {
    return this.neo4jService.findEntitiesByVector(
      queryEmbedding,
      limit,
      similarityThreshold,
      scopeId,
      contexts,
      validAt
    );
  }

  async findDocumentsByVector(
    queryEmbedding: number[],
    limit: number = 10,
    similarityThreshold: number = 0.5,
    scopeId?: string,
    contexts?: string[],
    validAt?: string
  ): Promise<Document[]> {
    return this.neo4jService.findDocumentsByVector(
      queryEmbedding,
      limit,
      similarityThreshold,
      scopeId,
      contexts,
      validAt
    );
  }

  // Graph Operations
  async retrieveSubgraph(
    entityLabels: string[],
    relationshipTypes: string[],
    maxDepth: number,
    limit: number,
    startEntityIds?: string[],
    scopeId?: string
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    return this.neo4jService.retrieveSubgraph(
      entityLabels,
      relationshipTypes,
      maxDepth,
      limit,
      startEntityIds,
      scopeId
    );
  }

  // Entity CRUD
  async createEntities(
    entities: Array<{ label: string; properties: Record<string, unknown> }>,
    embeddings: number[][]
  ): Promise<Entity[]> {
    return this.neo4jService.createEntities(entities, embeddings);
  }

  async findEntityByName(name: string, scopeId: string): Promise<Entity | null> {
    return this.neo4jService.findEntityByName(name, scopeId);
  }

  async findEntityById(entityId: string, scopeId?: string): Promise<Entity | null> {
    return this.neo4jService.findEntityById(entityId, scopeId);
  }

  async updateEntity(entityId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Entity> {
    return this.neo4jService.updateEntity(entityId, properties, scopeId);
  }

  async updateEntityContextIds(entityId: string, contextId: string): Promise<Entity> {
    return this.neo4jService.updateEntityContextIds(entityId, contextId);
  }

  async deleteEntity(entityId: string, scopeId?: string): Promise<DeleteResult> {
    return this.neo4jService.deleteEntity(entityId, scopeId);
  }

  async listEntities(label?: string, limit: number = 100, offset: number = 0, scopeId?: string): Promise<Entity[]> {
    return this.neo4jService.listEntities(label, limit, offset, scopeId);
  }

  // Relationship CRUD
  async createRelationships(
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, unknown>;
    }>
  ): Promise<Relationship[]> {
    return this.neo4jService.createRelationships(relationships);
  }

  async findRelationshipById(relationshipId: string, scopeId?: string): Promise<Relationship | null> {
    return this.neo4jService.findRelationshipById(relationshipId, scopeId);
  }

  async updateRelationship(relationshipId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Relationship> {
    return this.neo4jService.updateRelationship(relationshipId, properties, scopeId);
  }

  async deleteRelationship(relationshipId: string, scopeId?: string): Promise<DeleteResult> {
    return this.neo4jService.deleteRelationship(relationshipId, scopeId);
  }

  async listRelationships(
    type?: string,
    fromId?: string,
    toId?: string,
    limit: number = 100,
    offset: number = 0,
    scopeId?: string
  ): Promise<Relationship[]> {
    return this.neo4jService.listRelationships(type, fromId, toId, limit, offset, scopeId);
  }

  // Document CRUD
  async createDocument(
    document: { properties: Document['properties'] },
    embedding: number[]
  ): Promise<Document> {
    return this.neo4jService.createDocument(document, embedding);
  }

  async findDocumentByText(text: string, scopeId: string): Promise<Document | null> {
    return this.neo4jService.findDocumentByText(text, scopeId);
  }

  async findDocumentById(documentId: string, scopeId?: string): Promise<Document | null> {
    return this.neo4jService.findDocumentById(documentId, scopeId);
  }

  async updateDocument(documentId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Document> {
    return this.neo4jService.updateDocument(documentId, properties, scopeId);
  }

  async updateDocumentContextIds(documentId: string, contextId: string): Promise<Document> {
    return this.neo4jService.updateDocumentContextIds(documentId, contextId);
  }

  async deleteDocument(documentId: string, scopeId?: string): Promise<DeleteResult> {
    return this.neo4jService.deleteDocument(documentId, scopeId);
  }

  async listDocuments(limit: number = 100, offset: number = 0, scopeId?: string): Promise<Document[]> {
    return this.neo4jService.listDocuments(limit, offset, scopeId);
  }

  // Linking
  async linkEntityToDocument(documentId: string, entityId: string, scopeId: string): Promise<Relationship> {
    return this.neo4jService.linkEntityToDocument(documentId, entityId, scopeId);
  }

  // Additional methods
  async getEntitiesFromDocuments(documentIds: string[], scopeId?: string): Promise<Entity[]> {
    return this.neo4jService.getEntitiesFromDocuments(documentIds, scopeId);
  }

  async ping(): Promise<boolean> {
    return this.neo4jService.ping();
  }
}
```

**Action:**
1. Create file with class above
2. Verify: `bun run build`

---

### Step 3.2: Create Database Provider Factory

**File:** `src/services/providers/database/factory.ts`

```typescript
import type { DatabaseProvider } from './interfaces';
import type { DatabaseConfig } from '../../../types';
import { Neo4jProvider } from './neo4j-provider';
// import { KuzuProvider } from './kuzu-provider'; // Future

/**
 * Create a database provider from configuration
 */
export function createDatabaseProvider(config: DatabaseConfig): DatabaseProvider {
  if (config.type === 'neo4j') {
    return new Neo4jProvider(config.config);
  } else if (config.type === 'kuzu') {
    // return new KuzuProvider(config.config); // Future
    throw new Error('Kuzu provider not yet implemented');
  } else {
    throw new Error(`Unknown database type: ${(config as any).type}`);
  }
}
```

**Action:**
1. Create file with factory function
2. Verify: `bun run build`

---

## Phase 4: Update Akasha Class

### Step 4.1: Update Imports and Constructor

**File:** `src/akasha.ts`

**Change imports (Line 30, 38):**
```typescript
// BEFORE:
import { Neo4jService } from './services/neo4j.service';
import neo4j from 'neo4j-driver';

// AFTER:
import type { DatabaseProvider } from './services/providers/database/interfaces';
import { createDatabaseProvider } from './services/providers/database/factory';
```

**Change constructor (Line 54-65):**
```typescript
// BEFORE:
export class Akasha {
  private neo4j: Neo4jService;
  // ...
  constructor(
    config: AkashaConfig,
    neo4jService?: Neo4jService,
    embeddingProvider?: EmbeddingProvider,
    llmProvider?: LLMProvider
  ) {
    // ...
    this.neo4j = neo4jService || new Neo4jService(config.neo4j);
    // ...
  }

// AFTER:
export class Akasha {
  private databaseProvider: DatabaseProvider;
  // ...
  constructor(
    config: AkashaConfig,
    databaseProvider?: DatabaseProvider,
    embeddingProvider?: EmbeddingProvider,
    llmProvider?: LLMProvider
  ) {
    // ...
    this.databaseProvider = databaseProvider || createDatabaseProvider(config.database);
    // ...
  }
```

**Action:**
1. Update imports
2. Update class property name
3. Update constructor signature
4. Update initialization logic
5. Run test: `bun test src/__tests__/akasha.test.ts --grep "Initialization"`

---

### Step 4.2: Replace All this.neo4j References

**File:** `src/akasha.ts`

**Find and replace:**
- `this.neo4j.` → `this.databaseProvider.` (27 occurrences)

**Action:**
1. Use find/replace in editor
2. Verify all 27 method calls updated
3. Run incremental tests (see Phase 3 in ITERATION_PLAN.md)

---

### Step 4.3: Replace getSession() Usage - Entities from Documents

**File:** `src/akasha.ts` (Line 399-446)

**Change:**
```typescript
// BEFORE:
if (documents.length > 0) {
  const session = this.neo4j.getSession();
  try {
    const relevantDocIds = documents
      .filter((d) => {
        const similarity = d.properties._similarity as number | undefined;
        return similarity !== undefined && similarity >= similarityThreshold;
      })
      .map((d) => d.id);

    if (relevantDocIds.length === 0) {
      // No relevant documents, skip entity retrieval
    } else {
      const docIdsList = relevantDocIds.map(id => neo4j.int(id).toString()).join(', ');
      let docQuery = `
        MATCH (d:Document)-[:CONTAINS_ENTITY]->(e:Entity)
        WHERE id(d) IN [${docIdsList}]
      `;
      
      if (scopeId) {
        docQuery += ` AND d.scopeId = $scopeId AND e.scopeId = $scopeId`;
      }
      
      docQuery += `
        RETURN DISTINCT id(e) as id, labels(e) as labels, properties(e) as properties
      `;

      const docResult = await session.run(docQuery, scopeId ? { scopeId } : {});
      const docEntities = docResult.records.map((record: any) => ({
        id: record.get('id').toString(),
        label: record.get('labels')[0] || 'Unknown',
        properties: record.get('properties') || {},
      }));

      // Merge with existing entities (avoid duplicates)
      const existingEntityIds = new Set(entities.map(e => e.id));
      for (const docEntity of docEntities) {
        if (!existingEntityIds.has(docEntity.id)) {
          entities.push(docEntity);
          entityIds.push(docEntity.id);
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not retrieve entities from documents:', error);
  } finally {
    await session.close();
  }
}

// AFTER:
if (documents.length > 0) {
  try {
    const relevantDocIds = documents
      .filter((d) => {
        const similarity = d.properties._similarity as number | undefined;
        return similarity !== undefined && similarity >= similarityThreshold;
      })
      .map((d) => d.id);

    if (relevantDocIds.length > 0) {
      const docEntities = await this.databaseProvider.getEntitiesFromDocuments(relevantDocIds, scopeId);

      // Merge with existing entities (avoid duplicates)
      const existingEntityIds = new Set(entities.map(e => e.id));
      for (const docEntity of docEntities) {
        if (!existingEntityIds.has(docEntity.id)) {
          entities.push(docEntity);
          entityIds.push(docEntity.id);
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not retrieve entities from documents:', error);
  }
}
```

**Action:**
1. Replace entire block
2. Remove `neo4j-driver` import (no longer needed)
3. Run test: `bun test src/__tests__/akasha.test.ts --grep "Query Strategy"`

---

### Step 4.4: Replace getSession() Usage - Health Check

**File:** `src/akasha.ts` (Line 1277-1289)

**Change:**
```typescript
// BEFORE:
// Check Neo4j
try {
  const session = this.neo4j.getSession();
  try {
    await session.run('RETURN 1');
    health.neo4j.connected = true;
  } finally {
    await session.close();
  }
} catch (error) {
  health.neo4j.connected = false;
  health.neo4j.error = error instanceof Error ? error.message : 'Unknown error';
}

// AFTER:
// Check database
try {
  const connected = await this.databaseProvider.ping();
  health.database.connected = connected;
  if (!connected) {
    health.database.error = 'Ping failed';
  }
} catch (error) {
  health.database.connected = false;
  health.database.error = error instanceof Error ? error.message : 'Unknown error';
}
```

**Also update health status calculation (Line 1301):**
```typescript
// BEFORE:
if (!health.neo4j.connected && !health.openai.available) {
  health.status = 'unhealthy';
} else if (!health.neo4j.connected || !health.openai.available) {
  health.status = 'degraded';
}

// AFTER:
if (!health.database.connected && !health.openai.available) {
  health.status = 'unhealthy';
} else if (!health.database.connected || !health.openai.available) {
  health.status = 'degraded';
}
```

**Action:**
1. Replace health check logic
2. Update status calculation
3. Run test: `bun test src/__tests__/health-check.test.ts`

---

## Phase 5: Update Factory Function

### Step 5.1: Update Factory to Use Database Provider

**File:** `src/factory.ts`

**Change:**
```typescript
// BEFORE:
/**
 * @example
 * ```typescript
 * const kg = akasha({
 *   neo4j: { uri: '...', user: '...', password: '...' },
 *   scope: { id: 'tenant-1', type: 'tenant', name: 'My Tenant' },
 * });
 * ```
 */
export function akasha(config: AkashaConfig): Akasha {
  return new Akasha(config);
}

// AFTER:
/**
 * @example
 * ```typescript
 * const kg = akasha({
 *   database: {
 *     type: 'neo4j',
 *     config: { uri: '...', user: '...', password: '...' }
 *   },
 *   providers: {
 *     embedding: { type: 'openai', config: { apiKey: '...', model: '...' } },
 *     llm: { type: 'openai', config: { apiKey: '...', model: '...' } }
 *   },
 *   scope: { id: 'tenant-1', type: 'tenant', name: 'My Tenant' },
 * });
 * ```
 */
export function akasha(config: AkashaConfig): Akasha {
  return new Akasha(config);
}
```

**Action:**
1. Update JSDoc example
2. Verify: `bun run build`

---

## Phase 6: Update Exports

### Step 6.1: Export New Types

**File:** `src/index.ts`

**Add exports:**
```typescript
// Add to existing exports:
export type {
  DatabaseProvider,
} from './services/providers/database/interfaces';

export type {
  DatabaseType,
  DatabaseConfig,
  Neo4jConfig,
  KuzuConfig,
} from './types';

export { Neo4jProvider } from './services/providers/database/neo4j-provider';
export { createDatabaseProvider } from './services/providers/database/factory';
```

**Action:**
1. Add exports
2. Verify: `bun run build`

---

## Phase 7: Update Test Helpers

### Step 7.1: Create Mock Database Provider Helper

**File:** `src/__tests__/test-helpers.ts`

**Add function:**
```typescript
import type { DatabaseProvider } from '../services/providers/database/interfaces';
import type { Entity, Relationship, Document } from '../types';

/**
 * Create a mock database provider
 */
export function createMockDatabaseProvider(): DatabaseProvider {
  return {
    connect: mock(() => Promise.resolve()),
    disconnect: mock(() => Promise.resolve()),
    ensureVectorIndex: mock(() => Promise.resolve()),
    findEntitiesByVector: mock(() => Promise.resolve([])),
    findDocumentsByVector: mock(() => Promise.resolve([])),
    retrieveSubgraph: mock(() => Promise.resolve({ entities: [], relationships: [] })),
    createEntities: mock(() => Promise.resolve([])),
    findEntityByName: mock(() => Promise.resolve(null)),
    findEntityById: mock(() => Promise.resolve(null)),
    updateEntity: mock(() => Promise.resolve({ id: '1', label: 'Entity', properties: {} })),
    updateEntityContextIds: mock(() => Promise.resolve({ id: '1', label: 'Entity', properties: {} })),
    deleteEntity: mock(() => Promise.resolve({ deleted: true, message: 'Deleted' })),
    listEntities: mock(() => Promise.resolve([])),
    createRelationships: mock(() => Promise.resolve([])),
    findRelationshipById: mock(() => Promise.resolve(null)),
    updateRelationship: mock(() => Promise.resolve({ id: '1', type: 'REL', from: '1', to: '2', properties: {} })),
    deleteRelationship: mock(() => Promise.resolve({ deleted: true, message: 'Deleted' })),
    listRelationships: mock(() => Promise.resolve([])),
    createDocument: mock(() => Promise.resolve({ id: '1', label: 'Document', properties: { text: '', scopeId: '' } })),
    findDocumentByText: mock(() => Promise.resolve(null)),
    findDocumentById: mock(() => Promise.resolve(null)),
    updateDocument: mock(() => Promise.resolve({ id: '1', label: 'Document', properties: { text: '', scopeId: '' } })),
    updateDocumentContextIds: mock(() => Promise.resolve({ id: '1', label: 'Document', properties: { text: '', scopeId: '' } })),
    deleteDocument: mock(() => Promise.resolve({ deleted: true, message: 'Deleted' })),
    listDocuments: mock(() => Promise.resolve([])),
    linkEntityToDocument: mock(() => Promise.resolve({ id: '1', type: 'CONTAINS_ENTITY', from: '1', to: '2', properties: {} })),
    getEntitiesFromDocuments: mock(() => Promise.resolve([])),
    ping: mock(() => Promise.resolve(true)),
  } as any;
}
```

**Action:**
1. Add function to test-helpers.ts
2. Import `mock` from 'bun:test' if not already imported
3. Verify: `bun run build`

---

## Phase 8: Update Tests (One File at a Time)

### Step 8.1: Update akasha.test.ts

**File:** `src/__tests__/akasha.test.ts`

**Changes:**
1. Import: `import { createMockDatabaseProvider } from './test-helpers';`
2. Replace: `const mockNeo4jService = { ... }` → `const mockDatabaseProvider = createMockDatabaseProvider();`
3. Update: `new Akasha(config, mockNeo4jService, ...)` → `new Akasha(config, mockDatabaseProvider, ...)`
4. Update: All `mockNeo4jService.*` → `mockDatabaseProvider.*`
5. Update: All `expect(mockNeo4jService.*)` → `expect(mockDatabaseProvider.*)`

**Action:**
1. Update file incrementally (one describe block at a time)
2. Run tests incrementally: `bun test src/__tests__/akasha.test.ts --grep "Initialization"`
3. Continue with each describe block
4. Finally: `bun test src/__tests__/akasha.test.ts`

---

### Step 8.2-8.11: Update Remaining Test Files

**Follow same pattern for:**
- `query-relevance.test.ts`
- `query-statistics.test.ts`
- `batch-learn.test.ts`
- `graph-queries.test.ts`
- `graph-management.test.ts`
- `progress-callbacks.test.ts`
- `e2e/events-workflow.test.ts`
- `integration/events-integration.test.ts`
- `integration/multi-provider.test.ts`

**Action for each:**
1. Import `createMockDatabaseProvider`
2. Replace mock creation
3. Update constructor calls
4. Update assertions
5. Run test: `bun test src/__tests__/[filename].test.ts`

---

## Phase 9: Update Integration Tests

### Step 9.1: Update Config in Integration Tests

**File:** `src/__tests__/integration/akasha-integration.test.ts`

**Change all config objects:**
```typescript
// BEFORE:
const kg = akasha({
  neo4j: {
    uri: process.env.NEO4J_URI!,
    user: process.env.NEO4J_USER!,
    password: process.env.NEO4J_PASSWORD!,
  },
  providers: { ... },
  scope: testScope,
});

// AFTER:
const kg = akasha({
  database: {
    type: 'neo4j',
    config: {
      uri: process.env.NEO4J_URI!,
      user: process.env.NEO4J_USER!,
      password: process.env.NEO4J_PASSWORD!,
    },
  },
  providers: { ... },
  scope: testScope,
});
```

**Also update health check assertions:**
```typescript
// BEFORE:
expect(health.neo4j.connected).toBe(true);

// AFTER:
expect(health.database.connected).toBe(true);
```

**Action:**
1. Find and replace all config objects
2. Update health check assertions
3. Run incrementally: `bun test src/__tests__/integration/akasha-integration.test.ts --grep "Initialization"`

---

## Phase 10: Move Provider-Specific Tests

### Step 10.1: Create neo4j-provider.test.ts

**File:** `src/__tests__/providers/database/neo4j-provider.test.ts`

**Move tests from:**
- `neo4j-vector-filtering.test.ts` → Move Cypher query tests here
- `neo4j-scope.test.ts` → Move scope filtering tests here

**Update to test Neo4jProvider instead of Neo4jService:**
```typescript
import { Neo4jProvider } from '../../../services/providers/database/neo4j-provider';

describe('Neo4jProvider', () => {
  let provider: Neo4jProvider;
  
  beforeEach(() => {
    provider = new Neo4jProvider({
      uri: 'bolt://localhost:7687',
      user: 'neo4j',
      password: 'password',
    });
  });
  
  // Move tests from neo4j-vector-filtering.test.ts
  // Move tests from neo4j-scope.test.ts
});
```

**Action:**
1. Create new test file
2. Move and adapt tests
3. Delete old test files
4. Run: `bun test src/__tests__/providers/database/neo4j-provider.test.ts`

---

## Verification Checklist

After each phase, verify:

- [ ] TypeScript compiles: `bun run build`
- [ ] No type errors: `bunx tsc --noEmit`
- [ ] Tests pass for modified files
- [ ] No regressions in other tests

## Final Verification

```bash
# All unit tests
bun test src/__tests__ --exclude integration --exclude e2e

# Integration tests
bun test src/__tests__/integration

# Full suite
bun test
```

## Migration Notes

### Backward Compatibility

**Option 1: Support both config formats temporarily**
```typescript
// In factory or Akasha constructor:
if ('neo4j' in config && !('database' in config)) {
  // Migrate old format
  config.database = {
    type: 'neo4j',
    config: config.neo4j,
  };
  delete config.neo4j;
}
```

**Option 2: Breaking change (recommended)**
- Update all examples and documentation
- Version bump (major version)
- Migration guide for users

## Next Steps After Neo4jProvider Works

1. Implement `KuzuProvider` in `kuzu-provider.ts`
2. Create `kuzu-provider.test.ts`
3. Update factory to support Kuzu
4. Create `akasha-integration-kuzu.test.ts`
5. Update documentation

