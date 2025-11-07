# Akasha

A minimal, developer-friendly GraphRAG library that transforms natural language into structured knowledge graphs and enables semantic querying over that knowledge.

> **⚠️ Runtime Requirement**: Akasha currently requires the [Bun](https://bun.sh) runtime (v1.1.26 or later). Node.js compatibility is in progress. The package can be installed via npm, but code must be executed with Bun.

## Installation

```bash
bun add @glossick/akasha
```

Or with npm:

```bash
npm install @glossick/akasha
```

**Note**: While the package can be installed via npm, Akasha currently requires the Bun runtime to execute. Node.js compatibility is being worked on.

## Quick Start

```typescript
import { akasha } from '@glossick/akasha';

const kg = akasha({
  neo4j: {
    uri: 'bolt://localhost:7687',
    user: 'neo4j',
    password: 'password',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  scope: {
    id: 'my-project',
    type: 'project',
    name: 'My Project',
  },
});

await kg.initialize();

// Learn from text
await kg.learn('Alice works for Acme Corp. Bob works for TechCorp. Alice knows Bob.');

// Query the knowledge
const result = await kg.ask('What is the relationship between Alice and Bob?');
console.log(result.answer);

await kg.cleanup();
```

## Features

- **Semantic Search**: Vector-based similarity search for documents and entities
- **Multi-Tenancy**: Scope-based data isolation
- **Document Nodes**: First-class document representation with deduplication
- **Temporal Tracking**: Optional validity periods for facts
- **Batch Learning**: Process multiple texts efficiently
- **Health Checks**: Monitor Neo4j and OpenAI connectivity
- **Query Statistics**: Performance metrics for queries
- **Graph Management**: Create, update, delete, and query entities, relationships, and documents

## Documentation

Full documentation is available in the `docs/` directory:

- [Getting Started](https://github.com/Glossick/akasha/blob/HEAD/akasha/docs/getting-started.md) - Quick start guide
- [Core Concepts](https://github.com/Glossick/akasha/blob/HEAD/akasha/docs/core-concepts.md) - Understanding Akasha's architecture
- [API Reference](https://github.com/Glossick/akasha/blob/HEAD/akasha/docs/api-reference.md) - Complete API documentation
- [Examples](https://github.com/Glossick/akasha/blob/HEAD/akasha/docs/examples.md) - Practical examples and patterns

## Requirements

- **Bun runtime** (v1.1.26 or later) - Required
- **Neo4j database** (v5.0 or later, with vector index support)
- **OpenAI API key** (for embeddings and LLM responses)

## License

Apache License 2.0 - See [LICENSE](./LICENSE) for details.

