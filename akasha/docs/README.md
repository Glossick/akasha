# Akasha Documentation

Akasha is a minimal, developer-friendly GraphRAG library that transforms natural language into structured knowledge graphs and enables semantic querying over that knowledge.

## Navigation

- [Getting Started](./getting-started.md) - Quick start guide
- [Core Concepts](./core-concepts.md) - Understanding Akasha's architecture
- [Philosophy](./philosophy.md) - Conceptual foundations and design principles
- [API Reference](./api-reference.md) - Complete API documentation
- [Ontologies](./ontologies.md) - Working with custom ontologies
- [Multi-Tenancy](./multi-tenancy.md) - Scope and context management
- [Examples](./examples.md) - Practical examples and patterns

---

## What is Akasha?

Akasha bridges the gap between unstructured text and structured knowledge. It extracts entities and relationships from natural language, stores them in a graph database, and enables semantic queries that traverse those relationships.

The name "Akasha" derives from Sanskrit, meaning "aether" or "space"—the foundational essence that connects all things. In this library, Akasha serves as the connective medium between language and knowledge, between questions and answers, between data and understanding.

## Core Philosophy

Akasha operates on a few fundamental principles:

**Knowledge as Structure**: Information gains meaning through relationships. A person alone is data; a person connected to a company, a project, and other people becomes knowledge.

**Semantic Over Syntax**: We query by meaning, not by exact string matching. "Who works with Alice?" and "What are Alice's colleagues?" should yield the same results.

**Ontological Flexibility**: Different domains require different ways of understanding. A process ontology suits workflows; a substance ontology suits entities. Akasha accommodates both.

**Scope as Boundary**: Knowledge exists in contexts. A tenant's data, a project's documents, a user's notes—each has its own semantic space that can be isolated or connected as needed.

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
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
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
