# Neo4j Sharding Strategy for Akasha Multi-Tenancy

## Current Architecture

### Scope-Based Isolation (Current)
- **Single Database**: All scopes share one Neo4j database
- **Property-Based Filtering**: All queries filter by `scopeId` property
- **Isolation**: Logical isolation via WHERE clauses
- **Limitations**: 
  - All data in one database (scaling bottleneck)
  - Indexes contain data from all scopes
  - Vector searches scan all scopes (filtered after)
  - No physical isolation

### Current Query Pattern
```cypher
MATCH (e:Entity)
WHERE e.scopeId = $scopeId AND e.embedding <-> $queryEmbedding < $threshold
RETURN e
```

## Sharding Strategies

### Strategy 1: Neo4j Fabric - Scope-to-Database Mapping

**Concept**: Map each scope (or scope group) to a separate Neo4j database.

#### Architecture
```
Fabric Instance (Coordinator)
├── Database: tenant-1 (Neo4j Instance 1)
├── Database: tenant-2 (Neo4j Instance 1)
├── Database: tenant-3 (Neo4j Instance 2)
└── Database: tenant-4 (Neo4j Instance 2)
```

#### Implementation Approach

**1. Scope-to-Database Mapping**
```typescript
interface ShardingConfig {
  strategy: 'fabric' | 'composite' | 'property' | 'none';
  mapping: {
    type: 'hash' | 'range' | 'explicit';
    // Hash: scopeId -> hash -> database
    // Range: scopeId ranges -> database
    // Explicit: scopeId -> database mapping
  };
  fabric?: {
    coordinatorUri: string;
    databases: Array<{
      name: string; // e.g., 'tenant-1', 'tenant-group-a'
      uri: string;
      user: string;
      password: string;
    }>;
  };
}
```

**2. Neo4jService Changes**
```typescript
class Neo4jService {
  private fabricDriver?: Driver; // Fabric coordinator
  private databaseMapping: Map<string, string>; // scopeId -> database name
  
  getSession(scopeId?: string): Session {
    if (this.fabricDriver && scopeId) {
      const database = this.databaseMapping.get(scopeId) || this.getDefaultDatabase(scopeId);
      return this.fabricDriver.session({ 
        database,
        defaultAccessMode: neo4j.session.READ,
      });
    }
    // Fallback to single database
    return this.driver.session({ database: this.config.database || 'neo4j' });
  }
  
  private getDefaultDatabase(scopeId: string): string {
    // Hash-based: consistent hashing
    // Range-based: range lookup
    // Explicit: direct mapping
    return `tenant-${hash(scopeId) % this.fabricConfig.databases.length}`;
  }
}
```

**3. Query Changes**
- Remove `scopeId` WHERE clauses (database isolation replaces it)
- Use Fabric's `USE` clause or session database selection
- Cross-shard queries require Fabric's distributed query syntax

**4. Vector Index Management**
- Each database has its own vector indexes
- Index creation must happen per database
- Vector searches are scoped to the database automatically

#### Benefits
- **Physical Isolation**: Each scope's data in separate database
- **Independent Scaling**: Scale databases independently
- **Better Performance**: Smaller indexes per database
- **Security**: Database-level access control possible

#### Challenges
- **Cross-Shard Queries**: Cannot traverse relationships across shards
- **Fabric Complexity**: Requires Fabric setup and coordination
- **Migration**: Existing data needs to be redistributed
- **Connection Management**: Multiple database connections to manage

#### Use Cases
- Large-scale SaaS with thousands of tenants
- Regulatory requirements for data isolation
- Performance-critical multi-tenant applications

---

### Strategy 2: Composite Databases - Scope Groups

**Concept**: Group scopes into shards, each shard is a separate database.

#### Architecture
```
Composite Database Query
├── Shard 1: tenant-1, tenant-2, tenant-3 (Database A)
├── Shard 2: tenant-4, tenant-5, tenant-6 (Database B)
└── Shard 3: tenant-7, tenant-8, tenant-9 (Database C)
```

#### Implementation Approach

**1. Scope Grouping**
```typescript
interface ScopeShard {
  shardId: string;
  scopeIds: string[]; // Scopes in this shard
  database: {
    name: string;
    uri: string;
    user: string;
    password: string;
  };
}

class ShardManager {
  private shards: Map<string, ScopeShard>; // scopeId -> shard
  private shardDatabases: Map<string, Driver>; // shardId -> driver
  
  getShardForScope(scopeId: string): ScopeShard {
    // Consistent hashing or explicit mapping
    return this.shards.get(this.getShardId(scopeId));
  }
  
  private getShardId(scopeId: string): string {
    // Hash-based: consistent hashing
    const hash = consistentHash(scopeId);
    return `shard-${hash % this.totalShards}`;
  }
}
```

