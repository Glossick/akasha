import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { akasha } from '../../akasha/src/factory';
import { Neo4jService } from './services/neo4j.service';
import { neo4jConfig } from './config/database';
import { openaiConfig } from './config/openai';
import type {
  GraphRAGQuery,
  CreateEntityRequest,
  UpdateEntityRequest,
  CreateRelationshipRequest,
  BatchCreateEntitiesRequest,
  BatchCreateRelationshipsRequest,
  ExtractTextRequest,
  ExtractTextResponse,
} from './types/graph';
import type { Akasha } from '../../akasha/src/akasha';

const app = new Elysia();

// Initialize Akasha library (lazy initialization to avoid errors in tests)
let akashaInstance: Akasha | null = null;

function getAkasha(): Akasha {
  if (!akashaInstance) {
    // Create Akasha instance with default scope for backend
    // Using a default scope ensures all backend data is isolated
    akashaInstance = akasha({
      neo4j: {
        uri: neo4jConfig.uri,
        user: neo4jConfig.user,
        password: neo4jConfig.password,
        database: neo4jConfig.database,
      },
      openai: {
        apiKey: openaiConfig.apiKey,
        model: openaiConfig.model,
        embeddingModel: openaiConfig.embeddingModel,
      },
      scope: {
        id: 'backend-default',
        type: 'backend',
        name: 'Backend Default Scope',
      },
    });
  }
  return akashaInstance;
}

// Initialize on startup
app.onStart(async () => {
  try {
    await getAkasha().initialize();
    console.log('✅ Akasha library initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Akasha library:', error);
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      console.error('\n📝 Neo4j Authentication Failed!');
      console.error('   Please check your .env file and ensure NEO4J_PASSWORD is correct.');
      console.error('   See docs/guides/NEO4J_SETUP.md for help.\n');
    }
    console.warn('⚠️  Server will continue running, but GraphRAG queries will fail until Neo4j is connected.');
  }
});

// Cleanup on shutdown
app.onStop(async () => {
  if (akashaInstance) {
    await akashaInstance.cleanup();
  }
});

// API routes must be defined BEFORE static/catch-all routes
app.get('/api/hello', () => 'Hello from API!');

