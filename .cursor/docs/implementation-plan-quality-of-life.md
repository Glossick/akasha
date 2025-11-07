# Quality-of-Life Improvements - TDD Implementation Plan

## Navigation Analysis

**Primary Semantic Region**: GraphRAG library developer experience enhancements  
**Confidence**: HIGH - Clear patterns established in codebase  
**Strategy**: Direct navigation with TDD approach

## Current Codebase Understanding

### Architecture Patterns
- **Service Layer**: `Neo4jService` handles all database operations, `EmbeddingService` handles LLM operations
- **Public API**: Methods on `Akasha` class are the public interface
- **Error Handling**: Simple `Error` throwing with descriptive messages
- **Scope Filtering**: All queries automatically filter by `scopeId` when provided
- **Session Management**: Each Neo4j operation gets its own session, closes in finally blocks
- **Type Safety**: Strong TypeScript typing throughout

### Test Patterns
- **Unit Tests**: Mock services (`mockNeo4jService`, `mockEmbeddingService`), test in isolation
- **Integration Tests**: Real Neo4j/OpenAI connections, skip if env vars not set
- **Test Structure**: `describe` blocks for feature groups, `beforeEach` for setup
- **Mock State**: Track state in closure variables for update operations

### Current Public Methods
- `initialize()` - Connect to Neo4j
- `cleanup()` - Disconnect from Neo4j
- `getScope()` - Get current scope
- `ask()` - Semantic query
- `learn()` - Extract and create from text
- `learnBatch()` - Batch learning
- `healthCheck()` - Service health status

### Cypher Query Patterns
- Entity queries: `MATCH (e:Entity) WHERE ...`
- Document queries: `MATCH (d:Document) WHERE ...`
- Relationship queries: `MATCH (a)-[r:TYPE]->(b) WHERE ...`
- Scope filtering: `WHERE e.scopeId = $scopeId`
- ID lookups: `WHERE id(e) = $entityId`
- Label filtering: `WHERE e:Label` or `MATCH (e:Label:Entity)`

## Implementation Plan

### Phase 1: Graph Management Operations (Priority 1)

#### 1.1 Delete Operations

**Types to Add** (`akasha/src/types.ts`):
```typescript
export interface DeleteResult {
  deleted: boolean;
  message: string;
  relatedEntitiesDeleted?: number; // For entity deletion (cascade relationships)
  relatedRelationshipsDeleted?: number;
}
```

**Public Methods** (`akasha/src/akasha.ts`):
- `deleteEntity(entityId: string): Promise<DeleteResult>`
- `deleteRelationship(relationshipId: string): Promise<DeleteResult>`
- `deleteDocument(documentId: string): Promise<DeleteResult>`

**Service Methods** (`akasha/src/services/neo4j.service.ts`):
- `deleteEntity(entityId: string, scopeId?: string): Promise<DeleteResult>`
- `deleteRelationship(relationshipId: string, scopeId?: string): Promise<DeleteResult>`
- `deleteDocument(documentId: string, scopeId?: string): Promise<DeleteResult>`

**TDD Approach**:
1. **Unit Tests** (`akasha/src/__tests__/graph-management.test.ts`):
   ```typescript
   describe('Akasha - Graph Management', () => {
     describe('Delete Operations', () => {
       it('should delete entity by ID', async () => {
         // Mock Neo4jService.deleteEntity to return success
         // Call akasha.deleteEntity()
         // Verify service method called with correct params
         // Verify result structure
       });
       
       it('should throw error if entity not found', async () => {
         // Mock service to throw error
         // Verify error propagated
       });
       
       it('should respect scope filtering', async () => {
         // Create entity in scope-1
         // Try to delete from scope-2 instance
         // Verify deletion fails or entity not found
       });
       
       it('should cascade delete relationships when deleting entity', async () => {
         // Mock service to return relationship count
         // Verify relatedRelationshipsDeleted in result
       });
     });
   });
   ```

2. **Integration Tests** (`akasha/src/__tests__/integration/graph-management.test.ts`):
   ```typescript
   describe('Graph Management Integration', () => {
     it.skipIf(!shouldRunIntegrationTests)('should delete entity and verify removal', async () => {
       // Create entity via learn()
       // Verify exists via findEntity()
       // Delete entity
       // Verify findEntity() returns null
     });
     
     it.skipIf(!shouldRunIntegrationTests)('should cascade delete relationships', async () => {
       // Create entity with relationships
       // Delete entity
       // Verify relationships also deleted
     });
   });
   ```

