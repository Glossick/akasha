import { Database, Connection, type QueryResult } from '../../../vendor/lbug/index.mjs';
import type { DatabaseProvider } from './interfaces';
import type { Entity, Relationship, Document, DeleteResult } from '../../../types';

/**
 * LadybugDB implementation of DatabaseProvider
 * 
 * LadybugDB is an embedded property graph database with vector search capabilities.
 * It uses a file path instead of a connection string.
 * 
 * Documentation: https://docs.ladybugdb.com/
 * NPM Package: https://www.npmjs.com/package/lbug
 */
export class LadybugProvider implements DatabaseProvider {
  private databasePath: string;
  private db: Database;
  private conn: Connection;

  constructor(config: { databasePath: string }) {
    this.databasePath = config.databasePath;
    // Initialize database and connection
    this.db = new Database(this.databasePath);
    this.conn = new Connection(this.db);
  }

  // Connection & Setup
  async connect(): Promise<void> {
    // Connection already established in constructor
    // Verify connectivity with a simple query
    const result = await this.conn.query('RETURN 1');
    const results = Array.isArray(result) ? result : [result];
    for (const res of results) {
      await res.getAll(); // Consume result
      res.close();
    }
  }

  async disconnect(): Promise<void> {
    // LadybugDB connections don't have explicit close methods
    // The connection will be cleaned up when the Database is closed
    // For now, we'll just ensure queries are finished
    // Note: Database and Connection don't have explicit close() methods in the API
  }

  /**
   * Ensure database schema is created
   * Creates node tables for Entity and Document, and relationship tables
   * 
   * Note: LadybugDB doesn't support IF NOT EXISTS, so we catch "already exists" errors
   */
  private async ensureSchema(): Promise<void> {
    // Create Entity node table
    // Note: LadybugDB requires explicit schema definition with PRIMARY KEY
    // LIST types use STRING[] syntax, DOUBLE[] for embeddings
    // Note: LadybugDB doesn't support dynamic properties - all properties must be in schema
    // We include common properties: name, title (for works), and a generic properties field
    try {
      const result = await this.conn.query(`
        CREATE NODE TABLE Entity(
          id STRING,
          label STRING,
          name STRING,
          title STRING,
          scopeId STRING,
          contextIds STRING[],
          embedding DOUBLE[],
          _recordedAt STRING,
          _validFrom STRING,
          _validTo STRING,
          PRIMARY KEY(id)
        )
      `);
      const results = Array.isArray(result) ? result : [result];
      for (const res of results) {
        await res.getAll();
        res.close();
      }
    } catch (e: any) {
      // Table might already exist - that's fine
      if (!e.message?.includes('already exists') && !e.message?.includes('duplicate')) {
        console.warn('Entity table creation:', e.message);
      }
    }

    // Create Document node table
    try {
      const result = await this.conn.query(`
        CREATE NODE TABLE Document(
          id STRING,
          text STRING,
          scopeId STRING,
          contextIds STRING[],
          embedding DOUBLE[],
          _recordedAt STRING,
          _validFrom STRING,
          _validTo STRING,
          PRIMARY KEY(id)
        )
      `);
      const results = Array.isArray(result) ? result : [result];
      for (const res of results) {
        await res.getAll();
        res.close();
      }
    } catch (e: any) {
      if (!e.message?.includes('already exists') && !e.message?.includes('duplicate')) {
        console.warn('Document table creation:', e.message);
      }
    }

    // Create relationship table for entity-to-entity relationships
    // Note: LadybugDB relationship tables don't support PRIMARY KEY
    try {
      const result = await this.conn.query(`
        CREATE REL TABLE Relationship(
          FROM Entity TO Entity,
          id STRING,
          type STRING,
          scopeId STRING,
          _recordedAt STRING,
          _validFrom STRING,
          _validTo STRING
        )
      `);
      const results = Array.isArray(result) ? result : [result];
      for (const res of results) {
        await res.getAll();
        res.close();
      }
    } catch (e: any) {
      if (!e.message?.includes('already exists') && !e.message?.includes('duplicate')) {
        console.warn('Relationship table creation:', e.message);
      }
    }

    // Create relationship table for document-to-entity relationships (CONTAINS_ENTITY)
    try {
      const result = await this.conn.query(`
        CREATE REL TABLE ContainsEntity(
          FROM Document TO Entity,
          id STRING,
          scopeId STRING
        )
      `);
      const results = Array.isArray(result) ? result : [result];
      for (const res of results) {
        await res.getAll();
        res.close();
      }
    } catch (e: any) {
      if (!e.message?.includes('already exists') && !e.message?.includes('duplicate')) {
        console.warn('ContainsEntity table creation:', e.message);
      }
    }
  }

