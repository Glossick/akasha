import type {
  AkashaConfig,
  Scope,
  Context,
  GraphRAGQuery,
  GraphRAGResponse,
  ExtractResult,
  LearnOptions,
  QueryOptions,
  Entity,
  Relationship,
  ExtractionPromptTemplate,
  Document,
} from './types';
import { Neo4jService } from './services/neo4j.service';
import { EmbeddingService } from './services/embedding.service';
import { generateEntityText } from './utils/entity-embedding';
import { generateExtractionPrompt } from './utils/prompt-template';
import { scrubEmbeddings } from './utils/scrub-embeddings';
import { randomUUID } from 'crypto';
import neo4j from 'neo4j-driver';

/**
 * Akasha - Main GraphRAG library class
 */
export class Akasha {
  private neo4j: Neo4jService;
  private embeddings: EmbeddingService;
  private scope?: Scope;
  private extractionPromptConfig?: Partial<ExtractionPromptTemplate>;

  constructor(
    config: AkashaConfig,
    neo4jService?: Neo4jService,
    embeddingService?: EmbeddingService
  ) {
    this.scope = config.scope;
    this.extractionPromptConfig = config.extractionPrompt;

    // Initialize services
    this.neo4j = neo4jService || new Neo4jService(config.neo4j);
    this.embeddings = embeddingService || new EmbeddingService({
      apiKey: config.openai?.apiKey || process.env.OPENAI_API_KEY || '',
      model: config.openai?.model,
      embeddingModel: config.openai?.embeddingModel,
    });
  }

  /**
   * Get the current scope
   */
  getScope(): Scope | undefined {
    return this.scope;
  }

  /**
   * Initialize connections
   */
  async initialize(): Promise<void> {
    await this.neo4j.connect();
    await this.neo4j.ensureVectorIndex();
  }

  /**
   * Cleanup connections
   */
  async cleanup(): Promise<void> {
    await this.neo4j.disconnect();
  }

