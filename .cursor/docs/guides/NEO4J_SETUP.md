# Neo4j Setup Guide

## Current Issue: Authentication Failure

If you're seeing `Neo.ClientError.Security.Unauthorized`, your Neo4j credentials don't match.

## Quick Fix

### 1. Check Your Neo4j Password

Neo4j requires you to set a password on first startup. Common scenarios:

- **First-time setup**: You set the password when Neo4j first started
- **Default password**: Some installations use `password` by default
- **Custom password**: You may have set a different password

### 2. Update Your `.env` File

Add or update these **required** variables in your `.env` file:

```bash
# Neo4j Configuration (Required)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-actual-password-here

# Optional (defaults to 'neo4j' if not set)
# NEO4J_DATABASE=neo4j
```

**Note:** Only `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` are required. `NEO4J_DATABASE` is optional.

### 3. Find Your Neo4j Password

**Option A: Check Neo4j Browser (Easiest)**
1. Open Neo4j Browser: http://localhost:7474
2. Try logging in with different passwords
3. Once logged in, you know the correct password

**Option B: Reset Neo4j Password**
1. Stop Neo4j server
2. Edit `conf/neo4j.conf` (or `neo4j.conf` in your installation)
3. Add: `dbms.security.auth_enabled=false` (temporarily)
4. Start Neo4j
5. Access Neo4j Browser and set new password
6. Re-enable auth: `dbms.security.auth_enabled=true`
7. Restart Neo4j

**Option C: Check Neo4j Installation**
- If you installed via Docker: Check your docker-compose.yml or docker run command
- If you installed via installer: Check installation notes or configuration files

### 4. Test Connection

After updating `.env`, restart your server:

```bash
# Stop the current server (Ctrl+C)
# Then restart
bun run index.ts
```

You should see:
```
Connected to Neo4j
GraphRAG service initialized
```

### 5. Verify Connection via API

```bash
curl http://localhost:3000/api/neo4j/test
```

Should return:
```json
{
  "status": "connected",
  "message": "Neo4j connection successful",
  "test": [[{"test": 1}]]
}
```

## Troubleshooting

### Still Getting Unauthorized?
- Double-check password spelling (case-sensitive)
- Ensure Neo4j server is actually running
- Check if Neo4j is using a different port
- Verify username is `neo4j` (default)

### Connection Refused?
- Neo4j server not running - start it first
- Wrong port - check `NEO4J_URI` matches your Neo4j setup
- Firewall blocking connection

### Rate Limiting Error?
If you see `AuthenticationRateLimit`, wait a few minutes before trying again. Neo4j locks accounts after too many failed attempts.

## Next Steps

Once connected:
1. Load sample data: `bun run seed:data`
2. Test GraphRAG endpoint: `POST /api/graphrag/query`
3. Explore the graph in Neo4j Browser