**2. Query Strategy**
- Single-scope queries: Query specific shard database
- Multi-scope queries: Query multiple shards, merge results
- Composite queries: Use Neo4j's composite database feature

**3. Data Distribution**
```typescript
// On learn()
async learn(text: string, options?: LearnOptions) {
  const scopeId = this.scope?.id;
  if (!scopeId) throw new Error('Scope required');
  
  const shard = shardManager.getShardForScope(scopeId);
  const shardService = new Neo4jService(shard.database);
  
  // Use shard-specific service
  await shardService.createEntities(...);
}
```

#### Benefits
- **Horizontal Scaling**: Add shards as needed
- **Load Distribution**: Spread load across shards
- **Flexible Grouping**: Group scopes by size, region, etc.

#### Challenges
- **Cross-Shard Relationships**: Still cannot traverse across shards
- **Shard Management**: Need to track which scope is in which shard
- **Rebalancing**: Moving scopes between shards requires data migration

---

### Strategy 3: Property Sharding (v2025.10+)

**Concept**: Separate graph structure from properties. Graph in one shard, properties in multiple shards.

#### Architecture
```
Graph Shard (Structure)
├── Nodes: (id, labels, relationships)
└── Relationships: (id, type, from, to)

Property Shards (Data)
├── Shard 1: Properties for nodes 1-1000
├── Shard 2: Properties for nodes 1001-2000
└── Shard 3: Properties for nodes 2001-3000
```

#### Implementation Approach

**1. Scope-Based Property Distribution**
```typescript
// Properties distributed by scope
const propertyShard = getPropertyShardForScope(scopeId);

// Graph structure in single shard (or scope-grouped)
const graphShard = getGraphShardForScope(scopeId);
```

**2. Query Changes**
- Graph traversal uses graph shard
- Property retrieval uses property shards
- Neo4j handles coordination automatically

#### Benefits
- **Independent Property Scaling**: Scale property storage separately
- **Smaller Graph Structure**: Graph structure is lightweight
- **Better for Property-Heavy Workloads**: Many properties per entity

#### Challenges
- **Preview Feature**: May not be production-ready
- **Complexity**: More moving parts
- **Query Performance**: Property lookups may be slower

---

## Design Considerations

### 1. Shard Selection Strategy

**Hash-Based (Consistent Hashing)**
```typescript
function getShardForScope(scopeId: string, totalShards: number): string {
  const hash = consistentHash(scopeId);
  return `shard-${hash % totalShards}`;
}
```
- **Pros**: Even distribution, deterministic
- **Cons**: Rebalancing requires data movement

**Range-Based**
```typescript
function getShardForScope(scopeId: string): string {
  if (scopeId < 'tenant-1000') return 'shard-1';
  if (scopeId < 'tenant-2000') return 'shard-2';
  return 'shard-3';
}
```
- **Pros**: Easy to understand, can optimize for access patterns
- **Cons**: Uneven distribution possible

**Explicit Mapping**
```typescript
const scopeToShard = new Map([
  ['tenant-1', 'shard-1'],
  ['tenant-2', 'shard-1'],
  ['tenant-3', 'shard-2'],
]);
```
- **Pros**: Full control, can optimize per tenant
- **Cons**: Manual management, doesn't scale

### 2. Cross-Shard Queries

**Problem**: Relationships cannot traverse across shards.

**Solutions**:
1. **Deny Cross-Shard**: Only allow queries within a single scope
2. **Fabric Composite Queries**: Use Fabric to query multiple shards, merge results
3. **Application-Level Joins**: Query each shard separately, join in application
4. **Reference Nodes**: Store cross-shard references, resolve in application

**Example: Application-Level Join**
```typescript
async ask(query: string, options?: QueryOptions) {
  if (options?.crossScope) {
    // Query multiple scopes
    const results = await Promise.all(
      options.scopes.map(scopeId => {
        const shard = getShardForScope(scopeId);
        return queryShard(shard, query);
      })
    );
    return mergeResults(results);
  }
  // Single scope query
  return queryShard(getShardForScope(this.scope.id), query);
}
```

### 3. Vector Index Management

**Per-Shard Indexes**
- Each shard has its own vector indexes
- Smaller indexes = faster searches
- Index creation must be coordinated

