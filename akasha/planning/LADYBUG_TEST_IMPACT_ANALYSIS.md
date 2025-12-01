# LadybugDB Provider - Test Impact Analysis

## Executive Summary

**Total Test Files:** 28 files  
**Test Cases:** ~450 test cases  
**Impact Level:** Medium - Most tests use mocks, but integration tests need updates

## Test Categories

### Category 1: Database-Agnostic Tests (No Changes Needed)

These tests use `mockDatabaseProvider` and will work with any `DatabaseProvider` implementation, including LadybugDB.

#### Files (9 files, ~258 test cases):
1. **`akasha.test.ts`** (41 test cases)
   - Uses `mockDatabaseProvider`
   - Tests core Akasha functionality
   - ✅ **No changes needed**

2. **`query-relevance.test.ts`** (6 test cases)
   - Uses `mockDatabaseProvider`
   - Tests relevance filtering logic
   - ✅ **No changes needed**

3. **`query-statistics.test.ts`** (7 test cases)
   - Uses `mockDatabaseProvider`
   - Tests query statistics collection
   - ✅ **No changes needed**

4. **`batch-learn.test.ts`** (7 test cases)
   - Uses `mockDatabaseProvider`
   - Tests batch learning functionality
   - ✅ **No changes needed**

5. **`graph-queries.test.ts`** (15 test cases)
   - Uses `mockDatabaseProvider`
   - Tests listEntities, listRelationships, listDocuments
   - ✅ **No changes needed**

6. **`graph-management.test.ts`** (23 test cases)
   - Uses `mockDatabaseProvider`
   - Tests CRUD operations
   - ✅ **No changes needed**

7. **`progress-callbacks.test.ts`** (6 test cases)
   - Uses `mockDatabaseProvider`
   - Tests progress callback functionality
   - ✅ **No changes needed**

8. **`health-check.test.ts`** (5 test cases)
   - Uses `mockDatabaseProvider`
   - Tests health check functionality
   - ✅ **No changes needed**

9. **`config-validation.test.ts`** (13 test cases)
   - Tests config validation
   - ⚠️ **Minor change needed:** Add LadybugDB config validation

### Category 2: Neo4j-Specific Tests (Cannot Be Made Database-Agnostic)

These tests directly test `Neo4jService` and Cypher query structures. They are provider-specific and should remain as-is.

#### Files (2 files, ~17 test cases):

1. **`neo4j-vector-filtering.test.ts`** (17 test cases)
   - **Purpose:** Tests Neo4j-specific vector search query structure
   - **Tests:** WHERE clause insertion, Cypher query patterns
   - **Impact:** ⚠️ **Cannot be made database-agnostic**
   - **Action:** Keep as-is, create equivalent `ladybug-vector-filtering.test.ts` for LadybugDB

2. **`neo4j-scope.test.ts`** (3 test cases)
   - **Purpose:** Tests Neo4jService's `addScopeFilter()` method
   - **Tests:** Query scope filtering logic
   - **Impact:** ⚠️ **Cannot be made database-agnostic**
   - **Action:** Keep as-is, create equivalent `ladybug-scope.test.ts` for LadybugDB

**Strategy:** These tests validate provider-specific behavior. We should:
- Keep existing Neo4j-specific tests
- Create equivalent tests for LadybugDB provider
- Ensure both providers implement the same filtering logic (but may use different Cypher syntax)

### Category 3: Integration Tests (Need Updates)

These tests use real database connections and need to support both Neo4j and LadybugDB.

#### Files (3 files, ~150+ test cases):

1. **`integration/akasha-integration.test.ts`** (~100+ test cases)
   - **Current:** Uses `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
   - **Impact:** 🔴 **High - Needs major updates**
   - **Required Changes:**
     - Add `LADYBUG_DB_PATH` environment variable support
     - Create database-agnostic test helpers
     - Run tests for both Neo4j and LadybugDB (or make it configurable)
     - Update all config objects to support both database types

2. **`integration/multi-provider.test.ts`** (~30+ test cases)
   - **Current:** Uses `hasNeo4j` check
   - **Impact:** 🔴 **High - Needs updates**
   - **Required Changes:**
     - Add `hasLadybug` check
     - Support both database types
     - Test provider combinations with both databases

3. **`integration/events-integration.test.ts`** (~7 test cases)
   - **Current:** Uses `createMockDatabaseProvider()` (already database-agnostic)
   - **Impact:** 🟢 **Low - Already uses mocks**
   - **Action:** ✅ **No changes needed** (uses mocks, not real DB)

### Category 4: Provider-Specific Tests (No Impact)

These tests are for embedding/LLM providers, not database providers.

#### Files (5 files):
- `providers/openai-embedding.provider.test.ts`
- `providers/openai-llm.provider.test.ts`
- `providers/anthropic-llm.provider.test.ts`
- `providers/deepseek-llm.provider.test.ts`
- `providers/provider-factory.test.ts`

**Impact:** ✅ **No changes needed**

### Category 5: Other Tests (No Impact)

These tests don't interact with the database.

#### Files (9 files):
- `events/event-emitter.test.ts`
- `events/event-types.test.ts`
- `prompt-template.test.ts`
- `scrub-embeddings.test.ts`
- `system-metadata.test.ts`
- `scope-context.test.ts`
- `template-backward-compat.test.ts`
- `e2e/events-workflow.test.ts`
- `test-helpers.ts` (already has `createMockDatabaseProvider()`)

**Impact:** ✅ **No changes needed**

## Detailed Impact Analysis

### High Priority: Integration Tests

#### `integration/akasha-integration.test.ts`

**Current Pattern:**
```typescript
const shouldRunIntegrationTests = 
  process.env.NEO4J_URI &&
  process.env.NEO4J_USER &&
  process.env.NEO4J_PASSWORD &&
  process.env.OPENAI_API_KEY;

