# Database Comparison Benchmark

This example compares performance and functionality between Neo4j and LadybugDB across various Akasha operations.

## Overview

The benchmark script runs the same operations on both databases and compares:
- **Execution time** for each operation
- **Success rate** (error handling)
- **Overall performance** (which database is faster)
- **Operation-specific insights** (which database excels at specific tasks)

## Prerequisites

- Bun runtime (v1.1.26+)
- Neo4j server running and accessible
- Environment variables configured

## Environment Variables

Required environment variables:

```bash
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# Provider API Keys
OPENAI_API_KEY=your-openai-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
```

## Running the Benchmark

```bash
# From the akasha directory
bun run examples/database-comparison.ts
```

Or:

```bash
cd examples
bun database-comparison.ts
```

## What Gets Tested

The benchmark tests the following operations:

### Phase 1: Learning Operations
- **Learn (single document)**: Learning a single document
- **Learn (batch)**: Learning 10 documents sequentially

### Phase 2: Query Operations
- **Ask queries**: 5 different semantic queries
  - "Who works for Acme Corp?"
  - "What is the relationship between Alice and Bob?"
  - "What companies are mentioned?"
  - "Who are the leaders mentioned?"
  - "What are the key business activities?"

### Phase 3: List Operations
- **List Entities**: Retrieving all entities
- **List Relationships**: Retrieving all relationships
- **List Documents**: Retrieving all documents

### Phase 4: Vector Search Operations
- **Find Entities by Vector**: Vector similarity search (k=5)

### Phase 5: Graph Operations
- **Retrieve Subgraph**: Graph traversal (depth=2)

### Phase 6: Health Check
- **Health Check**: Database and provider health status

## Output

The benchmark provides:

1. **Real-time progress**: Shows each operation as it runs
2. **Detailed results**: Time for each operation on both databases
3. **Summary statistics**: 
   - Total operations
   - Wins for each database
   - Average time difference
4. **Winner analysis**: Overall performance comparison
5. **Insights**: Operation-specific performance patterns

### Example Output

```
🚀 Starting Database Comparison Benchmark
============================================================

📦 Initializing databases...

Initializing Neo4j...
✅ Neo4j initialized

Initializing LadybugDB...
✅ LadybugDB initialized

📚 Phase 1: Learning Operations
============================================================

🔄 Running: Learn (single document)
  ✅ Neo4j: 1.23s
  ✅ LadybugDB: 0.89s

...

📊 BENCHMARK RESULTS
============================================================

📈 Summary:
  Total Operations: 15
  Neo4j Wins: 6
  LadybugDB Wins: 7
  Ties: 2
  Average Time Difference: 145.23ms

🏆 Overall Winner Analysis
============================================================

🎯 LadybugDB is faster overall
   Wins: 7 vs 6
```

## Understanding the Results

- **Time Difference**: Shows how much faster/slower one database is
- **Percentage Difference**: Relative performance difference
- **Faster**: Which database completed the operation faster
- **Wins**: Count of operations where each database was faster

## Notes

- **First Run**: The first run may be slower due to initialization overhead
- **Network Latency**: Neo4j performance may vary based on network conditions
- **Database State**: Results may vary based on existing data in databases
- **API Rate Limits**: Provider API rate limits may affect timing

## Cleanup

The benchmark automatically:
- Cleans up database connections
- Leaves test data in both databases (for inspection if needed)

To clean up test data manually:

```bash
# Neo4j: Use Neo4j Browser or cypher-shell
MATCH (n) WHERE n.scopeId IN ['benchmark-neo4j'] DETACH DELETE n;

# LadybugDB: Delete the database directory
rm -rf ./benchmark-ladybug-db
```

## Troubleshooting

**Connection Errors:**
- Verify Neo4j is running: `neo4j status`
- Check Neo4j credentials
- Verify network connectivity

**API Errors:**
- Check API keys are valid
- Verify API rate limits
- Check provider service status

**Performance Issues:**
- Close other applications using the databases
- Ensure sufficient system resources
- Check for network latency (Neo4j)

## Customization

You can modify the benchmark by editing `database-comparison.ts`:

- **Test Documents**: Change `TEST_DOCUMENTS` array
- **Test Queries**: Change `TEST_QUERIES` array
- **Add Operations**: Add new benchmark operations
- **Change Scope**: Modify scope IDs for isolation

## Use Cases

This benchmark is useful for:
- **Performance evaluation**: Choosing the right database for your use case
- **Development decisions**: Understanding trade-offs
- **Optimization**: Identifying bottlenecks
- **Testing**: Ensuring both databases work correctly

---

**Last Updated:** 2025-01-28

