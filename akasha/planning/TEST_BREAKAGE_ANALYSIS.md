# Test Breakage Analysis: Database Provider Pattern

## Executive Summary

**Total Test Files Affected:** 17 files  
**Total Test Cases:** ~422 test cases  
**Breaking Changes:** High - requires systematic refactoring

## Detailed Test File Analysis

### Category 1: Direct Mock Dependencies (12 files)

These tests create mock `Neo4jService` objects and pass them to `Akasha` constructor.

#### 1. `akasha.test.ts` (1235 lines, ~54 test cases) ⚠️ **CRITICAL**

**Current Pattern:**
```typescript
const mockNeo4jService = {
  connect: mock(() => Promise.resolve()),
  disconnect: mock(() => Promise.resolve()),
  ensureVectorIndex: mock(() => Promise.resolve()),
  getSession: mock(() => mockSession),
  findEntitiesByVector: mock(() => Promise.resolve([...])),
  findDocumentsByVector: mock(() => Promise.resolve([...])),
  retrieveSubgraph: mock(() => Promise.resolve({...})),
  createEntities: mock((entities) => Promise.resolve([...])),
  createRelationships: mock(() => Promise.resolve([...])),
  findDocumentByText: mock(async (text, scopeId) => {...}),
  createDocument: mock((doc) => Promise.resolve({...})),
  linkEntityToDocument: mock(() => Promise.resolve({...})),
  updateDocumentContextIds: mock((docId, contextId) => {...}),
  updateEntityContextIds: mock((entityId, contextId) => {...}),
  findEntityByName: mock(async (name, scopeId) => {...}),
} as any;

const akasha = new Akasha(config, mockNeo4jService, ...);
```

**What Breaks:**
- Type `as any` loses type safety
- All 27 methods must be mocked
- Constructor signature changes: `neo4jService?: Neo4jService` → `databaseProvider?: DatabaseProvider`

**Required Changes:**
1. Rename `mockNeo4jService` → `mockDatabaseProvider`
2. Update type from `Neo4jService` to `DatabaseProvider`
3. Ensure all method signatures match interface exactly
4. Update all `expect(mockNeo4jService.*)` assertions

**Test Cases Affected:**
- Initialization tests (3)
- Scope management (2)
- Query with scope filtering (3)
- Extract and create with scope (3)
- Multi-tenant isolation (1)
- Context management (8)
- Document nodes (4)
- Query strategy (4)
- System metadata (6)
- Temporal query filtering (3)

#### 2. `query-relevance.test.ts` (362 lines, ~11 test cases)

**Current Pattern:**
```typescript
mockNeo4jService.findDocumentsByVector = mock(() => Promise.resolve([...]));
mockNeo4jService.findEntitiesByVector = mock(() => Promise.resolve([...]));
```

**What Breaks:**
- Direct method assignment on mock
- Type checking on mock calls

**Required Changes:**
- Update to use `DatabaseProvider` interface
- Update mock creation pattern

#### 3. `query-statistics.test.ts` (244 lines, ~7 test cases)

**Current Pattern:**
```typescript
mockNeo4jService.findEntitiesByVector.mockClear();
mockNeo4jService.findDocumentsByVector.mockClear();
mockNeo4jService.retrieveSubgraph.mockClear();
```

**What Breaks:**
- Mock method access patterns
- Type inference on mock methods

**Required Changes:**
- Update mock type to `DatabaseProvider`
- Ensure mock framework supports interface mocking

#### 4. `batch-learn.test.ts` (302 lines, ~7 test cases)

**Current Pattern:**
```typescript
mockNeo4jService.findDocumentByText.mockResolvedValueOnce(null);
mockNeo4jService.createDocument.mockResolvedValueOnce({...});
mockNeo4jService.findEntityByName.mockResolvedValueOnce(null);
```

**What Breaks:**
- Mock method chaining (`.mockResolvedValueOnce`)
- State tracking in mocks

**Required Changes:**
- Update to `DatabaseProvider` interface
- Ensure mock framework supports interface methods

#### 5. `graph-queries.test.ts` (447 lines, ~19 test cases)

**Current Pattern:**
```typescript
mockNeo4jService.listEntities = mock(() => Promise.resolve([...]));
mockNeo4jService.listRelationships = mock(() => Promise.resolve([...]));
mockNeo4jService.listDocuments = mock(() => Promise.resolve([...]));
```

**What Breaks:**
- Direct method assignment
- Return type expectations

