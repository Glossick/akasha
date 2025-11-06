# Core Concepts

Understanding Akasha requires familiarity with a few fundamental concepts: how knowledge is represented, how it's extracted, and how it's queried.

## Knowledge as Graph

Akasha represents knowledge as a graph—nodes (entities) connected by edges (relationships). This structure mirrors how we think: concepts relate to other concepts, people connect to organizations, events link to participants.

A simple example:
```
Alice --[WORKS_FOR]--> Acme Corp
Bob --[WORKS_FOR]--> TechCorp
Alice --[KNOWS]--> Bob
```

This graph encodes relationships explicitly. When you ask "Who does Alice know?", the system traverses the KNOWS relationship to find Bob.

## The Learning Process

When you call `learn()`, Akasha performs several steps:

1. **Text Analysis**: The input text is sent to an LLM with an extraction prompt that defines what entities and relationships to look for.

2. **Entity Extraction**: The LLM identifies entities (people, organizations, concepts) and their properties. Each entity gets a label (Person, Company) and properties (name, age, industry).

3. **Relationship Extraction**: The LLM identifies relationships between entities. Each relationship has a type (WORKS_FOR, KNOWS) and connects two entities.

4. **Embedding Generation**: Text representations of entities are converted to vector embeddings. These embeddings enable semantic search—finding entities by meaning, not just exact text matches.

5. **Graph Storage**: Entities and relationships are stored in Neo4j with their embeddings. The graph structure is preserved, and all data is tagged with a scopeId for isolation.

6. **Context Creation**: A Context record is created to track the source of this knowledge. Multiple contexts can exist within a scope, allowing you to track where knowledge came from.

## The Query Process

When you call `ask()`, Akasha performs semantic retrieval:

1. **Query Embedding**: Your question is converted to a vector embedding.

2. **Entity Search**: The system searches for entities whose embeddings are similar to the query embedding. This finds entities semantically related to your question, not just those containing the exact words.

3. **Subgraph Retrieval**: Starting from the found entities, the system traverses the graph to retrieve connected entities and relationships. This builds a context subgraph relevant to your question.

4. **Context Formatting**: The subgraph is formatted as text, describing entities and relationships in a way the LLM can understand.

5. **Answer Generation**: The formatted context and your question are sent to the LLM, which generates an answer based on the graph structure.

## Scope and Context

**Scope** represents an isolation boundary. It could be a tenant, a workspace, a project, or any logical grouping. All entities and relationships created within a scope are tagged with that scope's ID, ensuring data isolation.

**Context** represents a knowledge space within a scope. Each text you learn from creates a context. Multiple contexts can exist in a scope, allowing you to track different sources of knowledge.

For example:
- Scope: "Tenant 1"
  - Context: "Company Handbook"
  - Context: "Employee Interviews"
  - Context: "Project Documentation"

Queries can filter by context, allowing you to ask questions within specific knowledge sources.

## Embeddings and Semantic Search

Embeddings are vector representations of text that capture semantic meaning. Two texts with similar meanings will have similar embeddings, even if they use different words.

Akasha uses embeddings for:
- **Entity Search**: Finding entities semantically related to a query
- **Entity Storage**: Storing embeddings with entities for future searches

By default, embeddings are not included in API responses (they're large arrays). You can request them explicitly with `includeEmbeddings: true`.

## Ontologies and Templates

An ontology defines what entities and relationships exist in your domain. The default ontology is substance-oriented (Person, Company, etc.), but you can define custom ontologies.

Akasha uses **extraction prompt templates** to guide the LLM. The template defines:
- What entity types to extract
- What relationship types to identify
- What constraints apply
- What format to use

By customizing the template, you can implement different ontological paradigms: process ontology, relational ontology, domain-specific ontologies.

## Multi-Tenancy

Akasha supports multi-tenancy through scopes. Each scope is isolated:

- Entities in scope A are invisible to scope B
- Queries in scope A only return entities from scope A
- Relationships cannot cross scope boundaries

This enables scenarios like:
- SaaS applications with per-tenant knowledge graphs
- Multi-project workspaces with isolated data
- User-specific knowledge spaces

## Connection Management

Akasha uses a single Neo4j driver instance with connection pooling. The driver is shared across all operations, and scope filtering happens at the query level, not at the connection level.

This design choice prioritizes:
- **Efficiency**: Single connection pool, no per-scope overhead
- **Simplicity**: No complex connection management
- **Flexibility**: Easy to add new scopes without infrastructure changes

The trade-off is that all scopes share the same database connection. For stronger isolation, you could use separate Akasha instances with different Neo4j databases.

---

**Next**: Read [API Reference](./api-reference.md) for detailed method documentation, or [Ontologies](./ontologies.md) to customize extraction behavior.

