# Events and Reactivity

Akasha includes a built-in event system that enables reactive programming patterns, custom integrations, and extensibility. The event system follows the Node.js EventEmitter pattern for familiarity and simplicity.

## Overview

Events are emitted automatically during graph operations, allowing you to:
- **Enrich entities** with additional metadata from external APIs
- **Monitor graph changes** for observability and analytics
- **Integrate with external systems** via webhooks or message queues
- **Build reactive workflows** that respond to knowledge graph mutations
- **Implement watchers** that analyze graph state and prompt users

All event handlers execute asynchronously (fire-and-forget) to avoid blocking main operations, making them ideal for eventual consistency patterns.

## Event Types

### Graph Mutation Events

Emitted when graph elements are created, updated, or deleted:

- `entity.created` - New entity added to the graph
- `entity.updated` - Entity properties modified
- `entity.deleted` - Entity removed from the graph
- `relationship.created` - New relationship added
- `relationship.updated` - Relationship properties modified
- `relationship.deleted` - Relationship removed
- `document.created` - New document node created
- `document.updated` - Document properties modified
- `document.deleted` - Document removed

### Learning Lifecycle Events

Emitted during the learning process:

- `learn.started` - Learning operation begins
- `learn.completed` - Learning operation completes successfully
- `learn.failed` - Learning operation fails
- `extraction.started` - Entity/relationship extraction begins
- `extraction.completed` - Extraction completes

### Query Events

Emitted during query operations:

- `query.started` - Query operation begins
- `query.completed` - Query operation completes

### Batch Events

Emitted during batch operations:

- `batch.progress` - Progress update during batch learning
- `batch.completed` - Batch operation completes

## Basic Usage

### Registering Event Handlers

Use `on()` to register event handlers:

```typescript
import { akasha } from '@glossick/akasha';
import type { EntityEvent } from '@glossick/akasha';

const kg = akasha({ /* config */ });
await kg.initialize();

// Listen for entity creation
kg.on('entity.created', async (event: EntityEvent) => {
  console.log(`New entity created: ${event.entity.label}`);
  console.log(`Properties:`, event.entity.properties);
  console.log(`Scope: ${event.scopeId}`);
  console.log(`Timestamp: ${event.timestamp}`);
});

// Learn from text - will emit entity.created events
await kg.learn('Alice works for Acme Corp.');
```

### Removing Event Handlers

Use `off()` to remove handlers:

```typescript
const handler = (event: EntityEvent) => {
  console.log('Entity created:', event.entity.id);
};

kg.on('entity.created', handler);

// Later, remove the handler
kg.off('entity.created', handler);
```

### One-Time Handlers

Use `once()` for handlers that should only run once:

```typescript
kg.once('learn.completed', (event) => {
  console.log('First learning operation completed!');
});

await kg.learn('First text'); // Handler called
await kg.learn('Second text'); // Handler NOT called
```

## Event Payloads

### Entity Events

```typescript
interface EntityEvent {
  type: 'entity.created' | 'entity.updated' | 'entity.deleted';
  timestamp: string; // ISO timestamp
  scopeId?: string; // Scope ID for multi-tenancy
  entity: Entity; // The entity that was created/updated/deleted
}
```

### Relationship Events

```typescript
interface RelationshipEvent {
  type: 'relationship.created' | 'relationship.updated' | 'relationship.deleted';
  timestamp: string;
  scopeId?: string;
  relationship: Relationship; // The relationship that was created/updated/deleted
}
```

### Learning Events

```typescript
interface LearnEvent {
  type: 'learn.started' | 'learn.completed' | 'learn.failed';
  timestamp: string;
  scopeId?: string;
  text?: string; // Original text being learned
  result?: ExtractResult; // Result for completed events
  error?: Error; // Error for failed events
}
```

### Query Events

```typescript
interface QueryEvent {
  type: 'query.started' | 'query.completed';
  timestamp: string;
  scopeId?: string;
  query: string; // The query string
}
```

### Batch Events

```typescript
interface BatchEvent {
  type: 'batch.progress' | 'batch.completed';
  timestamp: string;
  scopeId?: string;
  progress?: {
    current: number;
    total: number;
    completed: number;
    failed: number;
    currentText?: string;
    estimatedTimeRemainingMs?: number;
  };
  summary?: {
    total: number;
    succeeded: number;
    failed: number;
    totalDocumentsCreated: number;
    totalEntitiesCreated: number;
    totalRelationshipsCreated: number;
  };
}
```

## Common Patterns

### Entity Enrichment

Enrich entities with additional metadata from external APIs:

```typescript
kg.on('entity.created', async (event) => {
  if (event.entity.label === 'Company') {
    const companyName = event.entity.properties.name as string;
    
    // Fetch additional data from external API
    const companyData = await fetchCompanyData(companyName);
    
    // Update entity with enriched data
    await kg.updateEntity(event.entity.id, {
      properties: {
        industry: companyData.industry,
        website: companyData.website,
        employees: companyData.employeeCount,
      },
    });
  }
});

await kg.learn('Acme Corp is a technology company.');
// Entity will be automatically enriched with industry, website, etc.
```

### Observability and Monitoring

Track graph changes for analytics:

```typescript
const metrics = {
  entitiesCreated: 0,
  relationshipsCreated: 0,
  documentsCreated: 0,
};

kg.on('entity.created', () => metrics.entitiesCreated++);
kg.on('relationship.created', () => metrics.relationshipsCreated++);
kg.on('document.created', () => metrics.documentsCreated++);

// Later, report metrics
setInterval(() => {
  console.log('Graph metrics:', metrics);
}, 60000);
```

