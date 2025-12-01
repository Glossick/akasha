# Examples and Patterns

Practical examples demonstrating common Akasha patterns and use cases.

## Basic Usage

### Simple Knowledge Graph

```typescript
import { akasha } from '@glossick/akasha';

const kg = akasha({
  database: {
    type: 'neo4j',
    config: {
      uri: 'bolt://localhost:7687',
      user: 'neo4j',
      password: 'password',
    },
  },
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'text-embedding-3-small',
      },
    },
    llm: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'gpt-4',
      },
    },
  },
});

await kg.initialize();

// Learn (creates document node, extracts entities)
const learnResult = await kg.learn('Alice works for Acme Corp. Bob works for TechCorp.');
console.log(`Document: ${learnResult.document.id}`);
console.log(`Created ${learnResult.created.entities} entities`);

// Query (default strategy: 'both' - searches documents and entities)
const result = await kg.ask('Who works for Acme Corp?');
console.log(result.answer);
console.log(`Found ${result.context.documents?.length || 0} documents`);
console.log(`Found ${result.context.entities.length} entities`);

await kg.cleanup();
```

## Multi-Tenant Application

### Tenant Isolation

```typescript
function createTenantKG(tenantId: string) {
  return akasha({
    database: { /* ... */ },
    scope: {
      id: `tenant-${tenantId}`,
      type: 'tenant',
      name: `Tenant ${tenantId}`,
    },
  });
}

// Tenant 1
const tenant1 = createTenantKG('1');
await tenant1.initialize();
await tenant1.learn('Alice works for Acme Corp.');

// Tenant 2
const tenant2 = createTenantKG('2');
await tenant2.initialize();
await tenant2.learn('Bob works for TechCorp.');

// Queries are isolated
const result1 = await tenant1.ask('Who works for Acme Corp?'); // Finds Alice
const result2 = await tenant2.ask('Who works for Acme Corp?'); // No results
```

## Custom Ontology

### E-Commerce Ontology

```typescript
const ecommerceOntology = {
  entityTypes: [
    {
      label: 'Customer',
      description: 'A customer who makes purchases',
      examples: ['John Doe', 'customer@example.com'],
      requiredProperties: ['email', 'name'],
    },
    {
      label: 'Product',
      description: 'A product for sale',
      examples: ['iPhone 15', 'SKU-12345'],
      requiredProperties: ['sku', 'name'],
    },
    {
      label: 'Order',
      description: 'A customer order',
      examples: ['Order #12345'],
      requiredProperties: ['orderId', 'total'],
    },
  ],
  relationshipTypes: [
    {
      type: 'PURCHASED',
      description: 'Customer purchased a product',
      from: ['Customer'],
      to: ['Product'],
    },
    {
      type: 'CONTAINS',
      description: 'Order contains products',
      from: ['Order'],
      to: ['Product'],
    },
  ],
};

const kg = akasha({
  database: { /* ... */ },
  extractionPrompt: ecommerceOntology,
});

await kg.learn('John Doe purchased an iPhone 15. Order #12345 contains iPhone 15.');
```

## Process Ontology

### Workflow Tracking

```typescript
import { processOntologyTemplate } from '../examples/process-ontology';

const kg = akasha({
  database: { /* ... */ },
  extractionPrompt: processOntologyTemplate,
});

await kg.learn(
  'Alice started working at 9 AM. She attended a meeting at 10 AM. The meeting led to a decision to launch a new project.'
);

const result = await kg.ask('What processes did Alice participate in?');
```

## Context Management

### Multiple Knowledge Sources

```typescript
// Learn from different sources
await kg.learn('Company policy states...', {
  contextName: 'Company Handbook',
  contextId: 'handbook',
});

await kg.learn('Alice mentioned in the interview...', {
  contextName: 'Employee Interviews',
  contextId: 'interviews',
});

// Query specific context (strict filtering)
const handbookAnswer = await kg.ask('What is company policy?', {
  contexts: ['handbook'], // Only searches documents/entities with 'handbook' in contextIds
});

// Query multiple contexts
const multiContextAnswer = await kg.ask('What do we know about Alice?', {
  contexts: ['handbook', 'interviews'], // Searches documents/entities with either contextId
});

// Query all contexts (no filter)
const allAnswer = await kg.ask('What do we know about Alice?');
```

