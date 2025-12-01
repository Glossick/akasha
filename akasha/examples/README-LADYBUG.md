# LadybugDB Example

This example demonstrates how to use Akasha with **LadybugDB**, an embedded graph database that supports Cypher queries, vector search, and full-text search.

## What is LadybugDB?

LadybugDB is a fork/evolution of KuzuDB, an embedded property graph database with:
- **Embedded architecture**: No separate server needed
- **Cypher support**: Uses Neo4j-compatible Cypher query language
- **Vector search**: Built-in support for vector embeddings
- **Full-text search**: Advanced text search capabilities
- **LLM extension**: Built-in `CREATE_EMBEDDING` function for generating embeddings

## Prerequisites

1. **Install dependencies**:
   ```bash
   npm install lbug
   # or
   bun add lbug
   ```

2. **Set environment variables**:
   ```bash
   export OPENAI_API_KEY="your-openai-api-key"
   export DEEPSEEK_API_KEY="your-deepseek-api-key"
   ```

   Or create a `.env` file:
   ```
   OPENAI_API_KEY=your-openai-api-key
   DEEPSEEK_API_KEY=your-deepseek-api-key
   ```

## Running the Example

```bash
bun run examples/ladybug-example.ts
```

## What the Example Does

1. **Initialization**: Creates a LadybugDB database and initializes Akasha
2. **Health Check**: Verifies database and API connectivity
3. **Learning**: Extracts entities and relationships from text
4. **Querying**: Asks questions and gets answers from the knowledge graph
5. **Listing**: Shows all entities and relationships
6. **Scope Filtering**: Demonstrates multi-tenancy with scope isolation
7. **Cleanup**: Properly closes connections

## Example Output

```
🚀 Starting LadybugDB example with Akasha...

📊 Initializing Akasha with LadybugDB...
✅ Akasha initialized successfully!

🏥 Health check:
  Database: ✅ Connected
  OpenAI: ✅ Available
  Overall: healthy

📚 Learning knowledge from text...
✅ Learned 4 entities and 3 relationships

Entities created:
  1. Person: Alice
  2. Company: Acme Corp
  3. Person: Bob
  4. Person: Charlie

Relationships created:
  1. WORKS_FOR: Alice → Acme Corp
  2. REPORTS_TO: Alice → Bob
  3. FRIENDS_WITH: Alice → Charlie

🔍 Querying the knowledge graph...
Query: "Who does Alice work for?"
📝 Answer: Alice works for Acme Corp...

📋 Listing all entities:
Found 4 entities:
  1. Person: Alice (scope: example-scope)
  2. Company: Acme Corp (scope: example-scope)
  ...
```

## Key Features Demonstrated

### 1. Embedded Database
- No external database server required
- Database files stored locally
- Fast startup and shutdown

### 2. Vector Search
- Automatic vector indexing on `DOUBLE[]` properties
- Semantic similarity search for entities and documents
- No explicit index creation needed

### 3. Scope Filtering
- Multi-tenancy support
- Data isolation by scope
- All queries automatically filtered by scope

### 4. Cypher Compatibility
- Uses Neo4j-compatible Cypher queries
- Similar query patterns to Neo4j
- Easy migration from Neo4j

## Database Location

The example creates a database at:
```
./ladybug-db-example/
```

To start fresh, simply delete this directory and run the example again.

## Differences from Neo4j

1. **No Server**: LadybugDB is embedded, no separate server process
2. **File-based**: Database stored as files, not in a server
3. **Vector Indexes**: Automatic - no explicit index creation needed
4. **Connection Model**: Single connection per database instance
5. **ID System**: Uses string IDs with `PRIMARY KEY(id)` in schema

## Troubleshooting

### Error: "Cannot find module 'lbug'"
```bash
npm install lbug
# or
bun add lbug
```

### Error: "OPENAI_API_KEY is required"
Make sure you've set the environment variable:
```bash
export OPENAI_API_KEY="your-key"
```

### Error: "DEEPSEEK_API_KEY is required"
Make sure you've set the environment variable:
```bash
export DEEPSEEK_API_KEY="your-key"
```

### Database Lock Errors
If you see database lock errors, make sure:
- No other process is using the database
- Previous database files are cleaned up
- You're not running multiple instances simultaneously

## Next Steps

- Try different queries and see how the knowledge graph responds
- Add more complex relationships and entities
- Experiment with different scopes for multi-tenant scenarios
- Use the vector search capabilities for semantic queries

## Resources

- [LadybugDB Documentation](https://docs.ladybugdb.com/)
- [LadybugDB npm Package](https://www.npmjs.com/package/lbug)
- [Akasha Documentation](../README.md)

