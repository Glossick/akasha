# Database Providers

Akasha supports multiple graph database backends, allowing you to choose the best database for your use case.

## Overview

Akasha uses a database provider pattern that abstracts the underlying database implementation. This allows you to:

- **Switch databases** without changing your application code
- **Use embedded databases** for development and edge deployments
- **Use server-based databases** for production and multi-user applications
- **Test with different databases** easily

## Supported Databases

| Database | Type | Best For | Status |
|----------|------|----------|--------|
| **Neo4j** | Server-based | Production, multi-user, existing Neo4j infrastructure | ✅ Production Ready |
| **LadybugDB** | Embedded | Development, single-user, edge computing, embedded deployments | ✅ Production Ready |

---

## Neo4j Provider

### Overview

Neo4j is a mature, production-ready graph database with excellent performance, scalability, and tooling. It's ideal for production environments, multi-user applications, and when you need the full power of Neo4j's ecosystem.

### Setup

1. **Install Neo4j:**
   - Download from [neo4j.com](https://neo4j.com/download/)
   - Or use Neo4j Aura (cloud): [neo4j.com/cloud/aura](https://neo4j.com/cloud/aura)
   - Or use Docker: `docker run -p 7474:7474 -p 7687:7687 neo4j:latest`

2. **Start Neo4j:**
   ```bash
   # Local installation
   neo4j start
   
   # Or with Docker
   docker run -p 7474:7474 -p 7687:7687 neo4j:latest
   ```

3. **Configure Akasha:**
   ```typescript
   const kg = akasha({
     database: {
       type: 'neo4j',
       config: {
         uri: 'bolt://localhost:7687',
         user: 'neo4j',
         password: 'your-password',
         database: 'neo4j', // Optional, defaults to 'neo4j'
       },
     },
     providers: { /* ... */ },
   });
   ```

### Configuration Options

- **`uri`** (required): Connection URI
  - Local: `'bolt://localhost:7687'`
  - Remote: `'bolt://your-server:7687'`
  - Neo4j Aura: `'neo4j+s://your-instance.databases.neo4j.io'`
  
- **`user`** (required): Username (default: `'neo4j'`)
- **`password`** (required): Password
- **`database`** (optional): Database name (default: `'neo4j'`)

### Features

- ✅ **Vector Index Support**: Automatic vector index creation and management
- ✅ **Full Cypher Support**: All Neo4j Cypher features available
- ✅ **Connection Pooling**: Efficient connection management
- ✅ **Transaction Support**: ACID transactions
- ✅ **Multi-User**: Concurrent access from multiple clients
- ✅ **Scalability**: Horizontal and vertical scaling options
- ✅ **Tooling**: Rich ecosystem (Neo4j Browser, Bloom, etc.)

### Environment Variables

```bash
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j
```

### Example

```typescript
import { akasha } from '@glossick/akasha';

const kg = akasha({
  database: {
    type: 'neo4j',
    config: {
      uri: process.env.NEO4J_URI!,
      user: process.env.NEO4J_USER!,
      password: process.env.NEO4J_PASSWORD!,
    },
  },
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'text-embedding-3-small',
      },
    },
    llm: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'gpt-4',
      },
    },
  },
});

await kg.initialize();
```

### Troubleshooting

**Connection Issues:**
- Verify Neo4j is running: `neo4j status`
- Check firewall settings for remote connections
- Verify credentials in Neo4j Browser (`http://localhost:7474`)

**Vector Index Issues:**
- Ensure Neo4j version 5.0+ with vector index support
- Check Neo4j logs for index creation errors
- Verify sufficient memory for vector operations

---

## LadybugDB Provider

### Overview

LadybugDB is an embedded graph database that requires no server setup, making it ideal for development, single-user applications, edge computing, and embedded deployments.

### Setup

1. **Install LadybugDB:**
   ```bash
   bun add lbug
   # or
   npm install lbug
   ```

2. **Configure Akasha:**
   ```typescript
   const kg = akasha({
     database: {
       type: 'ladybug',
       config: {
         databasePath: './my-database', // Path to database directory
       },
     },
     providers: { /* ... */ },
   });
   ```

### Configuration Options

- **`databasePath`** (required): Path to database directory
  - Relative paths: `'./my-database'`
  - Absolute paths: `'/path/to/database'`
  - The directory will be created if it doesn't exist

### Features

- ✅ **No Server Required**: Embedded database, no separate process
- ✅ **Zero Configuration**: Works out of the box
- ✅ **Fast Startup**: Instant initialization
- ✅ **Vector Search**: Automatic vector search on `DOUBLE[]` properties
- ✅ **Cypher Support**: Full Cypher query language
- ✅ **File-Based**: Database stored as files on disk
- ✅ **Portable**: Easy to backup, copy, or move

### Limitations

- ⚠️ **Single Process**: Only one process can access the database at a time
- ⚠️ **No Remote Access**: Database must be on the same machine
- ⚠️ **Cypher Dialect**: Some Neo4j-specific features may not be available
- ⚠️ **No Connection Pooling**: Single embedded connection

### Environment Variables

```bash
LADYBUG_DATABASE_PATH=./my-database
```

### Example

```typescript
import { akasha } from '@glossick/akasha';

const kg = akasha({
  database: {
    type: 'ladybug',
    config: {
      databasePath: process.env.LADYBUG_DATABASE_PATH || './my-kg-database',
    },
  },
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'text-embedding-3-small',
      },
    },
    llm: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'gpt-4',
      },
    },
  },
});

await kg.initialize();
```

### Database Management

**Creating a New Database:**
```typescript
// Database is created automatically when you initialize
await kg.initialize();
```

**Backing Up:**
```bash
# Simply copy the database directory
cp -r ./my-database ./my-database-backup
```

**Deleting:**
```bash
# Remove the database directory
rm -rf ./my-database
```

### Troubleshooting

**Database Locked:**
- Ensure only one process is accessing the database
- Close any other connections before opening a new one
- Check for stale lock files in the database directory

**Path Issues:**
- Use absolute paths if relative paths cause issues
- Ensure the directory is writable
- Check disk space availability

**Performance:**
- LadybugDB is optimized for read-heavy workloads
- For write-heavy workloads, consider Neo4j
- Large databases may require more memory

---

## Comparison

| Feature | Neo4j | LadybugDB |
|---------|-------|-----------|
| **Setup Complexity** | Medium (server required) | Low (no server) |
| **Deployment** | Server-based | Embedded |
| **Multi-User** | ✅ Yes | ❌ No (single process) |
| **Remote Access** | ✅ Yes | ❌ No |
| **Connection Pooling** | ✅ Yes | ❌ No |
| **Scalability** | ✅ Excellent | ⚠️ Limited |
| **Vector Search** | ✅ Yes | ✅ Yes |
| **Cypher Support** | ✅ Full | ✅ Full (with dialect differences) |
| **Transaction Support** | ✅ ACID | ✅ ACID |
| **Tooling** | ✅ Rich ecosystem | ⚠️ Limited |
| **Best For** | Production, multi-user | Development, single-user, edge |

---

## Configuration Examples

### Development vs Production

**Development (LadybugDB):**
```typescript
const kg = akasha({
  database: {
    type: 'ladybug',
    config: {
      databasePath: './dev-database',
    },
  },
  providers: { /* ... */ },
});
```

**Production (Neo4j):**
```typescript
const kg = akasha({
  database: {
    type: 'neo4j',
    config: {
      uri: process.env.NEO4J_URI!,
      user: process.env.NEO4J_USER!,
      password: process.env.NEO4J_PASSWORD!,
    },
  },
  providers: { /* ... */ },
});
```

### Database-Agnostic Factory

```typescript
function createKG(databaseType: 'neo4j' | 'ladybug' = 'neo4j') {
  return akasha({
    database: databaseType === 'neo4j'
      ? {
          type: 'neo4j',
          config: {
            uri: process.env.NEO4J_URI!,
            user: process.env.NEO4J_USER!,
            password: process.env.NEO4J_PASSWORD!,
          },
        }
      : {
          type: 'ladybug',
          config: {
            databasePath: process.env.LADYBUG_DATABASE_PATH || './database',
          },
        },
    providers: {
      embedding: {
        type: 'openai',
        config: {
          apiKey: process.env.OPENAI_API_KEY!,
          model: 'text-embedding-3-small',
        },
      },
      llm: {
        type: 'openai',
        config: {
          apiKey: process.env.OPENAI_API_KEY!,
          model: 'gpt-4',
        },
      },
    },
  });
}

// Usage
const kg = createKG(process.env.DATABASE_TYPE as 'neo4j' | 'ladybug' || 'neo4j');
await kg.initialize();
```

---

## Migration

### From Neo4j to LadybugDB

Currently, there's no automatic migration tool. To migrate:

1. Export data from Neo4j (using Neo4j's export tools)
2. Import into LadybugDB (manual process or custom script)
3. Update your configuration to use LadybugDB

**Note:** This is a manual process. Consider this when choosing your initial database.

### From LadybugDB to Neo4j

Similar to above - export from LadybugDB and import into Neo4j. The graph structure is compatible, but the migration process is manual.

---

## Advanced Usage

### Custom Database Provider

You can create custom database providers by implementing the `DatabaseProvider` interface:

```typescript
import type { DatabaseProvider } from '@glossick/akasha';

class CustomDatabaseProvider implements DatabaseProvider {
  // Implement all required methods
  async connect(): Promise<void> { /* ... */ }
  async disconnect(): Promise<void> { /* ... */ }
  // ... other methods
}
```

See the [API Reference](./api-reference.md) for the complete `DatabaseProvider` interface.

---

## Best Practices

1. **Development**: Use LadybugDB for faster iteration and no server setup
2. **Production**: Use Neo4j for scalability, multi-user support, and production features
3. **Testing**: Use LadybugDB for isolated test databases
4. **Edge Computing**: Use LadybugDB for embedded deployments
5. **Backup**: Regularly backup your database (especially for production Neo4j instances)

---

## Getting Help

- **Neo4j**: [neo4j.com/docs](https://neo4j.com/docs/)
- **LadybugDB**: [docs.ladybugdb.com](https://docs.ladybugdb.com/)
- **Akasha Issues**: [GitHub Issues](https://github.com/your-repo/issues)

---

**Last Updated:** 2025-01-28