### Document Deduplication and Context Append

```typescript
// Learn text first time
const result1 = await kg.learn('Alice works for Acme Corp.', {
  contextId: 'handbook-1',
});

console.log(result1.created.document); // 1 (created)
console.log(result1.document.properties.contextIds); // ['handbook-1']

// Learn same text with different context
const result2 = await kg.learn('Alice works for Acme Corp.', {
  contextId: 'interviews-1',
});

console.log(result2.created.document); // 0 (reused/deduplicated)
console.log(result2.document.id === result1.document.id); // true (same document)
console.log(result2.document.properties.contextIds); // ['handbook-1', 'interviews-1']

// Entity also accumulates contextIds
const aliceEntity = result2.entities.find(e => e.properties.name === 'Alice');
console.log(aliceEntity?.properties.contextIds); // ['handbook-1', 'interviews-1']
```

## Embedding Management

### Including Embeddings

By default, embeddings are scrubbed from responses. To include them:

```typescript
// Include embeddings in learn() response
const learnResult = await kg.learn('Alice works for Acme Corp.', {
  includeEmbeddings: true,
});

// Include embeddings in ask() response
const queryResult = await kg.ask('Who works for Acme Corp?', {
  includeEmbeddings: true,
});
```

## Error Handling

### Robust Error Handling

```typescript
async function safeAsk(kg: Akasha, query: string) {
  try {
    return await kg.ask(query);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not initialized')) {
        throw new Error('Akasha not initialized. Call initialize() first.');
      }
      if (error.message.includes('Neo4j')) {
        throw new Error('Neo4j connection error. Check your database.');
      }
      if (error.message.includes('OpenAI')) {
        throw new Error('OpenAI API error. Check your API key.');
      }
    }
    throw error;
  }
}
```

## Long-Running Service

### Persistent Connection

```typescript
class GraphRAGService {
  private kg: Akasha;

  constructor() {
    this.kg = akasha({
      neo4j: { /* ... */ },
      scope: { /* ... */ },
    });
  }

  async start() {
    await this.kg.initialize();
  }

  async stop() {
    await this.kg.cleanup();
  }

  async learn(text: string) {
    return await this.kg.learn(text);
  }

  async ask(query: string) {
    return await this.kg.ask(query);
  }
}

// Usage
const service = new GraphRAGService();
await service.start();

// Use service throughout application lifetime
await service.learn('...');
await service.ask('...');

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  await service.stop();
});
```

## Batch Learning

### Learning from Multiple Texts

```typescript
const texts = [
  'Alice works for Acme Corp.',
  'Bob works for TechCorp.',
  'Alice knows Bob from college.',
];

for (const text of texts) {
  await kg.learn(text, {
    contextName: 'Batch Import',
  });
}
```

## Query Options

### Advanced Querying

```typescript
// Deep graph traversal
const deepResult = await kg.ask('Find all connections', {
  maxDepth: 5,
  limit: 200,
});

// Context-specific query (strict filtering)
const contextResult = await kg.ask('What did we learn?', {
  contexts: ['context-id-1', 'context-id-2'], // Only entities/documents with these contextIds
});

// Query strategy: documents only
const docResult = await kg.ask('What documents mention companies?', {
  strategy: 'documents', // Search document nodes first
});

// Query strategy: entities only (original behavior)
const entityResult = await kg.ask('Who works for companies?', {
  strategy: 'entities', // Search entity nodes only
});

// Query strategy: both (default)
const bothResult = await kg.ask('What do we know about Alice?', {
  strategy: 'both', // Search both documents and entities
});

// Include embeddings for analysis
const withEmbeddings = await kg.ask('Analyze similarities', {
  includeEmbeddings: true,
});

// Combined: context filter + strategy + embeddings
const combinedResult = await kg.ask('What did we learn from interviews?', {
  contexts: ['interviews-1', 'interviews-2'],
  strategy: 'both',
  maxDepth: 3,
  includeEmbeddings: false,
});
```