const kg = akasha({
  database: {
    type: 'neo4j',
    config: {
      uri: process.env.NEO4J_URI!,
      user: process.env.NEO4J_USER!,
      password: process.env.NEO4J_PASSWORD!,
    },
  },
  // ...
});
```

**Required Changes:**
1. Add database type selection:
   ```typescript
   const dbType = process.env.TEST_DB_TYPE || 'neo4j'; // 'neo4j' | 'ladybug'
   const shouldRunIntegrationTests = 
     (dbType === 'neo4j' && process.env.NEO4J_URI && process.env.NEO4J_USER && process.env.NEO4J_PASSWORD) ||
     (dbType === 'ladybug' && process.env.LADYBUG_DB_PATH);
   ```

2. Create database-agnostic config helper:
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

3. Update all test cases to use `createTestConfig()`

**Estimated Effort:** 4-6 hours

#### `integration/multi-provider.test.ts`

**Current Pattern:**
```typescript
const hasNeo4j = process.env.NEO4J_URI && process.env.NEO4J_USER && process.env.NEO4J_PASSWORD;
const canTestOpenAI = hasOpenAI && hasNeo4j;
```

**Required Changes:**
1. Add LadybugDB support:
   ```typescript
   const hasNeo4j = process.env.NEO4J_URI && process.env.NEO4J_USER && process.env.NEO4J_PASSWORD;
   const hasLadybug = process.env.LADYBUG_DB_PATH;
   const hasDatabase = hasNeo4j || hasLadybug;
   const canTestOpenAI = hasOpenAI && hasDatabase;
   ```

2. Update config creation to support both databases

**Estimated Effort:** 2-3 hours

### Medium Priority: Config Validation

#### `config-validation.test.ts`

**Required Changes:**
1. Add test cases for LadybugDB config:
   ```typescript
   it('should validate LadybugDB configuration', () => {
     const config: AkashaConfig = {
       database: {
         type: 'ladybug',
         config: {
           databasePath: './test-db',
         },
       },
       // ...
     };
     const result = Akasha.validateConfig(config);
     expect(result.valid).toBe(true);
   });

   it('should fail validation when ladybug.databasePath is missing', () => {
     const config = {
       database: {
         type: 'ladybug',
         config: {},
       },
       // ...
     } as any;
     const result = Akasha.validateConfig(config);
     expect(result.valid).toBe(false);
   });
   ```

**Estimated Effort:** 1 hour

### New Tests Required

#### 1. `providers/database/ladybug-provider.test.ts` (NEW)

**Purpose:** Unit tests for LadybugProvider implementation

**Test Coverage:**
- Connection/disconnection
- Vector index creation
- Vector search (entities and documents)
- All CRUD operations
- Subgraph retrieval
- Scope filtering
- Context filtering
- Temporal filtering
- Error handling

**Estimated Effort:** 8-12 hours

#### 2. `ladybug-vector-filtering.test.ts` (NEW)

**Purpose:** Test LadybugDB-specific vector search query structure

**Test Coverage:**
- WHERE clause insertion with scopeId
- WHERE clause insertion with contexts
- WHERE clause insertion with validAt
- Combined filters
- Query structure validation

**Estimated Effort:** 3-4 hours

#### 3. `ladybug-scope.test.ts` (NEW)

**Purpose:** Test LadybugDB-specific scope filtering

**Test Coverage:**
- Scope filter application
- Query modification for scope
- Scope in CRUD operations

**Estimated Effort:** 2-3 hours

#### 4. `integration/ladybug-integration.test.ts` (NEW - Optional)

**Purpose:** Full integration tests for LadybugDB

**Alternative:** Update existing integration tests to run for both databases

**Estimated Effort:** 4-6 hours (if creating new file)

## Test Execution Strategy

### Option 1: Parallel Test Suites (Recommended)

Run tests for both databases in parallel:

```bash
# Test Neo4j
TEST_DB_TYPE=neo4j bun test

