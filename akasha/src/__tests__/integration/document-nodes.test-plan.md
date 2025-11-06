# Integration Test Plan: Document Nodes

## Overview
Integration tests for document nodes, deduplication, and query strategies using real Neo4j and OpenAI connections.

## Test Scenarios

### 1. Document Node Creation
- **Test**: `should create document node when learning from text`
- **Steps**:
  1. Learn from text "Alice works for Acme Corp."
  2. Verify document node exists in Neo4j with correct text and scopeId
  3. Verify document has embedding
  4. Verify document is linked to entities via CONTAINS_ENTITY relationships

### 2. Document Deduplication
- **Test**: `should deduplicate documents with same text`
- **Steps**:
  1. Learn from text "Hello world"
  2. Learn from same text "Hello world" again
  3. Verify only one document node exists in Neo4j
  4. Verify second learn() returns existing document (created.document = 0)

### 3. Entity-Document Linking
- **Test**: `should link entities to document via CONTAINS_ENTITY`
- **Steps**:
  1. Learn from text "Alice works for Acme Corp."
  2. Verify CONTAINS_ENTITY relationships exist from document to each entity
  3. Verify relationships have correct scopeId

### 4. Entity Deduplication Across Documents
- **Test**: `should deduplicate entities across multiple documents`
- **Steps**:
  1. Learn from "Alice works for Acme Corp."
  2. Learn from "Alice knows Bob." (same entity "Alice")
  3. Verify only one "Alice" entity exists in Neo4j
  4. Verify Alice entity is linked to both documents via CONTAINS_ENTITY

### 5. Query Strategy: Both (Default)
- **Test**: `should search both documents and entities by default`
- **Steps**:
  1. Learn from multiple texts
  2. Query with default strategy (or strategy: 'both')
  3. Verify response includes both documents and entities
  4. Verify answer is generated from combined context

### 6. Query Strategy: Documents Only
- **Test**: `should search only documents when strategy is 'documents'`
- **Steps**:
  1. Learn from multiple texts
  2. Query with strategy: 'documents'
  3. Verify response includes documents but may include entities via graph traversal
  4. Verify document-level search was performed

### 7. Query Strategy: Entities Only
- **Test**: `should search only entities when strategy is 'entities'`
- **Steps**:
  1. Learn from multiple texts
  2. Query with strategy: 'entities'
  3. Verify response includes entities
  4. Verify no document-level search was performed (or documents only via traversal)

### 8. Document Vector Search
- **Test**: `should find documents by semantic similarity`
- **Steps**:
  1. Learn from "Alice works for Acme Corp."
  2. Learn from "Bob works for TechCorp."
  3. Query "Who works for companies?" with strategy: 'documents'
  4. Verify both documents are found (semantically similar)

### 9. Multi-Document Entity Connections
- **Test**: `should traverse graph from documents to entities`
- **Steps**:
  1. Learn from "Alice works for Acme Corp."
  2. Learn from "Acme Corp is a technology company."
  3. Query "What is Acme Corp?" with strategy: 'documents'
  4. Verify entities are found via graph traversal from documents

### 10. Scope Isolation with Documents
- **Test**: `should isolate documents by scope`
- **Steps**:
  1. Create two scopes (tenant-1, tenant-2)
  2. Learn same text in both scopes
  3. Verify separate document nodes exist (one per scope)
  4. Query each scope - verify only scope's documents are found

## Implementation Notes

- All tests should use unique scope IDs to avoid conflicts
- Clean up test data after each test or test suite
- Use real Neo4j and OpenAI connections (skip if env vars not set)
- Test both with and without embeddings in responses