**Cypher Patterns for Delete**:
```cypher
// Delete entity (cascade relationships)
MATCH (e:Entity)
WHERE id(e) = $entityId AND e.scopeId = $scopeId
OPTIONAL MATCH (e)-[r]-()
WITH e, count(r) as relCount
DETACH DELETE e
RETURN relCount

// Delete relationship
MATCH ()-[r:REL_TYPE]-()
WHERE id(r) = $relId AND r.scopeId = $scopeId
DELETE r
RETURN count(r) as deleted

// Delete document
MATCH (d:Document)
WHERE id(d) = $docId AND d.scopeId = $scopeId
OPTIONAL MATCH (d)-[r:CONTAINS_ENTITY]-()
WITH d, count(r) as relCount
DETACH DELETE d
RETURN relCount
```

#### 1.2 Update Operations

**Types to Add**:
```typescript
export interface UpdateEntityOptions {
  properties?: Record<string, unknown>;
  // Note: Can't change label (would require node recreation)
}

export interface UpdateRelationshipOptions {
  properties?: Record<string, unknown>;
  // Note: Can't change type, from, to (would require deletion + recreation)
}

export interface UpdateDocumentOptions {
  properties?: Record<string, unknown>;
  // Note: Can't change text (would break deduplication)
}
```

**Public Methods**:
- `updateEntity(entityId: string, options: UpdateEntityOptions): Promise<Entity>`
- `updateRelationship(relationshipId: string, options: UpdateRelationshipOptions): Promise<Relationship>`
- `updateDocument(documentId: string, options: UpdateDocumentOptions): Promise<Document>`

**Service Methods**:
- `updateEntity(entityId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Entity>`
- `updateRelationship(relationshipId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Relationship>`
- `updateDocument(documentId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Document>`

**Cypher Patterns for Update**:
```cypher
// Update entity (preserve system metadata)
MATCH (e:Entity)
WHERE id(e) = $entityId AND e.scopeId = $scopeId
SET e += $properties
// Don't overwrite system metadata fields
RETURN id(e) as id, labels(e) as labels, properties(e) as properties

// Update relationship
MATCH ()-[r:REL_TYPE]-()
WHERE id(r) = $relId AND r.scopeId = $scopeId
SET r += $properties
RETURN id(r) as id, type(r) as type, ...
```

### Phase 2: Direct Graph Queries (Priority 2)

**Types to Add**:
```typescript
export interface ListEntitiesOptions {
  label?: string; // Filter by entity label
  limit?: number; // Default: 100
  offset?: number; // Default: 0
  includeEmbeddings?: boolean; // Default: false
}

export interface ListRelationshipsOptions {
  type?: string; // Filter by relationship type
  fromId?: string; // Filter by source entity ID
  toId?: string; // Filter by target entity ID
  limit?: number; // Default: 100
  offset?: number; // Default: 0
  includeEmbeddings?: boolean; // Default: false
}

export interface ListDocumentsOptions {
  limit?: number; // Default: 100
  offset?: number; // Default: 0
  includeEmbeddings?: boolean; // Default: false
}
```

**Public Methods**:
- `findEntity(entityId: string): Promise<Entity | null>`
- `listEntities(options?: ListEntitiesOptions): Promise<Entity[]>`
- `findRelationship(relationshipId: string): Promise<Relationship | null>`
- `listRelationships(options?: ListRelationshipsOptions): Promise<Relationship[]>`
- `findDocument(documentId: string): Promise<Document | null>`
- `listDocuments(options?: ListDocumentsOptions): Promise<Document[]>`

**Service Methods**:
- `findEntityById(entityId: string, scopeId?: string): Promise<Entity | null>`
- `listEntities(label?: string, limit?: number, offset?: number, scopeId?: string): Promise<Entity[]>`
- `findRelationshipById(relationshipId: string, scopeId?: string): Promise<Relationship | null>`
- `listRelationships(type?: string, fromId?: string, toId?: string, limit?: number, offset?: number, scopeId?: string): Promise<Relationship[]>`
- `findDocumentById(documentId: string, scopeId?: string): Promise<Document | null>`
- `listDocuments(limit?: number, offset?: number, scopeId?: string): Promise<Document[]>`

