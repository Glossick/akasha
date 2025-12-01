# Akasha

Transform text into knowledge graphs. Query by meaning, not keywords.

> **⚠️ Runtime Requirement**: Akasha currently requires the [Bun](https://bun.sh) runtime (v1.1.26 or later). Node.js compatibility is in progress.

```bash
bun add @glossick/akasha
```

## What if your application could understand?

```typescript
import { akasha } from '@glossick/akasha';

// Mix and match providers - OpenAI embeddings with Anthropic LLM
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
      type: 'anthropic', // or 'openai', 'deepseek'
      config: {
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: 'claude-3-5-sonnet-20241022',
      },
    },
  },
  scope: {
    id: 'my-project',
    type: 'project',
    name: 'My Project',
  },
});

await kg.initialize();

// Feed it knowledge
await kg.learn('Alice works for Acme Corp. Bob works for TechCorp. Alice knows Bob.');

// Ask anything
const result = await kg.ask('What is the relationship between Alice and Bob?');
console.log(result.answer);
```

## React to knowledge as it forms

```typescript
// Watch the graph grow
kg.on('entity.created', async (event) => {
  if (event.entity.label === 'Company') {
    // Enrich automatically
    const data = await fetchCompanyData(event.entity.properties.name);
    await kg.updateEntity(event.entity.id, { properties: data });
  }
});

// Track what matters
kg.on('relationship.created', (event) => {
  analytics.track('relationship_created', {
    type: event.relationship.type,
    scope: event.scopeId,
  });
});

// Build reactive workflows
kg.on('learn.completed', async (event) => {
  await notifyTeam(event.result?.entities.length);
  await updateDashboard(event.result);
});
```

## Query across time and context

```typescript
// What was true then?
const historical = await kg.ask('Who worked at Acme Corp?', {
  validAt: new Date('2023-01-01'),
});

// What's true now?
const current = await kg.ask('Who works at Acme Corp?');

// Search specific knowledge sources
const handbook = await kg.ask('What is company policy?', {
  contexts: ['handbook'],
});

// Combine multiple sources
const comprehensive = await kg.ask('What do we know about Alice?', {
  contexts: ['handbook', 'interviews', 'meetings'],
});
```

## Define your own reality

```typescript
const customOntology = {
  entityTypes: [
    {
      label: 'Customer',
      description: 'A customer who makes purchases',
      requiredProperties: ['email', 'name'],
    },
    {
      label: 'Product',
      description: 'A product for sale',
      requiredProperties: ['sku', 'name'],
    },
  ],
  relationshipTypes: [
    {
      type: 'PURCHASED',
      description: 'Customer purchased a product',
      from: ['Customer'],
      to: ['Product'],
    },
  ],
};

const kg = akasha({
  database: { /* ... */ },
  extractionPrompt: customOntology,
});

// Now it understands your domain
await kg.learn('John Doe purchased an iPhone 15.');
```

## Isolate. Scale. Deploy.

```typescript
// Each tenant gets their own knowledge space
function createTenantKG(tenantId: string) {
  return akasha({
    database: { /* ... */ },
    providers: {
      embedding: {
        type: 'openai',
        config: {
          apiKey: process.env.OPENAI_API_KEY!,
          model: 'text-embedding-3-small',
        },
      },
      llm: {
        type: 'deepseek', // Cost-effective option
        config: {
          apiKey: process.env.DEEPSEEK_API_KEY!,
          model: 'deepseek-chat',
        },
      },
    },
    scope: {
      id: `tenant-${tenantId}`,
      type: 'tenant',
      name: `Tenant ${tenantId}`,
    },
  });
}

// Process thousands of documents
await kg.learnBatch(documents, {
  onProgress: (progress) => {
    console.log(`${progress.completed}/${progress.total} processed`);
  },
});
```

## Features

- **Semantic Search** - Find by meaning, not keywords
- **Event System** - React to graph changes in real-time
- **Multi-Tenancy** - Isolated knowledge spaces
- **Temporal Queries** - Ask "what was true then?"
- **Custom Ontologies** - Define your domain
- **Batch Processing** - Scale to millions of documents
- **Type-Safe** - Full TypeScript support

## Requirements

- **Bun runtime** (v1.1.26+) - Required
- **Database**: Neo4j (v5.0+) or LadybugDB (via `lbug` package)
- **Provider API Keys**:
  - **Embeddings**: OpenAI (required) - ⚠️ Only OpenAI is supported for embeddings
  - **LLM**: OpenAI, Anthropic, or DeepSeek (choose one)

## Documentation

- [Getting Started](https://github.com/Glossick/akasha/blob/HEAD/akasha/docs/getting-started.md) - Set up in minutes
- [Core Concepts](https://github.com/Glossick/akasha/blob/HEAD/akasha/docs/core-concepts.md) - How it works
- [Events](https://github.com/Glossick/akasha/blob/HEAD/akasha/docs/events.md) - Build reactive systems
- [Examples](https://github.com/Glossick/akasha/blob/HEAD/akasha/docs/examples.md) - Patterns and use cases
- [API Reference](https://github.com/Glossick/akasha/blob/HEAD/akasha/docs/api-reference.md) - Complete API docs

## License

Apache License 2.0
