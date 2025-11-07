# Design Principles

This document outlines the key design principles that guide Akasha's architecture and API decisions.

## Simplicity

The API is minimal—`learn()` and `ask()`. Complex operations are hidden behind simple interfaces. You don't need to understand graph databases, vector embeddings, or LLM prompting to use Akasha effectively.

## Flexibility

**Ontological Customization**: The template system allows you to define custom ontologies. Implement substance ontology, process ontology, relational ontology, or domain-specific ontologies through extraction prompt templates.

**Multi-Tenancy**: The scope system enables data isolation for multi-tenant applications, workspaces, or projects.

**Semantic Search**: The embedding system enables semantic search—finding content by meaning, not just exact text matches.

## Transparency

Responses include the context used to generate answers. You can see which entities, relationships, and documents informed the response, enabling you to verify and understand the reasoning.

## Efficiency

Performance considerations are built in:
- Single Neo4j connection pool
- Scope filtering at query time (not storage level)
- Embeddings scrubbed from responses by default
- Document deduplication
- Entity reuse across contexts

## Extensibility

The template system, scope system, and embedding system are all designed for extension. You can implement custom ontologies, multi-tenant patterns, and domain-specific behaviors without modifying the core library.

## How It Works

### Learning Process

When you call `learn()`, Akasha:
1. Creates or reuses a document node for the text
2. Extracts entities and relationships using the LLM and your extraction template
3. Reuses existing entities when possible (deduplication)
4. Generates embeddings for semantic search
5. Stores everything in Neo4j with scope and context tracking

### Query Process

When you call `ask()`, Akasha:
1. Converts your query to an embedding vector
2. Finds relevant documents and entities using vector similarity
3. Traverses the graph to build a context subgraph
4. Formats the subgraph as text for the LLM
5. Generates an answer based on the graph structure

### Embeddings and Semantic Search

Embeddings are vector representations that capture semantic meaning. Texts with similar meanings have similar embeddings, enabling semantic search—finding relevant content by meaning, not just exact text matches.

### Scopes and Contexts

**Scopes** provide data isolation boundaries (tenants, workspaces, projects). All entities and relationships are tagged with a scope ID, and queries automatically filter by scope.

**Contexts** represent knowledge sources within a scope. Each text you learn from is associated with a context. Documents and entities can belong to multiple contexts simultaneously, tracked via `contextIds` arrays.

### Template System

The extraction prompt template defines your ontology—what entities and relationships to extract, how to format them, and what constraints apply. This allows you to customize extraction behavior without changing the underlying system.

## GraphRAG Pattern

Akasha implements the GraphRAG pattern: extracting structured knowledge from text, storing it in a graph database, and using semantic search to retrieve relevant context for LLM-based question answering. This combines the benefits of structured knowledge graphs with the flexibility of semantic search.

Key capabilities:
- Semantic search over knowledge graphs
- Multi-tenant knowledge spaces
- Domain-specific ontologies
- Process-oriented knowledge representation
- Temporal fact tracking

---

**Next**: Read [Core Concepts](./core-concepts.md) for technical details, or [Getting Started](./getting-started.md) to begin using Akasha.
