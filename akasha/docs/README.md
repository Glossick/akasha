# Akasha Documentation

Akasha is a minimal, developer-friendly GraphRAG library that transforms natural language into structured knowledge graphs and enables semantic querying over that knowledge.

> **⚠️ Runtime Requirement**: Akasha currently requires the [Bun](https://bun.sh) runtime (v1.1.26 or later). Node.js compatibility is in progress. The package can be installed via npm, but code must be executed with Bun.

## Navigation

- [Getting Started](./getting-started.md) - Quick start guide
- [Core Concepts](./core-concepts.md) - Understanding Akasha's architecture
- [Providers](./providers.md) - Configuring embedding and LLM providers
- [Design Principles](./philosophy.md) - Design principles and architecture decisions
- [API Reference](./api-reference.md) - Complete API documentation
- [Ontologies](./ontologies.md) - Working with custom ontologies
- [Multi-Tenancy](./multi-tenancy.md) - Scope and context management
- [Examples](./examples.md) - Practical examples and patterns

---

## What is Akasha?

Akasha is a GraphRAG (Graph Retrieval-Augmented Generation) library that extracts entities and relationships from natural language, stores them in a graph database, and enables semantic queries that traverse those relationships.

## Key Features

- **Semantic Search**: Query by meaning, not exact string matching
- **Flexible Ontologies**: Define custom entity and relationship types through templates
- **Multi-Tenancy**: Scope-based data isolation for tenants, workspaces, or projects
- **Document Nodes**: First-class document representation with deduplication
- **Temporal Tracking**: Optional validity periods for facts

## Quick Example

```typescript
import { akasha } from '@glossick/akasha';

const kg = akasha({
  neo4j: {
    uri: 'bolt://localhost:7687',
    user: 'neo4j',
    password: 'password',
  },
  scope: {
    id: 'my-project',
    type: 'project',
    name: 'My Project',
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

// Learn from text
await kg.learn('Alice works for Acme Corp. Bob works for TechCorp. Alice knows Bob.');

// Query the knowledge
const result = await kg.ask('What is the relationship between Alice and Bob?');
console.log(result.answer);

await kg.cleanup();
```

This simple flow—learn, then ask—encapsulates Akasha's purpose: transform text into knowledge, then query that knowledge semantically.

---

**Next Steps**: Read [Getting Started](./getting-started.md) to set up Akasha in your project.