**Cypher Patterns for Queries**:
```cypher
// Find entity by ID
MATCH (e:Entity)
WHERE id(e) = $entityId AND e.scopeId = $scopeId
RETURN id(e) as id, labels(e) as labels, properties(e) as properties

// List entities by label
MATCH (e:Label:Entity)
WHERE e.scopeId = $scopeId
RETURN id(e) as id, labels(e) as labels, properties(e) as properties
ORDER BY e.name
SKIP $offset LIMIT $limit

// List relationships
MATCH (a)-[r:REL_TYPE]->(b)
WHERE r.scopeId = $scopeId
  AND ($fromId IS NULL OR id(a) = $fromId)
  AND ($toId IS NULL OR id(b) = $toId)
RETURN id(r) as id, type(r) as type, id(a) as fromId, id(b) as toId, properties(r) as properties
SKIP $offset LIMIT $limit
```

### Phase 3: Progress Callbacks for Batch Operations (Priority 3)

**Types to Add**:
```typescript
export interface BatchProgress {
  current: number; // Current item index (0-based)
  total: number; // Total items
  completed: number; // Successfully completed
  failed: number; // Failed so far
  currentText?: string; // Current item text
  estimatedTimeRemainingMs?: number; // Estimated time remaining
}

export type BatchProgressCallback = (progress: BatchProgress) => void | Promise<void>;
```

**Update Existing Types**:
```typescript
export interface BatchLearnOptions extends Omit<LearnOptions, 'contextId'> {
  contextName?: string;
  onProgress?: BatchProgressCallback; // NEW
  // ... existing fields
}
```

**Implementation Changes** (`akasha/src/akasha.ts`):
- Modify `learnBatch()` to call `onProgress` callback after each item
- Calculate estimated time based on average time per item
- Call callback before processing, after success, and after failure

### Phase 4: Configuration Validation (Priority 4)

**Types to Add**:
```typescript
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
```

**Public Methods**:
- `static validateConfig(config: AkashaConfig): ConfigValidationResult`
- `validateConfig(): ConfigValidationResult` (instance method)

## Implementation Order & TDD Workflow

### Step 1: Graph Management - Delete Operations

**TDD Cycle**:

1. **RED**: Write failing unit tests
   ```typescript
   // akasha/src/__tests__/graph-management.test.ts
   describe('Delete Operations', () => {
     it('should delete entity by ID', async () => {
       const mockNeo4jService = {
         deleteEntity: mock(() => Promise.resolve({
           deleted: true,
           message: 'Entity deleted',
           relatedRelationshipsDeleted: 2,
         })),
       };
       
       const akasha = new Akasha({ /* ... */ }, mockNeo4jService as any, mockEmbeddingService);
       await akasha.initialize();
       
       const result = await akasha.deleteEntity('entity-1');
       
       expect(result.deleted).toBe(true);
       expect(mockNeo4jService.deleteEntity).toHaveBeenCalledWith('entity-1', 'tenant-1');
     });
   });
   ```

2. **GREEN**: Implement minimal code to pass
   - Add `DeleteResult` type
   - Add `deleteEntity` to Neo4jService
   - Add `deleteEntity` to Akasha class
   - Run tests, verify passing

3. **REFACTOR**: Clean up, ensure patterns consistent

4. **INTEGRATION**: Write integration tests
   ```typescript
   it.skipIf(!shouldRunIntegrationTests)('should delete entity', async () => {
     const kg = akasha({ /* ... */ });
     await kg.initialize();
     
     // Create entity
     const learnResult = await kg.learn('Alice works for Acme Corp.');
     const entityId = learnResult.entities[0].id;
     
     // Verify exists
     const found = await kg.findEntity(entityId);
     expect(found).not.toBeNull();
     
     // Delete
     const deleteResult = await kg.deleteEntity(entityId);
     expect(deleteResult.deleted).toBe(true);
     
     // Verify gone
     const foundAfter = await kg.findEntity(entityId);
     expect(foundAfter).toBeNull();
   });
   ```

5. **REPEAT** for `deleteRelationship` and `deleteDocument`

### Step 2: Graph Management - Update Operations

**TDD Cycle** (same pattern):
1. Write failing unit tests
2. Implement service methods
3. Implement public methods
4. Write integration tests
5. Update documentation

