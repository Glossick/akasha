# Demo Backend

This is the backend server for the Akasha demo application. It provides REST API endpoints for GraphRAG operations using the Akasha library.

## Quick Start

```bash
cd demo/backend
bun run src/app.ts
```

The server will start on port 3000 (or as configured).

## Configuration

The backend is configured via environment variables (see root `.env` file) and uses the Akasha library with the new provider system:

```typescript
akasha({
  neo4j: {
    uri: process.env.NEO4J_URI,
    user: process.env.NEO4J_USER,
    password: process.env.NEO4J_PASSWORD,
    database: process.env.NEO4J_DATABASE,
  },
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      },
    },
    llm: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4',
      },
    },
  },
  scope: {
    id: 'backend-default',
    type: 'backend',
    name: 'Backend Default Scope',
  },
})
```

### Switching Providers

To use Anthropic Claude instead of OpenAI GPT-4:

1. Add `ANTHROPIC_API_KEY` to your `.env` file
2. Update `src/app.ts`:
   ```typescript
   llm: {
     type: 'anthropic',
     config: {
       apiKey: process.env.ANTHROPIC_API_KEY,
       model: 'claude-3-5-sonnet-20241022',
     },
   }
   ```

To use DeepSeek (cost-effective alternative):

1. Add `DEEPSEEK_API_KEY` to your `.env` file
2. Update `src/app.ts`:
   ```typescript
   llm: {
     type: 'deepseek',
     config: {
       apiKey: process.env.DEEPSEEK_API_KEY,
       model: 'deepseek-chat',
     },
   }
   ```

## API Endpoints

### GraphRAG Operations
- `POST /api/graphrag/query` - Query the knowledge graph
- `POST /api/graph/extract` - Extract entities from text
- `POST /api/graph/extract/batch` - Batch extraction

### Graph Management
- `GET /api/graph/entities` - List entities
- `POST /api/graph/entities` - Create entity
- `GET /api/graph/entities/:id` - Get entity
- `PUT /api/graph/entities/:id` - Update entity
- `DELETE /api/graph/entities/:id` - Delete entity

### Health & Status
- `GET /api/health` - Check service health
- `GET /api/neo4j/test` - Test Neo4j connection

See `src/app.ts` for complete API documentation.

## Legacy Services

The `src/services/` directory contains legacy service implementations:
- `graphrag.service.ts` - Original GraphRAG implementation
- `embedding.service.ts` - Original embedding service
- `neo4j.service.ts` - Direct Neo4j service

These are **kept for reference only**. The demo now uses the Akasha library directly, which provides these capabilities with a simpler, more powerful API.

## Architecture

```
backend/
├── src/
│   ├── app.ts              # Main ElysiaJS server (uses Akasha library)
│   ├── config/             # Configuration (Neo4j, OpenAI)
│   ├── types/              # TypeScript types
│   ├── services/           # Legacy services (reference only)
│   └── __tests__/          # Tests
└── scripts/                # Utility scripts
```

## Testing

```bash
bun test
```

## Notes

- The demo uses a single scope (`backend-default`) for all data
- All GraphRAG operations are handled by the Akasha library
- Legacy services are preserved for reference but not used
- Provider system allows easy switching between OpenAI, Anthropic, and DeepSeek