**Required Changes:**
- Update to `DatabaseProvider` interface
- Verify return types match interface

#### 6. `graph-management.test.ts`

**Current Pattern:**
- Mocks CRUD operations (findById, update, delete)

**What Breaks:**
- All CRUD method mocks

**Required Changes:**
- Update to `DatabaseProvider` interface

#### 7. `test-helpers.ts` (112 lines)

**Current Pattern:**
- Helper functions don't create Neo4j mocks, but tests use them

**What Breaks:**
- No direct breaks, but should add `createMockDatabaseProvider()` helper

**Required Changes:**
- Add `createMockDatabaseProvider(): DatabaseProvider` helper
- Update existing helpers if needed

#### 8-12. Other test files with similar patterns:
- `e2e/events-workflow.test.ts`
- `integration/events-integration.test.ts`
- `progress-callbacks.test.ts`
- `health-check.test.ts`

**Pattern:** All use `mockNeo4jService` directly

---

### Category 2: Neo4j-Specific Implementation Tests (2 files)

These tests validate Neo4j-specific behavior (Cypher queries, Neo4j driver).

#### 13. `neo4j-vector-filtering.test.ts` (280 lines, ~16 test cases) ⚠️ **CANNOT BE MIGRATED**

**Current Pattern:**
```typescript
neo4jService = new Neo4jService({...});
(neo4jService as any).driver = mockDriver;

await neo4jService.findDocumentsByVector(...);

expect(capturedQuery).toMatch(/scopeId = \$scopeId/);
expect(capturedQuery).toContain('WHERE');
expect(capturedQuery).toMatch(/CALL db.index.vector.queryNodes/);
```

**What Breaks:**
- **Tests Cypher query strings directly** - Kuzu uses different syntax
- **Tests Neo4j vector index API** - `CALL db.index.vector.queryNodes` is Neo4j-specific
- **Tests WHERE clause insertion** - Cypher-specific syntax
- **Injects mock driver** - Neo4j driver is database-specific

**Required Changes:**
- **MUST MOVE** to `neo4j-provider.test.ts` (provider-specific tests)
- Cannot be made database-agnostic
- Create equivalent `kuzu-provider.test.ts` for Kuzu-specific tests

**Test Cases:**
- WHERE clause insertion (6)
- Query structure validation (2)
- Parameter binding (4)
- Vector index usage (4)

#### 14. `neo4j-scope.test.ts` (77 lines, ~4 test cases) ⚠️ **CANNOT BE MIGRATED**

**Current Pattern:**
```typescript
const service = new Neo4jService({...});
const scopedQuery = service['addScopeFilter'](query, 'tenant-1');
expect(scopedQuery).toContain('e.scopeId = $scopeId');
```

**What Breaks:**
- **Tests `addScopeFilter()` method** - Internal Cypher query manipulation
- **Tests Cypher syntax** - `WHERE e.scopeId = $scopeId` is Cypher-specific
- **Accesses private method** - `service['addScopeFilter']`

**Required Changes:**
- **MUST MOVE** to `neo4j-provider.test.ts`
- Cannot test this for Kuzu (different query language)
- Scope filtering should be tested at interface level (behavior, not implementation)

---

### Category 3: Configuration Validation (1 file)

#### 15. `config-validation.test.ts` (356 lines, ~16 test cases)

**Current Pattern:**
```typescript
it('should fail validation when neo4j.uri is missing', () => {
  const config = { neo4j: { user: '...', password: '...' } };
  const result = Akasha.validateConfig(config);
  expect(result.errors.some(e => e.field.includes('neo4j.uri'))).toBe(true);
});

it('should validate Neo4j URI format', () => {
  const config = { neo4j: { uri: 'invalid://...' } };
  const result = Akasha.validateConfig(config);
  expect(result.warnings?.some(w => w.field === 'neo4j.uri')).toBe(true);
});
```

**What Breaks:**
- **Hardcoded `config.neo4j` validation**
- **Neo4j URI format checks** (`bolt://`, `neo4j://`)
- **Neo4j user/password requirements**

**Required Changes:**
```typescript
// New config structure needed:
interface AkashaConfig {
  database: {
    type: 'neo4j' | 'kuzu';
    config: Neo4jConfig | KuzuConfig;
  };
  // ...
}

// Validation logic:
if (config.database.type === 'neo4j') {
  // Validate Neo4j-specific fields
  if (!config.database.config.uri.startsWith('bolt://') && 
      !config.database.config.uri.startsWith('neo4j://')) {
    warnings.push({...});
  }
} else if (config.database.type === 'kuzu') {
  // Validate Kuzu-specific fields
  // Kuzu uses file path, not URI
}
```

