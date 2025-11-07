# Architecture Documentation

## System Overview

The Semantic Map system is a GraphRAG (Graph Retrieval-Augmented Generation) application built with Bun, ElysiaJS, Neo4j, and OpenAI.

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                          │
│                    (React Frontend)                          │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  ElysiaJS Application                        │
│  ┌──────────────────┐         ┌──────────────────────┐    │
│  │  Static Plugin   │         │   API Routes          │    │
│  │  (Frontend)      │         │   /api/*              │    │
│  └──────────────────┘         └───────────┬──────────┘    │
│                                            │                │
│                                    ┌───────▼────────┐       │
│                                    │ GraphRAG       │       │
│                                    │ Service        │       │
│                                    └───────┬────────┘       │
│                                            │                │
│                            ┌──────────────┴──────────────┐ │
│                            │                              │ │
│                    ┌───────▼──────┐            ┌─────────▼─▼┐│
│                    │ Neo4j        │            │ Embedding ││
│                    │ Service      │            │ Service   ││
│                    └───────┬──────┘            └─────┬──────┘│
└────────────────────────────┼────────────────────────┼───────┘
                             │                        │
                    ┌────────▼────────┐    ┌─────────▼────────┐
                    │   Neo4j DB      │    │   OpenAI API      │
                    │  (Graph Store)  │    │ (Embeddings/LLM) │
                    └─────────────────┘    └──────────────────┘
```

## Data Flow

### GraphRAG Query Flow

```
1. User Query (Natural Language)
   ↓
2. POST /api/graphrag/query
   ↓
3. GraphRAGService.query()
   ├─→ EmbeddingService.generateEmbedding() [Query Embedding]
   ├─→ Neo4jService.findEntitiesByVector() [Vector Similarity Search]
   ├─→ Neo4jService.retrieveSubgraph()    [Graph Traversal]
   ├─→ GraphRAGService.formatGraphContext() [Context Building]
   └─→ EmbeddingService.generateResponse() [LLM Generation]
   ↓
4. Response: { context, answer }
```

### Natural Language Extraction Flow

```
1. User Text Input
   ↓
2. POST /api/graph/extract
   ↓
3. GraphRAGService.extractAndCreate()
   ├─→ GraphRAGService.extractEntitiesAndRelationships() [LLM Extraction]
   │   ├─→ Validates entities and relationships
   │   ├─→ Filters self-referential relationships
   │   ├─→ Removes duplicates
   │   └─→ Validates semantic relationships
   ├─→ EmbeddingService.generateEmbeddings() [Batch Embedding Generation]
   ├─→ Neo4jService.createEntities() [Entity Creation with Embeddings]
   └─→ Neo4jService.createRelationships() [Relationship Creation]
   ↓
4. Response: { entities, relationships, summary, created }
```

### Graph Traversal Example

```
Query: "Who works with Alice?"

1. Entity Search: Finds "Alice" entity
2. Subgraph Retrieval:
   Alice --[WORKS_FOR]--> TechCorp
   Alice --[KNOWS]--> Bob
   Alice --[WORKS_ON]--> ProjectX
   Bob --[WORKS_ON]--> ProjectX
3. Context: All entities and relationships
4. LLM: Generates answer from context
```

## Service Responsibilities

### GraphRAGService
- **Orchestration**: Coordinates Neo4j and OpenAI services
- **Context Formatting**: Converts graph to text (filters internal properties, limits size)
- **Pipeline Management**: Manages query flow
- **Natural Language Extraction**: Extracts entities and relationships from text using LLM
- **Relationship Validation**: Filters invalid relationships (self-referential, duplicates, semantic errors)
- **Entity Embedding Generation**: Creates text representations and embeddings for entities

### Neo4jService
- **Connection Management**: Handles Neo4j driver lifecycle
- **Query Execution**: Executes Cypher queries
- **Graph Operations**: Subgraph retrieval, entity search
- **Vector Similarity Search**: Uses Neo4j vector indexes (5.x+) with fallback to cosine similarity
- **Vector Index Management**: Creates and maintains vector indexes for entity embeddings
- **Entity Embeddings**: Stores 1536-dimensional embeddings for semantic search
- **Relationship Deduplication**: Uses MERGE to prevent duplicate relationships
- **Graph Write Operations**: Full CRUD for entities and relationships

### EmbeddingService
- **Vector Generation**: Creates embeddings for text (single and batch)
- **LLM Integration**: Generates responses with context
- **API Management**: Handles OpenAI API calls
- **Temperature Control**: Configurable temperature for deterministic JSON extraction

## Configuration

### Environment Variables

```bash
# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=neo4j

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

## Error Handling

### Service Level
- Connection errors: Logged, graceful degradation
- Query errors: Returned to caller with context
- API errors: Wrapped with descriptive messages

### API Level
- Validation errors: 200 with error object
- Service errors: 200 with error details
- Network errors: Logged, user-friendly message

## Performance Considerations

### Current (MVP)
- Synchronous query execution
- No caching
- Direct API calls

### Future Optimizations
- Connection pooling for Neo4j
- Embedding caching
- Query result caching
- Async batch processing

## Security Considerations

### Current
- API keys via environment variables
- No authentication on endpoints (dev mode)

### Production Needs
- API authentication/authorization
- Rate limiting
- Input sanitization
- Secrets management

## Frontend Components

### Graph Visualization
- **GraphRenderer**: Custom Canvas-based force-directed graph renderer
  - No external dependencies (avoids React instance conflicts)
  - Force-directed layout algorithm
  - Interactive node and relationship visualization
  - Color-coded nodes by entity type
  - Relationship type labels on links

### Text Extraction
- **TextExtractionForm**: Natural language text input for graph extraction
  - Multi-line text input
  - Extraction results display
  - Entity and relationship summaries

### Results Display
- **Results**: Query results with graph visualization
  - LLM-generated answers
  - Graph context summary
  - Interactive graph visualization
  - Entity and relationship lists
  - Vector search indicators

## Scalability

### Current Limitations
- Single server instance
- No horizontal scaling
- Synchronous processing
- Vector index queries are synchronous

### Scaling Path
- Stateless services enable horizontal scaling
- Neo4j clustering for graph storage
- Load balancing for API
- Queue system for async processing
- Embedding caching for frequently queried entities

