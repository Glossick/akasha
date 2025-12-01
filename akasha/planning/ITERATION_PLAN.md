# Database Provider Pattern - Iteration Plan

## Complete Second-Pass Analysis

### Additional Items Found (Not in Original Analysis)

1. **HealthStatus Interface** (`types.ts:328`)
   - Hardcoded `neo4j: { connected, error }` field
   - Must change to `database: { connected, error }`
   - Affects: `health-check.test.ts`, `akasha-integration.test.ts`

2. **neo4j.int() in akasha.ts** (Line 413)
   - Direct import and usage of `neo4j-driver` for ID conversion
   - Must be removed when adding `getEntitiesFromDocuments()` method

3. **getSession() Usage** (2 locations in `akasha.ts`)
   - Line 399: Custom Cypher query for entities from documents
   - Line 1279: Health check with `RETURN 1`
   - Both must be replaced with interface methods

4. **Exports in index.ts**
   - Currently exports `AkashaConfig` which includes `neo4j` field
   - Will need to export new config structure

5. **Factory Function Documentation**
   - Example in `factory.ts` shows `neo4j:` config
   - Must update JSDoc example

6. **EmbeddingProvider Interface Comment**
   - `src/services/providers/interfaces.ts` line 17: "Must match the Neo4j vector index configuration"
   - Should be database-agnostic: "Must match the database vector index configuration"

## Iteration Plan with Specific Test Commands

### Phase 1: Interface & Core Types (Foundation)

**Goal:** Define interface and update types without breaking anything yet.

#### Step 1.1: Create DatabaseProvider Interface
**Files to create:**
- `src/services/providers/database/interfaces.ts` - DatabaseProvider interface

**Test command:** None (no tests yet)

**Verification:**
```bash
# Just verify TypeScript compiles
bun run build
```

#### Step 1.2: Update HealthStatus Interface
**Files to modify:**
- `src/types.ts` - Change `neo4j:` to `database:` in HealthStatus

**Test command:**
```bash
bun test src/__tests__/health-check.test.ts
```

**Expected failures:**
- All assertions checking `health.neo4j.connected` → `health.database.connected`
- Health check method using `getSession()`

**Fix:** Update test assertions, update health check method to use `ping()`

#### Step 1.3: Update AkashaConfig Interface
**Files to modify:**
- `src/types.ts` - Change `neo4j:` to `database: { type, config }`

**Test command:**
```bash
bun test src/__tests__/config-validation.test.ts
```

**Expected failures:**
- All tests checking `config.neo4j.*`
- Validation logic for Neo4j URI format

**Fix:** Update validation to check `config.database.type` and `config.database.config.*`

#### Step 1.4: Update EmbeddingProvider Interface Comment
**Files to modify:**
- `src/services/providers/interfaces.ts` - Update comment to be database-agnostic

**Test command:**
```bash
# Just verify compilation
bun run build
```

---

### Phase 2: Create Neo4jProvider Wrapper

**Goal:** Create provider that wraps Neo4jService, implement interface.

#### Step 2.1: Create Neo4jProvider Class
**Files to create:**
- `src/services/providers/database/neo4j-provider.ts` - Wraps Neo4jService

**Test command:**
```bash
# No tests yet, just verify compilation
bun run build
```

#### Step 2.2: Add getEntitiesFromDocuments() to Neo4jService
**Files to modify:**
- `src/services/neo4j.service.ts` - Add method to extract entities from documents

**Test command:**
```bash
# No direct tests, but will be tested via akasha.test.ts
bun test src/__tests__/akasha.test.ts --grep "Document Nodes"
```

**Expected:** Should pass (method exists, just needs to be called)

#### Step 2.3: Add ping() to Neo4jService
**Files to modify:**
- `src/services/neo4j.service.ts` - Add simple connectivity check

**Test command:**
```bash
bun test src/__tests__/health-check.test.ts
```

**Expected:** Should pass once health check uses `ping()`

---

### Phase 3: Update Akasha Class (Core Refactoring)

**Goal:** Change Akasha to use DatabaseProvider instead of Neo4jService.

#### Step 3.1: Update Akasha Constructor
**Files to modify:**
- `src/akasha.ts` - Change `neo4jService?: Neo4jService` to `databaseProvider?: DatabaseProvider`
- `src/akasha.ts` - Update initialization logic

**Test command:**
```bash
bun test src/__tests__/akasha.test.ts --grep "Initialization"
```

**Expected failures:**
- Type errors on `mockNeo4jService` parameter
- Constructor signature mismatch

**Fix:** Update test mocks to use `DatabaseProvider` interface

#### Step 3.2: Replace getSession() Usage - Entities from Documents
**Files to modify:**
- `src/akasha.ts` (Line 399) - Replace with `getEntitiesFromDocuments()`
- Remove `neo4j-driver` import and `neo4j.int()` usage

**Test command:**
```bash
bun test src/__tests__/akasha.test.ts --grep "Query Strategy"
bun test src/__tests__/query-relevance.test.ts
```

