# Getting Started with Akasha

This guide will help you set up Akasha and create your first knowledge graph from natural language.

## Prerequisites

- **Bun runtime** (v1.1.26 or later)
- **Neo4j database** (v5.0 or later, with vector index support)
- **OpenAI API key** (for embeddings and LLM responses)

## Installation

Install Akasha using your package manager:

```bash
bun add @glossick/akasha
```

Or with npm:

```bash
npm install @glossick/akasha
```

Then import it in your code:

```typescript
import { akasha } from '@glossick/akasha';
```

## Configuration

Akasha requires three essential components: a Neo4j connection, an OpenAI API key, and optionally a scope for multi-tenancy.

### Basic Configuration

```typescript
import { akasha } from '@glossick/akasha';

const kg = akasha({
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
    database: process.env.NEO4J_DATABASE || 'neo4j',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4', // Optional, defaults to 'gpt-4'
    embeddingModel: 'text-embedding-3-small', // Optional, defaults to 'text-embedding-3-small'
  },
});
```

### With Scope (Multi-Tenancy)

Scopes provide data isolation. Each scope represents a distinct knowledge space:

```typescript
const kg = akasha({
  neo4j: { /* ... */ },
  openai: { /* ... */ },
  scope: {
    id: 'tenant-1',
    type: 'tenant',
    name: 'Tenant 1',
    metadata: { /* optional */ },
  },
});
```

## Initialization

Before using Akasha, you must initialize the connection:

```typescript
await kg.initialize();
```

This connects to Neo4j and ensures the vector index exists for semantic search.

## Your First Knowledge Graph

### Learning from Text

The `learn()` method extracts entities and relationships from natural language:

```typescript
const result = await kg.learn(
  'Alice works for Acme Corp as a software engineer. Bob works for TechCorp. Alice knows Bob from college.',
  {
    contextName: 'Team Introduction',
  }
);

console.log(`Created ${result.created.entities} entities`);
console.log(`Created ${result.created.relationships} relationships`);
```

The text is analyzed, entities are extracted (Alice, Bob, Acme Corp, TechCorp), relationships are identified (WORKS_FOR, KNOWS), and everything is stored in Neo4j with embeddings for semantic search.

### Querying the Knowledge

The `ask()` method queries the knowledge graph semantically:

```typescript
const response = await kg.ask('What is the relationship between Alice and Bob?');

console.log(response.answer);
// "Alice and Bob know each other from college."

console.log(response.context.entities);
// Array of entities used to answer the question

console.log(response.context.relationships);
// Array of relationships traversed
```

The query process:

1. Finds relevant entities using vector similarity
2. Retrieves the subgraph around those entities
3. Formats the context for the LLM
4. Generates an answer based on the graph structure

## Cleanup

When done, close the connection:

```typescript
await kg.cleanup();
```

## Complete Example

```typescript
import { akasha } from '@glossick/akasha';

async function main() {
  const kg = akasha({
    neo4j: {
      uri: 'bolt://localhost:7687',
      user: 'neo4j',
      password: 'password',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
    },
    scope: {
      id: 'example-1',
      type: 'example',
      name: 'Getting Started Example',
    },
  });

  try {
    await kg.initialize();

    // Learn from text
    const learnResult = await kg.learn(
      'Alice works for Acme Corp. Bob works for TechCorp. Alice knows Bob.',
      { contextName: 'Example Context' }
    );

    console.log(`Learned: ${learnResult.created.entities} entities, ${learnResult.created.relationships} relationships`);

    // Query
    const queryResult = await kg.ask('Who works for Acme Corp?');
    console.log(`Answer: ${queryResult.answer}`);

  } finally {
    await kg.cleanup();
  }
}

main();
```

## Next Steps

- Read [Core Concepts](./core-concepts.md) to understand Akasha's architecture
- Explore [Ontologies](./ontologies.md) to customize extraction behavior
- Review [API Reference](./api-reference.md) for detailed method documentation