## Integration Patterns

### Database-Agnostic Factory

Create a factory function that works with any database:

```typescript
// Database-agnostic factory function
function createKG(databaseType: 'neo4j' | 'ladybug') {
  return akasha({
    database: databaseType === 'neo4j'
      ? {
          type: 'neo4j',
          config: {
            uri: process.env.NEO4J_URI!,
            user: process.env.NEO4J_USER!,
            password: process.env.NEO4J_PASSWORD!,
          },
        }
      : {
          type: 'ladybug',
          config: {
            databasePath: process.env.LADYBUG_DATABASE_PATH || './database',
          },
        },
    providers: {
      embedding: {
        type: 'openai',
        config: {
          apiKey: process.env.OPENAI_API_KEY!,
          model: 'text-embedding-3-small',
        },
      },
      llm: {
        type: 'openai',
        config: {
          apiKey: process.env.OPENAI_API_KEY!,
          model: 'gpt-4',
        },
      },
    },
  });
}

// Usage
const kg = createKG(process.env.DATABASE_TYPE as 'neo4j' | 'ladybug' || 'neo4j');
await kg.initialize();
```

## Integration Patterns

### Express.js Integration

```typescript
import express from 'express';
import { akasha } from '@glossick/akasha';

const app = express();
const kg = akasha({ /* ... */ });

await kg.initialize();

app.post('/api/learn', async (req, res) => {
  const { text, contextName } = req.body;
  const result = await kg.learn(text, { contextName });
  res.json(result);
});

app.post('/api/ask', async (req, res) => {
  const { query } = req.body;
  const result = await kg.ask(query);
  res.json(result);
});
```

### Express.js Integration

```typescript
import express from 'express';
import { akasha } from '@glossick/akasha';

const app = express();
app.use(express.json());

const kg = akasha({ /* ... */ });

await kg.initialize();

app.post('/api/learn', async (req, res) => {
  const { text, contextName } = req.body;
  const result = await kg.learn(text, { contextName });
  res.json(result);
});

app.post('/api/ask', async (req, res) => {
  const { query } = req.body;
  const result = await kg.ask(query);
  res.json(result);
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Temporal Tracking

### Learning Facts with Temporal Metadata

```typescript
// Fact valid for a specific period
await kg.learn('Alice worked for Acme Corp from January to June 2024.', {
  contextName: 'Q1-Q2 2024',
  validFrom: new Date('2024-01-01T00:00:00Z'),
  validTo: new Date('2024-06-30T23:59:59Z'),
});

// Ongoing fact (no expiration)
await kg.learn('Bob works for TechCorp.', {
  contextName: 'Current',
  validFrom: new Date('2024-01-01T00:00:00Z'),
  // No validTo = ongoing
});

// Fact with default temporal metadata (validFrom = recordedAt)
await kg.learn('Charlie works for StartupCo.');
// _recordedAt and _validFrom will both be set to current time
// No _validTo = ongoing
```

### Querying by Temporal Validity

```typescript
// Query facts valid at a specific point in time
const result1 = await kg.ask('Who works for companies?', {
  validAt: new Date('2024-03-01T12:00:00Z'), // Q1 2024
});
// Returns Alice (valid during Q1-Q2) and Bob/Charlie (ongoing)
// Does not return facts that expired before this date

// Query facts valid at a different time
const result2 = await kg.ask('Who works for companies?', {
  validAt: new Date('2024-08-01T12:00:00Z'), // Q3 2024
});
// Returns Bob and Charlie (ongoing)
// Does not return Alice (expired on June 30)

// Query without temporal filter (returns all facts)
const result3 = await kg.ask('Who works for companies?');
// Returns all entities regardless of validity period
```

### Historical Facts

```typescript
// Learn a fact about the past
await kg.learn('David worked for OldCorp from 2020 to 2023.', {
  contextName: 'Historical Data',
  validFrom: new Date('2020-01-01T00:00:00Z'),
  validTo: new Date('2023-12-31T23:59:59Z'),
});

