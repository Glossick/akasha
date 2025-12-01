# Test Commands Quick Reference

## Running Tests Incrementally

### Phase 1: Foundation Tests
```bash
# HealthStatus interface changes
bun test src/__tests__/health-check.test.ts

# Config validation changes
bun test src/__tests__/config-validation.test.ts
```

### Phase 2: Provider Creation
```bash
# Verify compilation only
bun run build
```

### Phase 3: Akasha Class Refactoring
```bash
# Run by feature area (incremental)
bun test src/__tests__/akasha.test.ts --grep "Initialization"
bun test src/__tests__/akasha.test.ts --grep "Scope Management"
bun test src/__tests__/akasha.test.ts --grep "Query with Scope"
bun test src/__tests__/akasha.test.ts --grep "Extract and Create"
bun test src/__tests__/akasha.test.ts --grep "Context Management"
bun test src/__tests__/akasha.test.ts --grep "Document Nodes"
bun test src/__tests__/akasha.test.ts --grep "Query Strategy"
bun test src/__tests__/akasha.test.ts --grep "System Metadata"
bun test src/__tests__/akasha.test.ts --grep "Temporal Query"

# Related tests
bun test src/__tests__/query-relevance.test.ts
bun test src/__tests__/query-statistics.test.ts
bun test src/__tests__/health-check.test.ts
```

### Phase 4: Factory & Config
```bash
bun test src/__tests__/config-validation.test.ts
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Initialization"
```

### Phase 5: Mock-Based Tests (One at a Time)
```bash
# Update and test each file individually
bun test src/__tests__/akasha.test.ts
bun test src/__tests__/query-relevance.test.ts
bun test src/__tests__/query-statistics.test.ts
bun test src/__tests__/batch-learn.test.ts
bun test src/__tests__/graph-queries.test.ts
bun test src/__tests__/graph-management.test.ts
bun test src/__tests__/progress-callbacks.test.ts
bun test src/__tests__/e2e/events-workflow.test.ts
bun test src/__tests__/integration/events-integration.test.ts
bun test src/__tests__/integration/multi-provider.test.ts
```

### Phase 6: Provider-Specific Tests
```bash
# After moving tests
bun test src/__tests__/providers/database/neo4j-provider.test.ts
```

### Phase 7: Integration Tests
```bash
# Run incrementally by feature
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Initialization"
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Learn"
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Ask"
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Context"
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Temporal"
bun test src/__tests__/integration/akasha-integration.test.ts --grep "Health"
```

### Phase 8: Full Verification
```bash
# All unit tests (exclude integration/e2e)
bun test src/__tests__ --exclude integration --exclude e2e

# Integration tests only
bun test src/__tests__/integration

# E2E tests only
bun test src/__tests__/e2e

# Full suite
bun test
```

## Useful Test Patterns

### Run tests matching a pattern
```bash
bun test --grep "Scope"
bun test --grep "Query"
bun test --grep "Context"
```

### Run specific test file with verbose output
```bash
bun test src/__tests__/akasha.test.ts --verbose
```

### Run tests and stop on first failure
```bash
bun test --bail
```

### Run tests in watch mode (auto-rerun on changes)
```bash
bun test --watch
```

## Verification Commands

### TypeScript Compilation
```bash
bun run build
```

### Type Checking Only
```bash
bunx tsc --noEmit
```

### Check for Type Errors in Specific File
```bash
bunx tsc --noEmit src/akasha.ts
```

## Test File Checklist

### Core Tests (Must Pass)
- [ ] `akasha.test.ts` (1235 lines, 54+ tests)
- [ ] `config-validation.test.ts` (16 tests)
- [ ] `health-check.test.ts` (5+ tests)

### Feature Tests (Must Pass)
- [ ] `query-relevance.test.ts` (11 tests)
- [ ] `query-statistics.test.ts` (7 tests)
- [ ] `batch-learn.test.ts` (7 tests)
- [ ] `graph-queries.test.ts` (19 tests)
- [ ] `graph-management.test.ts` (varies)

### Integration Tests (Must Pass with Real DB)
- [ ] `integration/akasha-integration.test.ts` (50+ tests)
- [ ] `integration/events-integration.test.ts`
- [ ] `integration/multi-provider.test.ts`
- [ ] `e2e/events-workflow.test.ts`

### Provider-Specific Tests (Move, Don't Break)
- [ ] `neo4j-vector-filtering.test.ts` → Move to `providers/database/neo4j-provider.test.ts`
- [ ] `neo4j-scope.test.ts` → Move to `providers/database/neo4j-provider.test.ts`

### Utility Tests
- [ ] `progress-callbacks.test.ts`
- [ ] `test-helpers.ts` (no tests, but used by others)

## Common Issues & Solutions

### Issue: Type errors on mock objects
**Solution:** Ensure mock implements all 27 DatabaseProvider methods

### Issue: Config structure errors
**Solution:** Update to `database: { type: 'neo4j', config: {...} }`

### Issue: Health check failures
**Solution:** Update `health.neo4j` → `health.database` in assertions

### Issue: getSession() not found
**Solution:** Replace with `getEntitiesFromDocuments()` or `ping()`

### Issue: neo4j.int() not found
**Solution:** Remove from akasha.ts, handle ID conversion in provider

