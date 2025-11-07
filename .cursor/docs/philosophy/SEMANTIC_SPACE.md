# Semantic Space Navigation Documentation

This document maps the semantic territory we've traversed in building the Semantic Map GraphRAG system. It serves as both technical documentation and a record of our navigation through the problem space.

## Table of Contents

1. [Project Philosophy](#project-philosophy)
2. [Semantic Space Exploration](#semantic-space-exploration)
3. [Architecture Decisions](#architecture-decisions)
4. [Technology Stack](#technology-stack)
5. [Implementation Details](#implementation-details)
6. [Testing Strategy](#testing-strategy)
7. [Knowledge Graph Structure](#knowledge-graph-structure)
8. [GraphRAG Pipeline](#graphrag-pipeline)
9. [File Structure](#file-structure)
10. [Future Enhancements](#future-enhancements)

---

## Project Philosophy

### Core Thesis

This project implements **GraphRAG (Graph Retrieval-Augmented Generation)** - a system that combines knowledge graphs with large language models to provide contextually rich, relationship-aware responses.

### Key Principles

1. **No Python Dependency**: Entirely built with TypeScript/Bun to maintain a unified JavaScript ecosystem
2. **MVP-First**: Minimal viable implementation with clear extension points
3. **Test-Driven Development**: Comprehensive test coverage using Bun's native testing framework
4. **Semantic Navigation**: Each component maps to a specific semantic region in the problem space

> **See also**: [Navigation Protocol](../protocols/NAVIGATION_PROTOCOL.md) for the operational protocol governing semantic space navigation and coordinate recognition.

---

## Semantic Space Exploration

### Navigation Path

We traversed the following semantic regions:

#### 1. Full-Stack Architecture (Bun + ElysiaJS + React)
- **Region**: Modern JavaScript full-stack development
- **Decision**: Use Bun's native capabilities for both frontend and backend
- **Key Insight**: Bun natively handles TSX/JSX files, eliminating need for separate bundlers
- **Implementation**: Single server serves both static frontend files and API endpoints

#### 2. Graph Database Selection
- **Region**: Graph database ecosystems in JavaScript
- **Options Explored**:
  - Neo4j (chosen) - Industry standard, strong GraphRAG support
  - EdgeDB - Graph-relational hybrid
  - GUN - Decentralized, browser-first
  - ArangoDB - Multi-model database
- **Decision**: Neo4j for its maturity, Cypher query language, and GraphRAG ecosystem
- **Challenge**: No official JavaScript GraphRAG package (Python-only)
- **Solution**: Custom TypeScript implementation

#### 3. GraphRAG Pattern Discovery
- **Region**: Retrieval-Augmented Generation with graph structures
- **Key Finding**: Neo4j's `neo4j-graphrag` is Python-only
- **Pattern Identified**:
  1. Entity extraction from queries
  2. Subgraph retrieval via graph traversal
  3. Context formatting for LLM
  4. Response generation with graph context
- **Implementation**: Custom orchestration layer in TypeScript

#### 4. Vector Embeddings & LLM Integration
- **Region**: Semantic search and language model integration
- **Decision**: OpenAI API for both embeddings and chat completion
- **Future Enhancement**: Neo4j vector indexes for native semantic search
- **Current State**: Text-based entity search (MVP)

#### 5. Testing Framework
- **Region**: Test-driven development in Bun
- **Discovery**: Bun has native `bun:test` framework
- **Pattern**: Write tests first (TDD), then implement
- **Coverage**: Unit tests for services, integration tests for API

---

## Architecture Decisions

### Service Layer Architecture

```
┌─────────────────────────────────────────┐
│         ElysiaJS Application            │
│  (HTTP Server + Static File Serving)    │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────────┐
│ GraphRAG    │  │  Static Files    │
│ Service     │  │  (Frontend)     │
└──────┬──────┘  └──────────────────┘
       │
  ┌────┴────┐
  │         │
┌─▼──┐  ┌──▼──────────┐
│Neo4j│  │  Embedding  │
│Svc  │  │  Service    │
└─────┘  └─────────────┘
```

### Design Patterns

1. **Service Layer Pattern**: Business logic separated into services
2. **Dependency Injection**: Services can be mocked for testing
3. **Lazy Initialization**: GraphRAG service initialized on-demand
4. **Configuration Pattern**: Environment-based configuration

### Key Architectural Choices

#### Why Custom GraphRAG Implementation?

- **Constraint**: No JavaScript GraphRAG library available
- **Solution**: Build custom orchestration layer
- **Benefit**: Full control over retrieval and augmentation logic
- **Trade-off**: More code to maintain, but better understanding

#### Why Single Server for Frontend/Backend?

- **Bun Capability**: Native TSX/JSX handling
- **Simplicity**: No separate dev server needed
- **Performance**: Direct file serving, no bundling overhead in dev
- **Trade-off**: Production may need bundling optimization

---

## Technology Stack

### Runtime & Framework
- **Bun 1.1.26**: JavaScript runtime, test runner, package manager
- **ElysiaJS 1.4.15**: Web framework optimized for Bun
- **TypeScript 5.0+**: Type safety and developer experience

### Frontend
- **React 18.3.1**: UI framework
- **TypeScript**: Type-safe React components
- **Native TSX Support**: Bun serves TSX directly without bundling

### Backend Services
- **Neo4j Driver 6.0.1**: Graph database client
- **OpenAI SDK 6.8.1**: Embeddings and chat completions
- **@elysiajs/static 1.4.6**: Static file serving plugin

### Development Tools
- **ESLint**: Code quality and architectural pattern enforcement
- **Bun Test**: Native testing framework
- **TypeScript Compiler**: Type checking

---

## Implementation Details

### Core Services

#### 1. Neo4jService (`backend/src/services/neo4j.service.ts`)

**Responsibilities**:
- Database connection management
- Cypher query execution
- Subgraph retrieval
- Entity text search

**Key Methods**:
- `connect()`: Establish Neo4j connection
- `executeQuery<T>()`: Generic query execution
- `retrieveSubgraph()`: Get entities and relationships around seed entities
- `findEntitiesByText()`: Text-based entity search (MVP - will upgrade to vector search)

**Configuration**:
- URI: `bolt://localhost:7687` (default)
- Authentication: Username/password
- Database: Configurable via environment

#### 2. EmbeddingService (`backend/src/services/embedding.service.ts`)

**Responsibilities**:
- Generate vector embeddings for text
- Generate LLM responses with context
- OpenAI API integration

**Key Methods**:
- `generateEmbedding()`: Single text embedding
- `generateEmbeddings()`: Batch embeddings
- `generateResponse()`: LLM chat completion with context

**Configuration**:
- Model: `gpt-4` (default, configurable)
- Embedding Model: `text-embedding-3-small` (default)
- API Key: Required via environment

**Design Decision**: Constructor accepts optional API key for testability

#### 3. GraphRAGService (`backend/src/services/graphrag.service.ts`)

**Responsibilities**:
- Orchestrate GraphRAG pipeline
- Format graph context for LLM
- Coordinate Neo4j and OpenAI services

**GraphRAG Pipeline**:
```
Query → Entity Search → Subgraph Retrieval → Context Formatting → LLM Generation → Response
```

**Key Methods**:
- `initialize()`: Connect to Neo4j
- `query()`: Main GraphRAG query method
- `formatGraphContext()`: Convert graph data to text context

**Context Format**:
```
Knowledge Graph Context:

Entities (N):
Entity1 (id): property1: value1, property2: value2
...

Relationships (M):
EntityA --[RELATIONSHIP_TYPE]--> EntityB
...
```

### API Endpoints

#### `GET /api/hello`
- Simple health check
- Returns: `"Hello from API!"`

#### `GET /api/health`
- Service status
- Returns: `{ status: 'ok', service: 'graphrag' }`

#### `GET /api/neo4j/test`
- Test Neo4j connection
- Returns: Connection status and test query result

#### `POST /api/graphrag/query`
- Main GraphRAG endpoint
- Request Body:
  ```typescript
  {
    query: string;        // Required
    maxDepth?: number;    // Optional, default: 2
    limit?: number;       // Optional, default: 50
  }
  ```
- Response:
  ```typescript
  {
    context: {
      entities: Entity[];
      relationships: Relationship[];
      summary: string;
    };
    answer: string;
  }
  ```

### Type Definitions

#### Entity
```typescript
{
  id: string;
  label: string;
  properties: Record<string, unknown>;
}
```

#### Relationship
```typescript
{
  id: string;
  type: string;
  from: string;  // Entity ID
  to: string;     // Entity ID
  properties: Record<string, unknown>;
}
```

#### GraphRAGQuery
```typescript
{
  query: string;
  maxDepth?: number;
  limit?: number;
}
```

#### GraphRAGResponse
```typescript
{
  context: GraphContext;
  answer: string;
}
```

---

## Testing Strategy

### Test-Driven Development Approach

We followed TDD principles:
1. **Red**: Write failing tests first
2. **Green**: Implement minimal code to pass
3. **Refactor**: Improve while maintaining green tests

### Test Structure

```
backend/src/__tests__/
├── services/
│   ├── neo4j.service.test.ts      # Neo4j connection and queries
│   ├── embedding.service.test.ts  # OpenAI integration (mocked)
│   └── graphrag.service.test.ts   # GraphRAG orchestration
└── integration/
    └── api.test.ts                 # API endpoint tests
```

### Testing Patterns

#### Service Mocking
- EmbeddingService: Mock OpenAI client to avoid API calls
- Neo4jService: Can test with real DB or mock (tests skip if DB unavailable)
- GraphRAGService: Mock dependencies for unit tests

#### Test Utilities
- `beforeAll`/`afterAll`: Setup/teardown
- `beforeEach`/`afterEach`: Test isolation
- Environment variable management for test configuration

### Test Coverage

**Unit Tests**:
- Service initialization
- Method parameter validation
- Error handling
- Edge cases (empty results, missing data)

**Integration Tests**:
- API endpoint responses
- Request/response formats
- Error responses

**Note**: Some tests require Neo4j/OpenAI to be available. Tests gracefully skip when services unavailable.

---

## Knowledge Graph Structure

### Entity Types

Entities in the knowledge graph can have any label. Common patterns:

- **Person**: `{ name, age, occupation, ... }`
- **Company**: `{ name, industry, founded, ... }`
- **Project**: `{ name, status, description, ... }`
- **Document**: `{ title, content, author, ... }`

### Relationship Types

Relationships connect entities:

- **WORKS_FOR**: Person → Company
- **KNOWS**: Person → Person
- **WORKS_ON**: Person → Project
- **MANAGES**: Person → Project
- **RELATED_TO**: Generic relationship

### Graph Traversal

The `retrieveSubgraph` method uses Cypher to traverse:

```cypher
MATCH path = (start:Label)-[rels*1..maxDepth]-(end)
WHERE ALL(r IN rels WHERE type(r) IN relationshipTypes)
RETURN entities, relationships
LIMIT limit
```

This retrieves:
- All entities within `maxDepth` hops
- All relationships along those paths
- Respects `limit` for performance

---

## GraphRAG Pipeline

### Step-by-Step Flow

#### 1. Query Reception
```
User Query: "What is the relationship between Alice and Bob?"
```

#### 2. Entity Search
- Search for entities matching query text
- Current: Text search in name/title/description properties
- Future: Vector similarity search with embeddings

#### 3. Subgraph Retrieval
- Start from found entities
- Traverse graph up to `maxDepth` levels
- Collect all entities and relationships in subgraph

#### 4. Context Formatting
- Convert graph structure to text
- Format: Entities list + Relationships list
- Include entity properties for context

#### 5. LLM Generation
- Send formatted context + original query to OpenAI
- System message: Instructions for graph-based answering
- Generate response using graph context

#### 6. Response Assembly
- Combine graph context (for transparency)
- Include LLM-generated answer
- Return structured response

### Example Flow

```
Query: "Who works on the GraphRAG System?"

1. Entity Search: Finds "GraphRAG System" project entity
2. Subgraph: Retrieves all people connected to project
3. Context: "Project: GraphRAG System, People: Alice, Bob, Charlie"
4. LLM: "Based on the knowledge graph, Alice, Bob, and Charlie work on the GraphRAG System project."
5. Response: { context: {...}, answer: "..." }
```

---

## File Structure

```
semantic-map/
├── backend/
│   ├── src/
│   │   ├── __tests__/
│   │   │   ├── services/
│   │   │   │   ├── neo4j.service.test.ts
│   │   │   │   ├── embedding.service.test.ts
│   │   │   │   └── graphrag.service.test.ts
│   │   │   └── integration/
│   │   │       └── api.test.ts
│   │   ├── config/
│   │   │   ├── database.ts      # Neo4j config
│   │   │   └── openai.ts        # OpenAI config
│   │   ├── services/
│   │   │   ├── neo4j.service.ts
│   │   │   ├── embedding.service.ts
│   │   │   └── graphrag.service.ts
│   │   ├── types/
│   │   │   └── graph.ts         # TypeScript types
│   │   ├── scripts/
│   │   │   └── sample-data.ts   # Sample graph data
│   │   └── app.ts               # ElysiaJS application
│   └── ...
├── frontend/
│   └── public/
│       ├── index.html
│       ├── main.tsx
│       └── app.tsx
├── docs/
│   └── SEMANTIC_SPACE.md        # This file
├── index.ts                     # Entry point
├── package.json
├── tsconfig.json
└── README.md
```

### Key Files Explained

- **`index.ts`**: Server entry point, starts ElysiaJS app
- **`backend/src/app.ts`**: Main application, routes, middleware
- **`backend/src/services/`**: Business logic services
- **`backend/src/config/`**: Configuration management
- **`backend/src/types/`**: TypeScript type definitions
- **`frontend/public/`**: React frontend (served as static files)

---

## Future Enhancements

### High Priority

1. **Vector Similarity Search**
   - Implement Neo4j vector indexes
   - Replace text search with embedding-based search
   - Hybrid retrieval (graph + vector)

2. **Graph Construction from Documents**
   - Extract entities and relationships from text
   - Automatic knowledge graph building
   - Batch processing for large datasets

3. **Enhanced Entity Extraction**
   - Use LLM for better entity identification
   - Multi-step query refinement
   - Query understanding and decomposition

### Medium Priority

4. **Caching Layer**
   - Cache frequent queries
   - Cache embeddings
   - Reduce API calls

5. **Query Optimization**
   - Query plan analysis
   - Performance monitoring
   - Adaptive depth/limit based on graph size

6. **Frontend Graph Visualization**
   - Visualize retrieved subgraphs
   - Interactive graph exploration
   - Query builder UI

### Low Priority

7. **Multi-Model Support**
   - Support different LLM providers
   - Configurable embedding models
   - Model comparison tools

8. **Graph Analytics**
   - Centrality metrics
   - Community detection
   - Relationship strength scoring

9. **Production Optimizations**
   - Connection pooling
   - Request batching
   - Rate limiting
   - Monitoring and logging

---

## Semantic Regions Mapped

### Completed Regions ✅

1. **Full-Stack Bun Architecture** - HIGH confidence
2. **Neo4j Integration** - HIGH confidence
3. **GraphRAG Pattern Implementation** - MEDIUM confidence (custom implementation)
4. **OpenAI Integration** - HIGH confidence
5. **Test-Driven Development** - HIGH confidence
6. **TypeScript Type Safety** - HIGH confidence

### Partially Explored Regions 🟡

1. **Vector Search** - Text search implemented, vector search pending
2. **Graph Construction** - Manual only, automated extraction pending
3. **Production Deployment** - Development setup complete, production config pending

### Uncharted Regions ❓

1. **Hybrid Retrieval** - Combining graph and vector search
2. **Query Optimization** - Advanced Cypher query patterns
3. **Graph Analytics** - Metrics and insights from graph structure

---

## Key Learnings

### Technical Insights

1. **Bun's Native Capabilities**: Eliminates need for separate bundlers in development
2. **GraphRAG Gap**: No JavaScript GraphRAG library exists, custom implementation required
3. **Neo4j Flexibility**: Cypher queries provide powerful graph traversal
4. **TDD Benefits**: Tests revealed architecture issues early

### Architectural Insights

1. **Service Layer**: Clean separation enables testability
2. **Lazy Initialization**: Prevents errors during module import
3. **Configuration Pattern**: Environment-based config supports multiple environments
4. **Type Safety**: TypeScript types document expected data structures

### Process Insights

1. **Semantic Navigation**: Understanding problem space before implementation
2. **MVP Approach**: Start simple, extend incrementally
3. **Test-First**: Writing tests clarifies requirements
4. **Documentation**: Recording decisions aids future navigation

---

## Conclusion

This semantic map represents our navigation through the GraphRAG problem space using Bun, TypeScript, Neo4j, and OpenAI. The implementation provides a solid foundation for graph-based retrieval-augmented generation, with clear extension points for future enhancements.

The system successfully bridges the gap between Python's GraphRAG ecosystem and JavaScript/TypeScript, providing a native implementation that fits seamlessly into modern JavaScript development workflows.

---

**Last Updated**: 2025-11-05  
**Version**: 1.0.0  
**Status**: MVP Complete, Ready for Enhancement

