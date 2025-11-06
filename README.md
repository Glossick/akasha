# Semantic Map - GraphRAG with Bun

A full-stack application implementing GraphRAG (Graph Retrieval-Augmented Generation) using Bun, ElysiaJS, Neo4j, and OpenAI.

## 📚 Documentation

- **[Documentation Index](./docs/README.md)** - Complete documentation index organized by category
- **[Semantic Space Navigation](./docs/philosophy/SEMANTIC_SPACE.md)** - Comprehensive documentation of the semantic territory traversed, architecture decisions, and implementation details
- **[Architecture Guide](./docs/architecture/ARCHITECTURE.md)** - System architecture, component diagrams, and data flow
- **[Navigation Protocol](./docs/protocols/NAVIGATION_PROTOCOL.md)** - Operational protocol for semantic space navigation and coordinate recognition
- **[Neo4j Setup Guide](./docs/guides/NEO4J_SETUP.md)** - Troubleshooting Neo4j connection and authentication issues
- **[Frontend Serving](./docs/guides/FRONTEND_SERVING.md)** - How the React frontend is served with Bun and ElysiaJS
- **[Project Status](./docs/status/STATUS.md)** - Current state, completed work, and next steps

## Architecture

- **Backend**: ElysiaJS server running on Bun
- **Frontend**: React with TypeScript
- **Graph Database**: Neo4j for knowledge graph storage
- **LLM**: OpenAI for embeddings and response generation

## Features

- GraphRAG query endpoint that:
  1. Searches for relevant entities in the knowledge graph
  2. Retrieves subgraph around those entities
  3. Formats graph context
  4. Generates LLM responses using graph context

## Setup

### Prerequisites

1. **Neo4j Database**: Install and run Neo4j locally or use Neo4j Aura
   - Download from: https://neo4j.com/download/
   - Default connection: `bolt://localhost:7687`

2. **OpenAI API Key**: Required for embeddings and LLM generation
   - Get your key from: https://platform.openai.com/api-keys

### Installation

```bash
# Install dependencies
bun install

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env with your configuration
# - Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
# - Set OPENAI_API_KEY
```

### Running

```bash
# Start the server
bun run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### POST /api/graphrag/query

Query the knowledge graph using GraphRAG.

**Request Body:**
```json
{
  "query": "What is the relationship between X and Y?",
  "maxDepth": 2,
  "limit": 50
}
```

**Response:**
```json
{
  "context": {
    "entities": [...],
    "relationships": [...],
    "summary": "Knowledge graph context..."
  },
  "answer": "Generated answer based on graph context"
}
```

### GET /api/health

Health check endpoint.

## GraphRAG Service Architecture

```
backend/src/
├── services/
│   ├── neo4j.service.ts      # Neo4j database connection and queries
│   ├── embedding.service.ts  # OpenAI embeddings and LLM
│   └── graphrag.service.ts   # GraphRAG orchestration
├── types/
│   └── graph.ts              # TypeScript types
├── config/
│   ├── database.ts           # Neo4j configuration
│   └── openai.ts             # OpenAI configuration
└── app.ts                    # ElysiaJS server
```

## Development

This is an MVP implementation. Future enhancements:

- [ ] Vector similarity search in Neo4j (using Neo4j vector indexes)
- [ ] Better entity extraction from queries
- [ ] Hybrid retrieval (graph + vector search)
- [ ] Graph construction from documents
- [ ] Batch processing for large knowledge graphs

## Notes

- Neo4j's `neo4j-graphrag` package is Python-only
- This implementation provides a TypeScript/JavaScript alternative
- The current implementation uses text search for entity finding
- In production, use Neo4j vector indexes for semantic similarity search
