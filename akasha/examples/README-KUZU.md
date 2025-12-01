# Kuzu DB Example

This example demonstrates how to use Akasha with Kuzu database instead of Neo4j.

## Prerequisites

1. **Install Kuzu Node.js package:**
   ```bash
   npm install kuzu
   # or
   bun add kuzu
   ```

2. **Set environment variables:**
   ```bash
   export OPENAI_API_KEY="your-openai-api-key"
   export DEEPSEEK_API_KEY="your-deepseek-api-key"
   ```

## Current Status

⚠️ **Note:** The `KuzuProvider` is currently a **stub implementation**. 

The interface is defined and the provider class exists, but the actual database operations need to be implemented. This is because:

1. The Kuzu Node.js package API may need to be verified
2. Kuzu-specific implementation details need to be worked out
3. Vector index creation and query syntax may differ from Neo4j

## Implementation Steps

To make Kuzu work with Akasha, you'll need to:

1. **Install Kuzu:**
   ```bash
   bun add kuzu
   ```

2. **Implement KuzuProvider methods** in `src/services/providers/database/kuzu-provider.ts`:
   - Import Kuzu package
   - Implement connection/disconnection
   - Implement vector index creation
   - Implement all CRUD operations using Kuzu's Cypher interface
   - Implement vector similarity search

3. **Key differences from Neo4j:**
   - Kuzu uses file path instead of connection string
   - Kuzu is embedded (no separate server)
   - Vector search syntax may differ
   - ID handling may be different (Kuzu uses string IDs, not integers)

## Running the Example

Once KuzuProvider is implemented:

```bash
bun run examples/kuzu-example.ts
```

## Configuration

The example uses this configuration:

```typescript
{
  database: {
    type: 'kuzu',
    config: {
      databasePath: './kuzu-db-example', // File path, not connection string
    },
  },
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'text-embedding-3-small',
      },
    },
    llm: {
      type: 'deepseek',
      config: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-chat',
      },
    },
  },
}
```

## Next Steps

1. Check Kuzu documentation for Node.js API
2. Implement the stub methods in `KuzuProvider`
3. Test with the example script
4. Update tests to include Kuzu integration tests

