# Events & Reactivity Implementation Plan

## Design Philosophy Alignment

Based on Akasha's current API design patterns:

1. **Minimal API Surface**: Simple methods (`learn()`, `ask()`) - events should follow same pattern
2. **Factory Pattern**: `akasha(config)` - events should be configurable
3. **Type Safety**: Strong TypeScript types throughout
4. **Progressive Enhancement**: Simple defaults, powerful when needed
5. **Configuration-Based**: Register handlers via config or methods
6. **Explicit & Transparent**: No magic, everything is clear
7. **Eventual Consistency**: Async by default (LLM calls are slow)

---

## API Design

### Core Event System (Following Node.js EventEmitter Pattern)

**Just the essentials** - following established pub/sub patterns:

```typescript
// Simple event subscription - that's it!
kg.on('entity.created', async (event) => {
  // Do anything: enrich, analyze, sync, etc.
  const enriched = await enrichEntity(event.entity);
  await kg.updateEntity(event.entity.id, enriched);
});

// That's it! Everything else builds on top of this.
// enrich() and watch() are just convenience wrappers around on()
```

**Reference: Established Patterns**
- **Node.js EventEmitter**: `on()`, `off()`, `once()`, `emit()`
- **DOM EventTarget**: `addEventListener()`, `removeEventListener()`, `dispatchEvent()`
- **RxJS**: `subscribe()` - everything else is operators
- **Akasha**: `on()`, `off()`, `once()` - build patterns on top

**Users can build everything with `on()`:**
```typescript
// Enrichment pattern (user builds it)
kg.on('entity.created', async (event) => {
  if (event.entity.label === 'Company') {
    const data = await lookupCompany(event.entity.properties.name);
    await kg.updateEntity(event.entity.id, { industry: data.industry });
  }
});

// Watcher pattern (user builds it)
kg.on('entity.created', async (event) => {
  if (event.entity.label === 'Person') {
    const gaps = await analyzeGaps(event.entity);
    if (gaps.length > 0) {
      await promptUser(event.entity, gaps);
    }
  }
});

// Integration pattern (user builds it)
kg.on('relationship.created', async (event) => {
  await externalSystem.sync(event.relationship);
});
```

**Future (if needed)**: We can add convenience methods later:
- `enrich()` - convenience wrapper around `on()` with auto-update
- `watch()` - convenience wrapper around `on()` with gap analysis helpers
- But these are **optional** - the event system is sufficient!

### Event Types

```typescript
// Graph mutation events
'entity.created' | 'entity.updated' | 'entity.deleted'
'relationship.created' | 'relationship.updated' | 'relationship.deleted'
'document.created' | 'document.updated' | 'document.deleted'

// Learning lifecycle events
'learn.started' | 'learn.completed' | 'learn.failed'
'extraction.started' | 'extraction.completed'
'batch.progress' | 'batch.completed'

// Query events
'query.started' | 'query.completed'
```

---

## Test-Driven Development Plan

### Phase 1: Core Event System Only (MVP)

#### Unit Tests

**File**: `src/__tests__/events/event-emitter.test.ts`

```typescript
describe('EventEmitter', () => {
  describe('on()', () => {
    it('should register event handler', async () => {});
    it('should call handler when event is emitted', async () => {});
    it('should support multiple handlers for same event', async () => {});
    it('should pass correct event payload to handler', async () => {});
    it('should handle async handlers', async () => {});
    it('should not block on handler execution (fire-and-forget)', async () => {});
    it('should handle handler errors gracefully', async () => {});
  });

  describe('off()', () => {
    it('should remove event handler', async () => {});
    it('should remove specific handler when multiple exist', async () => {});
  });

  describe('once()', () => {
    it('should call handler only once', async () => {});
  });

  describe('emit()', () => {
    it('should emit event to all registered handlers', async () => {});
    it('should emit events asynchronously', async () => {});
    it('should not throw if no handlers registered', async () => {});
  });
});
```

**File**: `src/__tests__/events/event-types.test.ts`

```typescript
describe('Event Types', () => {
  describe('Entity Events', () => {
    it('should emit entity.created with correct payload', async () => {});
    it('should emit entity.updated with correct payload', async () => {});
    it('should emit entity.deleted with correct payload', async () => {});
  });

  describe('Relationship Events', () => {
    it('should emit relationship.created with correct payload', async () => {});
    it('should emit relationship.updated with correct payload', async () => {});
    it('should emit relationship.deleted with correct payload', async () => {});
  });

  describe('Document Events', () => {
    it('should emit document.created with correct payload', async () => {});
    it('should emit document.updated with correct payload', async () => {});
    it('should emit document.deleted with correct payload', async () => {});
  });

  describe('Learning Events', () => {
    it('should emit learn.started before learning', async () => {});
    it('should emit learn.completed after successful learning', async () => {});
    it('should emit learn.failed on error', async () => {});
    it('should emit extraction.started/completed', async () => {});
  });

  describe('Query Events', () => {
    it('should emit query.started before query', async () => {});
    it('should emit query.completed after query', async () => {});
  });
});
```