**Test Cases Affected:**
- Neo4j URI validation (3)
- Neo4j user/password validation (2)
- Missing Neo4j config (2)
- All validation tests need database type awareness

---

### Category 4: Integration Tests (4 files)

These tests use real database connections.

#### 16. `integration/akasha-integration.test.ts` (2808 lines, ~50+ test cases) ⚠️ **CRITICAL**

**Current Pattern:**
```typescript
const kg = akasha({
  neo4j: {
    uri: process.env.NEO4J_URI!,
    user: process.env.NEO4J_USER!,
    password: process.env.NEO4J_PASSWORD!,
  },
  providers: {...},
  scope: testScope,
});
```

**What Breaks:**
- **Config structure** - `neo4j:` → `database: { type: 'neo4j', config: {...} }`
- **Real Neo4j connection** - Tests actual Cypher queries
- **Vector index creation** - Neo4j-specific `CALL db.index.vector.createNodeIndex`

**Required Changes:**
1. Update config structure in all test cases
2. Create separate test suites:
   - `akasha-integration-neo4j.test.ts`
   - `akasha-integration-kuzu.test.ts`
3. Or parameterize tests to run with both providers

**Test Cases:**
- Initialization (2)
- Learn/extract (10+)
- Query operations (10+)
- Context filtering (5+)
- Temporal queries (5+)
- Document operations (5+)
- Entity/relationship operations (10+)

#### 17. `integration/events-integration.test.ts`

**Current Pattern:**
- Similar to above, uses real Neo4j

**What Breaks:**
- Config structure
- Real database connections

**Required Changes:**
- Same as above

#### 18. `integration/multi-provider.test.ts`

**Current Pattern:**
- Tests multiple LLM/embedding providers with Neo4j

**What Breaks:**
- Config structure
- Assumes Neo4j as database

**Required Changes:**
- Add database provider to test matrix

#### 19. `e2e/events-workflow.test.ts`

**Current Pattern:**
- End-to-end tests with real Neo4j

**What Breaks:**
- Config structure
- Real database

**Required Changes:**
- Update config, consider provider parameterization

---

## Summary of Breaking Patterns

### Pattern 1: Direct Type Usage
```typescript
// BREAKS:
const mockNeo4jService: Neo4jService = {...};
new Akasha(config, mockNeo4jService, ...);

// FIX:
const mockDatabaseProvider: DatabaseProvider = {...};
new Akasha(config, mockDatabaseProvider, ...);
```

**Affected:** 12 test files

### Pattern 2: Config Structure
```typescript
// BREAKS:
const config = { neo4j: { uri: '...', user: '...', password: '...' } };

// FIX:
const config = { 
  database: { 
    type: 'neo4j', 
    config: { uri: '...', user: '...', password: '...' } 
  } 
};
```

**Affected:** 5 test files (integration + config validation)

### Pattern 3: Neo4j-Specific Implementation
```typescript
// BREAKS (cannot be fixed, must move):
expect(capturedQuery).toMatch(/CALL db.index.vector.queryNodes/);
service['addScopeFilter'](query, scopeId);

// FIX: Move to provider-specific test files
```

**Affected:** 2 test files (must be moved/refactored)

### Pattern 4: Mock Method Access
```typescript
// BREAKS:
mockNeo4jService.findEntitiesByVector.mockClear();
mockNeo4jService.findDocumentsByVector.mock.calls[0];

// FIX: Ensure mock framework supports interface methods
```

**Affected:** All mock-based tests

---

## Test-Driven Development Plan

### Phase 1: Interface Definition (No Implementation)
1. ✅ Create `DatabaseProvider` interface
2. ✅ Create `Neo4jProvider` class (wraps `Neo4jService`, implements interface)
3. ✅ Update `Akasha` to accept `DatabaseProvider` instead of `Neo4jService`
4. ✅ Update factory to create `Neo4jProvider` from config
5. ❌ **Run tests** - This will show ALL failures
6. ✅ Document failures

### Phase 2: Fix Mock-Based Tests (12 files)
1. Update `test-helpers.ts` - Add `createMockDatabaseProvider()`
2. Update `akasha.test.ts` - Change all mocks to use interface
3. Update remaining 11 test files with mocks
4. ✅ **Run tests** - Should pass for Neo4jProvider