// Query at time when fact was valid
const result1 = await kg.ask('Who worked for companies?', {
  validAt: new Date('2022-06-01T12:00:00Z'),
});
// Returns David (fact was valid in 2022)

// Query after fact expired
const result2 = await kg.ask('Who worked for companies?', {
  validAt: new Date('2024-06-01T12:00:00Z'),
});
// Does not return David (fact expired in 2023)
```

### Combining Temporal and Context Filtering

```typescript
// Learn facts in different contexts with different validity periods
await kg.learn('Alice works for Acme Corp.', {
  contextId: 'q1-q2-2024',
  validFrom: new Date('2024-01-01'),
  validTo: new Date('2024-06-30'),
});

await kg.learn('Bob works for TechCorp.', {
  contextId: 'q3-q4-2024',
  validFrom: new Date('2024-07-01'),
  validTo: new Date('2024-12-31'),
});

// Query with both context and temporal filters
const result = await kg.ask('Who works for companies?', {
  contexts: ['q1-q2-2024'],
  validAt: new Date('2024-03-01'),
});
// Returns Alice (matches both context and temporal filters)
```

## Batch Learning

### Learning Multiple Texts at Once

```typescript
// Simple batch with string array
const texts = [
  'Alice works for Acme Corp as a software engineer.',
  'Bob works for TechCorp as a designer.',
  'Charlie works for StartupCo as a manager.',
];

const result = await kg.learnBatch(texts, {
  contextName: 'Team Roster',
});

console.log(`Processed ${result.summary.succeeded} of ${result.summary.total} texts`);
console.log(`Created ${result.summary.totalEntitiesCreated} entities`);
console.log(`Created ${result.summary.totalRelationshipsCreated} relationships`);

// Handle errors if any
if (result.errors && result.errors.length > 0) {
  console.error('Some items failed:');
  result.errors.forEach(err => {
    console.error(`  Item ${err.index}: ${err.error}`);
  });
}
```

### Batch Learning with Per-Item Options

```typescript
const items = [
  {
    text: 'Alice works for Acme Corp.',
    contextId: 'handbook-1',
    contextName: 'Company Handbook',
  },
  {
    text: 'Bob works for TechCorp.',
    contextId: 'interviews-1',
    contextName: 'Employee Interviews',
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2024-12-31'),
  },
];

const result = await kg.learnBatch(items);
```

### Batch Learning with Progress Callback

```typescript
const texts = [
  'Alice works for Acme Corp.',
  'Bob works for TechCorp.',
  'Charlie works for StartupCo.',
];

const result = await kg.learnBatch(texts, {
  onProgress: (progress) => {
    const percentage = Math.round((progress.completed / progress.total) * 100);
    console.log(`Progress: ${percentage}% (${progress.completed}/${progress.total})`);
    
    if (progress.failed > 0) {
      console.log(`⚠️  ${progress.failed} items failed`);
    }
    
    if (progress.estimatedTimeRemainingMs) {
      const seconds = Math.round(progress.estimatedTimeRemainingMs / 1000);
      console.log(`⏱️  Estimated time remaining: ${seconds}s`);
    }
    
    if (progress.currentText) {
      console.log(`📄 Processing: ${progress.currentText.substring(0, 50)}...`);
    }
  },
});

console.log(`✅ Batch complete: ${result.summary.succeeded} succeeded, ${result.summary.failed} failed`);
```

## Configuration Validation

### Validating Configuration Before Use

```typescript
const config = {
  neo4j: {
    uri: 'bolt://localhost:7687',
    user: 'neo4j',
    password: 'password',
  },
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: 'sk-test-key',
        model: 'text-embedding-3-small',
      },
    },
    llm: {
      type: 'openai',
      config: {
        apiKey: 'sk-test-key',
        model: 'gpt-4',
      },
    },
  },
  scope: {
    id: 'tenant-1',
    type: 'tenant',
    name: 'My Tenant',
  },
};

// Validate before creating instance
const validation = Akasha.validateConfig(config);