**Implementation**:
```typescript
async ensureVectorIndex(indexName: string, scopeId?: string) {
  if (scopeId) {
    const shard = getShardForScope(scopeId);
    await shard.ensureVectorIndex(indexName);
  } else {
    // Ensure on all shards
    await Promise.all(
      shards.map(shard => shard.ensureVectorIndex(indexName))
    );
  }
}
```

### 4. Migration Strategy

**Phase 1: Dual Write**
- Write to both old (single DB) and new (sharded) systems
- Read from old system
- Verify data consistency

**Phase 2: Gradual Migration**
- Migrate scopes one by one
- Route reads based on migration status
- Monitor performance

**Phase 3: Cutover**
- All reads from sharded system
- Remove old system writes
- Decommission old system

### 5. Configuration API

```typescript
interface AkashaConfig {
  // ... existing config
  sharding?: {
    enabled: boolean;
    strategy: 'fabric' | 'composite' | 'property' | 'none';
    config: ShardingConfig;
  };
}

// Example: Fabric configuration
const kg = akasha({
  neo4j: { /* ... */ },
  sharding: {
    enabled: true,
    strategy: 'fabric',
    config: {
      coordinatorUri: 'neo4j://fabric-coordinator:7687',
      mapping: {
        type: 'hash',
        databases: [
          { name: 'tenant-1', uri: 'neo4j://shard-1:7687', ... },
          { name: 'tenant-2', uri: 'neo4j://shard-2:7687', ... },
        ],
      },
    },
  },
});
```

## API Changes Required

### 1. Neo4jService
- Add shard-aware session management
- Remove scopeId filtering (replaced by database isolation)
- Add shard selection logic
- Support cross-shard queries (if needed)

### 2. Akasha Class
- Accept sharding configuration
- Route operations to correct shard
- Handle cross-shard scenarios
- Manage shard connections

### 3. Query Methods
- `ask()`: Query specific shard or multiple shards
- `learn()`: Write to correct shard
- `listEntities()`: Query specific shard
- Cross-shard operations: New methods or options

### 4. Event System
- Events still work (per-shard)
- Cross-shard events: Application-level coordination

## Performance Implications

### Benefits
- **Faster Vector Searches**: Smaller indexes per shard
- **Better Parallelism**: Multiple shards can be queried in parallel
- **Independent Scaling**: Scale hot shards independently
- **Reduced Index Size**: Each index only contains one shard's data

### Costs
- **Cross-Shard Queries**: Slower (require multiple queries + merge)
- **Connection Overhead**: Multiple database connections
- **Complexity**: More moving parts to manage
- **Rebalancing**: Data movement when rebalancing

## When to Use Sharding

### Use Sharding When:
- **Large Scale**: Thousands of tenants/scopes
- **Performance Issues**: Single database is bottleneck
- **Regulatory Requirements**: Need physical data isolation
- **Uneven Load**: Some scopes much larger than others

### Don't Use Sharding When:
- **Small Scale**: < 100 scopes, single database sufficient
- **Cross-Scope Queries**: Frequent queries across scopes
- **Simple Setup**: Current scopeId filtering works fine
- **Limited Resources**: Sharding adds operational complexity

## Recommended Approach

### Phase 1: Current (ScopeId Filtering)
- Single database
- Property-based filtering
- Simple, works for most cases

### Phase 2: Fabric (When Needed)
- Migrate to Neo4j Fabric
- One database per scope (or scope group)
- Physical isolation
- Better performance at scale

### Phase 3: Property Sharding (Future)
- If property-heavy workloads
- Separate graph from properties
- Independent scaling

## Implementation Checklist

- [ ] Design shard selection strategy
- [ ] Implement shard mapping logic
- [ ] Update Neo4jService for multi-database support
- [ ] Remove scopeId WHERE clauses (database isolation)
- [ ] Update vector index management
- [ ] Handle cross-shard queries (if needed)
- [ ] Migration tooling for existing data
- [ ] Configuration API for sharding
- [ ] Documentation updates
- [ ] Performance testing
- [ ] Monitoring and observability

## Open Questions

1. **Cross-Shard Relationships**: How to handle relationships that should span shards?
2. **Rebalancing**: Automatic rebalancing or manual?
3. **Consistency**: Eventual consistency acceptable?
4. **Backup/Recovery**: Per-shard or coordinated?
5. **Monitoring**: How to monitor across shards?
6. **Cost**: Is sharding worth the complexity for your use case?

---

**Note**: This is an exploration document. Implementation would require careful planning, testing, and gradual rollout.