  /**
   * Ask a question (GraphRAG query)
   */
  async ask(query: string, options?: QueryOptions): Promise<GraphRAGResponse> {
    const maxDepth = options?.maxDepth ? Math.floor(options.maxDepth) : 2;
    const limit = options?.limit ? Math.floor(options.limit) : 50;
    const scopeId = this.scope?.id;
    const strategy = options?.strategy || 'both'; // Default to 'both'

    const queryEmbedding = await this.embeddings.generateEmbedding(query);
    let documents: Document[] = [];
    let entities: Entity[] = [];
    let entityIds: string[] = [];
    let documentIds: string[] = [];

    // Step 1: Search documents and/or entities based on strategy
    const contexts = options?.contexts;
    
    if (strategy === 'documents' || strategy === 'both') {
      documents = await this.neo4j.findDocumentsByVector(
        queryEmbedding,
        10,
        0.5,
        scopeId,
        contexts
      );
      documentIds = documents.map((d) => d.id);
    }

    if (strategy === 'entities' || strategy === 'both') {
      entities = await this.neo4j.findEntitiesByVector(
        queryEmbedding,
        10,
        0.5,
        scopeId,
        contexts
      );
      entityIds = entities.map((e) => e.id);
    }

    // If searching documents, also get entities connected to those documents
    if (documents.length > 0) {
      // Get entities connected to found documents via CONTAINS_ENTITY
      const session = this.neo4j.getSession();
      try {
        const docIdsList = documentIds.map(id => neo4j.int(id).toString()).join(', ');
        let docQuery = `
          MATCH (d:Document)-[:CONTAINS_ENTITY]->(e:Entity)
          WHERE id(d) IN [${docIdsList}]
        `;
        
        if (scopeId) {
          docQuery += ` AND d.scopeId = $scopeId AND e.scopeId = $scopeId`;
        }
        
        docQuery += `
          RETURN DISTINCT id(e) as id, labels(e) as labels, properties(e) as properties
        `;

        const docResult = await session.run(docQuery, scopeId ? { scopeId } : {});
        const docEntities = docResult.records.map((record: any) => ({
          id: record.get('id').toString(),
          label: record.get('labels')[0] || 'Unknown',
          properties: record.get('properties') || {},
        }));

        // Merge with existing entities (avoid duplicates)
        const existingEntityIds = new Set(entities.map(e => e.id));
        for (const docEntity of docEntities) {
          if (!existingEntityIds.has(docEntity.id)) {
            entities.push(docEntity);
            entityIds.push(docEntity.id);
          }
        }
      } catch (error) {
        console.warn('Warning: Could not retrieve entities from documents:', error);
      } finally {
        await session.close();
      }
    }

    if (entities.length === 0 && documents.length === 0) {
      return {
        context: { 
          documents: strategy === 'documents' || strategy === 'both' ? [] : undefined,
          entities: [], 
          relationships: [], 
          summary: 'No relevant information found.' 
        },
        answer: 'I could not find any relevant information in the knowledge graph to answer your question.',
      };
    }

    // Step 2: Retrieve subgraph starting from found entities
    const entityLabels = [...new Set(entities.map((e) => e.label))];
    const subgraph = await this.neo4j.retrieveSubgraph(
      entityLabels,
      [], // All relationship types
      maxDepth,
      limit,
      entityIds.length > 0 ? entityIds : undefined,
      scopeId
    );

    // Step 3: Format graph context for LLM
    const context = this.formatGraphContext(subgraph, documents);

    // Step 4: Generate response using LLM
    const answer = await this.embeddings.generateResponse(
      query,
      context.summary,
      'You are a helpful assistant that answers questions based on knowledge graph context. Use the provided graph structure to give accurate, contextual answers.'
    );

    // Scrub embeddings unless explicitly requested
    const scrubbedData = options?.includeEmbeddings
      ? { entities: subgraph.entities, relationships: subgraph.relationships }
      : scrubEmbeddings({ entities: subgraph.entities, relationships: subgraph.relationships });

    const scrubbedDocuments = options?.includeEmbeddings
      ? documents
      : documents.map(doc => {
          const props = { ...doc.properties };
          if ('embedding' in props) {
            delete props.embedding;
          }
          return { ...doc, properties: props };
        });

    return {
      context: {
        documents: strategy === 'documents' || strategy === 'both' ? scrubbedDocuments : undefined,
        entities: scrubbedData.entities,
        relationships: scrubbedData.relationships,
        summary: context.summary,
      },
      answer,
    };
  }