// GraphRAG query endpoint - moved here to ensure it's matched before catch-all
app.post('/api/graphrag/query', async ({ body }) => {
  try {
    const query = body as GraphRAGQuery;
    
    // Validate required fields
    if (!query.query || typeof query.query !== 'string') {
      return {
        error: 'Invalid request',
        message: 'Query string is required',
      };
    }

    // Use Akasha library
    const kg = getAkasha();
    try {
      const response = await kg.ask(query.query, {
        maxDepth: query.maxDepth,
        limit: query.limit,
        strategy: query.strategy || 'both', // Default to 'both' strategy
        includeEmbeddings: query.includeEmbeddings || false,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not initialized')) {
        return {
          error: 'Service not available',
          message: 'Neo4j connection is not initialized. Please check your database configuration.',
          hint: 'See docs/guides/NEO4J_SETUP.md for setup instructions',
        };
      }
      throw error;
    }
  } catch (error) {
    console.error('GraphRAG query error:', error);
    return {
      error: 'Failed to process GraphRAG query',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Extract entities and relationships from natural language text
app.post('/api/graph/extract', async ({ body }) => {
  try {
    const request = body as ExtractTextRequest;
    
    // Validate required fields
    if (!request.text || typeof request.text !== 'string') {
      return {
        error: 'Invalid request',
        message: 'Text is required and must be a string',
      };
    }

    if (request.text.trim().length === 0) {
      return {
        error: 'Invalid request',
        message: 'Text cannot be empty',
      };
    }

    // Use Akasha library
    const kg = getAkasha();
    try {
      const result = await kg.learn(request.text, {
        contextName: 'Extracted Text',
      });
      
      // Map Akasha result to ExtractTextResponse format
      const response: ExtractTextResponse = {
        document: result.document,
        entities: result.entities,
        relationships: result.relationships,
        summary: result.summary,
        created: result.created,
      };
      
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not initialized')) {
        return {
          error: 'Service not available',
          message: 'Neo4j connection is not initialized. Please check your database configuration.',
          hint: 'See docs/guides/NEO4J_SETUP.md for setup instructions',
        };
      }
      throw error;
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    return {
      error: 'Failed to extract graph structure from text',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Health check endpoint
app.get('/api/health', () => ({
  status: 'ok',
  service: 'graphrag',
}));

// Neo4j connection test endpoint
app.get('/api/neo4j/test', async () => {
  try {
    const neo4j = new Neo4jService();
    await neo4j.connect();
    
    // Test query
    const result = await neo4j.executeQuery('RETURN 1 as test');
    await neo4j.disconnect();
    
    return {
      status: 'connected',
      message: 'Neo4j connection successful',
      test: result,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Check NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD in your environment',
    };
  }
});

// ============================================
// Graph Write Operations (Entity Management)
// ============================================

// Create single entity
app.post('/api/graph/entities', async ({ body }) => {
  try {
    const request = body as CreateEntityRequest;
    
    if (!request.label || typeof request.label !== 'string') {
      return {
        error: 'Invalid request',
        message: 'Label is required and must be a string',
      };
    }

    if (!request.properties || typeof request.properties !== 'object') {
      return {
        error: 'Invalid request',
        message: 'Properties are required and must be an object',
      };
    }

    const neo4j = new Neo4jService();
    await neo4j.connect();
    
    try {
      const entity = await neo4j.createEntity(request.label, request.properties);
      return entity;
    } finally {
      await neo4j.disconnect();
    }
  } catch (error) {
    console.error('Create entity error:', error);
    return {
      error: 'Failed to create entity',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Get entity by ID
app.get('/api/graph/entities/:id', async ({ params }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return {
        error: 'Invalid request',
        message: 'Entity ID is required',
      };
    }

    const neo4j = new Neo4jService();
    await neo4j.connect();
    
    try {
      const entity = await neo4j.getEntityById(id);
      
      if (!entity) {
        return {
          error: 'Not found',
          message: `Entity with id ${id} not found`,
        };
      }
      
      return entity;
    } finally {
      await neo4j.disconnect();
    }
  } catch (error) {
    console.error('Get entity error:', error);
    return {
      error: 'Failed to get entity',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Update entity
app.put('/api/graph/entities/:id', async ({ body, params }) => {
  try {
    const { id } = params;
    const request = body as UpdateEntityRequest;
    
    if (!id) {
      return {
        error: 'Invalid request',
        message: 'Entity ID is required',
      };
    }

    if (!request.properties || typeof request.properties !== 'object') {
      return {
        error: 'Invalid request',
        message: 'Properties are required and must be an object',
      };
    }

    const neo4j = new Neo4jService();
    await neo4j.connect();
    
    try {
      const entity = await neo4j.updateEntity(id, request.properties);
      return entity;
    } finally {
      await neo4j.disconnect();
    }
  } catch (error) {
    console.error('Update entity error:', error);
    return {
      error: 'Failed to update entity',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Delete entity
app.delete('/api/graph/entities/:id', async ({ params }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return {
        error: 'Invalid request',
        message: 'Entity ID is required',
      };
    }

    const neo4j = new Neo4jService();
    await neo4j.connect();
    
    try {
      await neo4j.deleteEntity(id);
      return {
        success: true,
        message: `Entity ${id} deleted successfully`,
      };
    } finally {
      await neo4j.disconnect();
    }
  } catch (error) {
    console.error('Delete entity error:', error);
    return {
      error: 'Failed to delete entity',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Batch create entities
app.post('/api/graph/entities/batch', async ({ body }) => {
  try {
    const request = body as BatchCreateEntitiesRequest;
    
    if (!request.entities || !Array.isArray(request.entities)) {
      return {
        error: 'Invalid request',
        message: 'Entities array is required',
      };
    }

    if (request.entities.length === 0) {
      return {
        error: 'Invalid request',
        message: 'Entities array cannot be empty',
      };
    }

    const neo4j = new Neo4jService();
    await neo4j.connect();
    
    try {
      const created = await neo4j.createEntities(request.entities);
      return {
        entities: created,
        created: created.length,
      };
    } finally {
      await neo4j.disconnect();
    }
  } catch (error) {
    console.error('Batch create entities error:', error);
    return {
      error: 'Failed to create entities',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// ============================================
// Graph Write Operations (Relationship Management)
// ============================================

// Create single relationship
app.post('/api/graph/relationships', async ({ body }) => {
  try {
    const request = body as CreateRelationshipRequest;
    
    if (!request.from || !request.to || !request.type) {
      return {
        error: 'Invalid request',
        message: 'from, to, and type are required',
      };
    }

    const neo4j = new Neo4jService();
    await neo4j.connect();
    
    try {
      const relationship = await neo4j.createRelationship(
        request.from,
        request.to,
        request.type,
        request.properties
      );
      return relationship;
    } finally {
      await neo4j.disconnect();
    }
  } catch (error) {
    console.error('Create relationship error:', error);
    return {
      error: 'Failed to create relationship',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Batch create relationships
app.post('/api/graph/relationships/batch', async ({ body }) => {
  try {
    const request = body as BatchCreateRelationshipsRequest;
    
    if (!request.relationships || !Array.isArray(request.relationships)) {
      return {
        error: 'Invalid request',
        message: 'Relationships array is required',
      };
    }

    if (request.relationships.length === 0) {
      return {
        error: 'Invalid request',
        message: 'Relationships array cannot be empty',
      };
    }

    const neo4j = new Neo4jService();
    await neo4j.connect();
    
    try {
      const created = await neo4j.createRelationships(request.relationships);
      return {
        relationships: created,
        created: created.length,
      };
    } finally {
      await neo4j.disconnect();
    }
  } catch (error) {
    console.error('Batch create relationships error:', error);
    return {
      error: 'Failed to create relationships',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Delete relationship
app.delete('/api/graph/relationships/:id', async ({ params }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return {
        error: 'Invalid request',
        message: 'Relationship ID is required',
      };
    }

    const neo4j = new Neo4jService();
    await neo4j.connect();
    
    try {
      await neo4j.deleteRelationship(id);
      return {
        success: true,
        message: `Relationship ${id} deleted successfully`,
      };
    } finally {
      await neo4j.disconnect();
    }
  } catch (error) {
    console.error('Delete relationship error:', error);
    return {
      error: 'Failed to delete relationship',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Create transpilers for TSX/TS files (created once, reused)
const tsxTranspiler = new Bun.Transpiler({
  loader: 'tsx',
  target: 'browser',
});

const tsTranspiler = new Bun.Transpiler({
  loader: 'ts',
  target: 'browser',
});

// Helper function to serve transpiled TSX/TS files
async function serveTranspiledFile(filePath: string, isTSX: boolean): Promise<Response> {
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response('File not found', { status: 404 });
    }
    
    const content = await file.text();
    const transpiler = isTSX ? tsxTranspiler : tsTranspiler;
    let transpiled = transpiler.transformSync(content);
    
    // If the transpiled code uses jsxDEV but doesn't import it, add the import
    if (isTSX && transpiled.includes('jsxDEV') && !transpiled.includes('react/jsx-dev-runtime')) {
      transpiled = `import { jsxDEV } from "react/jsx-dev-runtime";\n${transpiled}`;
    }
    // If the transpiled code uses jsx but doesn't import it, add the import
    if (isTSX && transpiled.includes('jsx(') && !transpiled.includes('react/jsx-runtime') && !transpiled.includes('jsxDEV')) {
      transpiled = `import { jsx } from "react/jsx-runtime";\n${transpiled}`;
    }
    
    return new Response(transpiled, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
      },
    });
  } catch (error) {
    console.error(`Error transpiling ${filePath}:`, error);
    return new Response(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}

// Handle TSX/TS files - MUST come before static plugin
// Specific routes for known files
app.get('/main.tsx', async () => {
  return serveTranspiledFile('./frontend/public/main.tsx', true);
});

app.get('/app.tsx', async () => {
  return serveTranspiledFile('./frontend/public/app.tsx', true);
});

app.get('/api.ts', async () => {
  return serveTranspiledFile('./frontend/public/api.ts', false);
});

// Handle TSX/TS files and SPA routes in a single catch-all handler
// This route matches ALL paths and handles both TSX/TS files and SPA routing
// IMPORTANT: This must come before static plugin
app.get('/*', async ({ path, request }) => {
  // Don't interfere with API routes
  if (path.startsWith('/api/')) {
    return; // Let API routes handle it
  }
  
  // Handle .tsx or .ts files - serve them with correct MIME type
  if (path.endsWith('.tsx') || path.endsWith('.ts')) {
    const filePath = path.startsWith('/') ? path.slice(1) : path;
    const isTSX = path.endsWith('.tsx');
    return serveTranspiledFile(`./frontend/public/${filePath}`, isTSX);
  }
  
  // For files with extensions (but not TSX/TS), let static plugin handle them
  // Static plugin will serve CSS, images, etc. or return 404 if not found
  if (path.includes('.') && !path.endsWith('/')) {
    return; // Let static plugin handle files with extensions
  }
  
  // For routes without file extensions (SPA routes), serve index.html
  // Try Bun's HTML import first (if available)
  if (frontendApp) {
    try {
      if (typeof frontendApp === 'function') {
        return await frontendApp(request);
      }
    } catch (error) {
      console.error('Error serving frontend via HTML import:', error);
    }
  }
  
  // Fallback: serve index.html for SPA routes
  try {
    const file = Bun.file('./frontend/public/index.html');
    if (await file.exists()) {
      const content = await file.text();
      return new Response(content, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }
  } catch (error) {
    console.error('Error serving index.html:', error);
  }
  
  return new Response('Not found', { status: 404 });
});

// Generic handler for any other TSX/TS files in root (single segment)
app.get('/:filename', async ({ path }) => {
  // Only handle .tsx or .ts files - return undefined to let other routes handle it
  if (!path.endsWith('.tsx') && !path.endsWith('.ts')) {
    return; // Let other routes handle it
  }
  
  const filePath = path.startsWith('/') ? path.slice(1) : path;
  const isTSX = path.endsWith('.tsx');
  return serveTranspiledFile(`./frontend/public/${filePath}`, isTSX);
});

// Try to use Bun's HTML import feature (only works with bun --hot)
let frontendApp: any = undefined;

try {
  // @ts-ignore - Bun's HTML import is not fully typed yet
  // Path is relative to backend/src/app.ts -> ../../frontend/public/index.html
  const htmlModule = await import('../../frontend/public/index.html');
  frontendApp = htmlModule.default;
  console.log('✅ Frontend loaded via Bun HTML import (HMR enabled with --hot)');
} catch (error) {
  // HTML import may not work in all Bun versions or without --hot flag
  // That's okay, we'll use the fallback
  console.log('ℹ️  Using fallback HTML serving (run with `bun --hot` for HTML import support)');
}

// Serve the frontend app at root
// This MUST come after TSX/TS handlers but BEFORE static plugin
app.get('/', async ({ request }) => {
  // Try Bun's HTML import first (if available)
  if (frontendApp) {
    try {
      if (typeof frontendApp === 'function') {
        return await frontendApp(request);
      }
    } catch (error) {
      console.error('Error serving frontend via HTML import:', error);
    }
  }
  
  // Fallback: serve index.html file content directly
  try {
    const file = Bun.file('./frontend/public/index.html');
    if (await file.exists()) {
      const content = await file.text();
      return new Response(content, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }
  } catch (error) {
    console.error('Error serving index.html:', error);
  }
  
  return new Response('Not found', { status: 404 });
});

// Serve static assets (CSS, images, JS files, etc.) - but NOT index.html
// This comes AFTER the root route so it doesn't intercept /
app.use(
  staticPlugin({
    assets: './frontend/public',
    prefix: '/',
  })
);

export default app;

