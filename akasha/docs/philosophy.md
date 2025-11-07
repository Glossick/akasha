# The Philosophy of Akasha

This document explores the conceptual foundations of Akasha—why it exists, how it thinks about knowledge, and what principles guide its design.

## Knowledge as Structure

Traditional databases store facts. Knowledge graphs store understanding. The difference lies in relationships.

Consider two statements:
- "Alice works for Acme Corp"
- "Bob works for TechCorp"

Stored separately, these are isolated facts. Connected through relationships—Alice KNOWS Bob, Acme Corp PARTNERS_WITH TechCorp—they form a structure that enables reasoning.

Akasha recognizes that knowledge emerges from structure. An entity alone is data; an entity connected to other entities becomes knowledge. The graph is not merely a storage format—it is the medium through which meaning flows.

## Semantic Over Syntax

Many search systems match strings. You search for "Alice" and find documents containing "Alice". This works, but it's brittle. Misspellings break it. Synonyms break it. Context breaks it.

Akasha uses semantic search via embeddings. The query "Who collaborates with Alice?" finds entities related to Alice semantically, even if the exact phrase "collaborates with" never appears in the stored text. This is possible because embeddings capture semantic similarity—texts with similar meanings have similar vector representations.

This semantic approach enables more natural interaction. You ask questions as you would ask a colleague, not as you would query a database.

## Ontological Flexibility

Different domains require different ways of understanding. A software project might think in terms of processes: development, testing, deployment. A product catalog might think in terms of entities: products, categories, suppliers.

Many GraphRAG systems use fixed ontological models. Akasha allows you to define your own through extraction prompt templates, enabling you to implement substance ontology, process ontology, relational ontology, or domain-specific ontologies.

This flexibility acknowledges that reality resists single frameworks. What works for one domain may not work for another. Akasha provides the mechanism; you provide the perspective.

## Scope as Semantic Boundary

Knowledge exists in contexts. A tenant's data, a project's documentation, a user's notes—each represents a distinct semantic space. These spaces can be isolated (multi-tenant SaaS) or connected (cross-project collaboration).

Akasha implements this through scopes. A scope is not just a data partition—it is a semantic boundary. Entities within a scope form a coherent knowledge space. Queries within a scope explore that space. Relationships within a scope connect entities meaningfully.

This design reflects how we actually think about knowledge. We don't have one monolithic knowledge base; we have many knowledge spaces that sometimes overlap, sometimes remain separate. Scopes make this explicit.

## The Learning Process

When you call `learn()`, Akasha performs a transformation: unstructured text becomes structured knowledge. This transformation involves several steps, each with philosophical implications.

**Extraction** is interpretation. The LLM reads your text and interprets it according to the ontology you've defined. This is not mechanical parsing—it requires understanding context, resolving ambiguity, making inferences.

**Embedding** is abstraction. Text becomes vectors—high-dimensional representations that capture meaning. Two texts with similar meanings have similar embeddings, even if they use different words. This abstraction enables semantic search.

**Storage** is preservation. Entities and relationships are stored in Neo4j, preserving both structure and meaning. The graph structure encodes relationships explicitly; embeddings encode semantic meaning.

**Context** is provenance. Each learning operation creates a context that records the source. This enables you to track where knowledge came from, query specific sources, and understand the lineage of information.

## The Query Process

When you call `ask()`, Akasha performs semantic retrieval: finding relevant knowledge and synthesizing an answer.

**Vector Search** finds entities semantically related to your question. This is not keyword matching—it's meaning matching. The query "Who works with Alice?" finds entities related to collaboration, even if the word "works" doesn't appear.

**Graph Traversal** explores relationships. Starting from found entities, the system traverses the graph to build a context subgraph. This subgraph represents the relevant knowledge space for your question.

**Context Formatting** translates graph structure into language. Entities and relationships are described in natural language, creating a context that the LLM can understand and reason about.

**Answer Generation** synthesizes understanding. The LLM receives your question and the formatted context, then generates an answer based on the graph structure. This is not retrieval—it's reasoning over structure.

## Embeddings as Semantic Coordinates

Embeddings are vector representations of text that capture semantic meaning. Think of them as coordinates in semantic space. Texts with similar meanings are close together; texts with different meanings are far apart.

This spatial metaphor helps understand how Akasha works. When you query "Who works with Alice?", the system:
1. Converts the query to coordinates in semantic space
2. Finds entities whose coordinates are nearby
3. Explores the graph structure around those entities
4. Synthesizes an answer from the discovered structure

The embedding space is not arbitrary—it's learned from vast amounts of text, capturing patterns of meaning that emerge from language use. Akasha leverages this learned space to enable semantic search.

## Multi-Tenancy as Semantic Isolation

Multi-tenancy in Akasha is not just data isolation—it's semantic isolation. Each scope represents a distinct knowledge space with its own entities, relationships, and semantic structure.

This design reflects how knowledge actually exists: in bounded contexts. A tenant's knowledge graph is not just a partition of a larger graph—it is a complete semantic space that can be understood independently.

The isolation is enforced at the query level, not the storage level. All scopes share the same Neo4j database, but queries automatically filter by scope. This design prioritizes efficiency and simplicity while maintaining semantic boundaries.

## The Template System

The extraction prompt template is more than configuration—it's an ontological specification. It defines what entities and relationships exist in your domain, how they should be extracted, and what constraints apply.

This system acknowledges that extraction is interpretation. The same text can be interpreted differently depending on the ontology. "Alice started working" could be:
- A process (Process: Working, Participant: Alice)
- An entity (Person: Alice, Company: [inferred])
- An event (Event: Start, Participant: Alice)

The template guides this interpretation, allowing you to implement different ontological paradigms without changing the underlying system.

## Connection to the Namesake

The name "Akasha" derives from Sanskrit, meaning "aether" or "space"—the foundational essence that connects all things. In various traditions, Akasha represents the medium through which information flows, the space in which knowledge exists.

This library embodies that concept. Akasha serves as the connective medium between language and knowledge, between questions and answers, between data and understanding. It creates a space—the knowledge graph—in which information gains structure and meaning through relationships.

The graph is not just a data structure; it is a semantic space. Entities exist in this space, connected by relationships that encode meaning. Queries navigate this space semantically, finding paths through the structure. Answers emerge from the relationships, not just from isolated facts.

## Design Principles

Several principles guide Akasha's design:

**Simplicity**: The API is minimal—`learn()` and `ask()`. Complex operations are hidden behind simple interfaces.

**Flexibility**: The template system allows ontological customization. The scope system allows multi-tenancy. The embedding system allows semantic search.

**Transparency**: Responses include the context used to generate answers. You can see which entities and relationships informed the response.

**Efficiency**: Single connection pool, scope filtering at query time, embedding scrubbing by default. Performance considerations are built in.

**Extensibility**: The template system, scope system, and embedding system are all designed for extension. You can implement custom ontologies, multi-tenant patterns, and domain-specific behaviors.

## GraphRAG as a Pattern

Akasha implements the GraphRAG pattern: extracting structured knowledge from text, storing it in a graph database, and using semantic search to retrieve relevant context for LLM-based question answering. This approach combines the benefits of structured knowledge graphs with the flexibility of semantic search.

Key capabilities include: semantic search over knowledge graphs, multi-tenant knowledge spaces, domain-specific ontologies, and process-oriented knowledge representation. These features enable working with knowledge as it exists: connected, contextual, and semantic.

---

**Next**: Read [Core Concepts](./core-concepts.md) for technical details, or [Getting Started](./getting-started.md) to begin using Akasha.