#### Integration Tests

**File**: `src/__tests__/integration/events-integration.test.ts`

```typescript
describe('Events Integration', () => {
  it('should emit events during learn() operation', async () => {
    const events: any[] = [];
    kg.on('entity.created', (e) => events.push(e));
    kg.on('relationship.created', (e) => events.push(e));
    kg.on('document.created', (e) => events.push(e));
    
    await kg.learn('Alice works for Acme Corp.');
    
    expect(events).toHaveLength(3); // document, entity, relationship
    expect(events[0].type).toBe('document.created');
    expect(events[1].type).toBe('entity.created');
    expect(events[2].type).toBe('relationship.created');
  });

  it('should emit events during ask() operation', async () => {
    const events: any[] = [];
    kg.on('query.started', (e) => events.push(e));
    kg.on('query.completed', (e) => events.push(e));
    
    await kg.ask('Who works for Acme Corp?');
    
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('query.started');
    expect(events[1].type).toBe('query.completed');
  });

  it('should not block main operation on handler execution', async () => {
    let handlerCompleted = false;
    kg.on('entity.created', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      handlerCompleted = true;
    });
    
    const start = Date.now();
    await kg.learn('Alice works for Acme Corp.');
    const duration = Date.now() - start;
    
    // Main operation should complete quickly (not wait for handler)
    expect(duration).toBeLessThan(50);
    // Handler should complete eventually
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(handlerCompleted).toBe(true);
  });
});
```

#### Implementation Files

1. `src/events/event-emitter.ts` - Core event emitter class
2. `src/events/event-types.ts` - Event type definitions
3. `src/events/index.ts` - Public exports

---

### Phase 2: Convenience Methods (Future - Only if needed)

If users request it, we can add:
- `enrich()` - convenience wrapper around `on()` with auto-update
- `watch()` - convenience wrapper around `on()` with gap analysis helpers

But these are **optional** - the event system is sufficient!

**Example of how users can build these patterns themselves:**

```typescript
// Enrichment pattern (user builds it)
kg.on('entity.created', async (event) => {
  if (event.entity.label === 'Company') {
    const data = await lookupCompany(event.entity.properties.name);
    await kg.updateEntity(event.entity.id, { industry: data.industry });
  }
});

// Watcher pattern (user builds it)
kg.on('entity.created', async (event) => {
  if (event.entity.label === 'Person') {
    const gaps = await analyzeGaps(event.entity);
    if (gaps.length > 0) {
      await promptUser(event.entity, gaps);
    }
  }
});
```

