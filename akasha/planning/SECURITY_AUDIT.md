# Security Audit: Cypher Query Injection Vulnerabilities

**Date:** 2024-12-19  
**Scope:** Akasha codebase - Cypher query injection attack vectors  
**Goal:** Identify security vulnerabilities to ensure production-readiness

---

## Executive Summary

This audit identified **multiple critical and high-severity vulnerabilities** related to Cypher query injection in the Akasha codebase. The primary concerns are:

1. **CRITICAL:** LadybugProvider uses string interpolation instead of parameterized queries
2. **HIGH:** Neo4jService interpolates entity labels and relationship types directly into queries
3. **MEDIUM:** Insufficient validation of user-controlled input (contexts, property keys)
4. **MEDIUM:** Numeric values (limit, offset) are interpolated without proper sanitization

---

## Critical Vulnerabilities

### 1. LadybugProvider: Complete Lack of Parameterized Queries

**Severity:** CRITICAL  
**Location:** `akasha/src/services/providers/database/ladybug-provider.ts`  
**Impact:** Full Cypher query injection capability

#### Vulnerability Details

The `LadybugProvider` class constructs all Cypher queries using string interpolation with a custom `escapeCypherValue()` function. This approach is fundamentally insecure because:

1. **Insufficient Escaping:** The `escapeCypherValue()` function (lines 565-585) only escapes single quotes and backslashes:
   ```typescript
   const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
   return `'${escaped}'`;
   ```
   This does NOT protect against:
   - Cypher syntax injection (e.g., `' OR '1'='1`)
   - Function calls (e.g., `' OR 1=1 RETURN *`)
   - Comments (e.g., `' // comment`)
   - Unicode/encoding attacks
   - Property key injection

2. **Direct String Interpolation:** All queries use template literals with direct interpolation:
   ```typescript
   // Example from line 204
   whereConditions.push(`e.scopeId = ${this.escapeCypherValue(scopeId)}`);
   ```

3. **No Parameter Binding:** LadybugDB's `conn.query()` method appears to accept raw strings, and there's no evidence of parameterized query support being used.

#### Affected Methods

All methods in `LadybugProvider` are vulnerable. Key examples:

- `findEntitiesByVector()` - lines 189-265: `scopeId`, `contexts`, `validAt` interpolated
- `findDocumentsByVector()` - lines 267-352: Same as above
- `retrieveSubgraph()` - lines 355-514: `entityLabels`, `relationshipTypes`, `startEntityIds`, `scopeId` interpolated
- `createEntities()` - lines 588-679: Entity properties, labels interpolated
- `findEntityByName()` - lines 681-708: `name`, `scopeId` interpolated
- `updateEntity()` - lines 740-793: Property keys and values interpolated
- `createRelationships()` - lines 959-1030: Relationship types, entity IDs interpolated
- `listEntities()` - lines 892-927: `label`, `scopeId`, `limit`, `offset` interpolated
- All other CRUD operations

#### Attack Scenarios

**Scenario 1: Scope ID Injection**
```typescript
// Attacker controls scopeId
const scopeId = "test' OR '1'='1' RETURN * //";
// Results in query:
// WHERE e.scopeId = 'test' OR '1'='1' RETURN * //'
```

**Scenario 2: Context Injection**
```typescript
// Attacker controls contexts array
const contexts = ["test' OR 1=1 RETURN * //"];
// Results in query:
// WHERE (e.contextIds IS NULL OR "test' OR 1=1 RETURN * //" IN e.contextIds)
```

**Scenario 3: Entity Label Injection**
```typescript
// Attacker controls entityLabels
const entityLabels = ["Entity' WHERE 1=1 RETURN * //"];
// Results in query:
// WHERE start.label = 'Entity' WHERE 1=1 RETURN * //'
```

**Scenario 4: Relationship Type Injection**
```typescript
// Attacker controls relationshipTypes
const relationshipTypes = ["REL' OR 1=1 RETURN * //"];
// Results in query:
// WHERE (r.type = 'REL' OR 1=1 RETURN * //' OR ...)
```

**Scenario 5: Property Key Injection**
```typescript
// Attacker controls property keys
const properties = {
  "name': 'injected', 'malicious': 'value' //": "test"
};
// Results in query:
// SET e.name': 'injected', 'malicious': 'value' // = 'test'
```

#### Recommendation

**IMMEDIATE ACTION REQUIRED:** Refactor `LadybugProvider` to use parameterized queries if LadybugDB supports them. If not, implement a whitelist-based validation system for all user inputs.

---

### 2. Neo4jService: Entity Label and Relationship Type Injection

**Severity:** HIGH  
**Location:** `akasha/src/services/neo4j.service.ts`  
**Impact:** Limited Cypher injection via labels and relationship types

