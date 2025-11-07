import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
// Use published @glossick/akasha package from npm
import { akasha, Akasha } from '@glossick/akasha';
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
  BatchLearnRequest,
  BatchLearnResponse,
} from './types/graph';

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
        validAt: query.validAt,
        includeStats: query.includeStats || false,
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
        validFrom: request.validFrom,
        validTo: request.validTo,
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

// Batch learning endpoint
app.post('/api/graph/extract/batch', async ({ body }) => {
  try {
    const request = body as BatchLearnRequest;
    
    // Validate required fields
    if (!request.items || !Array.isArray(request.items) || request.items.length === 0) {
      return {
        error: 'Invalid request',
        message: 'Items array is required and must not be empty',
      };
    }

    // Use Akasha library
    const kg = getAkasha();
    try {
      const result = await kg.learnBatch(request.items, {
        contextName: request.contextName,
        validFrom: request.validFrom,
        validTo: request.validTo,
        includeEmbeddings: request.includeEmbeddings || false,
      });
      
      const response: BatchLearnResponse = {
        results: result.results.map(r => ({
          document: r.document,
          entities: r.entities,
          relationships: r.relationships,
          summary: r.summary,
          created: r.created,
        })),
        summary: result.summary,
        ...(result.errors && result.errors.length > 0 ? { errors: result.errors } : {}),
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
    console.error('Batch extraction error:', error);
    return {
      error: 'Failed to process batch extraction',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Health check endpoint
app.get('/api/health', async () => {
  try {
    const kg = getAkasha();
    const health = await kg.healthCheck();
    return health;
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      neo4j: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      openai: {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date().toISOString(),
    };
  }
});

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

    const kg = getAkasha();
    const createdEntities = await kg.neo4j.createEntities([{
      label: request.label,
      properties: request.properties,
    }]);
    return createdEntities[0];
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

    const kg = getAkasha();
    const entity = await kg.findEntity(id);
    
    if (!entity) {
      return {
        error: 'Not found',
        message: `Entity with id ${id} not found`,
      };
    }
    
    return entity;
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

    const kg = getAkasha();
    const entity = await kg.updateEntity(id, { properties: request.properties });
    return entity;
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

    const kg = getAkasha();
    const result = await kg.deleteEntity(id);
    return {
      success: result.deleted,
      message: result.message,
      relatedRelationshipsDeleted: result.relatedRelationshipsDeleted,
    };
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

    const kg = getAkasha();
    const created = await kg.neo4j.createEntities(
      request.entities.map(e => ({
        label: e.label,
        properties: e.properties,
      }))
    );
    return {
      entities: created,
      created: created.length,
    };
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

    const kg = getAkasha();
    const created = await kg.neo4j.createRelationships([{
      from: request.from,
      to: request.to,
      type: request.type,
      properties: request.properties || {},
    }]);
    return created[0];
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

    const kg = getAkasha();
    const created = await kg.neo4j.createRelationships(
      request.relationships.map(r => ({
        from: r.from,
        to: r.to,
        type: r.type,
        properties: r.properties || {},
      }))
    );
    return {
      relationships: created,
      created: created.length,
    };
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

    const kg = getAkasha();
    const result = await kg.deleteRelationship(id);
    return {
      success: result.deleted,
      message: result.message,
    };
  } catch (error) {
    console.error('Delete relationship error:', error);
    return {
      error: 'Failed to delete relationship',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// ============================================
// Graph Read Operations (List & Find)
// ============================================

// List entities
app.get('/api/graph/entities', async ({ query }) => {
  try {
    const kg = getAkasha();
    const label = query.label as string | undefined;
    const limit = query.limit ? Number.parseInt(query.limit as string, 10) : undefined;
    const offset = query.offset ? Number.parseInt(query.offset as string, 10) : undefined;
    const includeEmbeddings = query.includeEmbeddings === 'true';

    const entities = await kg.listEntities({
      label,
      limit,
      offset,
      includeEmbeddings,
    });

    return entities;
  } catch (error) {
    console.error('List entities error:', error);
    return {
      error: 'Failed to list entities',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// List relationships
app.get('/api/graph/relationships', async ({ query }) => {
  try {
    const kg = getAkasha();
    const type = query.type as string | undefined;
    const fromId = query.fromId as string | undefined;
    const toId = query.toId as string | undefined;
    const limit = query.limit ? Number.parseInt(query.limit as string, 10) : undefined;
    const offset = query.offset ? Number.parseInt(query.offset as string, 10) : undefined;
    const includeEmbeddings = query.includeEmbeddings === 'true';

    const relationships = await kg.listRelationships({
      type,
      fromId,
      toId,
      limit,
      offset,
      includeEmbeddings,
    });

    return relationships;
  } catch (error) {
    console.error('List relationships error:', error);
    return {
      error: 'Failed to list relationships',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// List documents
app.get('/api/graph/documents', async ({ query }) => {
  try {
    const kg = getAkasha();
    const limit = query.limit ? Number.parseInt(query.limit as string, 10) : undefined;
    const offset = query.offset ? Number.parseInt(query.offset as string, 10) : undefined;
    const includeEmbeddings = query.includeEmbeddings === 'true';

    const documents = await kg.listDocuments({
      limit,
      offset,
      includeEmbeddings,
    });

    return documents;
  } catch (error) {
    console.error('List documents error:', error);
    return {
      error: 'Failed to list documents',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Find relationship by ID
app.get('/api/graph/relationships/:id', async ({ params }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return {
        error: 'Invalid request',
        message: 'Relationship ID is required',
      };
    }

    const kg = getAkasha();
    const relationship = await kg.findRelationship(id);
    
    if (!relationship) {
      return {
        error: 'Not found',
        message: `Relationship with id ${id} not found`,
      };
    }
    
    return relationship;
  } catch (error) {
    console.error('Find relationship error:', error);
    return {
      error: 'Failed to find relationship',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Find document by ID
app.get('/api/graph/documents/:id', async ({ params }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return {
        error: 'Invalid request',
        message: 'Document ID is required',
      };
    }

    const kg = getAkasha();
    const document = await kg.findDocument(id);
    
    if (!document) {
      return {
        error: 'Not found',
        message: `Document with id ${id} not found`,
      };
    }
    
    return document;
  } catch (error) {
    console.error('Find document error:', error);
    return {
      error: 'Failed to find document',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// ============================================
// Graph Update Operations
// ============================================

// Update relationship
app.put('/api/graph/relationships/:id', async ({ body, params }) => {
  try {
    const { id } = params;
    const request = body as { properties?: Record<string, unknown> };
    
    if (!id) {
      return {
        error: 'Invalid request',
        message: 'Relationship ID is required',
      };
    }

    if (!request.properties || typeof request.properties !== 'object') {
      return {
        error: 'Invalid request',
        message: 'Properties are required and must be an object',
      };
    }

    const kg = getAkasha();
    const relationship = await kg.updateRelationship(id, { properties: request.properties });
    return relationship;
  } catch (error) {
    console.error('Update relationship error:', error);
    return {
      error: 'Failed to update relationship',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Update document
app.put('/api/graph/documents/:id', async ({ body, params }) => {
  try {
    const { id } = params;
    const request = body as { properties?: Record<string, unknown> };
    
    if (!id) {
      return {
        error: 'Invalid request',
        message: 'Document ID is required',
      };
    }

    if (!request.properties || typeof request.properties !== 'object') {
      return {
        error: 'Invalid request',
        message: 'Properties are required and must be an object',
      };
    }

    const kg = getAkasha();
    const document = await kg.updateDocument(id, { properties: request.properties });
    return document;
  } catch (error) {
    console.error('Update document error:', error);
    return {
      error: 'Failed to update document',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// ============================================
// Graph Delete Operations
// ============================================

// Delete document
app.delete('/api/graph/documents/:id', async ({ params }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return {
        error: 'Invalid request',
        message: 'Document ID is required',
      };
    }

    const kg = getAkasha();
    const result = await kg.deleteDocument(id);
    return {
      success: result.deleted,
      message: result.message,
      relatedRelationshipsDeleted: result.relatedRelationshipsDeleted,
    };
  } catch (error) {
    console.error('Delete document error:', error);
    return {
      error: 'Failed to delete document',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// ============================================
// Configuration Validation
// ============================================

// Validate configuration
app.post('/api/config/validate', async ({ body }) => {
  try {
    const config = body as any;
    
    if (!config || typeof config !== 'object') {
      return {
        valid: false,
        errors: [{
          field: 'config',
          message: 'Configuration object is required',
        }],
      };
    }

    const { Akasha } = await import('@glossick/akasha');
    const validation = Akasha.validateConfig(config);
    return validation;
  } catch (error) {
    console.error('Config validation error:', error);
    return {
      valid: false,
      errors: [{
        field: 'config',
        message: error instanceof Error ? error.message : 'Unknown error',
      }],
    };
  }
});

// Create transpilers for TSX/TS files (created once, reused)
// Only available in Bun runtime
let tsxTranspiler: any = null;
let tsTranspiler: any = null;

if (typeof Bun !== 'undefined') {
  tsxTranspiler = new Bun.Transpiler({
    loader: 'tsx',
    target: 'browser',
  });
  tsTranspiler = new Bun.Transpiler({
    loader: 'ts',
    target: 'browser',
  });
}

// Helper function to serve transpiled TSX/TS files
async function serveTranspiledFile(filePath: string, isTSX: boolean): Promise<Response> {
  try {
    let content: string;
    
    // Use Bun.file if available, otherwise use Node.js fs
    if (typeof Bun !== 'undefined') {
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        return new Response('File not found', { status: 404 });
      }
      content = await file.text();
    } else {
      // Node.js fallback - read file using fs
      const fs = await import('fs/promises');
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch (error) {
        return new Response('File not found', { status: 404 });
      }
    }
    
    // Transpile if Bun is available, otherwise return as-is (for Node.js, use a bundler in production)
    if (typeof Bun !== 'undefined' && tsxTranspiler && tsTranspiler) {
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
    } else {
      // Node.js: Return raw content (for production, use a bundler like Vite)
      // This is a fallback - in production, you should pre-build the frontend
      console.warn('⚠️  Frontend transpilation requires Bun. For Node.js, use a bundler (e.g., Vite) or run with Bun.');
      return new Response(content, {
        headers: {
          'Content-Type': isTSX ? 'application/javascript; charset=utf-8' : 'application/javascript; charset=utf-8',
        },
      });
    }
  } catch (error) {
    console.error(`Error transpiling ${filePath}:`, error);
    return new Response(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}

// Handle TSX/TS files - MUST come before static plugin
// Specific routes for known files
app.get('/main.tsx', async () => {
    return serveTranspiledFile('./demo/frontend/public/main.tsx', true);
});

app.get('/app.tsx', async () => {
    return serveTranspiledFile('./demo/frontend/public/app.tsx', true);
});

app.get('/api.ts', async () => {
    return serveTranspiledFile('./demo/frontend/public/api.ts', false);
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
    return serveTranspiledFile(`./demo/frontend/public/${filePath}`, isTSX);
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
    const file = Bun.file('./demo/frontend/public/index.html');
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
  // Path is relative to demo/backend/src/app.ts -> ../../../demo/frontend/public/index.html
  const htmlModule = await import('../../../demo/frontend/public/index.html');
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
    let content: string;
    if (typeof Bun !== 'undefined') {
      const file = Bun.file('./demo/frontend/public/index.html');
      if (await file.exists()) {
        content = await file.text();
      } else {
        throw new Error('File not found');
      }
    } else {
      // Node.js fallback
      const fs = await import('fs/promises');
      content = await fs.readFile('./demo/frontend/public/index.html', 'utf-8');
    }
    return new Response(content, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error serving index.html:', error);
  }
  
  return new Response('Not found', { status: 404 });
});

// Serve static assets (CSS, images, JS files, etc.) - but NOT index.html
// This comes AFTER the root route so it doesn't intercept /
app.use(
  staticPlugin({
    assets: './demo/frontend/public',
    prefix: '/',
  })
);

export default app;

