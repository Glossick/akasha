# Examples and Patterns

Practical examples demonstrating common Akasha patterns and use cases.

## Basic Usage

### Simple Knowledge Graph

```typescript
import { akasha } from '@glossick/akasha';

const kg = akasha({
  neo4j: {
    uri: 'bolt://localhost:7687',
    user: 'neo4j',
    password: 'password',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
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
    neo4j: { /* ... */ },
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
  neo4j: { /* ... */ },
  extractionPrompt: ecommerceOntology,
});

await kg.learn('John Doe purchased an iPhone 15. Order #12345 contains iPhone 15.');
```

## Process Ontology

### Workflow Tracking

```typescript
import { processOntologyTemplate } from '../examples/process-ontology';

const kg = akasha({
  neo4j: { /* ... */ },
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

### ElysiaJS Integration

```typescript
import { Elysia } from 'elysia';
import { akasha } from '@glossick/akasha';

const app = new Elysia();
const kg = akasha({ /* ... */ });

await kg.initialize();

app.post('/api/learn', async ({ body }) => {
  const { text, contextName } = body;
  return await kg.learn(text, { contextName });
});

app.post('/api/ask', async ({ body }) => {
  const { query } = body;
  return await kg.ask(query);
});
```

---

**Next**: Review the [API Reference](./api-reference.md) for complete method documentation.

