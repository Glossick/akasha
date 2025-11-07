import neo4j, { Driver, Session } from 'neo4j-driver';
import type { Entity, Relationship, Document } from '../types';

interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
  database?: string;
}

/**
 * Neo4jService with scope filtering support
 */
export class Neo4jService {
  private driver: Driver | null = null;
  private config: Neo4jConfig;

  constructor(config: Neo4jConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.driver) {
      return;
    }

    this.driver = neo4j.driver(
      this.config.uri,
      neo4j.auth.basic(this.config.user, this.config.password)
    );

    try {
      await this.driver.verifyConnectivity();
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

  getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }
    return this.driver.session({ database: this.config.database || 'neo4j' });
  }

  /**
   * Add scope filter to Cypher query
   * @internal
   */
  ['addScopeFilter'](query: string, scopeId?: string): string {
    if (!scopeId) {
      return query;
    }

    // Simple implementation - add WHERE clause with scopeId filter
    if (query.includes('WHERE')) {
      return query.replace(/WHERE\s+/i, `WHERE e.scopeId = $scopeId AND `);
    } else {
      // Add WHERE clause after first MATCH
      return query.replace(/(MATCH\s*\([^)]+\))/i, `$1 WHERE e.scopeId = $scopeId`);
    }
  }

  async ensureVectorIndex(indexName: string = 'entity_vector_index'): Promise<void> {
    const session = this.getSession();
    try {
      // Check if index exists
      const checkResult = await session.run(`
        SHOW INDEXES
        WHERE name = $indexName
      `, { indexName });

      if (checkResult.records.length === 0) {
        try {
          await session.run(`
            CALL db.index.vector.createNodeIndex(
              $indexName,
              'Entity',
              'embedding',
              1536,
              'cosine'
            )
          `, { indexName });
        } catch (error) {
          // Vector indexes might not be supported - that's okay
          console.warn(`Vector index creation not available: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Also ensure document vector index
      const docIndexName = 'document_vector_index';
      const docCheckResult = await session.run(`
        SHOW INDEXES
        WHERE name = $indexName
      `, { indexName: docIndexName });

      if (docCheckResult.records.length === 0) {
        try {
          await session.run(`
            CALL db.index.vector.createNodeIndex(
              $indexName,
              'Document',
              'embedding',
              1536,
              'cosine'
            )
          `, { indexName: docIndexName });
        } catch (error) {
          console.warn(`Document vector index creation not available: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } finally {
      await session.close();
    }
  }

  async findEntitiesByVector(
    queryEmbedding: number[],
    limit: number = 10,
    similarityThreshold: number = 0.5,
    scopeId?: string,
    contexts?: string[]
  ): Promise<Entity[]> {
    const session = this.getSession();
    try {
      const limitInt = neo4j.int(Math.floor(limit));

      // Try vector index search first
      try {
        let query = `
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

        // Add scope and context filters if provided
        const whereConditions: string[] = [];
        if (scopeId) {
          whereConditions.push('node.scopeId = $scopeId');
        }
        if (contexts && contexts.length > 0) {
          whereConditions.push('(node.contextIds IS NULL OR ANY(ctx IN node.contextIds WHERE ctx IN $contexts))');
        }
        
        if (whereConditions.length > 0) {
          query = query.replace(
            /RETURN id\(node\)/i,
            `WHERE ${whereConditions.join(' AND ')}\n          RETURN id(node)`
          );
        }

        const result = await session.run(query, {
          k: limitInt,
          queryVector: queryEmbedding,
          limit: limitInt,
          ...(scopeId ? { scopeId } : {}),
          ...(contexts && contexts.length > 0 ? { contexts } : {}),
        });

        const vectorResults = result.records
          .map((record) => ({
            id: record.get('id').toString(),
            label: record.get('labels')[0] || 'Unknown',
            properties: {
              ...record.get('properties'),
              _similarity: record.get('score'),
            },
          }))
          .filter((e) => {
            const score = e.properties._similarity as number;
            return score >= similarityThreshold;
          });

        if (vectorResults.length > 0) {
          return vectorResults;
        }
      } catch (vectorError) {
        // Fallback to property-based search
        console.warn('Vector index search not available, using fallback');
      }

      // Fallback: property-based cosine similarity
      let fallbackQuery = `
        MATCH (n)
        WHERE n.embedding IS NOT NULL
      `;

      if (scopeId) {
        fallbackQuery += ` AND n.scopeId = $scopeId`;
      }
      
      if (contexts && contexts.length > 0) {
        fallbackQuery += ` AND (n.contextIds IS NULL OR ANY(ctx IN n.contextIds WHERE ctx IN $contexts))`;
      }

      fallbackQuery += `
        RETURN id(n) as id, labels(n) as labels, properties(n) as properties, n.embedding as embedding
        LIMIT 1000
      `;

      const fallbackResult = await session.run(fallbackQuery, {
        ...(scopeId ? { scopeId } : {}),
        ...(contexts && contexts.length > 0 ? { contexts } : {}),
      });
      const entities: Array<Entity & { similarity?: number }> = [];

      for (const record of fallbackResult.records) {
        const storedEmbedding = record.get('embedding');
        if (Array.isArray(storedEmbedding) && storedEmbedding.length > 0) {
          const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
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

      entities.sort((a, b) => (b.properties._similarity as number || 0) - (a.properties._similarity as number || 0));
      return entities.slice(0, limit);
    } finally {
      await session.close();
    }
  }

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

  async retrieveSubgraph(
    entityLabels: string[],
    relationshipTypes: string[],
    maxDepth: number = 2,
    limit: number = 50,
    entityIds?: string[],
    scopeId?: string
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    const session = this.getSession();
    try {
      const maxDepthInt = Math.floor(maxDepth);
      const limitInt = neo4j.int(Math.floor(limit));

      if (maxDepthInt < 1 || maxDepthInt > 10) {
        throw new Error(`maxDepth must be between 1 and 10, got ${maxDepthInt}`);
      }

      let startNodePattern: string;
      let whereClause: string;

      if (entityIds && entityIds.length > 0) {
        const entityIdsList = entityIds.map(id => neo4j.int(id).toString()).join(', ');
        startNodePattern = '(start)';
        whereClause = `WHERE id(start) IN [${entityIdsList}]`;
      } else if (entityLabels.length > 0) {
        const labels = entityLabels.map((label) => `:${label}`).join('');
        startNodePattern = `(start${labels})`;
        whereClause = '';
      } else {
        return { entities: [], relationships: [] };
      }

      // Add scope filter to where clause
      if (scopeId) {
        if (whereClause) {
          whereClause += ` AND start.scopeId = $scopeId`;
        } else {
          whereClause = `WHERE start.scopeId = $scopeId`;
        }
      }

      let relationshipFilter = '';
      if (relationshipTypes.length > 0) {
        const relTypesList = relationshipTypes.map((t) => `'${t}'`).join(', ');
        relationshipFilter = `ALL(r IN rels WHERE type(r) IN [${relTypesList}])`;
      }

      let combinedWhereClause = '';
      if (whereClause && relationshipFilter) {
        combinedWhereClause = `${whereClause} AND ${relationshipFilter}`;
      } else if (whereClause) {
        combinedWhereClause = whereClause;
      } else if (relationshipFilter) {
        combinedWhereClause = `WHERE ${relationshipFilter}`;
      }

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
        ...(scopeId ? { scopeId } : {}),
      });

      const entitiesMap = new Map<string, Entity>();
      const relationshipsMap = new Map<string, Relationship>();

      result.records.forEach((record) => {
        const fromId = record.get('fromId').toString();
        if (!entitiesMap.has(fromId)) {
          entitiesMap.set(fromId, {
            id: fromId,
            label: record.get('fromLabels')[0] || 'Unknown',
            properties: record.get('fromProps') || {},
          });
        }

        const toId = record.get('toId').toString();
        if (!entitiesMap.has(toId)) {
          entitiesMap.set(toId, {
            id: toId,
            label: record.get('toLabels')[0] || 'Unknown',
            properties: record.get('toProps') || {},
          });
        }

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

  async createEntities(
    entities: Array<{ label: string; properties: Record<string, unknown> }>,
    embeddings?: number[][]
  ): Promise<Entity[]> {
    const session = this.getSession();
    try {
      const createdEntities: Entity[] = [];

      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        const embedding = embeddings && embeddings[i] ? embeddings[i] : undefined;

        // Validate label
        if (!/^[A-Z][A-Za-z0-9_]*$/.test(entity.label)) {
          throw new Error(`Invalid label: ${entity.label}`);
        }

        const propsWithEmbedding = embedding
          ? { ...entity.properties, embedding }
          : entity.properties;

        const uniqueKey = entity.properties.name ? 'name' : entity.properties.id ? 'id' : null;
        const uniqueValue = uniqueKey ? entity.properties[uniqueKey] : null;

        let query: string;
        let params: Record<string, unknown>;

        if (uniqueKey && uniqueValue) {
          query = `
            MERGE (n:${entity.label}:Entity {${uniqueKey}: $uniqueValue})
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
          query = `
            CREATE (n:${entity.label}:Entity $properties)
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

        createdEntities.push({
          id: record.get('id').toString(),
          label: record.get('labels')[0] || entity.label,
          properties: record.get('properties') || entity.properties,
        });
      }

      return createdEntities;
    } finally {
      await session.close();
    }
  }

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

  private async createRelationship(
    fromId: string,
    toId: string,
    type: string,
    properties?: Record<string, unknown>
  ): Promise<Relationship> {
    const session = this.getSession();
    try {
      if (!/^[A-Z][A-Z0-9_]*$/.test(type)) {
        throw new Error(`Invalid relationship type: ${type}`);
      }

      const from = neo4j.int(fromId);
      const to = neo4j.int(toId);

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
   * Find document by text content (for deduplication)
   */
  async findDocumentByText(text: string, scopeId: string): Promise<Document | null> {
    const session = this.getSession();
    try {
      const query = `
        MATCH (d:Document)
        WHERE d.text = $text AND d.scopeId = $scopeId
        RETURN id(d) as id, labels(d) as labels, properties(d) as properties
        LIMIT 1
      `;

      const result = await session.run(query, { text, scopeId });
      
      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      return {
        id: record.get('id').toString(),
        label: 'Document',
        properties: record.get('properties') || {},
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Create a document node with embedding
   */
  async createDocument(document: { properties: Document['properties'] }, embedding: number[]): Promise<Document> {
    const session = this.getSession();
    try {
      const query = `
        CREATE (d:Document $properties)
        SET d.embedding = $embedding
        RETURN id(d) as id, labels(d) as labels, properties(d) as properties
      `;

      const result = await session.run(query, {
        properties: document.properties,
        embedding,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error('Failed to create document');
      }

      return {
        id: record.get('id').toString(),
        label: 'Document',
        properties: record.get('properties') || document.properties,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Find documents by vector similarity
   */
  async findDocumentsByVector(
    queryEmbedding: number[],
    limit: number = 10,
    similarityThreshold: number = 0.5,
    scopeId?: string,
    contexts?: string[]
  ): Promise<Document[]> {
    const session = this.getSession();
    try {
      const limitInt = neo4j.int(Math.floor(limit));

      // Try vector index search first
      try {
        let query = `
          CALL db.index.vector.queryNodes(
            'document_vector_index',
            $k,
            $queryVector
          )
          YIELD node, score
          WITH node, score
          ORDER BY score DESC
          LIMIT $limit
          RETURN id(node) as id, labels(node) as labels, properties(node) as properties, score
        `;

        // Add scope and context filters if provided
        const whereConditions: string[] = [];
        if (scopeId) {
          whereConditions.push('node.scopeId = $scopeId');
        }
        if (contexts && contexts.length > 0) {
          whereConditions.push('(node.contextIds IS NULL OR ANY(ctx IN node.contextIds WHERE ctx IN $contexts))');
        }
        
        if (whereConditions.length > 0) {
          query = query.replace(
            /RETURN id\(node\)/i,
            `WHERE ${whereConditions.join(' AND ')}\n          RETURN id(node)`
          );
        }

        const result = await session.run(query, {
          k: limitInt,
          queryVector: queryEmbedding,
          limit: limitInt,
          ...(scopeId ? { scopeId } : {}),
          ...(contexts && contexts.length > 0 ? { contexts } : {}),
        });

        const vectorResults = result.records
          .map((record) => ({
            id: record.get('id').toString(),
            label: 'Document' as const,
            properties: {
              ...record.get('properties'),
              _similarity: record.get('score'),
            },
          }))
          .filter((d) => {
            const score = d.properties._similarity as number;
            return score >= similarityThreshold;
          });

        if (vectorResults.length > 0) {
          return vectorResults;
        }
      } catch (vectorError) {
        // Fallback to property-based search
        console.warn('Document vector index search not available, using fallback');
      }

      // Fallback: property-based cosine similarity
      let fallbackQuery = `
        MATCH (d:Document)
        WHERE d.embedding IS NOT NULL
      `;

      if (scopeId) {
        fallbackQuery += ` AND d.scopeId = $scopeId`;
      }
      
      if (contexts && contexts.length > 0) {
        fallbackQuery += ` AND (d.contextIds IS NULL OR ANY(ctx IN d.contextIds WHERE ctx IN $contexts))`;
      }

      fallbackQuery += `
        RETURN id(d) as id, labels(d) as labels, properties(d) as properties, d.embedding as embedding
        LIMIT 1000
      `;

      const fallbackResult = await session.run(fallbackQuery, {
        ...(scopeId ? { scopeId } : {}),
        ...(contexts && contexts.length > 0 ? { contexts } : {}),
      });
      const documents: Array<Document & { similarity?: number }> = [];

      for (const record of fallbackResult.records) {
        const storedEmbedding = record.get('embedding');
        if (Array.isArray(storedEmbedding) && storedEmbedding.length > 0) {
          const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
          if (similarity >= similarityThreshold) {
            documents.push({
              id: record.get('id').toString(),
              label: 'Document',
              properties: {
                ...record.get('properties'),
                _similarity: similarity,
              },
            });
          }
        }
      }

      documents.sort((a, b) => (b.properties._similarity as number || 0) - (a.properties._similarity as number || 0));
      return documents.slice(0, limit);
    } finally {
      await session.close();
    }
  }

  /**
   * Link entity to document via CONTAINS_ENTITY relationship
   */
  async linkEntityToDocument(documentId: string, entityId: string, scopeId: string): Promise<Relationship> {
    const session = this.getSession();
    try {
      const docId = neo4j.int(documentId);
      const entId = neo4j.int(entityId);

      const query = `
        MATCH (d:Document), (e:Entity)
        WHERE id(d) = $docId AND id(e) = $entId AND d.scopeId = $scopeId AND e.scopeId = $scopeId
        MERGE (d)-[r:CONTAINS_ENTITY]->(e)
        SET r.scopeId = $scopeId
        RETURN id(r) as id, type(r) as type, id(d) as fromId, id(e) as toId, properties(r) as properties
      `;

      const result = await session.run(query, {
        docId,
        entId,
        scopeId,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error('Failed to link entity to document: document or entity not found');
      }

      return {
        id: record.get('id').toString(),
        type: record.get('type'),
        from: record.get('fromId').toString(),
        to: record.get('toId').toString(),
        properties: record.get('properties') || { scopeId },
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Update document contextIds array (add contextId if not present)
   */
  async updateDocumentContextIds(documentId: string, contextId: string): Promise<Document> {
    const session = this.getSession();
    try {
      const docId = neo4j.int(documentId);
      
      const query = `
        MATCH (d:Document)
        WHERE id(d) = $docId
        WITH d, 
          CASE 
            WHEN d.contextIds IS NULL THEN [$contextId]
            WHEN $contextId IN d.contextIds THEN d.contextIds
            ELSE d.contextIds + [$contextId]
          END AS newContextIds
        SET d.contextIds = newContextIds
        RETURN id(d) as id, labels(d) as labels, properties(d) as properties
      `;

      const result = await session.run(query, {
        docId,
        contextId,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error(`Document with id ${documentId} not found`);
      }

      return {
        id: record.get('id').toString(),
        label: 'Document',
        properties: record.get('properties') || {},
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Update entity contextIds array (add contextId if not present)
   */
  async updateEntityContextIds(entityId: string, contextId: string): Promise<Entity> {
    const session = this.getSession();
    try {
      const entId = neo4j.int(entityId);
      
      const query = `
        MATCH (e:Entity)
        WHERE id(e) = $entId
        WITH e,
          CASE 
            WHEN e.contextIds IS NULL THEN [$contextId]
            WHEN $contextId IN e.contextIds THEN e.contextIds
            ELSE e.contextIds + [$contextId]
          END AS newContextIds
        SET e.contextIds = newContextIds
        RETURN id(e) as id, labels(e) as labels, properties(e) as properties
      `;

      const result = await session.run(query, {
        entId,
        contextId,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error(`Entity with id ${entityId} not found`);
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
   * Find entity by name (for deduplication)
   */
  async findEntityByName(name: string, scopeId: string): Promise<Entity | null> {
    const session = this.getSession();
    try {
      const query = `
        MATCH (e:Entity)
        WHERE (e.name = $name OR e.title = $name) AND e.scopeId = $scopeId
        RETURN id(e) as id, labels(e) as labels, properties(e) as properties
        LIMIT 1
      `;

      const result = await session.run(query, { name, scopeId });
      
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