### External System Integration

Sync graph changes to external systems:

```typescript
// Webhook integration
kg.on('entity.created', async (event) => {
  if (event.entity.label === 'Person') {
    await fetch('https://api.example.com/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'person.created',
        data: event.entity,
        timestamp: event.timestamp,
      }),
    });
  }
});

// Message queue integration
kg.on('relationship.created', async (event) => {
  await messageQueue.publish('graph.relationship.created', {
    relationship: event.relationship,
    scopeId: event.scopeId,
  });
});
```

### Gap Analysis Watchers

Analyze entities for missing information and prompt users:

```typescript
kg.on('entity.created', async (event) => {
  if (event.entity.label === 'Person') {
    const gaps = [];
    
    if (!event.entity.properties.email) gaps.push('email');
    if (!event.entity.properties.phone) gaps.push('phone');
    if (!event.entity.properties.address) gaps.push('address');
    
    if (gaps.length > 0) {
      // Use LLM to analyze gaps
      const analysis = await analyzeEntityGaps(event.entity, gaps);
      
      if (analysis.confidence > 0.8) {
        // Prompt user to fill gaps
        await promptUser({
          entity: event.entity,
          missingFields: gaps,
          suggestion: analysis.suggestion,
        });
      }
    }
  }
});
```

### Learning Progress Tracking

Monitor batch learning progress:

```typescript
kg.on('batch.progress', (event) => {
  if (event.progress) {
    const { current, total, completed, failed } = event.progress;
    const percentage = Math.round((completed / total) * 100);
    
    console.log(`Progress: ${percentage}% (${completed}/${total} completed, ${failed} failed)`);
    
    if (event.progress.estimatedTimeRemainingMs) {
      const seconds = Math.round(event.progress.estimatedTimeRemainingMs / 1000);
      console.log(`Estimated time remaining: ${seconds}s`);
    }
  }
});

kg.on('batch.completed', (event) => {
  if (event.summary) {
    console.log(`Batch complete: ${event.summary.succeeded} succeeded, ${event.summary.failed} failed`);
  }
});
```

## Configuration

You can register event handlers at initialization time via configuration:

```typescript
const kg = akasha({
  neo4j: { /* ... */ },
  providers: { /* ... */ },
  events: {
    enabled: true, // Default: true
    handlers: [
      {
        type: 'entity.created',
        handler: async (event) => {
          // Handler registered at initialization
          console.log('Entity created:', event.entity.id);
        },
      },
    ],
  },
});
```

## Best Practices

### 1. Async Handlers

Always use async handlers for I/O operations:

```typescript
// ✅ Good - async handler
kg.on('entity.created', async (event) => {
  await externalAPI.sync(event.entity);
});

// ❌ Bad - blocking synchronous operation
kg.on('entity.created', (event) => {
  // This blocks the event loop!
  heavyComputation(event.entity);
});
```

### 2. Error Handling

Event handlers should handle their own errors:

```typescript
kg.on('entity.created', async (event) => {
  try {
    await externalAPI.sync(event.entity);
  } catch (error) {
    // Log error but don't crash
    console.error('Failed to sync entity:', error);
    // Optionally, retry or send to dead letter queue
  }
});
```

### 3. Filtering

Filter events early to avoid unnecessary processing:

```typescript
// ✅ Good - filter early
kg.on('entity.created', async (event) => {
  if (event.entity.label !== 'Company') return;
  // Only process Company entities
  await enrichCompany(event.entity);
});

// ❌ Less efficient - processes all entities
kg.on('entity.created', async (event) => {
  // Process all entities, then filter
  if (event.entity.label === 'Company') {
    await enrichCompany(event.entity);
  }
});
```

### 4. Handler Cleanup

Remove handlers when no longer needed to prevent memory leaks:

```typescript
const handler = (event: EntityEvent) => {
  // Handler logic
};

kg.on('entity.created', handler);

// Later, when done
kg.off('entity.created', handler);
```

### 5. Event Ordering

Don't rely on event ordering - handlers execute asynchronously:

```typescript
// ❌ Bad - assumes ordering
let entityId: string;
kg.on('entity.created', (event) => {
  entityId = event.entity.id;
});
kg.on('relationship.created', (event) => {
  // entityId might not be set yet!
  console.log(entityId);
});

// ✅ Good - use event data directly
kg.on('relationship.created', (event) => {
  // Use data from the event itself
  console.log(event.relationship.from);
});
```

## Performance Considerations

- **Fire-and-Forget**: Event handlers execute asynchronously and don't block main operations
- **No Ordering Guarantees**: Handlers may execute in any order
- **Error Isolation**: Errors in handlers don't crash the system
- **Memory**: Keep handlers lightweight to avoid memory issues
- **Rate Limiting**: For high-volume operations, consider rate limiting in handlers

## Type Safety

All event types are fully typed:

```typescript
import type { EntityEvent, LearnEvent, QueryEvent } from '@glossick/akasha';

kg.on('entity.created', (event: EntityEvent) => {
  // event.entity is typed
  const name = event.entity.properties.name;
});

kg.on('learn.completed', (event: LearnEvent) => {
  // event.result is typed
  if (event.result) {
    console.log(event.result.entities.length);
  }
});
```

## Next Steps

- See [Examples](./examples.md) for more event patterns
- Review [API Reference](./api-reference.md) for complete event API documentation
- Check [Core Concepts](./core-concepts.md) to understand how events fit into Akasha's architecture