  async ensureVectorIndex(indexName: string = 'entity_vector_index'): Promise<void> {
    // Ensure schema exists first
    await this.ensureSchema();
    
    // Note: LadybugDB handles vector search differently from Neo4j
    // Based on testing, LadybugDB does NOT require explicit vector index creation
    // Vector search works automatically with DOUBLE[] properties in the schema
    // The embedding properties defined in Entity and Document tables enable vector search
    // 
    // Unlike Neo4j which requires:
    //   CALL db.index.vector.createNodeIndex(...)
    // 
    // LadybugDB automatically supports vector operations on DOUBLE[] properties
    // Vector similarity queries will work once we implement findEntitiesByVector/findDocumentsByVector
    //
    // This method ensures the schema is ready for vector operations
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Vector Search
  async findEntitiesByVector(
    queryEmbedding: number[],
    limit: number = 10,
    similarityThreshold: number = 0.5,
    scopeId?: string,
    contexts?: string[],
    validAt?: string
  ): Promise<Entity[]> {
    await this.ensureSchema();

    // Build query to get all entities with embeddings
    let query = `MATCH (e:Entity) WHERE e.embedding IS NOT NULL`;

    const whereConditions: string[] = [];
    if (scopeId) {
      whereConditions.push(`e.scopeId = ${this.escapeCypherValue(scopeId)}`);
    }
    if (contexts && contexts.length > 0) {
      // Check if any context in contexts array matches any in entity's contextIds
      // Only include entities that have at least one matching contextId
      // Exclude entities with NULL contextIds when contexts are specified
      const contextChecks = contexts.map(ctx => `"${ctx}" IN e.contextIds`).join(' OR ');
      whereConditions.push(`(e.contextIds IS NOT NULL AND ${contextChecks})`);
    }
    if (validAt) {
      whereConditions.push(`(e._validFrom IS NULL OR e._validFrom <= ${this.escapeCypherValue(validAt)})`);
      whereConditions.push(`(e._validTo IS NULL OR e._validTo >= ${this.escapeCypherValue(validAt)})`);
    }

    if (whereConditions.length > 0) {
      query += ` AND ${whereConditions.join(' AND ')}`;
    }

    // Calculate query limit: increase when filters are present to account for filtering
    // After filtering by similarity, we'll limit to the requested amount
    const hasFilters = !!(scopeId || (contexts && contexts.length > 0) || validAt);
    const queryLimit = hasFilters 
      ? Math.max(limit * 5, 500)  // Request 5x more if filtering, but cap at 500 for memory safety
      : Math.max(limit, 100);  // Use reasonable limit when no filters (at least requested limit, or 100 minimum)

    query += ` RETURN e LIMIT ${queryLimit}`;

    try {
      const result = await this.conn.query(query);
      const results = Array.isArray(result) ? result : [result];
      const entitiesWithSimilarity: Array<Entity & { similarity: number }> = [];

      for (const res of results) {
        try {
          const rows = await res.getAll();
          
          for (const row of rows) {
            const entity = this.extractEntityFromResult(row);
            const storedEmbedding = entity.properties.embedding as number[] | undefined;

            if (Array.isArray(storedEmbedding) && storedEmbedding.length > 0) {
              const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
              
              if (similarity >= similarityThreshold) {
                entitiesWithSimilarity.push({
                  ...entity,
                  properties: {
                    ...entity.properties,
                    _similarity: similarity,
                  },
                  similarity,
                });
              }
            }
          }
        } finally {
          res.close();
        }
      }

      // Sort by similarity (descending) and limit
      entitiesWithSimilarity.sort((a, b) => b.similarity - a.similarity);
      return entitiesWithSimilarity.slice(0, limit).map(({ similarity, ...entity }) => entity);
    } catch (e: any) {
      // If query fails, return empty array
      console.warn('Vector search query failed:', e.message);
      return [];
    }
  }

  async findDocumentsByVector(
    queryEmbedding: number[],
    limit: number = 10,
    similarityThreshold: number = 0.5,
    scopeId?: string,
    contexts?: string[],
    validAt?: string
  ): Promise<Document[]> {
    await this.ensureSchema();

    // Build query to get all documents with embeddings
    let query = `MATCH (d:Document) WHERE d.embedding IS NOT NULL`;

    const whereConditions: string[] = [];
    if (scopeId) {
      whereConditions.push(`d.scopeId = ${this.escapeCypherValue(scopeId)}`);
    }
    if (contexts && contexts.length > 0) {
      // Check if any context in contexts array matches any in document's contextIds
      // Only include documents that have at least one matching contextId
      // Exclude documents with NULL contextIds when contexts are specified
      const contextChecks = contexts.map(ctx => `"${ctx}" IN d.contextIds`).join(' OR ');
      whereConditions.push(`(d.contextIds IS NOT NULL AND ${contextChecks})`);
    }
    if (validAt) {
      whereConditions.push(`(d._validFrom IS NULL OR d._validFrom <= ${this.escapeCypherValue(validAt)})`);
      whereConditions.push(`(d._validTo IS NULL OR d._validTo >= ${this.escapeCypherValue(validAt)})`);
    }

    if (whereConditions.length > 0) {
      query += ` AND ${whereConditions.join(' AND ')}`;
    }

    // Calculate query limit: increase when filters are present to account for filtering
    // After filtering by similarity, we'll limit to the requested amount
    const hasFilters = !!(scopeId || (contexts && contexts.length > 0) || validAt);
    const queryLimit = hasFilters 
      ? Math.max(limit * 5, 500)  // Request 5x more if filtering, but cap at 500 for memory safety
      : Math.max(limit, 100);  // Use reasonable limit when no filters (at least requested limit, or 100 minimum)

    query += ` RETURN d LIMIT ${queryLimit}`;

    try {
      const result = await this.conn.query(query);
      const results = Array.isArray(result) ? result : [result];
      const documentsWithSimilarity: Array<Document & { similarity: number }> = [];

      for (const res of results) {
        try {
          const rows = await res.getAll();
          
          for (const row of rows) {
            const node = (row as any).d || row;
            const storedEmbedding = (node && typeof node === 'object' && 'embedding' in node) 
              ? (node.embedding as number[] | undefined)
              : undefined;

            if (Array.isArray(storedEmbedding) && storedEmbedding.length > 0) {
              const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
              
              if (similarity >= similarityThreshold) {
                // Extract document properties
                const properties: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(node)) {
                  if (key !== '_id' && key !== '_label' && key !== 'id') {
                    properties[key] = value;
                  }
                }
                
                const nodeId = (node && typeof node === 'object' && 'id' in node) ? (node.id as string) : undefined;
                const node_id = (node && typeof node === 'object' && '_id' in node) ? (node._id as any) : undefined;
                const docId = nodeId || this.nodeIdToString(node_id || nodeId);
                
                // Ensure required Document properties
                const docProperties: Document['properties'] = {
                  text: (properties.text as string) || '',
                  scopeId: (properties.scopeId as string) || '',
                  ...properties,
                  _similarity: similarity,
                };
                
                documentsWithSimilarity.push({
                  id: docId,
                  label: 'Document',
                  properties: docProperties,
                  similarity,
                });
              }
            }
          }
        } finally {
          res.close();
        }
      }

      // Sort by similarity (descending) and limit
      documentsWithSimilarity.sort((a, b) => b.similarity - a.similarity);
      return documentsWithSimilarity.slice(0, limit).map(({ similarity, ...doc }) => doc);
    } catch (e: any) {
      // If query fails, return empty array
      console.warn('Document vector search query failed:', e.message);
      return [];
    }
  }

