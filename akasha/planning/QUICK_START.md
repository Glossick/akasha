# Quick Start: Database Provider Implementation

## Prerequisites

- All tests currently passing
- Git branch created: `git checkout -b feature/database-provider-pattern`
- Backup/commit current state: `git commit -am "Before database provider refactor"`

## Implementation Order (Critical Path)

### 1. Foundation (2-3 hours)
```bash
# Step 1: Create interface
mkdir -p src/services/providers/database
# Create interfaces.ts (copy from IMPLEMENTATION_PLAN.md)

# Step 2: Update types
# Edit src/types.ts - Update HealthStatus and AkashaConfig
bun test src/__tests__/health-check.test.ts
bun test src/__tests__/config-validation.test.ts

# Step 3: Add methods to Neo4jService
# Edit src/services/neo4j.service.ts - Add getEntitiesFromDocuments() and ping()
bun run build
```

### 2. Create Provider (1-2 hours)
```bash
# Step 1: Create Neo4jProvider
# Create src/services/providers/database/neo4j-provider.ts
# (Copy from IMPLEMENTATION_PLAN.md)

# Step 2: Create factory
# Create src/services/providers/database/factory.ts
bun run build
```

### 3. Update Akasha (4-6 hours)
```bash
# Step 1: Update constructor and imports
# Edit src/akasha.ts
bun test src/__tests__/akasha.test.ts --grep "Initialization"

# Step 2: Replace getSession() usages
# Edit src/akasha.ts (2 locations)
bun test src/__tests__/akasha.test.ts --grep "Query Strategy"
bun test src/__tests__/health-check.test.ts

# Step 3: Replace all this.neo4j references
# Find/replace: this.neo4j → this.databaseProvider
# Run tests incrementally:
bun test src/__tests__/akasha.test.ts --grep "Scope"
bun test src/__tests__/akasha.test.ts --grep "Query"
bun test src/__tests__/akasha.test.ts --grep "Context"
# ... continue for each feature area
```

### 4. Update Tests (8-12 hours)
```bash
# Step 1: Create mock helper
# Edit src/__tests__/test-helpers.ts - Add createMockDatabaseProvider()

# Step 2: Update akasha.test.ts (largest file)
# Edit src/__tests__/akasha.test.ts
bun test src/__tests__/akasha.test.ts --grep "Initialization"
# Continue incrementally for each describe block

# Step 3: Update remaining test files (one at a time)
bun test src/__tests__/query-relevance.test.ts
bun test src/__tests__/query-statistics.test.ts
bun test src/__tests__/batch-learn.test.ts
# ... etc
```

### 5. Integration & Verification (3-4 hours)
```bash
# Step 1: Update integration tests
# Edit src/__tests__/integration/akasha-integration.test.ts
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Initialization"

# Step 2: Move provider-specific tests
# Create src/__tests__/providers/database/neo4j-provider.test.ts
# Move tests from neo4j-vector-filtering.test.ts and neo4j-scope.test.ts
bun test src/__tests__/providers/database/neo4j-provider.test.ts

# Step 3: Full verification
bun test src/__tests__ --exclude integration --exclude e2e
bun test src/__tests__/integration
bun test
```

## Key Files to Modify

### Create New Files:
1. `src/services/providers/database/interfaces.ts`
2. `src/services/providers/database/neo4j-provider.ts`
3. `src/services/providers/database/factory.ts`
4. `src/__tests__/providers/database/neo4j-provider.test.ts`

### Modify Existing Files:
1. `src/types.ts` - HealthStatus, AkashaConfig
2. `src/akasha.ts` - Constructor, all this.neo4j references
3. `src/services/neo4j.service.ts` - Add 2 methods
4. `src/factory.ts` - Update JSDoc
5. `src/index.ts` - Export new types
6. `src/__tests__/test-helpers.ts` - Add mock helper
7. All test files (17 files) - Update mocks

### Delete After Migration:
1. `src/__tests__/neo4j-vector-filtering.test.ts` (move to neo4j-provider.test.ts)
2. `src/__tests__/neo4j-scope.test.ts` (move to neo4j-provider.test.ts)

## Critical Code Changes

### 1. Config Structure Change
```typescript
// OLD:
{ neo4j: { uri, user, password } }

// NEW:
{ database: { type: 'neo4j', config: { uri, user, password } } }
```

### 2. Constructor Change
```typescript
// OLD:
constructor(config, neo4jService?: Neo4jService, ...)

// NEW:
constructor(config, databaseProvider?: DatabaseProvider, ...)
```

### 3. Property Change
```typescript
// OLD:
private neo4j: Neo4jService;
this.neo4j.findEntitiesByVector(...)

// NEW:
private databaseProvider: DatabaseProvider;
this.databaseProvider.findEntitiesByVector(...)
```

### 4. Health Check Change
```typescript
// OLD:
health.neo4j.connected = true;

// NEW:
health.database.connected = true;
```

## Testing Strategy

**Never run full test suite until end:**
- Run specific test files
- Use `--grep` to test one feature at a time
- Verify after each change
- Commit after each passing phase

## Common Pitfalls

1. **Forgetting to update all 27 method calls** - Use find/replace
2. **Missing mock methods** - Ensure all 27 methods in mock
3. **Config structure** - Update all test configs
4. **Health check assertions** - Update all `health.neo4j` → `health.database`
5. **Type errors** - Run `bun run build` frequently

## Success Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] TypeScript compiles without errors
- [ ] No `neo4j-driver` import in `akasha.ts`
- [ ] No `getSession()` calls in `akasha.ts`
- [ ] All tests use `DatabaseProvider` interface
- [ ] Provider-specific tests moved to correct location

## Rollback Plan

If critical issues arise:
```bash
git tag database-provider-phase-X  # After each successful phase
git reset --hard database-provider-phase-X  # If needed
```

## Next: KuzuProvider

Once Neo4jProvider works:
1. Create `KuzuProvider` implementing `DatabaseProvider`
2. Update factory to support `type: 'kuzu'`
3. Create `kuzu-provider.test.ts`
4. Create `akasha-integration-kuzu.test.ts`

