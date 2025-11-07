# Akasha Demo Application

This directory contains a **demo application** that showcases the Akasha GraphRAG library in action. This is **not production code**—it's a working example that demonstrates how to use Akasha in a real application.

## What's Included

- **`backend/`**: ElysiaJS server that provides REST API endpoints for GraphRAG operations
- **`frontend/`**: React-based web UI for interacting with the knowledge graph

## Purpose

This demo serves as:
- A **working example** of Akasha library integration
- A **reference implementation** for developers learning to use Akasha
- A **testbed** for trying out Akasha features interactively

## Features Demonstrated

- ✅ Text extraction from natural language
- ✅ Document node creation and deduplication
- ✅ Entity and relationship extraction
- ✅ Semantic querying with GraphRAG
- ✅ Query strategies (documents, entities, both)
- ✅ **Temporal tracking** (validFrom, validTo, validAt)
- ✅ Context filtering
- ✅ Graph visualization
- ✅ Multi-tenant data isolation

## Running the Demo

### Prerequisites

1. **Neo4j** running and accessible
2. **OpenAI API key** configured
3. **Bun** runtime installed

### Setup

1. Copy `.env.sample` to `.env` in the project root and configure:
   ```bash
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your-password
   OPENAI_API_KEY=your-api-key
   ```

2. Start the demo server:
   ```bash
   cd demo/backend
   bun run src/app.ts
   ```

3. Open your browser to `http://localhost:3000` (or the port shown in console)

### Using the Demo

1. **Extract Text**: Use the "Extract from Natural Language" form to add knowledge to the graph
   - Enter text describing entities and relationships
   - Optionally set temporal validity (Valid From / Valid To)
   - Click "Extract & Create Graph"

2. **Query Graph**: Use the "Query GraphRAG" form to ask questions
   - Enter a natural language question
   - Optionally set query strategy (documents, entities, or both)
   - Optionally set temporal filter (Valid At)
   - Click "Query GraphRAG"

3. **View Results**: See the extracted entities, relationships, and generated answers
   - Temporal metadata is displayed for all facts
   - Graph visualization shows relationships
   - Documents are shown with full text

## Architecture

- **Backend**: ElysiaJS server that wraps Akasha library calls
- **Frontend**: React SPA that communicates with backend via REST API
- **Library**: Uses the published `@glossick/akasha` package from npm

## Important Notes

⚠️ **This is demo code, not production-ready:**
- No authentication or authorization
- No input sanitization beyond basic validation
- No error recovery or retry logic
- No rate limiting
- Simplified error handling

For production use, see the [Akasha documentation](https://www.npmjs.com/package/@glossick/akasha) or the [GitHub repository](https://github.com/Glossick/akasha) for library usage patterns.

## File Structure

```
demo/
├── README.md (this file)
├── backend/
│   ├── src/
│   │   ├── app.ts          # ElysiaJS server with API endpoints
│   │   ├── config/         # Database and OpenAI configuration
│   │   ├── services/       # Legacy services (kept for reference)
│   │   └── types/          # TypeScript type definitions
│   └── MIGRATION_TO_AKASHA.md
└── frontend/
    └── public/
        ├── app.tsx         # Main React application
        ├── api.ts          # API client for backend
        └── components/     # React components
            ├── QueryForm.tsx
            ├── TextExtractionForm.tsx
            ├── Results.tsx
            └── ...
```

## Temporal Tracking Demo

The demo includes full support for temporal tracking:

1. **Learning with Temporal Metadata**:
   - Set "Valid From" to specify when a fact becomes valid
   - Set "Valid To" to specify when a fact expires (leave empty for ongoing facts)

2. **Querying with Temporal Filters**:
   - Set "Valid At" to query facts valid at a specific point in time
   - Leave empty to return all facts regardless of validity period

3. **Viewing Temporal Metadata**:
   - All entities and documents display temporal metadata badges
   - Shows: Recorded date, Valid from, Valid until (if set), Ongoing status

## Troubleshooting

- **"Neo4j connection failed"**: Check your `.env` file and ensure Neo4j is running
- **"OpenAI API error"**: Verify your `OPENAI_API_KEY` is set correctly
- **Frontend not loading**: Check that the server is running and accessible

For more help, see the main project documentation.