  // Graph Operations
  async retrieveSubgraph(
    entityLabels: string[],
    relationshipTypes: string[],
    maxDepth: number,
    limit: number,
    startEntityIds?: string[],
    scopeId?: string
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    await this.ensureSchema();

    const maxDepthInt = Math.floor(maxDepth);
    if (maxDepthInt < 1 || maxDepthInt > 10) {
      throw new Error(`maxDepth must be between 1 and 10, got ${maxDepthInt}`);
    }

    // Check if we have any starting criteria
    if (!startEntityIds?.length && !entityLabels.length) {
      return { entities: [], relationships: [] };
    }

    // Build path query - use same pattern as listRelationships which works
    // Hypothesis: Variable names 'start'/'end' might be reserved, or multiple WHERE conditions cause issues
    // Test: Use same variable names (a, b) and pattern structure as listRelationships
    const pathQuery = `(a:Entity)-[r:Relationship]->(b:Entity)`;

    // Build WHERE conditions using same method as listRelationships (simple array join)
    const whereConditions: string[] = [];
    
    // Add start node conditions (using 'a' instead of 'start')
    if (startEntityIds && startEntityIds.length > 0) {
      if (startEntityIds.length === 1) {
        whereConditions.push(`a.id = ${this.escapeCypherValue(startEntityIds[0])}`);
      } else {
        // Multiple IDs - use OR conditions
        const entityIdConditions = startEntityIds.map(id => `a.id = ${this.escapeCypherValue(id)}`).join(' OR ');
        whereConditions.push(`(${entityIdConditions})`);
      }
    } else if (entityLabels.length > 0) {
      if (entityLabels.length === 1) {
        whereConditions.push(`a.label = ${this.escapeCypherValue(entityLabels[0])}`);
      } else {
        // Multiple labels - use OR conditions
        const labelConditions = entityLabels.map(l => `a.label = ${this.escapeCypherValue(l)}`).join(' OR ');
        whereConditions.push(`(${labelConditions})`);
      }
    }
    
    // Add scope filter for start node (a), end node (b), and relationship (r)
    if (scopeId) {
      whereConditions.push(`a.scopeId = ${this.escapeCypherValue(scopeId)}`);
      whereConditions.push(`b.scopeId = ${this.escapeCypherValue(scopeId)}`); // Filter end nodes by scopeId
      whereConditions.push(`r.scopeId = ${this.escapeCypherValue(scopeId)}`); // Filter relationships by scopeId
    }
    
    // Add relationship type filter
    if (relationshipTypes.length > 0) {
      if (relationshipTypes.length === 1) {
        whereConditions.push(`r.type = ${this.escapeCypherValue(relationshipTypes[0])}`);
      } else {
        // Multiple relationship types - use OR conditions
        const relTypeConditions = relationshipTypes.map(t => `r.type = ${this.escapeCypherValue(t)}`).join(' OR ');
        whereConditions.push(`(${relTypeConditions})`);
      }
    }

    // Build query using same structure as listRelationships
    let query = `MATCH ${pathQuery}`;
    
    // Add WHERE clause if we have conditions (same method as listRelationships)
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += `
      RETURN DISTINCT
        a.id as fromId,
        a.label as fromLabel,
        a as fromNode,
        b.id as toId,
        b.label as toLabel,
        b as toNode,
        r.id as relId,
        r.type as relType,
        r as relNode
      LIMIT ${limit}
    `;

    try {
      const result = await this.conn.query(query);
      const results = Array.isArray(result) ? result : [result];
      const entitiesMap = new Map<string, Entity>();
      const relationshipsMap = new Map<string, Relationship>();

      for (const res of results) {
        const rows = await res.getAll();
        res.close();

        for (const row of rows) {
          const rowAny = row as any;
          // Extract from entity
          const fromId = String(rowAny.fromId || (rowAny.fromNode?.id) || '');
          if (fromId && !entitiesMap.has(fromId)) {
            entitiesMap.set(fromId, this.extractEntityFromResult({ e: rowAny.fromNode || row }));
          }

          // Extract to entity
          const toId = String(rowAny.toId || (rowAny.toNode?.id) || '');
          if (toId && !entitiesMap.has(toId)) {
            entitiesMap.set(toId, this.extractEntityFromResult({ e: rowAny.toNode || row }));
          }

          // Extract relationship
          const relId = String(rowAny.relId || (rowAny.relNode?.id) || '');
          if (relId && !relationshipsMap.has(relId)) {
            // Extract relationship properties
            const relProps: Record<string, unknown> = {};
            const relNode = rowAny.relNode || {};
            if (relNode && typeof relNode === 'object') {
              for (const [key, value] of Object.entries(relNode)) {
                if (key !== '_id' && key !== '_label' && key !== 'id' && key !== 'type') {
                  relProps[key] = value;
                }
              }
            }
            
            const relType = rowAny.relType || (relNode && typeof relNode === 'object' && 'type' in relNode ? (relNode.type as string) : '') || 'Relationship';
            relationshipsMap.set(relId, {
              id: relId,
              type: relType,
              from: fromId,
              to: toId,
              properties: relProps,
            });
          }
        }
      }

      return {
        entities: Array.from(entitiesMap.values()),
        relationships: Array.from(relationshipsMap.values()),
      };
    } catch (e: any) {
      console.warn('Subgraph retrieval failed:', e.message);
      return { entities: [], relationships: [] };
    }
  }

  /**
   * Convert LadybugDB NodeID to string format
   * NodeID format: { offset: number, table: number }
   * String format: "table:offset"
   */
  private nodeIdToString(nodeId: any): string {
    if (typeof nodeId === 'string') {
      return nodeId;
    }
    if (nodeId && typeof nodeId === 'object' && 'offset' in nodeId && 'table' in nodeId) {
      return `${nodeId.table}:${nodeId.offset}`;
    }
    return String(nodeId);
  }

