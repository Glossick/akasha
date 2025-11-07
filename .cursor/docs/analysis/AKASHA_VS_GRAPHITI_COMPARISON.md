# Akasha vs Graphiti: Internal Comparison

**Note**: This document is for internal understanding only. It is not published in user-facing documentation and does not mention Graphiti in any public-facing materials.

## Overview

This document compares Akasha (our implementation) with Graphiti (the framework we evaluated before building Akasha). The purpose is to understand architectural differences, design decisions, and trade-offs.

## High-Level Architecture

### Graphiti (Python Framework)
- **Language**: Python
- **Framework Type**: Full-featured GraphRAG framework with server capabilities
- **Architecture**: Likely includes server components, API endpoints, and client libraries
- **Database**: Unknown (likely supports multiple graph databases)

### Akasha (TypeScript/JavaScript Library)
- **Language**: TypeScript/JavaScript (Bun runtime)
- **Framework Type**: Minimal library focused on core GraphRAG operations
- **Architecture**: Library-based, designed to be embedded in applications
- **Database**: Neo4j (explicit requirement)

## Core Operations

### Graphiti
Based on typical GraphRAG frameworks, likely provides:
- Text extraction to graph
- Entity and relationship extraction
- Semantic search capabilities
- Query/answer generation
- Server API for remote access

### Akasha
Provides two core methods:
- `learn(text, options?)`: Extract entities/relationships from text, create document nodes
- `ask(query, options?)`: Semantic query with graph traversal and LLM answer generation

## Key Differences

### 1. **Document Handling**

**Graphiti**: Unknown implementation (likely stores text as metadata or separate storage)

**Akasha**: 
- Documents are **first-class nodes** in the graph
- Full text stored in Document nodes with embeddings
- Document deduplication by text content
- Documents linked to entities via `CONTAINS_ENTITY` relationships
- Documents searchable via vector similarity (query strategy: `'documents'`, `'entities'`, or `'both'`)

### 2. **Multi-Tenancy / Isolation**

**Graphiti**: Unknown (may or may not have built-in multi-tenancy)

**Akasha**:
- **Scope-based isolation**: All entities/documents tagged with `scopeId`
- Query-level filtering (not connection-level)
- Single Neo4j connection pool shared across scopes
- **Context filtering**: Documents/entities can belong to multiple contexts via `contextIds` arrays
- Strict context filtering in queries

### 3. **Entity Deduplication**

**Graphiti**: Unknown implementation

**Akasha**:
- Entities deduplicated by name (same entity name = same entity node)
- Entities accumulate `contextIds` as they appear in different contexts
- Entities can belong to multiple contexts simultaneously

### 4. **Query Strategies**

**Graphiti**: Unknown (likely single search strategy)

**Akasha**:
- **Three query strategies**:
  - `'documents'`: Search document nodes first, then connected entities
  - `'entities'`: Search entity nodes only (original behavior)
  - `'both'`: Search both documents and entities (default)
- Documents prioritized in LLM context (60% of context reserved for documents)

### 5. **Ontology Customization**

**Graphiti**: Likely supports ontology customization (common in GraphRAG frameworks)

**Akasha**:
- **Extraction prompt templates**: Full control over entity/relationship extraction
- Supports substance ontology, process ontology, relational ontology, domain-specific ontologies
- Template defines: entity types, relationship types, constraints, format

### 6. **API Design**

**Graphiti**: 
- Likely server-based with REST/GraphQL API
- Client libraries for Python
- Remote access pattern

**Akasha**:
- **Library-based**: Direct function calls, no server required
- TypeScript/JavaScript native
- Embedded in application code
- Simple API: `learn()` and `ask()`

### 7. **Embedding Management**

**Graphiti**: Unknown (likely includes embeddings)

**Akasha**:
- Embeddings generated for documents and entities
- Embeddings scrubbed from responses by default (reduces payload size)
- Optional `includeEmbeddings: true` to include in responses
- Vector similarity search via Neo4j vector indexes

### 8. **Context Tracking**

**Graphiti**: Unknown (may or may not have context tracking)

**Akasha**:
- **Context metadata**: Each `learn()` operation creates a Context (id, scopeId, name, source)
- **Context IDs on nodes**: Documents and entities have `contextIds` arrays
- **Multi-context support**: Same document/entity can belong to multiple contexts
- **Strict filtering**: Queries can filter by specific contexts

### 9. **Language & Runtime**

**Graphiti**: Python (requires Python runtime)

**Akasha**: TypeScript/JavaScript (Bun runtime, can work with Node.js)

### 10. **Dependencies**

**Graphiti**: Python ecosystem dependencies

**Akasha**:
- Neo4j (required)
- OpenAI API (for embeddings and LLM)
- Bun runtime (or Node.js compatible)

## Design Philosophy Differences

### Graphiti
- Likely designed as a **complete framework** with server capabilities
- May include UI components, admin interfaces, or additional tooling
- Python-first ecosystem

### Akasha
- Designed as a **minimal library** focused on core GraphRAG operations
- No server required—embeds directly in applications
- TypeScript/JavaScript native
- Simplicity: two main methods (`learn()` and `ask()`)
- Flexibility: template system, scope system, query strategies

## Why Build Akasha Instead of Using Graphiti?

Based on the implementation, likely reasons:

1. **Language Preference**: TypeScript/JavaScript vs Python
2. **Architecture Preference**: Library vs framework/server
3. **Document Nodes**: First-class document nodes with deduplication
4. **Query Strategies**: Multiple search strategies (documents, entities, both)
5. **Multi-Tenancy**: Built-in scope-based isolation
6. **Context Filtering**: Granular context tracking with strict filtering
7. **Simplicity**: Minimal API surface (learn/ask)
8. **Control**: Full control over implementation and customization

## Feature Comparison Matrix

| Feature | Graphiti | Akasha |
|---------|----------|--------|
| Language | Python | TypeScript/JavaScript |
| Architecture | Framework/Server | Library |
| Document Nodes | Unknown | First-class nodes |
| Entity Deduplication | Unknown | By name, multi-context |
| Query Strategies | Unknown | 3 strategies (documents/entities/both) |
| Multi-Tenancy | Unknown | Scope-based |
| Context Filtering | Unknown | Strict filtering via contextIds |
| Ontology Customization | Likely | Template-based |
| Embedding Scrubbing | Unknown | Optional (default: scrubbed) |
| Database | Unknown | Neo4j (required) |

## Conclusion

Akasha was built as a minimal, TypeScript-native GraphRAG library with specific design choices:
- First-class document nodes
- Multiple query strategies
- Built-in multi-tenancy
- Granular context filtering
- Simple API (learn/ask)

These choices differentiate it from Graphiti and other GraphRAG frameworks, making it suitable for TypeScript/JavaScript applications that need embedded GraphRAG capabilities without a separate server.

---

**Last Updated**: 2025-01-27  
**Status**: Internal Reference Document