if (!validation.valid) {
  console.error('Configuration errors:');
  validation.errors.forEach(error => {
    console.error(`  ${error.field}: ${error.message}`);
  });
  // Don't proceed with invalid config
  process.exit(1);
}

if (validation.warnings && validation.warnings.length > 0) {
  console.warn('Configuration warnings:');
  validation.warnings.forEach(warning => {
    console.warn(`  ${warning.field}: ${warning.message}`);
  });
}

// Configuration is valid, proceed
const kg = akasha(config);
await kg.initialize();
```

### Validating Instance Configuration

```typescript
const kg = akasha({
  database: {
    type: 'neo4j',
    config: {
      uri: 'bolt://localhost:7687',
      user: 'neo4j',
      password: 'password',
    },
  },
});

// Validate instance configuration
const validation = kg.validateConfig();

if (!validation.valid) {
  console.error('Current configuration is invalid:', validation.errors);
  // Handle invalid configuration
}
```

### Handling Validation Errors

```typescript
function createAkashaWithValidation(config: AkashaConfig): Akasha {
  const validation = Akasha.validateConfig(config);

  if (!validation.valid) {
    const errorMessages = validation.errors
      .map(e => `${e.field}: ${e.message}`)
      .join(', ');
    throw new Error(`Invalid configuration: ${errorMessages}`);
  }

  if (validation.warnings && validation.warnings.length > 0) {
    console.warn('Configuration warnings:', validation.warnings);
  }

  return akasha(config);
}

// Usage
try {
  const kg = createAkashaWithValidation({
    database: {
      type: 'neo4j',
      config: {
        uri: '', // Invalid: empty URI
        user: 'neo4j',
        password: 'password',
      },
    },
  });
} catch (error) {
  console.error('Failed to create Akasha:', error.message);
  // Output: "Invalid configuration: neo4j.uri: Neo4j URI is required and must be a non-empty string"
}
```

## Health Check

### Checking Service Availability

```typescript
const health = await kg.healthCheck();

if (health.status === 'healthy') {
  console.log('✅ All services operational');
} else if (health.status === 'degraded') {
  console.warn('⚠️ Some services unavailable');
  if (!health.neo4j.connected) {
    console.error('Neo4j:', health.neo4j.error);
  }
  if (!health.openai.available) {
    console.error('OpenAI:', health.openai.error);
  }
} else {
  console.error('❌ All services unavailable');
}
```

### Startup Validation

```typescript
async function startService() {
  const kg = akasha({ /* ... */ });
  await kg.initialize();

  const health = await kg.healthCheck();
  if (health.status !== 'healthy') {
    throw new Error('Services not ready');
  }

  return kg;
}
```

## Query Statistics

### Performance Monitoring

```typescript
const result = await kg.ask('Who works for companies?', {
  includeStats: true,
});

if (result.statistics) {
  console.log(`Query Performance:`);
  console.log(`  Total time: ${result.statistics.totalTimeMs}ms`);
  console.log(`  Search: ${result.statistics.searchTimeMs}ms`);
  console.log(`  Subgraph retrieval: ${result.statistics.subgraphRetrievalTimeMs}ms`);
  console.log(`  LLM generation: ${result.statistics.llmGenerationTimeMs}ms`);
  console.log(`  Found: ${result.statistics.entitiesFound} entities, ${result.statistics.relationshipsFound} relationships`);
}
```

### Optimizing Query Performance

```typescript
// Compare different strategies
const strategies: QueryStrategy[] = ['documents', 'entities', 'both'];

for (const strategy of strategies) {
  const result = await kg.ask('Who works for companies?', {
    strategy,
    includeStats: true,
  });
  console.log(`${strategy}: ${result.statistics?.totalTimeMs}ms`);
}
```

## Graph Management

### Finding Entities, Relationships, and Documents

```typescript
// Find entity by ID
const entity = await kg.findEntity('entity-123');
if (entity) {
  console.log(`Found: ${entity.label} - ${entity.properties.name}`);
}

// Find relationship by ID
const relationship = await kg.findRelationship('rel-456');
if (relationship) {
  console.log(`${relationship.type}: ${relationship.from} -> ${relationship.to}`);
}