# Test LadybugDB
TEST_DB_TYPE=ladybug LADYBUG_DB_PATH=./test-db bun test

# Test both (in CI)
bun test --test-db=neo4j && bun test --test-db=ladybug
```

### Option 2: Single Suite with Database Selection

Update integration tests to support both:

```typescript
const testDatabases = ['neo4j'];
if (process.env.LADYBUG_DB_PATH) {
  testDatabases.push('ladybug');
}

testDatabases.forEach(dbType => {
  describe(`Integration Tests - ${dbType}`, () => {
    // Run all tests for this database type
  });
});
```

## Test Helper Updates

### Update `test-helpers.ts`

Add helper for creating test configs with database selection:

```typescript
export function createTestConfig(
  overrides?: Partial<AkashaConfig>,
  dbType: 'neo4j' | 'ladybug' = 'neo4j'
): AkashaConfig {
  const baseConfig: AkashaConfig = {
    database: dbType === 'neo4j' 
      ? {
          type: 'neo4j',
          config: {
            uri: 'bolt://localhost:7687',
            user: 'neo4j',
            password: 'password',
          },
        }
      : {
          type: 'ladybug',
          config: {
            databasePath: './test-ladybug-db',
          },
        },
    providers: {
      embedding: {
        type: 'openai',
        config: {
          apiKey: 'test-key',
          model: 'text-embedding-3-small',
        },
      },
      llm: {
        type: 'openai',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4',
        },
      },
    },
    ...overrides,
  };
  return baseConfig;
}
```

## Summary of Required Changes

### Files Requiring Updates (5 files):

1. **`config-validation.test.ts`**
   - Add LadybugDB config validation tests
   - Effort: 1 hour

2. **`integration/akasha-integration.test.ts`**
   - Add database type selection
   - Create database-agnostic config helper
   - Update all test cases
   - Effort: 4-6 hours

3. **`integration/multi-provider.test.ts`**
   - Add LadybugDB support
   - Update environment variable checks
   - Effort: 2-3 hours

4. **`test-helpers.ts`**
   - Add `createTestConfig()` with database type parameter
   - Effort: 30 minutes

5. **`akasha.ts` (validateConfig method)**
   - Add LadybugDB config validation
   - Effort: 30 minutes

### New Files to Create (3-4 files):

1. **`providers/database/ladybug-provider.test.ts`**
   - Unit tests for LadybugProvider
   - Effort: 8-12 hours

2. **`ladybug-vector-filtering.test.ts`**
   - LadybugDB-specific vector search tests
   - Effort: 3-4 hours

3. **`ladybug-scope.test.ts`**
   - LadybugDB-specific scope filtering tests
   - Effort: 2-3 hours

4. **`integration/ladybug-integration.test.ts`** (Optional)
   - Full integration test suite for LadybugDB
   - Effort: 4-6 hours (if creating separate file)

## Total Estimated Effort

- **Updates to existing tests:** 8-11 hours
- **New test files:** 13-19 hours
- **Total:** 21-30 hours

## Testing Checklist

### Phase 1: Unit Tests
- [ ] Create `ladybug-provider.test.ts`
- [ ] Test all 27 DatabaseProvider methods
- [ ] Test error handling
- [ ] Test edge cases

### Phase 2: Provider-Specific Tests
- [ ] Create `ladybug-vector-filtering.test.ts`
- [ ] Create `ladybug-scope.test.ts`
- [ ] Verify query structure matches requirements

### Phase 3: Integration Tests
- [ ] Update `akasha-integration.test.ts` for database selection
- [ ] Update `multi-provider.test.ts` for database selection
- [ ] Test with real LadybugDB instance
- [ ] Verify all workflows work with LadybugDB

### Phase 4: Config & Validation
- [ ] Update `config-validation.test.ts`
- [ ] Update `validateConfig()` method
- [ ] Test config validation for both databases

### Phase 5: Test Helpers
- [ ] Update `test-helpers.ts`
- [ ] Add database-agnostic helpers
- [ ] Verify all tests can use new helpers

## Risk Assessment

### Low Risk
- Unit tests using mocks (already database-agnostic)
- Provider-specific tests (embedding/LLM)
- Event system tests

### Medium Risk
- Integration tests (need careful database selection)
- Config validation (need to support both)

### High Risk
- Neo4j-specific tests (must remain as-is)
- Vector search query structure (may differ between databases)
- ID system differences (may affect test expectations)

## Recommendations

1. **Start with unit tests:** Create `ladybug-provider.test.ts` first to validate implementation
2. **Update integration tests gradually:** Start with one test file, verify it works, then update others
3. **Keep Neo4j-specific tests:** Don't try to make them database-agnostic
4. **Create equivalent tests:** For each Neo4j-specific test, create a LadybugDB equivalent
5. **Use test helpers:** Centralize database config creation in `test-helpers.ts`
6. **Environment-based selection:** Use environment variables to select database type for integration tests

