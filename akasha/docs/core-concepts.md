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

1. **Document Node Creation**: The input text is stored as a first-class `Document` node in the graph. If the same text already exists, the existing document is reused (deduplication). The document gets an embedding for semantic search and is tagged with the current `contextId` (appended to `contextIds` array if the document already exists).

2. **Text Analysis**: The input text is sent to an LLM with an extraction prompt that defines what entities and relationships to look for.

3. **Entity Extraction**: The LLM identifies entities (people, organizations, concepts) and their properties. Each entity gets a label (Person, Company) and properties (name, age, industry).

4. **Entity Deduplication**: If an entity with the same name already exists, it's reused. The current `contextId` is appended to the entity's `contextIds` array, allowing entities to belong to multiple contexts.

5. **Relationship Extraction**: The LLM identifies relationships between entities. Each relationship has a type (WORKS_FOR, KNOWS) and connects two entities.

6. **Embedding Generation**: Text representations of entities and the document are converted to vector embeddings. These embeddings enable semantic search—finding entities and documents by meaning, not just exact text matches.

7. **Graph Storage**: Documents, entities, and relationships are stored in Neo4j with their embeddings. Documents are linked to entities via `CONTAINS_ENTITY` relationships. The graph structure is preserved, and all data is tagged with a scopeId for isolation.

8. **Context Tracking**: The `contextId` is stored in the document's and entities' `contextIds` arrays, allowing them to belong to multiple contexts simultaneously.

## The Query Process

When you call `ask()`, Akasha performs semantic retrieval based on the selected query strategy:

1. **Query Embedding**: Your question is converted to a vector embedding.

2. **Search Phase** (strategy-dependent):
   - **`'documents'`**: Searches document nodes by vector similarity, then retrieves connected entities via graph traversal
   - **`'entities'`**: Searches entity nodes by vector similarity (original behavior)
   - **`'both'`** (default): Searches both documents and entities, combining results

3. **Context Filtering**: If `contexts` are specified, only documents/entities with at least one matching `contextId` in their `contextIds` array are included. Uses strict filtering: the entity/document must belong to at least one of the specified contexts.

4. **Subgraph Retrieval**: Starting from the found documents/entities, the system traverses the graph to retrieve connected entities and relationships. This builds a context subgraph relevant to your question.

5. **Context Formatting**: The subgraph (including document text when available) is formatted as text, describing documents, entities, and relationships in a way the LLM can understand. Documents are prioritized in the context since they contain full text.

6. **Answer Generation**: The formatted context and your question are sent to the LLM, which generates an answer based on the graph structure and document content.

## Scope and Context

**Scope** represents an isolation boundary. It could be a tenant, a workspace, a project, or any logical grouping. All entities and relationships created within a scope are tagged with that scope's ID, ensuring data isolation.

**Context** represents a knowledge space within a scope. Each text you learn from is associated with a context. Multiple contexts can exist in a scope, allowing you to track different sources of knowledge.

**Important**: Documents and entities can belong to multiple contexts simultaneously. When you learn the same text with different `contextId` values, the document is reused and the new `contextId` is appended to its `contextIds` array. Similarly, entities are reused across documents and accumulate `contextIds` as they appear in different contexts.

For example:
- Scope: "Tenant 1"
  - Context: "Company Handbook" (`contextId: 'handbook-1'`)
  - Context: "Employee Interviews" (`contextId: 'interviews-1'`)
  - Context: "Project Documentation" (`contextId: 'docs-1'`)

A document or entity can belong to multiple contexts:
- Document "Alice works for Acme Corp" might have `contextIds: ['handbook-1', 'interviews-1']`
- Entity "Alice" might have `contextIds: ['handbook-1', 'interviews-1', 'docs-1']`

Queries can filter by context using strict filtering: when you specify `contexts: ['handbook-1']`, only documents and entities that have `'handbook-1'` in their `contextIds` array are included in the search.

## Embeddings and Semantic Search

Embeddings are vector representations of text that capture semantic meaning. Two texts with similar meanings will have similar embeddings, even if they use different words.

Akasha uses embeddings for:
- **Document Search**: Finding documents semantically related to a query (when using `strategy: 'documents'` or `'both'`)
- **Entity Search**: Finding entities semantically related to a query
- **Storage**: Storing embeddings with documents and entities for future searches

By default, embeddings are not included in API responses (they're large arrays). You can request them explicitly with `includeEmbeddings: true`.

## Document Nodes

Documents are first-class nodes in the knowledge graph, not just metadata. This enables:

- **Full Text Retrieval**: Documents contain the complete original text, which is prioritized in LLM context
- **Deduplication**: Same text content = same document node (efficient storage)
- **Multi-Context Tracking**: Documents can belong to multiple contexts via `contextIds` array
- **Semantic Search**: Documents are searchable via vector similarity, just like entities
- **Entity Linking**: Documents are linked to entities via `CONTAINS_ENTITY` relationships

When you learn text, a document node is created (or reused if the text already exists). Entities extracted from that text are linked to the document, creating a clear provenance chain.

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

## Temporal Tracking

Akasha automatically tracks temporal metadata for all learned facts, enabling point-in-time queries and historical reasoning.

**System Metadata Fields:**
- `_recordedAt`: ISO timestamp when the fact was recorded in the system (always automatic)
- `_validFrom`: ISO timestamp when the fact becomes valid (defaults to `_recordedAt` if not specified)
- `_validTo`: ISO timestamp when the fact becomes invalid (optional; if omitted, the fact is ongoing)

**Temporal Learning:**
When you call `learn()`, you can optionally specify `validFrom` and `validTo` to indicate when a fact was or will be true:

```typescript
// Fact valid for a specific period
await kg.learn('Alice worked for Acme Corp.', {
  validFrom: new Date('2024-01-01'),
  validTo: new Date('2024-12-31'),
});

// Ongoing fact (no expiration)
await kg.learn('Bob works for TechCorp.', {
  validFrom: new Date('2024-01-01'),
  // No validTo = ongoing
});
```

**Temporal Querying:**
You can query facts valid at a specific point in time using `validAt`:

```typescript
// Only return facts valid on June 1, 2024
const result = await kg.ask('Who works for companies?', {
  validAt: new Date('2024-06-01'),
});
```

This enables scenarios like:
- "What did we know about Alice in Q2 2024?"
- "Who was working at the company on this date?"
- "What facts were true during this period?"

**Default Behavior:**
- If `validFrom` is not provided, it defaults to `_recordedAt` (current time)
- If `validTo` is not provided, the fact is considered ongoing (no expiration)
- If `validAt` is not provided in queries, all facts are returned regardless of validity period

This temporal tracking aligns with Akasha's "map is not the territory" axiom: facts are recorded at a specific time (`_recordedAt`), but they may represent knowledge that was true at different times (`_validFrom`/`_validTo`).

---

**Next**: Read [API Reference](./api-reference.md) for detailed method documentation, or [Ontologies](./ontologies.md) to customize extraction behavior.

