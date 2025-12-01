# Getting Started with Akasha

This guide will help you set up Akasha and create your first knowledge graph from natural language.

## Prerequisites

- **Bun runtime** (v1.1.26 or later) - **Required**
  - ⚠️ **Note**: Akasha currently requires Bun as the runtime. Node.js compatibility is in progress.
  - You can install the package via npm, but you must run your code with Bun.
- **Database** (choose one):
  - **Neo4j** (v5.0 or later, with vector index support) - Server-based, production-ready
  - **LadybugDB** (via `lbug` package) - Embedded, no server required
- **API Keys** (at least one of):
  - **OpenAI API key** - Required for embeddings (⚠️ **Only OpenAI is supported for embeddings**), can also be used for LLM
  - **Anthropic API key** - Optional, for Claude LLM models
  - **DeepSeek API key** - Optional, for cost-effective DeepSeek LLM models

## Installation

Install Akasha using your package manager:

```bash
bun add @glossick/akasha
```

Or with npm (package can be installed, but requires Bun runtime):

```bash
npm install @glossick/akasha
```

**Important**: While the package can be installed via npm, Akasha currently requires the Bun runtime to execute. Node.js compatibility is being worked on.

Then import it in your code:

```typescript
import { akasha } from '@glossick/akasha';
```

## Choosing a Database

Akasha supports two database backends:

### Neo4j
- **Best for:** Production environments, multi-user applications, existing Neo4j infrastructure
- **Setup:** Requires Neo4j server running (local or cloud)
- **Installation:** Download from [neo4j.com](https://neo4j.com/download/)
- **Connection:** Uses Bolt protocol (`bolt://localhost:7687`)

### LadybugDB
- **Best for:** Development, single-user applications, embedded deployments, edge computing
- **Setup:** No server required - embedded database
- **Installation:** `bun add lbug` or `npm install lbug`
- **Connection:** Uses file path (e.g., `'./my-database'`)

**Example with LadybugDB:**
```typescript
const kg = akasha({
  database: {
    type: 'ladybug',
    config: {
      databasePath: './my-kg-database',
    },
  },
  providers: { /* ... */ },
});
```

## Configuration

Akasha requires three essential components: a database connection, provider configuration, and optionally a scope for multi-tenancy.

### Basic Configuration (Neo4j)

```typescript
import { akasha } from '@glossick/akasha';

const kg = akasha({
  database: {
    type: 'neo4j',
    config: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      user: process.env.NEO4J_USER || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password',
      database: process.env.NEO4J_DATABASE || 'neo4j',
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
```

### Basic Configuration (LadybugDB)

```typescript
import { akasha } from '@glossick/akasha';

const kg = akasha({
  database: {
    type: 'ladybug',
    config: {
      databasePath: process.env.LADYBUG_DATABASE_PATH || './my-kg-database',
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
```

### With Scope (Multi-Tenancy)

Scopes provide data isolation. Each scope represents a distinct knowledge space:

```typescript
const kg = akasha({
  database: { /* ... */ },
  providers: { /* ... */ },
  scope: {
    id: 'tenant-1',
    type: 'tenant',
    name: 'Tenant 1',
    metadata: { /* optional */ },
  },
});
```

### Using Anthropic LLM

Mix OpenAI embeddings with Anthropic's Claude for LLM:

```typescript
const kg = akasha({
  neo4j: { /* ... */ },
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'text-embedding-3-small',
      },
    },
    llm: {
      type: 'anthropic',
      config: {
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: 'claude-3-5-sonnet-20241022',
      },
    },
  },
});
```

## Initialization

Before using Akasha, you must initialize the connection:

```typescript
await kg.initialize();
```

This connects to the database and ensures the vector index exists for semantic search.

## Your First Knowledge Graph

### Learning from Text

The `learn()` method creates a document node, extracts entities and relationships from natural language, and links them together:

```typescript
const result = await kg.learn(
  'Alice works for Acme Corp as a software engineer. Bob works for TechCorp. Alice knows Bob from college.',
  {
    contextName: 'Team Introduction',
  }
);

console.log(`Document: ${result.document.id} (${result.created.document === 1 ? 'created' : 'reused'})`);
console.log(`Created ${result.created.entities} entities`);
console.log(`Created ${result.created.relationships} relationships`);
```

The process:
1. **Document Creation**: The text is stored as a `Document` node (or reused if the same text already exists)
2. **Entity Extraction**: Entities are extracted (Alice, Bob, Acme Corp, TechCorp)
3. **Relationship Extraction**: Relationships are identified (WORKS_FOR, KNOWS)
4. **Linking**: Entities are linked to the document via `CONTAINS_ENTITY` relationships
5. **Storage**: Everything is stored in Neo4j with embeddings for semantic search

### Querying the Knowledge

The `ask()` method queries the knowledge graph semantically:

```typescript
const response = await kg.ask('What is the relationship between Alice and Bob?');

console.log(response.answer);
// "Alice and Bob know each other from college."

console.log(response.context.documents);
// Array of document nodes found (if strategy includes documents)

console.log(response.context.entities);
// Array of entities used to answer the question

console.log(response.context.relationships);
// Array of relationships traversed
```

The query process (default strategy: `'both'`):

1. Finds relevant documents and entities using vector similarity
2. Retrieves the subgraph around those documents/entities
3. Formats the context for the LLM (documents are prioritized since they contain full text)
4. Generates an answer based on the graph structure and document content

You can customize the query strategy:
- `strategy: 'documents'` - Search document nodes first, then connected entities
- `strategy: 'entities'` - Search entity nodes only (original behavior)
- `strategy: 'both'` - Search both documents and entities (default)

You can also control relevance filtering:
- `similarityThreshold: 0.7` - Minimum similarity score (default: `0.7`). Only results above this threshold are returned. Use higher values (e.g., `0.8`, `0.9`) for stricter filtering, or lower values (e.g., `0.5`, `0.6`) for more permissive results.

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

    console.log(`Document: ${learnResult.document.id}`);
    console.log(`Learned: ${learnResult.created.entities} entities, ${learnResult.created.relationships} relationships`);

    // Query (default: searches both documents and entities)
    const queryResult = await kg.ask('Who works for Acme Corp?');
    console.log(`Answer: ${queryResult.answer}`);
    console.log(`Found ${queryResult.context.documents?.length || 0} documents`);
    console.log(`Found ${queryResult.context.entities.length} entities`);

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