// Find document by ID
const document = await kg.findDocument('doc-789');
if (document) {
  console.log(`Document text: ${document.properties.text.substring(0, 100)}...`);
}
```

### Deleting Entities

```typescript
// Delete an entity (cascade deletes relationships)
const result = await kg.deleteEntity('entity-123');

if (result.deleted) {
  console.log(`✅ Entity deleted`);
  console.log(`   Removed ${result.relatedRelationshipsDeleted} relationships`);
} else {
  console.error(`❌ Failed: ${result.message}`);
}
```

### Deleting Relationships

```typescript
// Delete a specific relationship
const result = await kg.deleteRelationship('rel-456');

if (result.deleted) {
  console.log('✅ Relationship deleted');
} else {
  console.error(`❌ Failed: ${result.message}`);
}
```

### Deleting Documents

```typescript
// Delete a document (cascade deletes CONTAINS_ENTITY relationships)
const result = await kg.deleteDocument('doc-789');

if (result.deleted) {
  console.log(`✅ Document deleted`);
  console.log(`   Removed ${result.relatedRelationshipsDeleted} entity links`);
} else {
  console.error(`❌ Failed: ${result.message}`);
}
```

### Complete Workflow: Create, Find, Delete

```typescript
// 1. Learn from text (creates entities, relationships, document)
const learnResult = await kg.learn('Alice works for Acme Corp.');

// 2. Find the created entity
const entity = await kg.findEntity(learnResult.entities[0].id);
console.log('Created entity:', entity?.properties.name);

// 3. Find the created relationship
const relationship = await kg.findRelationship(learnResult.relationships[0].id);
console.log('Created relationship:', relationship?.type);

// 4. Find the created document
const document = await kg.findDocument(learnResult.document.id);
console.log('Created document:', document?.properties.text.substring(0, 50));

// 5. Delete the entity (cascade deletes relationships)
const deleteResult = await kg.deleteEntity(learnResult.entities[0].id);
console.log('Delete result:', deleteResult.deleted);

// 6. Verify deletion
const foundAfter = await kg.findEntity(learnResult.entities[0].id);
console.log('Entity still exists?', foundAfter !== null); // false
```

### Scope Isolation in Delete Operations

```typescript
// Create entity in scope1
const kg1 = akasha({
  database: { /* ... */ },
  scope: { id: 'scope1', type: 'project', name: 'Project 1' },
});
await kg1.initialize();

const learnResult = await kg1.learn('Alice works for Acme Corp.');
const entityId = learnResult.entities[0].id;

// Try to delete from scope2 (will fail - entity not found)
const kg2 = akasha({
  neo4j: { /* ... */ },
  scope: { id: 'scope2', type: 'project', name: 'Project 2' },
});
await kg2.initialize();

const deleteResult = await kg2.deleteEntity(entityId);
console.log(deleteResult.deleted); // false
console.log(deleteResult.message); // "Entity with id ... not found"

// Entity still exists in scope1
const found = await kg1.findEntity(entityId);
console.log(found !== null); // true
```

### Updating Entities

```typescript
// Update entity properties
const updated = await kg.updateEntity('entity-123', {
  properties: {
    name: 'Alice Updated',
    age: 30,
    role: 'Senior Engineer',
  },
});

console.log(`✅ Updated: ${updated.properties.name}`);
console.log(`   Age: ${updated.properties.age}`);
console.log(`   Role: ${updated.properties.role}`);
```

### Updating Relationships

```typescript
// Update relationship properties
const updated = await kg.updateRelationship('rel-456', {
  properties: {
    since: '2019-01-01',
    role: 'Manager',
    department: 'Engineering',
  },
});

console.log(`✅ Updated relationship: ${updated.type}`);
console.log(`   Since: ${updated.properties.since}`);
```

### Updating Documents

```typescript
// Update document metadata (text cannot be changed)
const updated = await kg.updateDocument('doc-789', {
  properties: {
    metadata: {
      source: 'updated-source',
      author: 'Test Author',
      version: 2,
    },
  },
});