### Step 3: Direct Graph Queries

**TDD Cycle** (same pattern):
1. Write failing unit tests for all query methods
2. Implement service methods with Cypher queries
3. Implement public methods
4. Write integration tests
5. Update documentation

### Step 4: Progress Callbacks

**TDD Cycle**:
1. Write failing unit tests for callback invocation
2. Modify `learnBatch()` to call callbacks
3. Add time estimation logic
4. Write integration tests
5. Update documentation

### Step 5: Configuration Validation

**TDD Cycle**:
1. Write failing unit tests for validation logic
2. Implement static validation method
3. Add instance method that uses static
4. Write integration tests
5. Update documentation

## Testing Checklist Per Feature

### Unit Tests Must Cover:
- ✅ Happy path (successful operation)
- ✅ Error cases (not found, invalid input)
- ✅ Scope filtering (can't operate on different scope)
- ✅ Service method called with correct parameters
- ✅ Return value structure matches types
- ✅ Edge cases (empty results, null returns)

### Integration Tests Must Cover:
- ✅ Real database operations
- ✅ Data persistence (create, verify, modify, verify)
- ✅ Scope isolation
- ✅ Cascade operations (if applicable)
- ✅ Error handling with real errors

## Code Patterns to Follow

### Service Method Pattern:
```typescript
async methodName(params: Type, scopeId?: string): Promise<ReturnType> {
  const session = this.getSession();
  try {
    // Build Cypher query with scope filtering
    const query = `MATCH ... WHERE ... AND scopeId = $scopeId ...`;
    
    const result = await session.run(query, {
      ...params,
      ...(scopeId ? { scopeId } : {}),
    });
    
    // Process results
    return processedResult;
  } finally {
    await session.close();
  }
}
```

### Public Method Pattern:
```typescript
async methodName(params: Type): Promise<ReturnType> {
  const scopeId = this.scope?.id;
  
  // Validation if needed
  if (!scopeId && requiresScope) {
    throw new Error('Scope is required...');
  }
  
  // Call service method
  return await this.neo4j.methodName(params, scopeId);
}
```

### Error Handling Pattern:
```typescript
// Service layer: throw descriptive errors
if (!record) {
  throw new Error(`Entity with id ${entityId} not found`);
}

// Public layer: may add context, but generally let service errors propagate
```

## Documentation Updates Required

For each feature:
1. **API Reference** (`akasha/docs/api-reference.md`):
   - Add method signature
   - Add parameter descriptions
   - Add return type description
   - Add example usage
   - Add error cases

2. **Examples** (`akasha/docs/examples.md`):
   - Add practical usage examples
   - Show common patterns
   - Show error handling

3. **Core Concepts** (`akasha/docs/core-concepts.md`):
   - Update if concepts change
   - Add new sections if needed

4. **Index Exports** (`akasha/src/index.ts`):
   - Export new types
   - Ensure all public APIs exported

## Success Criteria

Each feature is complete when:
- ✅ All unit tests passing (100% coverage of new code)
- ✅ All integration tests passing
- ✅ TypeScript types properly defined and exported
- ✅ Documentation updated (API reference + examples)
- ✅ Follows existing code patterns
- ✅ Respects scope filtering
- ✅ Error handling consistent with existing code
- ✅ No linter errors
- ✅ Code review ready

## Risk Mitigation

### Potential Issues:
1. **Cascade Deletion**: Need to decide if deleting entity should delete relationships
   - **Decision**: Yes, use `DETACH DELETE` in Cypher
   - **Documentation**: Clearly document this behavior

2. **System Metadata Protection**: Updates shouldn't overwrite `_recordedAt`, etc.
   - **Solution**: Filter out system metadata fields in update operations
   - **Validation**: Add tests to verify system metadata preserved

3. **Performance**: List operations could be slow on large graphs
   - **Solution**: Always use LIMIT, add pagination support
   - **Documentation**: Warn about performance on large datasets

4. **Scope Isolation**: Must prevent cross-scope operations
   - **Solution**: Always filter by scopeId in Cypher queries
   - **Testing**: Add explicit tests for scope isolation

## Next Steps

1. Review this plan
2. Start with Phase 1, Step 1 (Delete Operations - Entity)
3. Follow TDD cycle strictly
4. Complete each phase before moving to next
5. Update this document as implementation progresses

