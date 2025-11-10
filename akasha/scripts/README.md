# Akasha Test Scripts

This directory contains scripts for testing and demonstrating the Akasha library with real Neo4j and OpenAI connections.

## Prerequisites

All scripts require the following environment variables:

- `NEO4J_URI` - Neo4j connection URI (e.g., `bolt://localhost:7687`)
- `NEO4J_USER` - Neo4j username
- `NEO4J_PASSWORD` - Neo4j password
- `OPENAI_API_KEY` - OpenAI API key (required for embeddings)

Optional (for testing different LLM providers):
- `ANTHROPIC_API_KEY` - Anthropic API key (for Claude models)
- `DEEPSEEK_API_KEY` - DeepSeek API key (for DeepSeek models)

## Scripts

### `test-deepseek-e2e.ts`

Quick E2E test for DeepSeek provider integration. Tests entity extraction and query answering with real API calls.

```bash
bun run scripts/test-deepseek-e2e.ts
```

### `test-integration.ts`

Comprehensive integration test script that verifies:
- Connection to Neo4j and OpenAI
- Text extraction and learning
- **Document nodes** (canonical text storage)
- **Document deduplication**
- **Entity deduplication** across documents
- Query functionality with **query strategies** (documents, entities, both)
- Multi-tenant isolation
- Context management
- Template system
- Embedding scrubbing options

**Usage:**
```bash
bun run scripts/test-integration.ts
```

### `demo.ts`

Interactive demo script showing:
- Basic library usage
- Learning from text
- **Document nodes** and **document deduplication**
- **Entity deduplication** across documents
- Querying the knowledge graph with different **query strategies**
- Multi-tenant scenarios
- Custom ontology templates

**Usage:**
```bash
bun run scripts/demo.ts
```

### `cleanup-test-data.ts`

Removes test data created by integration tests and demos. This script deletes all entities and relationships with test scopeIds.

**Usage:**
```bash
bun run scripts/cleanup-test-data.ts
```

## Running Tests

### Unit Tests (Mocked)
```bash
bun test
```

### Integration Tests (Real Services)
```bash
# Set environment variables first
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=your-password
export OPENAI_API_KEY=your-openai-key
export ANTHROPIC_API_KEY=your-anthropic-key  # Optional
export DEEPSEEK_API_KEY=your-deepseek-key    # Optional

# Run all integration tests (includes multi-provider tests)
bun test src/__tests__/integration

# Run specific multi-provider tests
bun test src/__tests__/integration/multi-provider.test.ts
```

Or use the test script:
```bash
bun run scripts/test-integration.ts
```

## Notes

- Integration tests will create test data in Neo4j
- Test data uses scopeIds starting with `test-`, `integration-test-`, `tenant-1-`, `tenant-2-`, `doc-test-`, `template-test-`, `embedding-test-`, `query-`, or exact matches like `demo-tenant-1`, `demo-tenant-2`, `demo-custom-ontology`
- Use `cleanup-test-data.ts` to remove test data after running tests
- Integration tests are skipped if environment variables are not set

## Features Tested

All scripts now comprehensively test:
- ✅ **Document Nodes**: Full text stored as first-class Document nodes with embeddings
- ✅ **Document Deduplication**: Same text content reuses existing document nodes
- ✅ **Entity Deduplication**: Entities are reused across multiple documents
- ✅ **Query Strategies**: `'documents'`, `'entities'`, and `'both'` (default) strategies
- ✅ **Entity-Document Linking**: CONTAINS_ENTITY relationships connect documents to entities
- ✅ **Multi-tenant Isolation**: Scope-based data separation
- ✅ **Template System**: Custom extraction prompt templates
- ✅ **Embedding Scrubbing**: Optional embedding inclusion in responses