console.log(`✅ Updated document metadata`);
console.log(`   Text unchanged: ${updated.properties.text.substring(0, 50)}...`);
console.log(`   Metadata: ${JSON.stringify(updated.properties.metadata)}`);
```

### System Metadata Protection

```typescript
// Attempting to update system metadata is automatically filtered out
const entity = await kg.learn('Alice works for Acme Corp.');
const entityId = entity.entities[0].id;

const originalRecordedAt = entity.entities[0].properties._recordedAt;
const originalScopeId = entity.entities[0].properties.scopeId;

// Try to update system metadata (will be ignored)
const updated = await kg.updateEntity(entityId, {
  properties: {
    name: 'Alice Updated',
    _recordedAt: '2020-01-01', // ❌ Ignored
    _validFrom: '2020-01-01',  // ❌ Ignored
    scopeId: 'different-scope', // ❌ Ignored
  },
});

// System metadata unchanged
console.log(updated.properties._recordedAt === originalRecordedAt); // true
console.log(updated.properties.scopeId === originalScopeId); // true

// Regular property updated
console.log(updated.properties.name); // 'Alice Updated'
```

### Complete Workflow: Create, Update, Delete

```typescript
// 1. Create entity
const learnResult = await kg.learn('Alice works for Acme Corp.');
const entityId = learnResult.entities[0].id;

// 2. Find and verify
const found = await kg.findEntity(entityId);
console.log('Created:', found?.properties.name);

// 3. Update entity
const updated = await kg.updateEntity(entityId, {
  properties: { name: 'Alice Updated', age: 30 },
});
console.log('Updated:', updated.properties.name);

// 4. Verify update
const foundAfter = await kg.findEntity(entityId);
console.log('After update:', foundAfter?.properties.name); // 'Alice Updated'

// 5. Delete entity
const deleteResult = await kg.deleteEntity(entityId);
console.log('Deleted:', deleteResult.deleted);

// 6. Verify deletion
const foundAfterDelete = await kg.findEntity(entityId);
console.log('Still exists?', foundAfterDelete !== null); // false
```

### Scope Isolation in Update Operations

```typescript
// Create entity in scope1
const kg1 = akasha({
  database: { /* ... */ },
  scope: { id: 'scope1', type: 'project', name: 'Project 1' },
});
await kg1.initialize();

const learnResult = await kg1.learn('Alice works for Acme Corp.');
const entityId = learnResult.entities[0].id;

// Try to update from scope2 (will fail - entity not found)
const kg2 = akasha({
  neo4j: { /* ... */ },
  scope: { id: 'scope2', type: 'project', name: 'Project 2' },
});
await kg2.initialize();

try {
  await kg2.updateEntity(entityId, { properties: { name: 'Updated' } });
} catch (error) {
  console.log('Update failed:', error.message); // "Entity with id ... not found"
}

// Entity unchanged in scope1
const found = await kg1.findEntity(entityId);
console.log(found?.properties.name); // Original name
```

## Direct Graph Queries

### Listing Entities

```typescript
// List all entities
const allEntities = await kg.listEntities();
console.log(`Found ${allEntities.length} entities`);

// Filter by label
const people = await kg.listEntities({ label: 'Person' });
console.log(`Found ${people.length} people`);

// Pagination
const page1 = await kg.listEntities({ limit: 50, offset: 0 });
const page2 = await kg.listEntities({ limit: 50, offset: 50 });
console.log(`Page 1: ${page1.length}, Page 2: ${page2.length}`);
```

### Listing Relationships

```typescript
// List all relationships
const allRels = await kg.listRelationships();
console.log(`Found ${allRels.length} relationships`);

// Filter by type
const worksForRels = await kg.listRelationships({ type: 'WORKS_FOR' });
console.log(`Found ${worksForRels.length} WORKS_FOR relationships`);

// Filter by source entity
const fromEntity = await kg.listRelationships({ fromId: 'entity-123' });
console.log(`Found ${fromEntity.length} relationships from entity-123`);

// Filter by target entity
const toEntity = await kg.listRelationships({ toId: 'entity-456' });
console.log(`Found ${toEntity.length} relationships to entity-456`);

