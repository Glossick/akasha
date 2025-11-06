# Backend Migration to Akasha Library

## Summary

The backend has been successfully migrated from using `GraphRAGService` to the new `Akasha` library.

## Changes Made

### 1. Replaced GraphRAGService with Akasha

**Before:**
```typescript
import { GraphRAGService } from './services/graphrag.service';
let graphRAG: GraphRAGService | null = null;
```

**After:**
```typescript
import { akasha } from '../../akasha/src/factory';
import type { Akasha } from '../../akasha/src/akasha';
let akashaInstance: Akasha | null = null;
```

### 2. Updated Initialization

- Uses Akasha factory function with configuration from `config/database.ts` and `config/openai.ts`
- Creates a default scope (`backend-default`) for all backend data
- All data created through the backend is automatically scoped

### 3. Updated API Endpoints

#### `/api/graphrag/query`
- **Before:** `service.query(query)`
- **After:** `kg.ask(query.query, { maxDepth, limit, strategy, includeEmbeddings })`
- **New Features:**
  - Supports `strategy` parameter: `'documents'`, `'entities'`, or `'both'` (default)
  - Supports `includeEmbeddings` parameter (default: false)
  - Response now includes `documents` array when strategy includes documents

#### `/api/graph/extract`
- **Before:** `service.extractAndCreate(text)`
- **After:** `kg.learn(text, { contextName: 'Extracted Text' })`
- **New Features:**
  - Response now includes `document` object (the created/reused document node)
  - `created.document` field indicates if document was newly created (1) or reused (0)
  - Documents are automatically deduplicated by text content
  - Entities are automatically deduplicated across documents

### 4. Benefits

1. **Multi-tenant ready**: All backend data is automatically scoped to `backend-default`
2. **Context management**: Text extractions create contexts automatically
3. **Cleaner API**: Uses Akasha's simplified `ask()` and `learn()` methods
4. **Scope isolation**: All entities and relationships have `scopeId` property

## Backward Compatibility

- All existing API endpoints maintain backward compatibility
- New fields are optional or have defaults:
  - `strategy` defaults to `'both'` if not specified
  - `includeEmbeddings` defaults to `false` if not specified
  - `documents` in response is optional (only present when strategy includes documents)
- Frontend code can continue working without changes, but can opt-in to new features
- Existing types have been extended with new optional fields

## Configuration

The backend uses environment variables:
- `NEO4J_URI`
- `NEO4J_USER`
- `NEO4J_PASSWORD`
- `NEO4J_DATABASE` (optional, defaults to 'neo4j')
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to 'gpt-4')
- `OPENAI_EMBEDDING_MODEL` (optional, defaults to 'text-embedding-3-small')

## Scope Information

All backend data is created with:
- **Scope ID**: `backend-default`
- **Scope Type**: `backend`
- **Scope Name**: `Backend Default Scope`

This ensures:
- Data isolation from other scopes
- Easy identification of backend-created data
- Foundation for future multi-tenant features

## Testing

The existing tests should continue to work, but may need updates to:
- Mock Akasha instead of GraphRAGService
- Account for scopeId in entity/relationship properties

## New Features (Document Node Architecture)

### Document Nodes
- Full text is now stored as first-class `Document` nodes in the graph
- Documents have their own embeddings for semantic search
- Documents are automatically deduplicated by text content within a scope

### Query Strategies
- **`'both'` (default)**: Searches both documents and entities, combining results
- **`'documents'`**: Searches only documents, then retrieves connected entities
- **`'entities'`**: Searches only entities (original behavior)

### Entity Deduplication
- Entities are automatically reused across multiple documents
- If "Alice" appears in multiple documents, there's only one Alice entity node
- Entity is linked to all documents via `CONTAINS_ENTITY` relationships

### API Changes

**Query Endpoint (`/api/graphrag/query`):**
```typescript
// New optional parameters
{
  query: string;
  strategy?: 'documents' | 'entities' | 'both'; // default: 'both'
  includeEmbeddings?: boolean; // default: false
  maxDepth?: number;
  limit?: number;
}

// Response now includes documents when strategy includes them
{
  context: {
    documents?: Document[]; // Present if strategy includes documents
    entities: Entity[];
    relationships: Relationship[];
    summary: string;
  };
  answer: string;
}
```

**Extract Endpoint (`/api/graph/extract`):**
```typescript
// Response now includes document information
{
  document: Document; // The created/reused document node
  entities: Entity[];
  relationships: Relationship[];
  summary: string;
  created: {
    document: number; // 1 if created, 0 if reused
    entities: number;
    relationships: number;
  };
}
```

## Next Steps

1. Update tests to use Akasha mocks and test new features
2. Consider adding scope management endpoints
3. Add context management features to API
4. Document scope and context concepts for API users
5. Update frontend to leverage document nodes and query strategies