**Expected:** Should pass once method is implemented

#### Step 3.3: Replace getSession() Usage - Health Check
**Files to modify:**
- `src/akasha.ts` (Line 1279) - Replace with `ping()`

**Test command:**
```bash
bun test src/__tests__/health-check.test.ts
```

**Expected:** Should pass once `ping()` is implemented

#### Step 3.4: Update All this.neo4j References
**Files to modify:**
- `src/akasha.ts` - Change `this.neo4j` to `this.databaseProvider` (27 method calls)

**Test command:**
```bash
# Run tests incrementally by feature area
bun test src/__tests__/akasha.test.ts --grep "Scope Management"
bun test src/__tests__/akasha.test.ts --grep "Query with Scope"
bun test src/__tests__/akasha.test.ts --grep "Extract and Create"
bun test src/__tests__/akasha.test.ts --grep "Context Management"
bun test src/__tests__/akasha.test.ts --grep "Document Nodes"
bun test src/__tests__/akasha.test.ts --grep "System Metadata"
bun test src/__tests__/akasha.test.ts --grep "Temporal Query"
```

**Expected failures:**
- All method calls need interface compliance
- Type errors on property access

**Fix:** Ensure all methods match interface signature

---

### Phase 4: Update Factory & Configuration

**Goal:** Update factory to create Neo4jProvider from config.

#### Step 4.1: Create Database Provider Factory
**Files to create:**
- `src/services/providers/database/factory.ts` - Creates provider from config

**Test command:**
```bash
# No direct tests, verify via integration
bun test src/__tests__/config-validation.test.ts
```

#### Step 4.2: Update Factory Function
**Files to modify:**
- `src/factory.ts` - Use database provider factory

**Test command:**
```bash
# Test via integration tests
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Initialization"
```

**Expected:** Should pass once factory creates provider correctly

---

### Phase 5: Update Test Mocks (One File at a Time)

**Goal:** Update each test file to use DatabaseProvider interface.

#### Step 5.1: Update test-helpers.ts
**Files to modify:**
- `src/__tests__/test-helpers.ts` - Add `createMockDatabaseProvider()`

**Test command:**
```bash
# Just verify it compiles
bun run build
```

#### Step 5.2: Update akasha.test.ts (CRITICAL - Largest File)
**Files to modify:**
- `src/__tests__/akasha.test.ts` - Replace all `mockNeo4jService` with `mockDatabaseProvider`

**Test command (run incrementally by describe block):**
```bash
# Run each describe block separately
bun test src/__tests__/akasha.test.ts --grep "Initialization"
bun test src/__tests__/akasha.test.ts --grep "Scope Management"
bun test src/__tests__/akasha.test.ts --grep "Query with Scope Filtering"
bun test src/__tests__/akasha.test.ts --grep "Extract and Create with Scope"
bun test src/__tests__/akasha.test.ts --grep "Multi-Tenant Isolation"
bun test src/__tests__/akasha.test.ts --grep "Context Management"
bun test src/__tests__/akasha.test.ts --grep "Document Nodes"
bun test src/__tests__/akasha.test.ts --grep "Query Strategy"
bun test src/__tests__/akasha.test.ts --grep "System Metadata"
bun test src/__tests__/akasha.test.ts --grep "Temporal Query Filtering"

# Then run full file
bun test src/__tests__/akasha.test.ts
```

**Expected failures:**
- Type errors on mock object
- Method signature mismatches
- Missing methods in mock

**Fix:** Ensure mock implements all 27 interface methods

#### Step 5.3: Update query-relevance.test.ts
**Files to modify:**
- `src/__tests__/query-relevance.test.ts`

**Test command:**
```bash
bun test src/__tests__/query-relevance.test.ts
```

#### Step 5.4: Update query-statistics.test.ts
**Files to modify:**
- `src/__tests__/query-statistics.test.ts`

**Test command:**
```bash
bun test src/__tests__/query-statistics.test.ts
```

#### Step 5.5: Update batch-learn.test.ts
**Files to modify:**
- `src/__tests__/batch-learn.test.ts`

**Test command:**
```bash
bun test src/__tests__/batch-learn.test.ts
```

#### Step 5.6: Update graph-queries.test.ts
**Files to modify:**
- `src/__tests__/graph-queries.test.ts`

**Test command:**
```bash
bun test src/__tests__/graph-queries.test.ts
```

#### Step 5.7: Update graph-management.test.ts
**Files to modify:**
- `src/__tests__/graph-management.test.ts`

**Test command:**
```bash
bun test src/__tests__/graph-management.test.ts
```

#### Step 5.8: Update progress-callbacks.test.ts
**Files to modify:**
- `src/__tests__/progress-callbacks.test.ts`

**Test command:**
```bash
bun test src/__tests__/progress-callbacks.test.ts
```

#### Step 5.9: Update e2e/events-workflow.test.ts
**Files to modify:**
- `src/__tests__/e2e/events-workflow.test.ts`

**Test command:**
```bash
bun test src/__tests__/e2e/events-workflow.test.ts
```