// Combine filters
const specific = await kg.listRelationships({
  type: 'WORKS_FOR',
  fromId: 'entity-123',
  limit: 10,
});
```

### Listing Documents

```typescript
// List all documents
const allDocs = await kg.listDocuments();
console.log(`Found ${allDocs.length} documents`);

// Pagination
const page1 = await kg.listDocuments({ limit: 20, offset: 0 });
const page2 = await kg.listDocuments({ limit: 20, offset: 20 });
console.log(`Page 1: ${page1.length}, Page 2: ${page2.length}`);
```

### Complete Workflow: Create, List, Find, Update, Delete

```typescript
// 1. Create entities
await kg.learn('Alice works for Acme Corp.');
await kg.learn('Bob works for TechCorp.');

// 2. List all entities
const entities = await kg.listEntities();
console.log(`Total entities: ${entities.length}`);

// 3. Filter entities by label
const people = await kg.listEntities({ label: 'Person' });
console.log(`People: ${people.length}`);

// 4. List relationships
const relationships = await kg.listRelationships();
console.log(`Total relationships: ${relationships.length}`);

// 5. Find specific entity
const alice = entities.find(e => e.properties.name === 'Alice');
if (alice) {
  const found = await kg.findEntity(alice.id);
  console.log(`Found: ${found?.properties.name}`);
}

// 6. Update entity
if (alice) {
  const updated = await kg.updateEntity(alice.id, {
    properties: { age: 30 },
  });
  console.log(`Updated: ${updated.properties.age}`);
}

// 7. Delete entity
if (alice) {
  const result = await kg.deleteEntity(alice.id);
  console.log(`Deleted: ${result.deleted}`);
}
```

## Events and Reactivity

### Basic Event Handling

```typescript
// Listen for entity creation
kg.on('entity.created', async (event) => {
  console.log(`New entity: ${event.entity.label}`);
  console.log(`Properties:`, event.entity.properties);
});

// Listen for learning completion
kg.on('learn.completed', (event) => {
  console.log(`Created ${event.result?.created.entities} entities`);
  console.log(`Created ${event.result?.created.relationships} relationships`);
});

// Learn from text - events will be emitted
await kg.learn('Alice works for Acme Corp.');
```

### Entity Enrichment

Enrich entities with additional metadata from external APIs:

```typescript
kg.on('entity.created', async (event) => {
  if (event.entity.label === 'Company') {
    const companyName = event.entity.properties.name as string;
    
    // Fetch additional data
    const companyData = await fetch(`https://api.example.com/companies/${companyName}`)
      .then(res => res.json());
    
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
// Entity will be automatically enriched
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

// Report metrics periodically
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

### Batch Progress Tracking

Monitor batch learning progress:

```typescript
kg.on('batch.progress', (event) => {
  if (event.progress) {
    const { current, total, completed, failed } = event.progress;
    const percentage = Math.round((completed / total) * 100);
    console.log(`Progress: ${percentage}% (${completed}/${total} completed)`);
  }
});

kg.on('batch.completed', (event) => {
  if (event.summary) {
    console.log(`Batch complete: ${event.summary.succeeded} succeeded`);
  }
});

await kg.learnBatch([
  'Alice works for Acme Corp.',
  'Bob works for TechCorp.',
  'Charlie works for StartupCo.',
]);
```

### Gap Analysis Watcher

Analyze entities for missing information:

```typescript
kg.on('entity.created', async (event) => {
  if (event.entity.label === 'Person') {
    const gaps = [];
    if (!event.entity.properties.email) gaps.push('email');
    if (!event.entity.properties.phone) gaps.push('phone');
    
    if (gaps.length > 0) {
      // Use LLM to analyze gaps
      const analysis = await analyzeEntityGaps(event.entity, gaps);
      
      if (analysis.confidence > 0.8) {
        // Prompt user to fill gaps
        await promptUser({
          entity: event.entity,
          missingFields: gaps,
        });
      }
    }
  }
});
```

---

**Next**: Review the [API Reference](./api-reference.md) for complete method documentation, or read [Events](./events.md) for comprehensive event system guide.