### Phase 3: Fix Config Tests (1 file)
1. Update `config-validation.test.ts` - Support new config structure
2. Add validation for `database.type` and database-specific configs
3. ✅ **Run tests** - Should pass

### Phase 4: Refactor Provider-Specific Tests (2 files)
1. Move `neo4j-vector-filtering.test.ts` → `neo4j-provider.test.ts`
2. Move `neo4j-scope.test.ts` → `neo4j-provider.test.ts`
3. Update to test `Neo4jProvider` instead of `Neo4jService`
4. ✅ **Run tests** - Should pass

### Phase 5: Fix Integration Tests (4 files)
1. Update config structure in all integration tests
2. Create separate test suites or parameterize
3. ✅ **Run tests** - Should pass with Neo4jProvider

### Phase 6: Implement KuzuProvider
1. Create `KuzuProvider` implementing `DatabaseProvider`
2. Create `kuzu-provider.test.ts` (equivalent to `neo4j-provider.test.ts`)
3. Create `akasha-integration-kuzu.test.ts`
4. ✅ **Run tests** - Should pass with both providers

---

## Critical Decisions Needed

### 1. Config Structure
**Option A:** Nested structure
```typescript
database: {
  type: 'neo4j' | 'kuzu';
  config: Neo4jConfig | KuzuConfig;
}
```

**Option B:** Flat structure with optional fields
```typescript
neo4j?: Neo4jConfig;
kuzu?: KuzuConfig;
// Validate exactly one is provided
```

**Option C:** Direct injection
```typescript
database?: DatabaseProvider; // For testing
databaseConfig?: { type: 'neo4j' | 'kuzu'; config: ... }; // For factory
```

**Recommendation:** Option A - Cleaner, more extensible

### 2. `getSession()` Method
**Problem:** Returns Neo4j-specific `Session` type

**Options:**
1. Remove - Add `getEntitiesFromDocuments()` method to interface
2. Abstract - Create `DatabaseSession` interface (complex)
3. Keep - Make return type `unknown` (loses type safety)

**Recommendation:** Option 1 - Add explicit method to interface

### 3. Provider-Specific Tests
**Problem:** Some tests validate Neo4j-specific behavior

**Options:**
1. Move to provider-specific test files
2. Delete (test at interface level only)
3. Keep but mark as Neo4j-only

**Recommendation:** Option 1 - Keep provider-specific tests separate

### 4. Integration Test Strategy
**Problem:** Integration tests use real databases

**Options:**
1. Separate test files per provider
2. Parameterize tests to run with both
3. Test suite selection via environment variable

**Recommendation:** Option 2 - Parameterize, but allow filtering

---

## Estimated Effort

### Phase 1 (Interface): 2-4 hours
- Define interface
- Create Neo4jProvider wrapper
- Update Akasha class

### Phase 2 (Mock Tests): 8-12 hours
- 12 test files × 1-2 hours each
- Most time-consuming due to volume

### Phase 3 (Config Tests): 2-3 hours
- Update validation logic
- Add database type awareness

### Phase 4 (Provider Tests): 2-3 hours
- Move and refactor tests
- Update to test provider instead of service

### Phase 5 (Integration Tests): 4-6 hours
- Update config in all tests
- Parameterize or separate

### Phase 6 (KuzuProvider): 8-16 hours
- Implement interface
- Create tests
- Integration testing

**Total Estimated Effort:** 26-44 hours

---

## Risk Assessment

### High Risk
- **Mock framework compatibility** - Ensure Bun mocks work with interfaces
- **Type safety** - Losing `as any` casts may reveal type issues
- **Integration test complexity** - Real database tests are harder to parameterize

### Medium Risk
- **Config migration** - Breaking change for users
- **Performance** - Provider abstraction layer may add overhead

### Low Risk
- **Interface design** - Can iterate based on test failures
- **Neo4jProvider wrapper** - Should be straightforward pass-through

---

## Next Steps

1. **Create interface** - Define `DatabaseProvider` with all 27 methods
2. **Create Neo4jProvider** - Wrap `Neo4jService`, implement interface
3. **Update Akasha** - Change constructor to accept `DatabaseProvider`
4. **Update ONE test file** - `akasha.test.ts` to use interface
5. **Run tests** - Document all failures
6. **Iterate** - Fix failures, refine interface as needed
7. **Repeat** - One test file at a time until all pass

