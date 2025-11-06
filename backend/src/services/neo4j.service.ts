import neo4j, { Driver, Session } from 'neo4j-driver';
import { neo4jConfig } from '../config/database';
import type { Entity, Relationship } from '../types/graph';

export class Neo4jService {
  private driver: Driver | null = null;

  async connect(): Promise<void> {
    if (this.driver) {
      return;
    }

    this.driver = neo4j.driver(
      neo4jConfig.uri,
      neo4j.auth.basic(neo4jConfig.user, neo4jConfig.password)
    );

    // Verify connectivity
    try {
      await this.driver.verifyConnectivity();
      console.log('Connected to Neo4j');
    } catch (error) {
      console.error('Failed to connect to Neo4j:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }

  private getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }
    return this.driver.session({ database: neo4jConfig.database });
  }

  async executeQuery<T>(query: string, parameters?: Record<string, unknown>): Promise<T[]> {
    const session = this.getSession();
    try {
      const result = await session.run(query, parameters);
      return result.records.map((record) => record.toObject() as T);
    } finally {
      await session.close();
    }
  }

  /**
   * Retrieve relevant subgraph based on entity labels or specific entity IDs
   * If entityIds is provided, matches those specific entities
   * If entityIds is empty, uses entityLabels to match by label
   */
  async retrieveSubgraph(
    entityLabels: string[],
    relationshipTypes: string[],
    maxDepth: number = 2,
    limit: number = 50,
    entityIds?: string[]
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    const session = this.getSession();
    try {
      // Ensure maxDepth and limit are integers (Neo4j requires INTEGER type, not float)
      const maxDepthInt = Math.floor(maxDepth);
      const limitInt = neo4j.int(Math.floor(limit));
      
      // Validate maxDepth is within reasonable bounds (1-10) for security
      if (maxDepthInt < 1 || maxDepthInt > 10) {
        throw new Error(`maxDepth must be between 1 and 10, got ${maxDepthInt}`);
      }
      
      // Build dynamic Cypher query to retrieve subgraph
      // Note: maxDepth must be interpolated (not parameterized) because Neo4j doesn't
      // allow parameters in relationship depth patterns [rels*1..$maxDepth]
      // This is safe because maxDepth is validated to be an integer between 1-10
      
      let startNodePattern: string;
      let whereClause: string;
      
      if (entityIds && entityIds.length > 0) {
        // Match specific entities by ID
        const entityIdsList = entityIds.map(id => neo4j.int(id).toString()).join(', ');
        startNodePattern = '(start)';
        whereClause = `WHERE id(start) IN [${entityIdsList}]`;
      } else if (entityLabels.length > 0) {
        // Match by labels
      const labels = entityLabels.map((label) => `:${label}`).join('');
        startNodePattern = `(start${labels})`;
        whereClause = '';
      } else {
        // No entities to match - return empty
        return { entities: [], relationships: [] };
      }
      
      // Handle relationship type filtering
      let relationshipFilter = '';
      if (relationshipTypes.length > 0) {
      const relTypesList = relationshipTypes.map((t) => `'${t}'`).join(', ');
        relationshipFilter = `ALL(r IN rels WHERE type(r) IN [${relTypesList}])`;
      }

      // Build WHERE clause - combine node matching and relationship filtering
      let combinedWhereClause = '';
      if (whereClause && relationshipFilter) {
        combinedWhereClause = `${whereClause} AND ${relationshipFilter}`;
      } else if (whereClause) {
        combinedWhereClause = whereClause;
      } else if (relationshipFilter) {
        combinedWhereClause = `WHERE ${relationshipFilter}`;
      }

      // Query to get all nodes and relationships in the subgraph
      // We use UNWIND to extract individual relationships from paths and deduplicate them
      const query = `
        MATCH path = ${startNodePattern}-[rels*1..${maxDepthInt}]-(end)
        ${combinedWhereClause}
        WITH path, start, end, rels
        LIMIT $limit
        UNWIND rels AS rel
        WITH DISTINCT rel, startNode(rel) AS fromNode, endNode(rel) AS toNode
        RETURN DISTINCT
          id(fromNode) as fromId,
          labels(fromNode) as fromLabels,
          properties(fromNode) as fromProps,
          id(toNode) as toId,
          labels(toNode) as toLabels,
          properties(toNode) as toProps,
          id(rel) as relId,
          type(rel) as relType,
          properties(rel) as relProps
        ORDER BY relId
      `;

      const result = await session.run(query, {
        limit: limitInt,
      });
      const entitiesMap = new Map<string, Entity>();
      const relationshipsMap = new Map<string, Relationship>();

      result.records.forEach((record) => {
        // Add from entity
        const fromId = record.get('fromId').toString();
        if (!entitiesMap.has(fromId)) {
          entitiesMap.set(fromId, {
            id: fromId,
            label: record.get('fromLabels')[0] || 'Unknown',
            properties: record.get('fromProps') || {},
          });
        }

        // Add to entity
        const toId = record.get('toId').toString();
        if (!entitiesMap.has(toId)) {
          entitiesMap.set(toId, {
            id: toId,
            label: record.get('toLabels')[0] || 'Unknown',
            properties: record.get('toProps') || {},
          });
        }

        // Add relationship (deduplicated by ID)
        const relId = record.get('relId').toString();
        if (!relationshipsMap.has(relId)) {
          relationshipsMap.set(relId, {
            id: relId,
            type: record.get('relType'),
            from: fromId,
            to: toId,
            properties: record.get('relProps') || {},
          });
        }
      });

      return {
        entities: Array.from(entitiesMap.values()),
        relationships: Array.from(relationshipsMap.values()),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Find entities by vector similarity search
   * Uses Neo4j vector index if available, otherwise falls back to text search
   */
  async findEntitiesByVector(
    queryEmbedding: number[],
    limit: number = 10,
    similarityThreshold: number = 0.5
  ): Promise<Entity[]> {
    const session = this.getSession();
    try {
      const limitInt = neo4j.int(Math.floor(limit));
      
      // Try vector index search first (Neo4j 5.x+)
      let useFallback = false;
      let vectorResults: Entity[] = [];
      
      try {
        const query = `
          CALL db.index.vector.queryNodes(
            'entity_vector_index',
            $k,
            $queryVector
          )
          YIELD node, score
          WITH node, score
          ORDER BY score DESC
          LIMIT $limit
          RETURN id(node) as id, labels(node) as labels, properties(node) as properties, score
        `;
        
        // Neo4j expects array of floats - pass directly as array
        const queryVector = queryEmbedding;
        const result = await session.run(query, {
          k: limitInt,
          queryVector,
          limit: limitInt,
        });
        
        vectorResults = result.records
          .map((record) => ({
            id: record.get('id').toString(),
            label: record.get('labels')[0] || 'Unknown',
            properties: {
              ...record.get('properties'),
              _similarity: record.get('score'),
            },
          }))
          .filter((e) => {
            // Filter by threshold after getting results (cosine similarity scores are typically 0-1)
            const score = e.properties._similarity as number;
            return score >= similarityThreshold;
          });
        
        // If we got results from vector index, return them
        if (vectorResults.length > 0) {
          console.log(`✅ Vector index found ${vectorResults.length} entities`);
          return vectorResults;
        } else {
          console.warn(`⚠️  Vector index returned 0 results (threshold: ${similarityThreshold}), trying fallback`);
          useFallback = true;
        }
      } catch (vectorError) {
        // Vector index not available, fall back to property-based cosine similarity
        console.warn('Vector index search not available, using fallback:', vectorError instanceof Error ? vectorError.message : 'Unknown error');
        useFallback = true;
      }
      
      // Fallback: Find all entities with embeddings and compute similarity manually
      // This works when vector index isn't available or returns no results
      if (useFallback || vectorResults.length === 0) {
        console.log('Using fallback property-based cosine similarity search');
        const fallbackQuery = `
          MATCH (n)
          WHERE n.embedding IS NOT NULL
          RETURN id(n) as id, labels(n) as labels, properties(n) as properties, n.embedding as embedding
          LIMIT 1000
        `;
        
        const fallbackResult = await session.run(fallbackQuery);
        const entities: Array<Entity & { similarity?: number }> = [];
        
        console.log(`Found ${fallbackResult.records.length} entities with embeddings for similarity computation`);
        
        for (const record of fallbackResult.records) {
          const storedEmbedding = record.get('embedding');
          if (Array.isArray(storedEmbedding) && storedEmbedding.length > 0) {
            const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
            // Lower threshold for fallback - we want to find matches
            if (similarity >= similarityThreshold) {
              entities.push({
                id: record.get('id').toString(),
                label: record.get('labels')[0] || 'Unknown',
                properties: {
                  ...record.get('properties'),
                  _similarity: similarity,
                },
              });
            }
          }
        }
        
        // Sort by similarity and limit
        entities.sort((a, b) => (b.properties._similarity as number || 0) - (a.properties._similarity as number || 0));
        const results = entities.slice(0, limit).map(({ _similarity, ...entity }) => entity);
        
        console.log(`Fallback search found ${results.length} entities above threshold ${similarityThreshold}`);
        return results;
      }
      
      return vectorResults;
    } finally {
      await session.close();
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * Helper function for fallback similarity computation
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
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find entities by text similarity (requires vector search setup)
   * This is a placeholder - in production, use Neo4j vector indexes
   */
  async findEntitiesByText(text: string, limit: number = 10): Promise<Entity[]> {
    const session = this.getSession();
    try {
      // Ensure limit is an integer (Neo4j requires INTEGER type, not float)
      const limitInt = neo4j.int(Math.floor(limit));
      
      // Simple text search - replace with vector similarity search in production
      const query = `
        MATCH (n)
        WHERE toLower(n.name) CONTAINS toLower($text)
           OR toLower(n.title) CONTAINS toLower($text)
           OR toLower(n.description) CONTAINS toLower($text)
        RETURN id(n) as id, labels(n) as labels, properties(n) as properties
        LIMIT $limit
      `;

      const result = await session.run(query, { text, limit: limitInt });
      return result.records.map((record) => ({
        id: record.get('id').toString(),
        label: record.get('labels')[0] || 'Unknown',
        properties: record.get('properties') || {},
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Ensure vector index exists for entity embeddings
   * This should be called once during initialization
   */
  async ensureVectorIndex(indexName: string = 'entity_vector_index'): Promise<void> {
    const session = this.getSession();
    try {
      // First, add Entity label to all existing nodes with embeddings (for backward compatibility)
      const updateResult = await session.run(`
        MATCH (n)
        WHERE n.embedding IS NOT NULL AND NOT n:Entity
        SET n:Entity
        RETURN count(n) as updated
      `);
      const updatedCount = updateResult.records[0]?.get('updated') || 0;
      if (updatedCount > 0) {
        console.log(`✅ Added 'Entity' label to ${updatedCount} existing entities with embeddings`);
      }

      // Check if index exists
      const checkResult = await session.run(`
        SHOW INDEXES
        WHERE name = $indexName
      `, { indexName });

      if (checkResult.records.length === 0) {
        // Try to create vector index (Neo4j 5.x+)
        // Note: Vector indexes require a specific label, so we'll try to create on a common pattern
        // If your entities don't have a common label, the fallback similarity search will be used
        try {
          // Try creating index on a common label pattern
          // Note: This assumes entities might have a base label - adjust as needed
          await session.run(`
            CALL db.index.vector.createNodeIndex(
              $indexName,
              'Entity',
              'embedding',
              1536,
              'cosine'
            )
          `, { indexName });
          console.log(`✅ Vector index '${indexName}' created`);
          console.log(`   Note: Index targets 'Entity' label. All entities with embeddings now have this label.`);
        } catch (error) {
          // Vector indexes might not be supported in this Neo4j version
          // Or the label doesn't exist - that's okay, we'll use fallback
          console.warn(`⚠️  Vector index creation not available: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.warn('   Using fallback property-based cosine similarity search');
        }
      } else {
        console.log(`✅ Vector index '${indexName}' already exists`);
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Create a single entity (node) in the graph
   * Uses MERGE to avoid duplicates based on label and unique property
   * Optionally accepts an embedding vector to store for similarity search
   */
  async createEntity(
    label: string,
    properties: Record<string, unknown>,
    embedding?: number[]
  ): Promise<Entity> {
    const session = this.getSession();
    try {
      // Validate label (prevent injection, allow alphanumeric and underscores)
      if (!/^[A-Z][A-Za-z0-9_]*$/.test(label)) {
        throw new Error(`Invalid label: ${label}. Must start with uppercase letter and contain only alphanumeric and underscores.`);
      }

      // Use MERGE to create or get existing entity
      // If name property exists, use it as unique identifier
      const uniqueKey = properties.name ? 'name' : properties.id ? 'id' : null;
      const uniqueValue = uniqueKey ? properties[uniqueKey] : null;

      // Prepare properties with embedding if provided
      const propsWithEmbedding = embedding 
        ? { ...properties, embedding }
        : properties;

      let query: string;
      let params: Record<string, unknown>;

      if (uniqueKey && uniqueValue) {
        // Use MERGE with unique property (label is validated, safe to interpolate)
        // Add 'Entity' label for vector index compatibility
        query = `
          MERGE (n:${label}:Entity {${uniqueKey}: $uniqueValue})
          SET n += $properties
          ${embedding ? 'SET n.embedding = $embedding' : ''}
          RETURN id(n) as id, labels(n) as labels, properties(n) as properties
        `;
        params = {
          uniqueValue,
          properties: propsWithEmbedding,
          ...(embedding ? { embedding } : {}),
        };
      } else {
        // CREATE new entity (no unique constraint, label is validated)
        // Add 'Entity' label for vector index compatibility
        query = `
          CREATE (n:${label}:Entity $properties)
          ${embedding ? 'SET n.embedding = $embedding' : ''}
          RETURN id(n) as id, labels(n) as labels, properties(n) as properties
        `;
        params = { 
          properties: propsWithEmbedding,
          ...(embedding ? { embedding } : {}),
        };
      }

      const result = await session.run(query, params);
      const record = result.records[0];
      if (!record) {
        throw new Error('Failed to create entity');
      }

      return {
        id: record.get('id').toString(),
        label: record.get('labels')[0] || label,
        properties: record.get('properties') || properties,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Create multiple entities in a batch operation
   * Optionally accepts embeddings array (one per entity)
   */
  async createEntities(
    entities: Array<{ label: string; properties: Record<string, unknown> }>,
    embeddings?: number[][]
  ): Promise<Entity[]> {
    const session = this.getSession();
    try {
      const createdEntities: Entity[] = [];

      // For simplicity, create entities one by one (can be optimized with UNWIND)
      // This allows us to pass embeddings per entity
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        const embedding = embeddings && embeddings[i] ? embeddings[i] : undefined;
        const created = await this.createEntity(entity.label, entity.properties, embedding);
        createdEntities.push(created);
      }

      return createdEntities;
    } finally {
      await session.close();
    }
  }

  /**
   * Update entity properties
   */
  async updateEntity(
    id: string,
    properties: Record<string, unknown>
  ): Promise<Entity> {
    const session = this.getSession();
    try {
      const entityId = neo4j.int(id);

      const query = `
        MATCH (n)
        WHERE id(n) = $id
        SET n += $properties
        RETURN id(n) as id, labels(n) as labels, properties(n) as properties
      `;

      const result = await session.run(query, {
        id: entityId,
        properties,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error(`Entity with id ${id} not found`);
      }

      return {
        id: record.get('id').toString(),
        label: record.get('labels')[0] || 'Unknown',
        properties: record.get('properties') || {},
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Delete an entity and all its relationships
   */
  async deleteEntity(id: string): Promise<void> {
    const session = this.getSession();
    try {
      const entityId = neo4j.int(id);

      const query = `
        MATCH (n)
        WHERE id(n) = $id
        DETACH DELETE n
      `;

      await session.run(query, { id: entityId });
    } finally {
      await session.close();
    }
  }

  /**
   * Create a relationship between two entities
   * Note: Relationship type cannot be parameterized in Cypher, so we validate it
   */
  async createRelationship(
    fromId: string,
    toId: string,
    type: string,
    properties?: Record<string, unknown>
  ): Promise<Relationship> {
    const session = this.getSession();
    try {
      // Validate relationship type (prevent injection, allow alphanumeric and underscores)
      if (!/^[A-Z][A-Z0-9_]*$/.test(type)) {
        throw new Error(`Invalid relationship type: ${type}. Must be uppercase alphanumeric with underscores.`);
      }

      const from = neo4j.int(fromId);
      const to = neo4j.int(toId);

      // Relationship type must be literal in Cypher, but we've validated it
      // Use MERGE to prevent duplicate relationships (idempotent)
      const query = `
        MATCH (from), (to)
        WHERE id(from) = $from AND id(to) = $to
        MERGE (from)-[r:${type}]->(to)
        SET r += $props
        RETURN id(r) as id, type(r) as type, id(from) as fromId, id(to) as toId, properties(r) as properties
      `;

      const result = await session.run(query, {
        from,
        to,
        props: properties || {},
      });

      const record = result.records[0];
      if (!record) {
        throw new Error(`Failed to create relationship: one or both entities not found`);
      }

      return {
        id: record.get('id').toString(),
        type: record.get('type'),
        from: record.get('fromId').toString(),
        to: record.get('toId').toString(),
        properties: record.get('properties') || properties || {},
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Create multiple relationships in a batch
   */
  async createRelationships(
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, unknown>;
    }>
  ): Promise<Relationship[]> {
    const created: Relationship[] = [];

    for (const rel of relationships) {
      const createdRel = await this.createRelationship(
        rel.from,
        rel.to,
        rel.type,
        rel.properties
      );
      created.push(createdRel);
    }

    return created;
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(id: string): Promise<void> {
    const session = this.getSession();
    try {
      const relId = neo4j.int(id);

      const query = `
        MATCH ()-[r]->()
        WHERE id(r) = $id
        DELETE r
      `;

      await session.run(query, { id: relId });
    } finally {
      await session.close();
    }
  }

  /**
   * Get entity by ID
   */
  async getEntityById(id: string): Promise<Entity | null> {
    const session = this.getSession();
    try {
      const entityId = neo4j.int(id);

      const query = `
        MATCH (n)
        WHERE id(n) = $id
        RETURN id(n) as id, labels(n) as labels, properties(n) as properties
      `;

      const result = await session.run(query, { id: entityId });

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      return {
        id: record.get('id').toString(),
        label: record.get('labels')[0] || 'Unknown',
        properties: record.get('properties') || {},
      };
    } finally {
      await session.close();
    }
  }
}