---
    it('should apply enrichment after entity creation', async () => {});
    it('should merge enrichment properties with entity', async () => {});
    it('should support filter function', async () => {});
    it('should support async enrichment handlers', async () => {});
    it('should handle enrichment errors gracefully', async () => {});
    it('should not block main operation', async () => {});
    it('should support multiple enrichments for same event', async () => {});
    it('should apply enrichments in registration order', async () => {});
  });

  describe('Enrichment Examples', () => {
    it('should enrich Company with external API data', async () => {
      kg.enrich('entity.created', {
        filter: (entity) => entity.label === 'Company',
        handler: async (entity) => {
          const data = await lookupCompany(entity.properties.name);
          return { industry: data.industry, website: data.website };
        }
      });
      
      const result = await kg.learn('Acme Corp is a technology company.');
      const company = result.entities.find(e => e.label === 'Company');
      
      // Enrichment happens asynchronously, so we need to wait
      await new Promise(resolve => setTimeout(resolve, 100));
      const enriched = await kg.findEntity(company.id);
      
      expect(enriched.properties.industry).toBe('Technology');
      expect(enriched.properties.website).toBeDefined();
    });

    it('should enrich Person with geocoding', async () => {
      kg.enrich('entity.created', {
        filter: (entity) => entity.label === 'Person' && entity.properties.address,
        handler: async (entity) => {
          const coords = await geocode(entity.properties.address);
          return { latitude: coords.lat, longitude: coords.lng };
        }
      });
      
      // Test implementation
    });
  });
});
```

#### Integration Tests

**File**: `src/__tests__/integration/enrichment-integration.test.ts`

```typescript
describe('Enrichment Integration', () => {
  it('should enrich entities during learn()', async () => {
    let enrichmentApplied = false;
    kg.enrich('entity.created', {
      handler: async (entity) => {
        enrichmentApplied = true;
        return { enriched: true };
      }
    });
    
    await kg.learn('Alice works for Acme Corp.');
    
    // Wait for async enrichment
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(enrichmentApplied).toBe(true);
  });

  it('should apply multiple enrichments', async () => {
    const enrichments: string[] = [];
    
    kg.enrich('entity.created', {
      handler: async () => {
        enrichments.push('first');
        return { first: true };
      }
    });
    
    kg.enrich('entity.created', {
      handler: async () => {
        enrichments.push('second');
        return { second: true };
      }
    });
    
    await kg.learn('Alice works for Acme Corp.');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(enrichments).toEqual(['first', 'second']);
  });
});
```

#### Implementation Files

1. `src/enrichment/enrichment-manager.ts` - Enrichment registration and execution
2. `src/enrichment/types.ts` - Enrichment type definitions
3. `src/enrichment/index.ts` - Public exports

---

### Phase 3: Watcher System (LLM-Powered Gap Analysis)

#### Unit Tests

**File**: `src/__tests__/watchers/watcher.test.ts`

```typescript
describe('Watcher System', () => {
  describe('watch()', () => {
    it('should register watcher', async () => {});
    it('should trigger watcher on matching event', async () => {});
    it('should support filter function', async () => {});
    it('should call analyze function with entity', async () => {});
    it('should handle async analyze functions', async () => {});
    it('should not block main operation', async () => {});
  });

  describe('Gap Analysis', () => {
    it('should analyze entity for missing properties', async () => {
      const mockLLM = {
        generateResponse: mock(async (prompt) => {
          return JSON.stringify({
            gaps: ['email', 'phone'],
            confidence: 0.8
          });
        })
      };
      
      kg.watch({
        trigger: 'entity.created',
        filter: (entity) => entity.label === 'Person',
        analyze: async (entity) => {
          const analysis = await mockLLM.generateResponse(...);
          return JSON.parse(analysis);
        }
      });
      
      await kg.learn('Alice works for Acme Corp.');
      // Verify watcher was called
    });

    it('should prompt user when gaps found', async () => {
      const prompts: any[] = [];
      
      kg.watch({
        trigger: 'entity.created',
        analyze: async (entity) => {
          return { gaps: ['email'], confidence: 0.9 };
        },
        onGapsFound: async (entity, gaps) => {
          prompts.push({ entity, gaps });
        }
      });
      
      await kg.learn('Alice works for Acme Corp.');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(prompts.length).toBeGreaterThan(0);
    });
  });
});
```

#### Integration Tests

**File**: `src/__tests__/integration/watcher-integration.test.ts`

```typescript
describe('Watcher Integration', () => {
  it('should watch for entity creation and analyze gaps', async () => {
    const analyses: any[] = [];
    
    kg.watch({
      trigger: 'entity.created',
      filter: (entity) => entity.label === 'Person',
      analyze: async (entity) => {
        // Mock LLM analysis
        const gaps = [];
        if (!entity.properties.email) gaps.push('email');
        if (!entity.properties.phone) gaps.push('phone');
        return { gaps, confidence: 0.8 };
      },
      onGapsFound: async (entity, gaps) => {
        analyses.push({ entity, gaps });
      }
    });
    
    await kg.learn('Alice works for Acme Corp.');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(analyses.length).toBeGreaterThan(0);
  });
});
```

#### Implementation Files

1. `src/watchers/watcher-manager.ts` - Watcher registration and execution
2. `src/watchers/gap-analyzer.ts` - LLM-powered gap analysis
3. `src/watchers/types.ts` - Watcher type definitions
4. `src/watchers/index.ts` - Public exports

---

### Phase 4: Custom Integrations (External System Hooks)

#### Unit Tests

**File**: `src/__tests__/integrations/integration.test.ts`

```typescript
describe('Custom Integrations', () => {
  describe('on() with external systems', () => {
    it('should call webhook on entity creation', async () => {
      const webhookCalls: any[] = [];
      
      kg.on('entity.created', async (event) => {
        await fetch('https://example.com/webhook', {
          method: 'POST',
          body: JSON.stringify(event)
        });
        webhookCalls.push(event);
      });
      
      await kg.learn('Alice works for Acme Corp.');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(webhookCalls.length).toBeGreaterThan(0);
    });

    it('should publish to message queue', async () => {
      const messages: any[] = [];
      
      kg.on('relationship.created', async (event) => {
        // Simulate message queue publish
        messages.push(event);
      });
      
      await kg.learn('Alice works for Acme Corp.');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should sync to external database', async () => {
      const syncs: any[] = [];
      
      kg.on('entity.created', async (event) => {
        // Simulate database sync
        await externalDB.insert(event.entity);
        syncs.push(event.entity);
      });
      
      await kg.learn('Alice works for Acme Corp.');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(syncs.length).toBeGreaterThan(0);
    });
  });
});
```

#### Integration Tests

**File**: `src/__tests__/integration/custom-integration.test.ts`

```typescript
describe('Custom Integration Examples', () => {
  it('should integrate with CRM system', async () => {
    const crmSyncs: any[] = [];
    
    kg.on('entity.created', async (event) => {
      if (event.entity.label === 'Person') {
        await crmSystem.createContact(event.entity);
        crmSyncs.push(event.entity);
      }
    });
    
    await kg.learn('Alice works for Acme Corp.');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(crmSyncs.length).toBeGreaterThan(0);
  });
});
```

---

### Phase 5: E2E Tests (Full Workflows)

#### E2E Test File

**File**: `src/__tests__/e2e/events-workflow.test.ts`

```typescript
describe('Events E2E Workflows', () => {
  it('should complete full enrichment workflow', async () => {
    // 1. Register enrichment
    kg.enrich('entity.created', {
      filter: (entity) => entity.label === 'Company',
      handler: async (entity) => {
        const data = await lookupCompany(entity.properties.name);
        return { industry: data.industry };
      }
    });
    
    // 2. Register watcher
    kg.watch({
      trigger: 'entity.created',
      filter: (entity) => entity.label === 'Person',
      analyze: async (entity) => {
        const gaps = [];
        if (!entity.properties.email) gaps.push('email');
        return { gaps, confidence: 0.9 };
      }
    });
    
    // 3. Register custom integration
    kg.on('relationship.created', async (event) => {
      await externalSystem.sync(event.relationship);
    });
    
    // 4. Perform learning
    const result = await kg.learn('Alice works for Acme Corp.');
    
    // 5. Verify all systems worked
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const company = result.entities.find(e => e.label === 'Company');
    const enriched = await kg.findEntity(company.id);
    expect(enriched.properties.industry).toBeDefined();
  });

  it('should handle batch learning with events', async () => {
    const events: any[] = [];
    kg.on('entity.created', (e) => events.push(e));
    kg.on('learn.completed', (e) => events.push(e));
    
    await kg.learnBatch([
      'Alice works for Acme Corp.',
      'Bob works for TechCorp.',
    ]);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(events.filter(e => e.type === 'entity.created').length).toBeGreaterThan(0);
    expect(events.filter(e => e.type === 'learn.completed').length).toBe(2);
  });
});
```

---

## Implementation Order

### Phase 1: Core Event System Only (MVP)
1. ✅ Write unit tests for `EventEmitter`
2. ✅ Write unit tests for event types
3. ✅ Implement `EventEmitter` class
4. ✅ Implement event type definitions
5. ✅ Integrate into `Akasha` class
6. ✅ Add `on()`, `off()`, `once()` methods
7. ✅ Write integration tests
8. ✅ Emit events from existing operations (`learn()`, `ask()`, CRUD)
9. ✅ E2E tests with event handlers
10. ✅ Documentation

**That's it for MVP!** Users can do everything with `on()`:
- Enrichment: `kg.on('entity.created', async (e) => { await enrichAndUpdate(e); })`
- Watchers: `kg.on('entity.created', async (e) => { await analyzeAndPrompt(e); })`
- Integrations: `kg.on('entity.created', async (e) => { await syncToExternal(e); })`

### Phase 2: Convenience Methods (Future - Only if needed)
If users request it, we can add:
- `enrich()` - convenience wrapper around `on()` with auto-update
- `watch()` - convenience wrapper around `on()` with gap analysis helpers

But these are **optional** - the event system is sufficient!

---

## Type Definitions

### Event Types

```typescript
// src/events/types.ts

