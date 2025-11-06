# Multi-Tenancy and Scope Management

Akasha supports multi-tenancy through scopes—isolation boundaries that separate knowledge spaces. This enables scenarios like SaaS applications, multi-project workspaces, and user-specific knowledge graphs.

## Understanding Scopes

A scope represents an isolation boundary. It could be:
- A tenant in a SaaS application
- A workspace in a collaboration tool
- A project in a project management system
- An organization in an enterprise system
- A user in a personal knowledge base

All entities and relationships created within a scope are tagged with that scope's ID. Queries automatically filter by scope, ensuring complete data isolation.

## Basic Scope Usage

```typescript
const tenant1 = akasha({
  neo4j: { /* ... */ },
  scope: {
    id: 'tenant-1',
    type: 'tenant',
    name: 'Tenant 1',
  },
});

const tenant2 = akasha({
  neo4j: { /* ... */ },
  scope: {
    id: 'tenant-2',
    type: 'tenant',
    name: 'Tenant 2',
  },
});
```

Each instance operates independently. Data created by `tenant1` is invisible to `tenant2`, and vice versa.

## Scope Isolation

Scope isolation happens automatically:

1. **Entity Creation**: All entities get a `scopeId` property set to the scope's ID.

2. **Relationship Creation**: All relationships get a `scopeId` property.

3. **Query Filtering**: All queries automatically filter by `scopeId`. When you call `ask()`, it only searches entities in your scope.

4. **Subgraph Retrieval**: Graph traversal only follows relationships within the same scope.

This means:
- Tenant A cannot see Tenant B's data
- Queries in Tenant A only return Tenant A's entities
- Relationships cannot cross scope boundaries

## Contexts Within Scopes

A context represents a knowledge space within a scope. Each text you learn from creates a context. Multiple contexts can exist in a scope:

```typescript
// Context 1: Company Handbook
await kg.learn('Our company values integrity...', {
  contextName: 'Company Handbook',
  contextId: 'handbook-1',
});

// Context 2: Employee Interviews
await kg.learn('Alice mentioned she enjoys...', {
  contextName: 'Employee Interviews',
  contextId: 'interviews-1',
});
```

Both contexts exist within the same scope but represent different sources of knowledge.

## Querying by Context

You can filter queries to specific contexts:

```typescript
const result = await kg.ask('What are our company values?', {
  contexts: ['handbook-1'], // Only search in this context
});
```

This enables scenarios like:
- "Answer based only on the company handbook"
- "What did we learn from the interviews?"
- "Query across all project documentation"

## Scope-Agnostic Mode

You can use Akasha without a scope (scope-agnostic mode):

```typescript
const kg = akasha({
  neo4j: { /* ... */ },
  // No scope provided
});
```

In this mode:
- Entities and relationships are still created (without scopeId)
- Queries search all entities (no scope filtering)
- Useful for single-tenant applications or development

## Multi-Tenant Patterns

### Pattern 1: Per-Tenant Instances

Create a separate Akasha instance for each tenant:

```typescript
class TenantService {
  private instances = new Map<string, Akasha>();

  getInstance(tenantId: string): Akasha {
    if (!this.instances.has(tenantId)) {
      this.instances.set(tenantId, akasha({
        neo4j: { /* ... */ },
        scope: {
          id: tenantId,
          type: 'tenant',
          name: `Tenant ${tenantId}`,
        },
      }));
    }
    return this.instances.get(tenantId)!;
  }
}
```

### Pattern 2: Dynamic Scope Creation

Create scopes dynamically based on user context:

```typescript
function createUserScope(userId: string, workspaceId: string): Scope {
  return {
    id: `${workspaceId}-${userId}`,
    type: 'user-workspace',
    name: `User ${userId} in Workspace ${workspaceId}`,
    metadata: {
      userId,
      workspaceId,
    },
  };
}

const kg = akasha({
  neo4j: { /* ... */ },
  scope: createUserScope('user-123', 'workspace-456'),
});
```

### Pattern 3: Hierarchical Scopes

Use scope metadata to represent hierarchies:

```typescript
const orgScope: Scope = {
  id: 'org-1',
  type: 'organization',
  name: 'Organization 1',
  metadata: {
    parentId: null,
  },
};

const projectScope: Scope = {
  id: 'project-1',
  type: 'project',
  name: 'Project 1',
  metadata: {
    parentId: 'org-1', // Belongs to organization
  },
};
```

## Scope Metadata

You can attach arbitrary metadata to scopes:

```typescript
const scope: Scope = {
  id: 'project-1',
  type: 'project',
  name: 'Project 1',
  metadata: {
    owner: 'user-123',
    createdAt: '2024-01-01',
    tags: ['important', 'active'],
    customField: 'custom value',
  },
};
```

This metadata is stored with the scope but doesn't affect isolation—only the `id` matters for data isolation.

## Connection Sharing

All scopes share the same Neo4j connection pool. This is efficient but means all scopes use the same database. For stronger isolation, you could:

1. Use separate Neo4j databases per tenant
2. Use separate Akasha instances with different Neo4j URIs
3. Implement application-level access control

## Best Practices

1. **Use Descriptive Scope IDs**: Make scope IDs meaningful and unique.

2. **Consistent Scope Types**: Use consistent type values (`'tenant'`, `'workspace'`, etc.) for easier querying.

3. **Scope Lifecycle**: Consider when to create and destroy scopes. Do they persist? Are they temporary?

4. **Context Organization**: Use contexts to organize knowledge within scopes. Don't put everything in one context.

5. **Query Filtering**: Use context filtering when you want answers from specific knowledge sources.

## Example: Multi-Tenant SaaS

```typescript
class MultiTenantGraphRAG {
  private getTenantScope(tenantId: string): Scope {
    return {
      id: `tenant-${tenantId}`,
      type: 'tenant',
      name: `Tenant ${tenantId}`,
    };
  }

  async learnForTenant(tenantId: string, text: string) {
    const kg = akasha({
      neo4j: { /* ... */ },
      scope: this.getTenantScope(tenantId),
    });

    await kg.initialize();
    try {
      return await kg.learn(text, {
        contextName: `Tenant ${tenantId} Knowledge`,
      });
    } finally {
      await kg.cleanup();
    }
  }

  async askTenant(tenantId: string, question: string) {
    const kg = akasha({
      neo4j: { /* ... */ },
      scope: this.getTenantScope(tenantId),
    });

    await kg.initialize();
    try {
      return await kg.ask(question);
    } finally {
      await kg.cleanup();
    }
  }
}
```

---

**Next**: Read [Examples](./examples.md) for practical patterns and use cases.