#### Vulnerability Details

While Neo4jService uses parameterized queries for most values, it directly interpolates entity labels and relationship types into query strings:

1. **Entity Label Injection** (lines 430, 442, 1412):
   ```typescript
   query = `
     MERGE (n:${entity.label}:Entity {${uniqueKey}: $uniqueValue})
     ...
   `;
   ```
   Even though labels are validated with regex `/^[A-Z][A-Za-z0-9_]*$/`, this validation can be bypassed if the validation is not consistently applied everywhere.

2. **Relationship Type Injection** (lines 512, 1469):
   ```typescript
   query = `
     MATCH (from), (to)
     WHERE id(from) = $from AND id(to) = $to
     MERGE (from)-[r:${type}]->(to)
     ...
   `;
   ```
   Relationship types are validated with `/^[A-Z][A-Z0-9_]*$/`, but if validation is bypassed or missing in any code path, injection is possible.

#### Attack Scenarios

**Scenario 1: Label Injection via Validation Bypass**
```typescript
// If validation is bypassed or missing
const entityLabel = "Entity} SET n.malicious = 'value' //";
// Results in query:
// MERGE (n:Entity} SET n.malicious = 'value' //:Entity {...})
```

**Scenario 2: Relationship Type Injection**
```typescript
// If validation is bypassed
const relType = "REL} SET r.malicious = 'value' //";
// Results in query:
// MERGE (from)-[r:REL} SET r.malicious = 'value' //]->(to)
```

#### Recommendation

1. Ensure validation is applied consistently at all entry points
2. Consider using a whitelist of allowed labels/types
3. If possible, use parameterized queries for labels/types (if Neo4j supports this)

---

## High-Severity Vulnerabilities

### 3. Context String Injection

**Severity:** HIGH  
**Location:** Multiple locations in both providers  
**Impact:** Query manipulation via context filters

#### Vulnerability Details

Context strings (`contexts` array) are used in queries without sufficient validation:

1. **LadybugProvider** (lines 206-210, 284-288):
   ```typescript
   const contextChecks = contexts.map(ctx => `"${ctx}" IN e.contextIds`).join(' OR ');
   whereConditions.push(`(e.contextIds IS NULL OR ${contextChecks})`);
   ```
   Context strings are directly interpolated with only quote escaping.

2. **Neo4jService** (lines 158, 638):
   ```typescript
   whereConditions.push('(node.contextIds IS NULL OR ANY(ctx IN node.contextIds WHERE ctx IN $contexts))');
   ```
   Neo4jService uses parameterized queries, which is safer, but the contexts array should still be validated.

#### Attack Scenario

```typescript
// Attacker controls contexts
const contexts = ['normal', 'test" OR 1=1 RETURN * //'];
// In LadybugProvider, results in:
// WHERE (e.contextIds IS NULL OR "normal" IN e.contextIds OR "test" OR 1=1 RETURN * //" IN e.contextIds)
```

#### Recommendation

1. Validate context strings with a whitelist or strict regex
2. Limit context string length
3. Sanitize context strings before use

---

### 4. Property Key Injection

**Severity:** HIGH  
**Location:** `ladybug-provider.ts` - property update operations  
**Impact:** Query manipulation via property keys

#### Vulnerability Details

When updating entities/relationships/documents, property keys are directly interpolated into SET clauses:

```typescript
// Line 762
const setClauses = Object.entries(filteredProperties)
  .map(([key, value]) => `e.${key} = ${this.escapeCypherValue(value)}`)
  .join(', ');
```

If an attacker can control property keys, they can inject Cypher syntax.

#### Attack Scenario

```typescript
// Attacker controls property keys
const properties = {
  "name = 'injected' SET e.malicious": "value"
};
// Results in:
// SET e.name = 'injected' SET e.malicious = 'value'
```

#### Recommendation

1. Whitelist allowed property keys
2. Validate property keys against a strict regex (e.g., `^[a-zA-Z_][a-zA-Z0-9_]*$`)
3. Reject any property keys that don't match the schema

---

## Medium-Severity Vulnerabilities

### 5. Numeric Value Injection (Limit/Offset)

**Severity:** MEDIUM  
**Location:** `ladybug-provider.ts` - list operations  
**Impact:** Potential DoS or query manipulation

#### Vulnerability Details

Limit and offset values are directly interpolated without parameterization:

```typescript
// Line 911
query += ` RETURN e ORDER BY e.id SKIP ${offset} LIMIT ${limit}`;
```

While these are typically numbers, if not properly validated, they could be manipulated.

#### Attack Scenario

```typescript
// If offset/limit are not properly validated
const limit = "10 UNION SELECT * FROM sensitive_table //";
// Results in query manipulation
```

#### Recommendation