export type EventType =
  | 'entity.created' | 'entity.updated' | 'entity.deleted'
  | 'relationship.created' | 'relationship.updated' | 'relationship.deleted'
  | 'document.created' | 'document.updated' | 'document.deleted'
  | 'learn.started' | 'learn.completed' | 'learn.failed'
  | 'extraction.started' | 'extraction.completed'
  | 'query.started' | 'query.completed'
  | 'batch.progress' | 'batch.completed';

export interface BaseEvent {
  type: EventType;
  timestamp: string;
  scopeId?: string;
}

export interface EntityEvent extends BaseEvent {
  type: 'entity.created' | 'entity.updated' | 'entity.deleted';
  entity: Entity;
}

export interface RelationshipEvent extends BaseEvent {
  type: 'relationship.created' | 'relationship.updated' | 'relationship.deleted';
  relationship: Relationship;
}

export interface DocumentEvent extends BaseEvent {
  type: 'document.created' | 'document.updated' | 'document.deleted';
  document: Document;
}

export interface LearnEvent extends BaseEvent {
  type: 'learn.started' | 'learn.completed' | 'learn.failed';
  text?: string;
  result?: ExtractResult;
  error?: Error;
}

export type AkashaEvent = EntityEvent | RelationshipEvent | DocumentEvent | LearnEvent | /* ... */;
```

### Future Types (If we add convenience methods later)

```typescript
// These would be added only if users request convenience methods