#### Step 5.10: Update integration/events-integration.test.ts
**Files to modify:**
- `src/__tests__/integration/events-integration.test.ts`

**Test command:**
```bash
bun test src/__tests__/integration/events-integration.test.ts
```

#### Step 5.11: Update integration/multi-provider.test.ts
**Files to modify:**
- `src/__tests__/integration/multi-provider.test.ts`

**Test command:**
```bash
bun test src/__tests__/integration/multi-provider.test.ts
```

---

### Phase 6: Provider-Specific Tests (Move & Refactor)

**Goal:** Move Neo4j-specific tests to provider-specific files.

#### Step 6.1: Move neo4j-vector-filtering.test.ts
**Files to modify:**
- Create `src/__tests__/providers/database/neo4j-provider.test.ts`
- Move tests from `neo4j-vector-filtering.test.ts`
- Update to test `Neo4jProvider` instead of `Neo4jService`

**Test command:**
```bash
bun test src/__tests__/providers/database/neo4j-provider.test.ts
```

**Note:** Can delete original file after migration

#### Step 6.2: Move neo4j-scope.test.ts
**Files to modify:**
- Add scope filtering tests to `neo4j-provider.test.ts`
- Update to test `Neo4jProvider`

**Test command:**
```bash
bun test src/__tests__/providers/database/neo4j-provider.test.ts
```

**Note:** Can delete original file after migration

---

### Phase 7: Integration Tests (Config Updates)

**Goal:** Update integration tests to use new config structure.

#### Step 7.1: Update akasha-integration.test.ts
**Files to modify:**
- `src/__tests__/integration/akasha-integration.test.ts` - Update all config objects

**Test command (run incrementally):**
```bash
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Initialization"
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Learn"
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Ask"
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Context"
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Temporal"
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Health"
```

**Expected failures:**
- Config structure errors
- `health.neo4j` → `health.database` assertions

**Fix:** Update config structure, update health check assertions

---

### Phase 8: Final Verification

**Goal:** Ensure all tests pass with Neo4jProvider.

#### Step 8.1: Run All Unit Tests
**Test command:**
```bash
bun test src/__tests__ --exclude integration --exclude e2e
```

**Expected:** All should pass

#### Step 8.2: Run Integration Tests
**Test command:**
```bash
bun test src/__tests__/integration
```

**Expected:** All should pass (with real Neo4j)

#### Step 8.3: Run E2E Tests
**Test command:**
```bash
bun test src/__tests__/e2e
```

**Expected:** All should pass

#### Step 8.4: Full Test Suite
**Test command:**
```bash
bun test
```

**Expected:** All tests pass with Neo4jProvider

---

## Test Command Reference

### Running Specific Test Files
```bash
# Single file
bun test src/__tests__/akasha.test.ts

# Single file with grep filter
bun test src/__tests__/akasha.test.ts --grep "Initialization"

# Multiple files
bun test src/__tests__/akasha.test.ts src/__tests__/query-relevance.test.ts

# Exclude patterns
bun test src/__tests__ --exclude integration --exclude e2e

# Integration tests only
bun test src/__tests__/integration
```

### Verification Commands
```bash
# TypeScript compilation
bun run build

# Linting
bun run lint  # if configured

# Type checking only
bunx tsc --noEmit
```

---

## Critical Path Summary

**Must complete in order:**

1. ✅ Interface definition
2. ✅ HealthStatus update → `health-check.test.ts`
3. ✅ AkashaConfig update → `config-validation.test.ts`
4. ✅ Neo4jProvider creation
5. ✅ Akasha class refactor → `akasha.test.ts` (incrementally)
6. ✅ Factory update → integration tests
7. ✅ All mock-based tests (one at a time)
8. ✅ Provider-specific tests (move)
9. ✅ Integration tests (config update)
10. ✅ Full suite verification

**Estimated time per phase:**
- Phase 1: 2-3 hours
- Phase 2: 2-3 hours
- Phase 3: 4-6 hours (most complex)
- Phase 4: 1-2 hours
- Phase 5: 8-12 hours (many files)
- Phase 6: 2-3 hours
- Phase 7: 3-4 hours
- Phase 8: 1 hour

**Total: 23-34 hours**

---

## Rollback Strategy

If any phase fails critically:

1. **Git commit after each successful phase**
2. **Tag working state:** `git tag database-provider-phase-X`
3. **Revert to last working tag if needed**

**Recommended commit points:**
- After Phase 1 (interface defined)
- After Phase 3 (Akasha refactored)
- After Phase 5 (all mocks updated)
- After Phase 8 (all tests pass)

---

## Next Steps After Neo4jProvider Works

Once all tests pass with Neo4jProvider:

1. Create `KuzuProvider` implementing `DatabaseProvider`
2. Create `kuzu-provider.test.ts` (equivalent to neo4j-provider.test.ts)
3. Create `akasha-integration-kuzu.test.ts` (parameterized or separate)
4. Update config validation to support Kuzu
5. Test with both providers