  /**
   * Extract entity properties from LadybugDB result
   */
  private extractEntityFromResult(row: any, entityLabel?: string): Entity {
    const node = row.e || row;
    const nodeId = this.nodeIdToString(node._id || node.id);
    
    // Extract all properties except internal ones
    const properties: Record<string, unknown> = {};
    let idFromProps: string | undefined;
    
    for (const [key, value] of Object.entries(node)) {
      if (key === 'id' && typeof value === 'string') {
        // Store id separately since it's both a property and top-level field
        idFromProps = value;
        properties[key] = value; // Include id in properties too
      } else if (key !== '_id' && key !== '_label') {
        properties[key] = value;
      }
    }
    
    // Use the id from properties if available, otherwise use NodeID
    const id = idFromProps || (node.id as string) || nodeId;
    
    return {
      id,
      label: entityLabel || node.label || node._label || 'Entity',
      properties,
    };
  }

  /**
   * Escape string value for Cypher query (simple escaping)
   */
  private escapeCypherValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      // Escape single quotes and backslashes
      const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `'${escaped}'`;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map(v => this.escapeCypherValue(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
      // For objects, convert to JSON string (LadybugDB may handle this differently)
      return `'${JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    return String(value);
  }

  // Entity CRUD
  async createEntities(
    entities: Array<{ label: string; properties: Record<string, unknown> }>,
    embeddings: number[][]
  ): Promise<Entity[]> {
    await this.ensureSchema();
    
    const createdEntities: Entity[] = [];

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const embedding = embeddings && embeddings[i] ? embeddings[i] : undefined;

      // Validate label
      if (!/^[A-Z][A-Za-z0-9_]*$/.test(entity.label)) {
        throw new Error(`Invalid label: ${entity.label}`);
      }

      // Generate ID if not provided
      const entityId = entity.properties.id 
        ? String(entity.properties.id)
        : `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;

      // Prepare properties with embedding
      const props: Record<string, unknown> = {
        ...entity.properties,
        id: entityId,
        label: entity.label,
      };
      
      if (embedding) {
        props.embedding = embedding;
      }

      // Build property string for Cypher (using string interpolation for now)
      // Note: In production, consider using prepared statements for better security
      const propPairs = Object.entries(props)
        .map(([key, value]) => `${key}: ${this.escapeCypherValue(value)}`)
        .join(', ');

      // Use MERGE for deduplication if name is provided (id must be in MERGE pattern)
      // Note: For MERGE, we need to include id in the pattern, so we'll use name for deduplication
      const useMerge = entity.properties.name && entity.properties.id;
      const uniqueKey = useMerge ? 'name' : null;
      const uniqueValue = uniqueKey ? entity.properties[uniqueKey] : null;

      let query: string;

      if (useMerge && uniqueValue) {
        // MERGE for deduplication - must include id in pattern
        // Set other properties individually (only schema-defined properties)
        const schemaProps = ['label', 'name', 'title', 'scopeId', 'contextIds', 'embedding', '_recordedAt', '_validFrom', '_validTo'];
        const otherProps = Object.entries(props)
          .filter(([k]) => k !== uniqueKey && k !== 'id' && schemaProps.includes(k))
          .map(([key, value]) => `e.${key} = ${this.escapeCypherValue(value)}`)
          .join(', ');
        
        query = `
          MERGE (e:Entity {id: ${this.escapeCypherValue(entityId)}, ${uniqueKey}: ${this.escapeCypherValue(uniqueValue)}})
          ${otherProps ? `SET ${otherProps}` : ''}
          RETURN e
        `;
      } else {
        // CREATE new entity - only include schema-defined properties
        const schemaProps = ['id', 'label', 'name', 'title', 'scopeId', 'contextIds', 'embedding', '_recordedAt', '_validFrom', '_validTo'];
        const filteredProps = Object.entries(props)
          .filter(([k]) => schemaProps.includes(k))
          .map(([key, value]) => `${key}: ${this.escapeCypherValue(value)}`)
          .join(', ');
        
        query = `
          CREATE (e:Entity {${filteredProps}})
          RETURN e
        `;
      }

      const result = await this.conn.query(query);
      const results = Array.isArray(result) ? result : [result];
      for (const res of results) {
        const rows = await res.getAll();
        res.close();

        if (rows.length === 0) {
          throw new Error('Failed to create entity');
        }

        const created = this.extractEntityFromResult(rows[0], entity.label);
        createdEntities.push(created);
      }
    }

    return createdEntities;
  }

  async findEntityByName(name: string, scopeId: string): Promise<Entity | null> {
    await this.ensureSchema();
    
    // Search by name or title (for works)
    const query = `
      MATCH (e:Entity)
      WHERE (e.name = ${this.escapeCypherValue(name)} OR e.title = ${this.escapeCypherValue(name)}) 
        AND e.scopeId = ${this.escapeCypherValue(scopeId)}
      RETURN e
      LIMIT 1
    `;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();
      
      if (rows.length === 0) {
        return null;
      }

      return this.extractEntityFromResult(rows[0]);
    }
    