// src/enrichment/types.ts (future)
export interface EnrichmentOptions<T = Entity | Relationship | Document> {
  filter?: (item: T) => boolean;
  handler: (item: T) => Promise<Record<string, unknown>> | Record<string, unknown>;
  priority?: number;
}

// src/watchers/types.ts (future)
export interface WatcherOptions<T = Entity | Relationship | Document> {
  trigger: EventType;
  filter?: (item: T) => boolean;
  analyze: (item: T) => Promise<GapAnalysis> | GapAnalysis;
  onGapsFound?: (item: T, gaps: GapAnalysis) => Promise<void> | void;
}
```

**For MVP**: Users build these patterns themselves using `on()`.

---

## API Methods to Add

### Akasha Class Methods (MVP - Just Events)

```typescript
// Event subscription (following Node.js EventEmitter pattern)
on(eventType: EventType, handler: (event: AkashaEvent) => void | Promise<void>): void;
off(eventType: EventType, handler: (event: AkashaEvent) => void | Promise<void>): void;
once(eventType: EventType, handler: (event: AkashaEvent) => void | Promise<void>): void;

// Internal emit (not public API - used by Akasha internally)
private emit(event: AkashaEvent): void;
```

**That's it!** Following established patterns:
- **Node.js EventEmitter**: `on()`, `off()`, `once()`, `emit()`
- **Akasha**: Same pattern, type-safe, async-friendly

---

## Configuration Options

### AkashaConfig Extensions (Optional)

```typescript
// src/types.ts (additions)

export interface AkashaConfig {
  // ... existing config
  events?: {
    enabled?: boolean; // Default: true
    handlers?: Array<{
      type: EventType;
      handler: (event: AkashaEvent) => void | Promise<void>;
    }>;
  };
}
```

**Note**: Configuration-based handlers are optional. Users can also register handlers via `on()` method.

---

## Success Criteria

### Unit Tests
- ✅ 100% coverage of event system
- ✅ All edge cases handled
- ✅ Error handling works correctly

### Integration Tests
- ✅ Events emitted correctly during operations
- ✅ Handlers execute asynchronously (don't block)
- ✅ Multiple handlers work correctly
- ✅ Event payloads are correct

### E2E Tests
- ✅ Full workflows work end-to-end
- ✅ Performance acceptable (async doesn't block)
- ✅ Error handling works correctly

### Documentation
- ✅ API reference updated
- ✅ Usage examples provided
- ✅ Best practices documented

---

## Open Questions

1. **Error Handling**: How should we handle handler errors?
   - Option A: Log and continue (recommended - fire-and-forget)
   - Option B: Emit error event (user can subscribe to errors)
   - Option C: User-configurable error handling

2. **Event Ordering**: Do we need guaranteed event ordering?
   - Option A: Best-effort ordering (recommended - simpler)
   - Option B: Strict ordering (more complex, may not be needed)

3. **Event Persistence**: Should we persist events for replay?
   - Option A: No persistence (recommended for MVP)
   - Option B: Optional persistence (future enhancement)

4. **Performance**: How many handlers can we support?
   - Need to test with 10, 100, 1000 handlers
   - Async execution should handle this well

5. **Handler Execution**: Should handlers be:
   - Option A: Fire-and-forget async (recommended - doesn't block)
   - Option B: Awaitable (blocks main operation - not recommended)

---

## Next Steps

1. Review this plan
2. Adjust based on feedback
3. Start with Phase 1 (Core Event System)
4. Iterate based on learnings