  /**
   * Learn from text (extract and create)
   */
  async learn(text: string, options?: LearnOptions): Promise<ExtractResult> {
    const scopeId = this.scope?.id;
    if (!scopeId) {
      throw new Error('Scope is required for learning. Please configure a scope when creating Akasha instance.');
    }

    // Step 1: Find or create document node (deduplication by text)
    let document: Document;
    let documentCreated = 0;
    const contextId = options?.contextId || randomUUID();
    
    const existingDocument = await this.neo4j.findDocumentByText(text, scopeId);
    if (existingDocument) {
      // Document already exists - update contextIds array
      document = await this.neo4j.updateDocumentContextIds(existingDocument.id, contextId);
      documentCreated = 0;
    } else {
      // Create new document node with contextIds array
      const documentEmbedding = await this.embeddings.generateEmbedding(text);
      
      document = await this.neo4j.createDocument({
        properties: {
          text,
          scopeId,
          contextIds: [contextId],
          // Keep contextId for backward compatibility
          contextId,
        },
      }, documentEmbedding);
      documentCreated = 1;
    }

    // Step 2: Extract structure from text using LLM
    const extracted = await this.extractEntitiesAndRelationships(text);

    // Step 3: Check for existing entities and create new ones (with deduplication)
    const createdEntities: Entity[] = [];
    const entityNameToIdMap = new Map<string, string>(); // Map entity name to entity ID

    for (const extractedEntity of extracted.entities) {
      const entityName = extractedEntity.properties.name as string || extractedEntity.properties.title as string;
      
      if (entityName) {
        // Check if entity already exists
        const existingEntity = await this.neo4j.findEntityByName(entityName, scopeId);
        
        if (existingEntity) {
          // Entity exists - update contextIds array
          const updatedEntity = await this.neo4j.updateEntityContextIds(existingEntity.id, contextId);
          createdEntities.push(updatedEntity);
          entityNameToIdMap.set(entityName, updatedEntity.id);
        } else {
          // Create new entity with contextIds array
          const entityText = generateEntityText(extractedEntity);
          const entityEmbedding = await this.embeddings.generateEmbedding(entityText);
          
          const entityWithScope = {
            ...extractedEntity,
            properties: {
              ...extractedEntity.properties,
              scopeId,
              contextIds: [contextId],
            },
          };
          
          const newEntity = await this.neo4j.createEntities([entityWithScope], [entityEmbedding]);
          createdEntities.push(newEntity[0]);
          entityNameToIdMap.set(entityName, newEntity[0].id);
        }
      }
    }

    // Step 4: Link entities to document via CONTAINS_ENTITY relationships
    for (const entity of createdEntities) {
      try {
        await this.neo4j.linkEntityToDocument(document.id, entity.id, scopeId);
      } catch (error) {
        // Relationship might already exist - that's okay
        console.warn(`Warning: Could not link entity ${entity.id} to document ${document.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Step 5: Create relationships using entity IDs with scopeId
    const relationshipsToCreate: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, unknown>;
    }> = [];

    const seenRelationshipIds = new Set<string>();

    for (const rel of extracted.relationships) {
      const fromEntityId = entityNameToIdMap.get(rel.from);
      const toEntityId = entityNameToIdMap.get(rel.to);

      if (!fromEntityId) {
        console.warn(`Warning: Could not find entity with name "${rel.from}" for relationship`);
        continue;
      }
      if (!toEntityId) {
        console.warn(`Warning: Could not find entity with name "${rel.to}" for relationship`);
        continue;
      }

      // Prevent self-referential relationships
      if (fromEntityId === toEntityId) {
        console.warn(`Skipping self-referential relationship: ${fromEntityId} --[${rel.type}]--> ${toEntityId}`);
        continue;
      }

      // Prevent duplicates by entity ID
      const relIdKey = `${fromEntityId}|||${toEntityId}|||${rel.type}`;
      if (seenRelationshipIds.has(relIdKey)) {
        console.warn(`Skipping duplicate relationship: ${fromEntityId} --[${rel.type}]--> ${toEntityId}`);
        continue;
      }
      seenRelationshipIds.add(relIdKey);

      relationshipsToCreate.push({
        from: fromEntityId,
        to: toEntityId,
        type: rel.type,
        properties: {
          ...rel.properties,
          scopeId, // Add scopeId to relationship properties
        },
      });
    }

    // Step 6: Create relationships in Neo4j
    const createdRelationships = await this.neo4j.createRelationships(relationshipsToCreate);

    // Step 7: Create context (metadata, not a graph node)
    const context: Context = {
      id: contextId,
      scopeId,
      name: options?.contextName || 'Untitled Context',
      source: text,
    };

    // Step 8: Format summary
    const entityNames = createdEntities.map(e => {
      const name = e.properties.name as string || e.properties.title as string || e.id;
      return `${e.label}: ${name}`;
    }).join(', ');

    const idToEntityMap = new Map<string, Entity>();
    for (const entity of createdEntities) {
      idToEntityMap.set(entity.id, entity);
    }

    const relDescriptions = createdRelationships.map(r => {
      const fromEntity = idToEntityMap.get(r.from);
      const toEntity = idToEntityMap.get(r.to);
      const fromName = fromEntity
        ? (fromEntity.properties.name as string || fromEntity.properties.title as string || r.from)
        : r.from;
      const toName = toEntity
        ? (toEntity.properties.name as string || toEntity.properties.title as string || r.to)
        : r.to;
      return `${fromName} --[${r.type}]--> ${toName}`;
    }).join(', ');

    const summary = `Extracted and created ${createdEntities.length} entities and ${createdRelationships.length} relationships from text.\n\nEntities: ${entityNames}\n\nRelationships: ${relDescriptions}`;

    // Scrub embeddings unless explicitly requested
    const scrubbedData = options?.includeEmbeddings
      ? { entities: createdEntities, relationships: createdRelationships }
      : scrubEmbeddings({ entities: createdEntities, relationships: createdRelationships });

    return {
      context,
      document,
      entities: scrubbedData.entities,
      relationships: scrubbedData.relationships,
      summary,
      created: {
        document: documentCreated,
        entities: createdEntities.length,
        relationships: createdRelationships.length,
      },
    };
  }

  /**
   * Extract entities and relationships from natural language text
   */
  private async extractEntitiesAndRelationships(text: string): Promise<{
    entities: Array<{ label: string; properties: Record<string, unknown> }>;
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, unknown>;
    }>;
  }> {
    // Generate prompt from template (or use default)
    const systemPrompt = generateExtractionPrompt(this.extractionPromptConfig);

    const userPrompt = `Extract all entities and relationships from the following text:\n\n${text}`;

    const response = await this.embeddings.generateResponse(
      userPrompt,
      '',
      systemPrompt,
      0.3
    );

    let jsonText = response.trim();

    if (jsonText.startsWith('```')) {
      const lines = jsonText.split('\n');
      const startIndex = lines.findIndex(line => line.trim().startsWith('```'));
      const endIndex = lines.findIndex((line, idx) => idx > startIndex && line.trim().endsWith('```'));
      if (startIndex !== -1 && endIndex !== -1) {
        jsonText = lines.slice(startIndex + 1, endIndex).join('\n');
      }
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonText);

      if (!parsed.entities || !Array.isArray(parsed.entities)) {
        throw new Error('Invalid response: missing entities array');
      }
      if (!parsed.relationships || !Array.isArray(parsed.relationships)) {
        throw new Error('Invalid response: missing relationships array');
      }

      for (const entity of parsed.entities) {
        if (!entity.label || typeof entity.label !== 'string') {
          throw new Error('Invalid entity: missing label');
        }
        if (!entity.properties || typeof entity.properties !== 'object') {
          throw new Error('Invalid entity: missing properties');
        }
        if (!entity.properties.name && !entity.properties.title) {
          throw new Error(`Invalid entity: missing name/title property for ${entity.label}`);
        }
      }

      const validRelationships: Array<{
        from: string;
        to: string;
        type: string;
        properties?: Record<string, unknown>;
      }> = [];

      const seenRelationships = new Set<string>();

      for (const rel of parsed.relationships) {
        if (!rel.from || !rel.to || !rel.type) {
          console.warn(`Skipping invalid relationship: missing from, to, or type`);
          continue;
        }

        if (typeof rel.type !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(rel.type)) {
          console.warn(`Skipping invalid relationship type: ${rel.type}`);
          continue;
        }

        if (rel.from === rel.to) {
          console.warn(`Skipping self-referential relationship: ${rel.from} --[${rel.type}]--> ${rel.to}`);
          continue;
        }

        const relKey = `${rel.from}|||${rel.to}|||${rel.type}`;
        if (seenRelationships.has(relKey)) {
          console.warn(`Skipping duplicate relationship: ${rel.from} --[${rel.type}]--> ${rel.to}`);
          continue;
        }
        seenRelationships.add(relKey);

        validRelationships.push({
          from: rel.from,
          to: rel.to,
          type: rel.type,
          properties: rel.properties || {},
        });
      }

      return {
        entities: parsed.entities,
        relationships: validRelationships,
      };
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      console.error('LLM response was:', response);
      throw new Error(`Failed to extract graph structure: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format graph data into text context for LLM
   */
  private formatGraphContext(
    graph: {
      entities: Array<{ id: string; label: string; properties: Record<string, unknown> }>;
      relationships: Array<{
        id: string;
        type: string;
        from: string;
        to: string;
        properties: Record<string, unknown>;
      }>;
    },
    documents?: Document[]
  ): { summary: string } {
    const entityMap = new Map(
      graph.entities.map((e) => [e.id, e])
    );

    const internalProps = ['embedding', '_similarity', 'scopeId'];
    const MAX_CONTEXT_CHARS = 200000;
    let contextChars = 0;
    const maxEntities = 100;
    const maxRelationships = 200;

    // Calculate remaining space after documents (documents get priority)
    const documentsReserved = documents && documents.length > 0 
      ? Math.floor(MAX_CONTEXT_CHARS * 0.6) 
      : 0;
    const remainingForGraph = MAX_CONTEXT_CHARS - documentsReserved;

    const entityDescriptions: string[] = [];
    let graphChars = 0;
    
    for (let i = 0; i < Math.min(graph.entities.length, maxEntities); i++) {
      const entity = graph.entities[i];

      const relevantProps = Object.entries(entity.properties)
        .filter(([key]) => !internalProps.includes(key))
        .map(([key, value]) => {
          const valueStr = typeof value === 'string'
            ? value.length > 200
              ? value.substring(0, 200) + '...'
              : value
            : String(value);
          return `${key}: ${valueStr}`;
        })
        .slice(0, 10);

      const propsStr = relevantProps.join(', ');
      const entityDesc = `${entity.label} (${entity.id}): ${propsStr || 'no properties'}`;

      // Check against remaining graph space (not total, since documents are separate)
      if (graphChars + entityDesc.length > remainingForGraph) {
        break;
      }

      entityDescriptions.push(entityDesc);
      graphChars += entityDesc.length;
      contextChars += entityDesc.length;
    }

    const relationshipDescriptions: string[] = [];
    for (let i = 0; i < Math.min(graph.relationships.length, maxRelationships); i++) {
      const rel = graph.relationships[i];
      const fromEntity = entityMap.get(rel.from);
      const toEntity = entityMap.get(rel.to);
      const fromName = fromEntity?.properties.name || fromEntity?.properties.title || fromEntity?.label || rel.from;
      const toName = toEntity?.properties.name || toEntity?.properties.title || toEntity?.label || rel.to;
      const relDesc = `${fromName} --[${rel.type}]--> ${toName}`;

      // Check against remaining graph space
      if (graphChars + relDesc.length > remainingForGraph) {
        break;
      }

      relationshipDescriptions.push(relDesc);
      graphChars += relDesc.length;
      contextChars += relDesc.length;
    }

    let summaryParts: string[] = [];

    // Add documents if provided - include FULL text (documents are the source material)
    // Documents should be prioritized as they contain the original narrative context
    // This gives the LLM both the original narrative AND the extracted graph structure
    if (documents && documents.length > 0) {
      const documentTexts: string[] = [];
      // Use the same reserve calculation as above for consistency
      const documentReserve = documentsReserved; // 60% of context for documents
      let documentChars = 0;
      
      for (let i = 0; i < Math.min(documents.length, 10); i++) {
        const doc = documents[i];
        const text = doc.properties.text || '';
        
        // Include FULL text (not just preview) - this is the source material
        let textToInclude = text;
        const remainingDocSpace = documentReserve - documentChars;
        
        if (text.length > remainingDocSpace && remainingDocSpace > 0) {
          // Only truncate if absolutely necessary (when running out of reserved space)
          textToInclude = text.substring(0, Math.max(remainingDocSpace - 100, 0)) + '...';
        }
        
        if (textToInclude.length > 0 && remainingDocSpace > 0) {
          documentTexts.push(`Document ${i + 1}:\n${textToInclude}`);
          const addedChars = textToInclude.length;
          documentChars += addedChars;
          contextChars += addedChars;
          
          // Stop if we've used our document reserve
          if (documentChars >= documentReserve) break;
        }
      }
      
      if (documentTexts.length > 0) {
        // Place documents FIRST in the context - they're the source material
        summaryParts.unshift(`Source Documents (${documentTexts.length}${documents.length > documentTexts.length ? ` of ${documents.length} total` : ''}):\n\n${documentTexts.join('\n\n---\n\n')}`);
      }
    }

    if (entityDescriptions.length > 0) {
      summaryParts.push(`Entities (${entityDescriptions.length}${graph.entities.length > entityDescriptions.length ? ` of ${graph.entities.length} total` : ''}):\n${entityDescriptions.join('\n')}`);
    }

    if (relationshipDescriptions.length > 0) {
      summaryParts.push(`Relationships (${relationshipDescriptions.length}${graph.relationships.length > relationshipDescriptions.length ? ` of ${graph.relationships.length} total` : ''}):\n${relationshipDescriptions.join('\n')}`);
    }

    const summary = `Knowledge Graph Context:\n\n${summaryParts.join('\n\n')}`;

    return { summary };
  }
}