    return null;
  }

  async findEntityById(entityId: string, scopeId?: string): Promise<Entity | null> {
    await this.ensureSchema();
    
    let query = `
      MATCH (e:Entity {id: ${this.escapeCypherValue(entityId)}})
    `;
    
    if (scopeId) {
      query += ` WHERE e.scopeId = ${this.escapeCypherValue(scopeId)}`;
    }
    
    query += ` RETURN e LIMIT 1`;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();
      
      if (rows.length === 0) {
        return null;
      }

      return this.extractEntityFromResult(rows[0]);
    }
    
    return null;
  }

  async updateEntity(entityId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Entity> {
    await this.ensureSchema();
    
    // Filter out system metadata fields that shouldn't be updated
    const systemMetadataFields = ['_recordedAt', '_validFrom', '_validTo', 'scopeId', 'contextIds', 'embedding', 'id'];
    const schemaProps = ['label', 'name', 'title', 'scopeId', 'contextIds', 'embedding', '_recordedAt', '_validFrom', '_validTo'];
    const filteredProperties = Object.fromEntries(
      Object.entries(properties).filter(([key]) => 
        !systemMetadataFields.includes(key) && schemaProps.includes(key)
      )
    );

    if (Object.keys(filteredProperties).length === 0) {
      // No properties to update, just return the entity
      const found = await this.findEntityById(entityId, scopeId);
      if (!found) {
        throw new Error(`Entity with id ${entityId} not found`);
      }
      return found;
    }

    const setClauses = Object.entries(filteredProperties)
      .map(([key, value]) => `e.${key} = ${this.escapeCypherValue(value)}`)
      .join(', ');

    let query = `
      MATCH (e:Entity {id: ${this.escapeCypherValue(entityId)}})
    `;
    
    if (scopeId) {
      query += ` WHERE e.scopeId = ${this.escapeCypherValue(scopeId)}`;
    }
    
    query += `
      SET ${setClauses}
      RETURN e
    `;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();
      
      if (rows.length === 0) {
        throw new Error(`Entity with id ${entityId} not found`);
      }

      return this.extractEntityFromResult(rows[0]);
    }
    
    throw new Error(`Entity with id ${entityId} not found`);
  }

  async updateEntityContextIds(entityId: string, contextId: string): Promise<Entity> {
    await this.ensureSchema();
    
    // Get current entity to append contextId
    const current = await this.findEntityById(entityId);
    if (!current) {
      throw new Error(`Entity with id ${entityId} not found`);
    }

    const currentContextIds = Array.isArray(current.properties.contextIds) 
      ? [...(current.properties.contextIds as string[])]
      : [];
    
    if (!currentContextIds.includes(contextId)) {
      currentContextIds.push(contextId);
    }

    const query = `
      MATCH (e:Entity {id: ${this.escapeCypherValue(entityId)}})
      SET e.contextIds = ${this.escapeCypherValue(currentContextIds)}
      RETURN e
    `;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();
      
      if (rows.length === 0) {
        throw new Error(`Entity with id ${entityId} not found`);
      }

      return this.extractEntityFromResult(rows[0]);
    }
    
    throw new Error(`Entity with id ${entityId} not found`);
  }

  async deleteEntity(entityId: string, scopeId?: string): Promise<DeleteResult> {
    await this.ensureSchema();
    
    // First check if entity exists
    const found = await this.findEntityById(entityId, scopeId);
    if (!found) {
      return {
        deleted: false,
        message: `Entity with id ${entityId} not found`,
      };
    }

    // Delete entity with DETACH DELETE (removes relationships too)
    // Include scopeId in MATCH pattern if provided
    let query: string;
    
    if (scopeId) {
      query = `
        MATCH (e:Entity {id: ${this.escapeCypherValue(entityId)}, scopeId: ${this.escapeCypherValue(scopeId)}})
        DETACH DELETE e
      `;
    } else {
      query = `
        MATCH (e:Entity {id: ${this.escapeCypherValue(entityId)}})
        DETACH DELETE e
      `;
    }

    try {
      const result = await this.conn.query(query);
      const results = Array.isArray(result) ? result : [result];
      
      for (const res of results) {
        const rows = await res.getAll(); // Consume result
        res.close();
        // If we got here, deletion succeeded
      }
      
      return {
        deleted: true,
        message: 'Entity deleted',
      };
    } catch (e: any) {
      // If entity doesn't exist, that's okay
      if (e.message?.includes('not found') || e.message?.includes('does not exist')) {
        return {
          deleted: false,
          message: `Entity with id ${entityId} not found`,
        };
      }
      return {
        deleted: false,
        message: `Error deleting entity: ${e.message}`,
      };
    }
  }

  async listEntities(label?: string, limit: number = 100, offset: number = 0, scopeId?: string): Promise<Entity[]> {
    await this.ensureSchema();
    
    let query = `MATCH (e:Entity)`;
    
    const whereConditions: string[] = [];
    if (scopeId) {
      whereConditions.push(`e.scopeId = ${this.escapeCypherValue(scopeId)}`);
    }
    if (label) {
      whereConditions.push(`e.label = ${this.escapeCypherValue(label)}`);
    }
    
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    // Order by name if it exists, otherwise by id
    // Note: Simple ordering - LadybugDB may not support COALESCE
    query += ` RETURN e ORDER BY e.id SKIP ${offset} LIMIT ${limit}`;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    const allEntities: Entity[] = [];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();
      
      for (const row of rows) {
        allEntities.push(this.extractEntityFromResult(row));
      }
    }
    
    return allEntities;
  }

  /**
   * Extract relationship properties from LadybugDB result
   */
  private extractRelationshipFromResult(row: any): Relationship {
    const rel = row.r || row;
    const nodeId = this.nodeIdToString(rel._id || rel.id);
    
    // Extract all properties except internal ones
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rel)) {
      if (key !== '_id' && key !== '_label' && key !== 'id' && key !== 'type' && key !== 'from' && key !== 'to') {
        properties[key] = value;
      }
    }
    
    const id = (rel.id as string) || nodeId;
    const type = rel.type || row.type || 'Relationship';
    const from = row.fromId || rel.from || '';
    const to = row.toId || rel.to || '';
    
    return {
      id,
      type,
      from: String(from),
      to: String(to),
      properties,
    };
  }

  // Relationship CRUD
  async createRelationships(
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, unknown>;
    }>
  ): Promise<Relationship[]> {
    await this.ensureSchema();
    
    const created: Relationship[] = [];

    for (const rel of relationships) {
      // Validate relationship type
      if (!/^[A-Z][A-Z0-9_]*$/.test(rel.type)) {
        throw new Error(`Invalid relationship type: ${rel.type}`);
      }

      // Generate ID if not provided
      const relId = rel.properties?.id 
        ? String(rel.properties.id)
        : `rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Prepare properties
      const props: Record<string, unknown> = {
        ...(rel.properties || {}),
        id: relId,
        type: rel.type,
      };

      // Build property string for Cypher
      // Note: Relationship schema only has: id, type, scopeId, _recordedAt, _validFrom, _validTo
      // But we need to check what's actually in the schema - let's be conservative
      const relationshipSchemaProps = ['id', 'type', 'scopeId', '_recordedAt', '_validFrom', '_validTo'];
      const filteredProps = Object.entries(props)
        .filter(([k]) => {
          // Only include properties that are explicitly in the relationship schema
          // Exclude contextIds (relationships don't have this property)
          if (k === 'contextIds') {
            return false;
          }
          return relationshipSchemaProps.includes(k);
        })
        .map(([key, value]) => `${key}: ${this.escapeCypherValue(value)}`)
        .join(', ');

      // Match entities by ID and create relationship
      // Note: Use Relationship type (the table name) but set type property
      const query = `
        MATCH (a:Entity {id: ${this.escapeCypherValue(rel.from)}}), (b:Entity {id: ${this.escapeCypherValue(rel.to)}})
        CREATE (a)-[r:Relationship {${filteredProps}}]->(b)
        RETURN r, a.id as fromId, b.id as toId
      `;

      const result = await this.conn.query(query);
      const results = Array.isArray(result) ? result : [result];
      
      for (const res of results) {
        const rows = await res.getAll();
        res.close();

        if (rows.length === 0) {
          throw new Error(`Failed to create relationship: one or both entities not found`);
        }

        const createdRel = this.extractRelationshipFromResult(rows[0]);
        created.push(createdRel);
      }
    }

    return created;
  }

  async findRelationshipById(relationshipId: string, scopeId?: string): Promise<Relationship | null> {
    await this.ensureSchema();
    
    let query = `
      MATCH (a:Entity)-[r:Relationship]->(b:Entity)
      WHERE r.id = ${this.escapeCypherValue(relationshipId)}
    `;
    
    if (scopeId) {
      query += ` AND r.scopeId = ${this.escapeCypherValue(scopeId)}`;
    }
    
    query += ` RETURN r, a.id as fromId, b.id as toId LIMIT 1`;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();
      
      if (rows.length === 0) {
        return null;
      }

      return this.extractRelationshipFromResult(rows[0]);
    }
    
    return null;
  }

  async updateRelationship(relationshipId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Relationship> {
    await this.ensureSchema();
    
    // Filter out system metadata fields that shouldn't be updated
    // Relationship schema: id, type, scopeId, _recordedAt, _validFrom, _validTo
    const systemMetadataFields = ['_recordedAt', '_validFrom', '_validTo', 'scopeId', 'id', 'type', 'contextIds'];
    const relationshipSchemaProps = ['id', 'type', 'scopeId', '_recordedAt', '_validFrom', '_validTo'];
    
    // Filter properties: exclude system metadata and contextIds (relationships don't have this)
    // But allow custom properties that aren't in the schema (for extensibility)
    const filteredProperties = Object.fromEntries(
      Object.entries(properties).filter(([key]) => 
        !systemMetadataFields.includes(key)
      )
    );

    if (Object.keys(filteredProperties).length === 0) {
      // No properties to update, just return the relationship
      const found = await this.findRelationshipById(relationshipId, scopeId);
      if (!found) {
        throw new Error(`Relationship with id ${relationshipId} not found`);
      }
      return found;
    }

    // Build SET clauses - individual property assignments (LadybugDB doesn't support SET r += {...})
    const setClauses = Object.entries(filteredProperties)
      .map(([key, value]) => `r.${key} = ${this.escapeCypherValue(value)}`)
      .join(', ');

    // Build query - use same pattern as findRelationshipById
    let query = `
      MATCH (a:Entity)-[r:Relationship]->(b:Entity)
      WHERE r.id = ${this.escapeCypherValue(relationshipId)}
    `;
    
    if (scopeId) {
      query += ` AND r.scopeId = ${this.escapeCypherValue(scopeId)}`;
    }
    
    query += `
      SET ${setClauses}
      RETURN r, a.id as fromId, b.id as toId
    `;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();
      
      if (rows.length === 0) {
        throw new Error(`Relationship with id ${relationshipId} not found`);
      }

      return this.extractRelationshipFromResult(rows[0]);
    }
    
    throw new Error(`Relationship with id ${relationshipId} not found`);
  }

  async deleteRelationship(relationshipId: string, scopeId?: string): Promise<DeleteResult> {
    await this.ensureSchema();
    
    // First check if relationship exists (LadybugDB may not support RETURN count(r) in DELETE queries)
    const found = await this.findRelationshipById(relationshipId, scopeId);
    if (!found) {
      return {
        deleted: false,
        message: `Relationship with id ${relationshipId} not found`,
      };
    }

    // Delete relationship using DELETE (not DETACH DELETE - relationships don't have dependent nodes)
    // Use same pattern as findRelationshipById
    let query = `
      MATCH (a:Entity)-[r:Relationship]->(b:Entity)
      WHERE r.id = ${this.escapeCypherValue(relationshipId)}
    `;
    
    if (scopeId) {
      query += ` AND r.scopeId = ${this.escapeCypherValue(scopeId)}`;
    }
    
    query += ` DELETE r`;

    try {
      const result = await this.conn.query(query);
      const results = Array.isArray(result) ? result : [result];
      
      for (const res of results) {
        const rows = await res.getAll(); // Consume result
        res.close();
        // If we got here, deletion succeeded
      }
      
      return {
        deleted: true,
        message: 'Relationship deleted',
      };
    } catch (e: any) {
      // If relationship doesn't exist or scope doesn't match, return false
      if (e.message?.includes('not found') || e.message?.includes('does not exist')) {
        return {
          deleted: false,
          message: `Relationship with id ${relationshipId} not found`,
        };
      }
      return {
        deleted: false,
        message: `Error deleting relationship: ${e.message}`,
      };
    }
  }

  async listRelationships(
    type?: string,
    fromId?: string,
    toId?: string,
    limit: number = 100,
    offset: number = 0,
    scopeId?: string
  ): Promise<Relationship[]> {
    await this.ensureSchema();
    
    // Build MATCH query - use the same pattern as findRelationshipById which works
    let query = `MATCH (a:Entity)-[r:Relationship]->(b:Entity)`;
    
    // Build WHERE conditions
    const whereConditions: string[] = [];
    
    if (type) {
      // Filter by relationship type property (not relationship label)
      whereConditions.push(`r.type = ${this.escapeCypherValue(type)}`);
    }
    
    if (scopeId) {
      whereConditions.push(`r.scopeId = ${this.escapeCypherValue(scopeId)}`);
    }
    
    if (fromId) {
      // Use a.id (property) not id(a) (function) for LadybugDB
      whereConditions.push(`a.id = ${this.escapeCypherValue(fromId)}`);
    }
    
    if (toId) {
      // Use b.id (property) not id(b) (function) for LadybugDB
      whereConditions.push(`b.id = ${this.escapeCypherValue(toId)}`);
    }
    
    // Add WHERE clause if we have conditions
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    // Add ORDER BY, SKIP, LIMIT
    // Use r.id for ordering (property, not function)
    query += ` RETURN r, a.id as fromId, b.id as toId ORDER BY r.id SKIP ${offset} LIMIT ${limit}`;
    
    try {
      const result = await this.conn.query(query);
      const results = Array.isArray(result) ? result : [result];
      const relationships: Relationship[] = [];
      
      for (const res of results) {
        const rows = await res.getAll();
        res.close();
        
        for (const row of rows) {
          relationships.push(this.extractRelationshipFromResult(row));
        }
      }
      
      return relationships;
    } catch (e: any) {
      console.warn('listRelationships failed:', e.message);
      return [];
    }
  }

  /**
   * Extract document properties from LadybugDB result
   */
  private extractDocumentFromResult(row: any): Document {
    const node = row.d || row;
    const nodeId = this.nodeIdToString(node._id || node.id);
    
    // Extract all properties except internal ones
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key !== '_id' && key !== '_label' && key !== 'id') {
        properties[key] = value;
      }
    }
    
    // Use the id from properties if available, otherwise use NodeID
    const id = (node && typeof node === 'object' && 'id' in node) ? (node.id as string) : nodeId;
    
    // Ensure required Document properties
    const docProperties: Document['properties'] = {
      text: (properties.text as string) || '',
      scopeId: (properties.scopeId as string) || '',
      ...properties,
    };
    
    return {
      id,
      label: 'Document',
      properties: docProperties,
    };
  }

  // Document CRUD
  async createDocument(
    document: { properties: Document['properties'] },
    embedding: number[]
  ): Promise<Document> {
    await this.ensureSchema();

    // Generate ID if not provided
    // Note: Document properties don't have an 'id' field - the id is on the Document object itself
    const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Prepare properties with embedding
    const props: Record<string, unknown> = {
      ...document.properties,
      id: docId,
    };
    
    if (embedding) {
      props.embedding = embedding;
    }

    // Build property string for Cypher (only schema-defined properties)
    const schemaProps = ['id', 'text', 'scopeId', 'contextIds', 'embedding', '_recordedAt', '_validFrom', '_validTo'];
    const filteredProps = Object.entries(props)
      .filter(([k]) => schemaProps.includes(k))
      .map(([key, value]) => `${key}: ${this.escapeCypherValue(value)}`)
      .join(', ');

    const query = `
      CREATE (d:Document {${filteredProps}})
      RETURN d
    `;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();

      if (rows.length === 0) {
        throw new Error('Failed to create document');
      }

      return this.extractDocumentFromResult(rows[0]);
    }

    throw new Error('Failed to create document');
  }

  async findDocumentByText(text: string, scopeId: string): Promise<Document | null> {
    await this.ensureSchema();
    
    const query = `
      MATCH (d:Document)
      WHERE d.text = ${this.escapeCypherValue(text)} AND d.scopeId = ${this.escapeCypherValue(scopeId)}
      RETURN d
      LIMIT 1
    `;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();
      
      if (rows.length === 0) {
        return null;
      }

      return this.extractDocumentFromResult(rows[0]);
    }
    
    return null;
  }

  async findDocumentById(documentId: string, scopeId?: string): Promise<Document | null> {
    await this.ensureSchema();
    
    let query = `
      MATCH (d:Document {id: ${this.escapeCypherValue(documentId)}})
    `;
    
    if (scopeId) {
      query += ` WHERE d.scopeId = ${this.escapeCypherValue(scopeId)}`;
    }
    
    query += ` RETURN d LIMIT 1`;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();
      
      if (rows.length === 0) {
        return null;
      }

      return this.extractDocumentFromResult(rows[0]);
    }
    
    return null;
  }

  async updateDocument(documentId: string, properties: Record<string, unknown>, scopeId?: string): Promise<Document> {
    await this.ensureSchema();
    
    // Filter out system metadata fields
    const systemMetadataFields = ['_recordedAt', '_validFrom', '_validTo', 'scopeId', 'contextIds', 'embedding', 'id'];
    const schemaProps = ['text', 'scopeId', 'contextIds', 'embedding', '_recordedAt', '_validFrom', '_validTo'];
    const filteredProperties = Object.fromEntries(
      Object.entries(properties).filter(([key]) => 
        !systemMetadataFields.includes(key) && schemaProps.includes(key)
      )
    );

    if (Object.keys(filteredProperties).length === 0) {
      const found = await this.findDocumentById(documentId, scopeId);
      if (!found) {
        throw new Error(`Document with id ${documentId} not found`);
      }
      return found;
    }

    const setClauses = Object.entries(filteredProperties)
      .map(([key, value]) => `d.${key} = ${this.escapeCypherValue(value)}`)
      .join(', ');

    let query = `
      MATCH (d:Document {id: ${this.escapeCypherValue(documentId)}})
    `;
    
    if (scopeId) {
      query += ` WHERE d.scopeId = ${this.escapeCypherValue(scopeId)}`;
    }
    
    query += `
      SET ${setClauses}
      RETURN d
    `;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();
      
      if (rows.length === 0) {
        throw new Error(`Document with id ${documentId} not found`);
      }

      return this.extractDocumentFromResult(rows[0]);
    }
    
    throw new Error(`Document with id ${documentId} not found`);
  }

  async updateDocumentContextIds(documentId: string, contextId: string): Promise<Document> {
    await this.ensureSchema();
    
    const current = await this.findDocumentById(documentId);
    if (!current) {
      throw new Error(`Document with id ${documentId} not found`);
    }

    const currentContextIds = Array.isArray(current.properties.contextIds) 
      ? [...(current.properties.contextIds as string[])]
      : [];
    
    if (!currentContextIds.includes(contextId)) {
      currentContextIds.push(contextId);
    }

    const query = `
      MATCH (d:Document {id: ${this.escapeCypherValue(documentId)}})
      SET d.contextIds = ${this.escapeCypherValue(currentContextIds)}
      RETURN d
    `;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();
      
      if (rows.length === 0) {
        throw new Error(`Document with id ${documentId} not found`);
      }

      return this.extractDocumentFromResult(rows[0]);
    }
    
    throw new Error(`Document with id ${documentId} not found`);
  }

  async deleteDocument(documentId: string, scopeId?: string): Promise<DeleteResult> {
    await this.ensureSchema();
    
    const found = await this.findDocumentById(documentId, scopeId);
    if (!found) {
      return {
        deleted: false,
        message: `Document with id ${documentId} not found`,
      };
    }

    let query: string;
    
    if (scopeId) {
      query = `
        MATCH (d:Document {id: ${this.escapeCypherValue(documentId)}, scopeId: ${this.escapeCypherValue(scopeId)}})
        DETACH DELETE d
      `;
    } else {
      query = `
        MATCH (d:Document {id: ${this.escapeCypherValue(documentId)}})
        DETACH DELETE d
      `;
    }

    try {
      const result = await this.conn.query(query);
      const results = Array.isArray(result) ? result : [result];
      
      for (const res of results) {
        const rows = await res.getAll();
        res.close();
      }
      
      return {
        deleted: true,
        message: 'Document deleted',
      };
    } catch (e: any) {
      return {
        deleted: false,
        message: `Error deleting document: ${e.message}`,
      };
    }
  }

  async listDocuments(limit: number = 100, offset: number = 0, scopeId?: string): Promise<Document[]> {
    await this.ensureSchema();
    
    let query = `MATCH (d:Document)`;
    
    const whereConditions: string[] = [];
    if (scopeId) {
      whereConditions.push(`d.scopeId = ${this.escapeCypherValue(scopeId)}`);
    }
    
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    query += ` RETURN d ORDER BY d.id SKIP ${offset} LIMIT ${limit}`;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    const allDocuments: Document[] = [];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();
      
      for (const row of rows) {
        allDocuments.push(this.extractDocumentFromResult(row));
      }
    }
    
    return allDocuments;
  }

  // Linking
  async linkEntityToDocument(documentId: string, entityId: string, scopeId: string): Promise<Relationship> {
    await this.ensureSchema();
    
    // Generate relationship ID
    const relId = `contains-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create ContainsEntity relationship
    const query = `
      MATCH (d:Document {id: ${this.escapeCypherValue(documentId)}}), (e:Entity {id: ${this.escapeCypherValue(entityId)}})
      WHERE d.scopeId = ${this.escapeCypherValue(scopeId)} AND e.scopeId = ${this.escapeCypherValue(scopeId)}
      CREATE (d)-[r:ContainsEntity {id: ${this.escapeCypherValue(relId)}, scopeId: ${this.escapeCypherValue(scopeId)}}]->(e)
      RETURN r, d.id as docId, e.id as entityId
    `;

    const result = await this.conn.query(query);
    const results = Array.isArray(result) ? result : [result];
    
    for (const res of results) {
      const rows = await res.getAll();
      res.close();

      if (rows.length === 0) {
        throw new Error(`Failed to link entity to document: document or entity not found`);
      }

      return {
        id: relId,
        type: 'ContainsEntity',
        from: documentId,
        to: entityId,
        properties: { scopeId },
      };
    }

    throw new Error(`Failed to link entity to document`);
  }

  // Additional methods
  async getEntitiesFromDocuments(documentIds: string[], scopeId?: string): Promise<Entity[]> {
    await this.ensureSchema();
    
    if (documentIds.length === 0) {
      return [];
    }

    // Build query to get entities connected to documents via ContainsEntity
    // Use OR conditions for multiple document IDs
    const docIdConditions = documentIds.map(id => `d.id = ${this.escapeCypherValue(id)}`).join(' OR ');
    let query = `
      MATCH (d:Document)-[r:ContainsEntity]->(e:Entity)
      WHERE (${docIdConditions})
    `;
    
    if (scopeId) {
      query += ` AND d.scopeId = ${this.escapeCypherValue(scopeId)} AND e.scopeId = ${this.escapeCypherValue(scopeId)}`;
    }
    
    query += ` RETURN DISTINCT e`;

    try {
      const result = await this.conn.query(query);
      const results = Array.isArray(result) ? result : [result];
      const entitiesMap = new Map<string, Entity>();
      
      for (const res of results) {
        const rows = await res.getAll();
        res.close();
        
        for (const row of rows) {
          const entity = this.extractEntityFromResult(row);
          // Use Map to ensure distinct entities
          if (!entitiesMap.has(entity.id)) {
            entitiesMap.set(entity.id, entity);
          }
        }
      }
      
      return Array.from(entitiesMap.values());
    } catch (e: any) {
      console.warn('getEntitiesFromDocuments failed:', e.message);
      return [];
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.conn.query('RETURN 1');
      const results = Array.isArray(result) ? result : [result];
      for (const res of results) {
        const rows = await res.getAll();
        res.close();
        return rows.length > 0;
      }
      return false;
    } catch {
      return false;
    }
  }
}