1. Ensure strict numeric validation (use `Math.floor()`, check for NaN)
2. Set maximum bounds for limit/offset
3. Use parameterized queries if possible

---

### 6. Entity ID and Document ID Injection

**Severity:** MEDIUM  
**Location:** Multiple locations in `ladybug-provider.ts`  
**Impact:** Query manipulation via ID values

#### Vulnerability Details

Entity IDs and document IDs are interpolated using `escapeCypherValue()`, which may not be sufficient if IDs can contain special characters.

#### Recommendation

1. Validate IDs with strict format (e.g., UUID format)
2. Use parameterized queries for IDs
3. Implement ID whitelist if IDs are generated server-side

---

## Low-Severity Issues

### 7. Insufficient Input Validation

**Severity:** LOW  
**Location:** Multiple locations  
**Impact:** Potential edge cases

#### Issues

1. **ValidAt timestamp:** Should validate ISO 8601 format strictly
2. **ScopeId:** Should validate format and length
3. **MaxDepth:** Already validated (1-10), but ensure this is consistent

---

## Positive Security Findings

### What's Working Well

1. **Neo4jService Parameterized Queries:** Most values in Neo4jService use parameterized queries (`$param` syntax), which is the correct approach.

2. **Label/Type Validation:** Both providers validate entity labels and relationship types with regex patterns.

3. **Numeric Validation:** MaxDepth is validated with bounds checking.

4. **Scope Filtering:** Scope-based filtering is implemented, which helps with multi-tenancy security.

---

## Recommendations Summary

### Immediate Actions (Before Production)

1. **CRITICAL:** Refactor `LadybugProvider` to use parameterized queries or implement strict whitelist validation
2. **HIGH:** Add comprehensive input validation for all user-controlled inputs
3. **HIGH:** Implement property key whitelisting
4. **MEDIUM:** Add strict validation for numeric values (limit, offset)
5. **MEDIUM:** Validate all ID formats

### Long-Term Improvements

1. Implement a query builder that enforces parameterization
2. Add security tests for injection attacks
3. Consider using a static analysis tool to detect string interpolation in queries
4. Document security best practices for contributors
5. Implement rate limiting to prevent DoS attacks

### Testing Recommendations

1. Create test cases for each injection vector identified
2. Test with malicious inputs containing:
   - SQL/Cypher keywords
   - Special characters (`'`, `"`, `\`, `//`, `/*`, `*/`)
   - Unicode characters
   - Very long strings
   - Null bytes
3. Test boundary conditions for numeric values
4. Test with unexpected data types

---

## Attack Vector Matrix

| Input Source | LadybugProvider | Neo4jService | Severity |
|-------------|----------------|-------------|----------|
| Entity Labels | ✅ Vulnerable | ⚠️ Partially Vulnerable | HIGH |
| Relationship Types | ✅ Vulnerable | ⚠️ Partially Vulnerable | HIGH |
| ScopeId | ✅ Vulnerable | ✅ Safe (parameterized) | CRITICAL (Ladybug) |
| Contexts | ✅ Vulnerable | ✅ Safe (parameterized) | HIGH (Ladybug) |
| ValidAt | ✅ Vulnerable | ✅ Safe (parameterized) | MEDIUM (Ladybug) |
| Property Keys | ✅ Vulnerable | ✅ Safe (parameterized) | HIGH (Ladybug) |
| Property Values | ✅ Vulnerable | ✅ Safe (parameterized) | CRITICAL (Ladybug) |
| Entity IDs | ✅ Vulnerable | ✅ Safe (parameterized) | MEDIUM (Ladybug) |
| Limit/Offset | ✅ Vulnerable | ✅ Safe (parameterized) | MEDIUM (Ladybug) |

**Legend:**
- ✅ Vulnerable = Direct string interpolation
- ⚠️ Partially Vulnerable = Interpolated but validated
- ✅ Safe = Parameterized queries

---

## Conclusion

The Akasha codebase has **critical security vulnerabilities** that must be addressed before production deployment. The primary concern is the `LadybugProvider` implementation, which uses string interpolation for all queries. The `Neo4jService` is significantly more secure but still has some risks with label/type interpolation.

**Priority Actions:**
1. Fix LadybugProvider query construction (CRITICAL)
2. Strengthen input validation across all providers (HIGH)
3. Implement comprehensive security testing (HIGH)

**Estimated Effort:**
- Critical fixes: 2-3 days
- High-priority fixes: 1-2 days
- Testing and validation: 2-3 days
- **Total: 5-8 days**

---

## References

- [OWASP Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html)
- [Neo4j Security Best Practices](https://neo4j.com/docs/operations-manual/current/security/)
- [Cypher Query Language Reference](https://neo4j.com/docs/cypher-manual/current/)

