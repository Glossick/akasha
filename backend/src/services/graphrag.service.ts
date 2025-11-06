import { Neo4jService } from './neo4j.service';
import { EmbeddingService } from './embedding.service';
import { generateEntityText } from '../utils/entity-embedding';
import type { GraphRAGQuery, GraphRAGResponse, GraphContext, Entity, Relationship } from '../types/graph';

export class GraphRAGService {
  private neo4j: Neo4jService;
  private embeddings: EmbeddingService;

  constructor(neo4jService?: Neo4jService, embeddingService?: EmbeddingService) {
    this.neo4j = neo4jService || new Neo4jService();
    this.embeddings = embeddingService || new EmbeddingService();
  }

  async initialize(): Promise<void> {
    await this.neo4j.connect();
    // Ensure vector index exists (will gracefully handle if not supported)
    await this.neo4j.ensureVectorIndex();
  }

  async cleanup(): Promise<void> {
    await this.neo4j.disconnect();
  }

  /**
   * Main GraphRAG query method
   * 1. Find relevant entities from query text
   * 2. Retrieve subgraph around those entities
   * 3. Format context
   * 4. Generate LLM response
   */
  async query(query: GraphRAGQuery): Promise<GraphRAGResponse> {
    // Ensure maxDepth and limit are integers (convert from potential floats)
    const maxDepth = query.maxDepth ? Math.floor(query.maxDepth) : 2;
    const limit = query.limit ? Math.floor(query.limit) : 50;
    
    // Step 1: Find relevant entities using vector similarity search
    // Generate embedding for the query text
    const queryEmbedding = await this.embeddings.generateEmbedding(query.query);
    // Use lower threshold (0.5) to catch more relevant matches, limit to top 10 for better recall
    const entities = await this.neo4j.findEntitiesByVector(queryEmbedding, 10, 0.5);

    if (entities.length === 0) {
      return {
        context: { entities: [], relationships: [], summary: 'No relevant entities found.' },
        answer: 'I could not find any relevant information in the knowledge graph to answer your question.',
      };
    }

    // Step 2: Retrieve subgraph starting from the specific entities found
    // Use entity IDs (not labels) to ensure we start from the exact entities found by vector search
    const entityIds = entities.map((e) => e.id);
    const entityLabels = [...new Set(entities.map((e) => e.label))];
    const subgraph = await this.neo4j.retrieveSubgraph(
      entityLabels,
      [], // All relationship types
      maxDepth,
      limit,
      entityIds // Pass specific entity IDs to start traversal from
    );

    // Step 3: Format graph context for LLM
    const context = this.formatGraphContext(subgraph);

    // Step 4: Generate response using LLM
    const answer = await this.embeddings.generateResponse(
      query.query,
      context.summary,
      'You are a helpful assistant that answers questions based on knowledge graph context. Use the provided graph structure to give accurate, contextual answers.'
    );

    return {
      context: {
        entities: subgraph.entities,
        relationships: subgraph.relationships,
        summary: context.summary,
      },
      answer,
    };
  }

  /**
   * Extract entities and relationships from natural language text
   * Uses LLM to parse text and identify graph structure
   */
  async extractEntitiesAndRelationships(text: string): Promise<{
    entities: Array<{ label: string; properties: Record<string, unknown> }>;
    relationships: Array<{
      from: string; // Entity identifier (name or key property)
      to: string; // Entity identifier (name or key property)
      type: string;
      properties?: Record<string, unknown>;
    }>;
  }> {
    const systemPrompt = `You are an expert at extracting knowledge graph structures from natural language text.

Your task is to analyze the provided text and extract:
1. Entities (people, places, organizations, concepts, works, etc.) with their properties
2. Relationships between entities

CRITICAL RULES:
- Entity labels should be singular, PascalCase (e.g., Person, Company, Film, Book, Location, Concept)
- Each entity must have at least a "name" property (or "title" if more appropriate for works/creations)
- Relationship types should be UPPERCASE with underscores (e.g., WORKS_FOR, LOCATED_IN, OWNS, CREATED, DIRECTED, WROTE, INSPIRED_BY, FATHER_OF)
- Relationships should reference entities by their "name" property (or "title" for works)
- Extract all relevant properties from the text for each entity
- ONLY extract relationships that are EXPLICITLY stated in the text - do not infer or create relationships
- NEVER create self-referential relationships (from and to cannot be the same entity)
- NEVER create duplicate relationships (same from, to, and type combination)
- Use semantically appropriate relationship types:
  * FATHER_OF, MOTHER_OF, SON_OF, DAUGHTER_OF only for familial relationships between Persons
  * CREATED, DIRECTED, WROTE, PRODUCED for creative works (Films, Books, etc.)
  * WORKS_FOR, OWNS, FOUNDED for organizations
  * INSPIRED_BY, BASED_ON for conceptual relationships
  * SIMILAR_TO, RELATED_TO for comparisons
- Films, Books, Concepts cannot have FATHER_OF, MOTHER_OF relationships
- Only Persons can have FATHER_OF, MOTHER_OF relationships
- Be precise: "X wrote Y" means Person wrote Work, not Work wrote Person

Return ONLY valid JSON in this format:
{
  "entities": [
    {
      "label": "Person",
      "properties": {
        "name": "Alice",
        "age": 30,
        "occupation": "Engineer"
      }
    }
  ],
  "relationships": [
    {
      "from": "Alice",
      "to": "TechCorp",
      "type": "WORKS_FOR",
      "properties": {}
    }
  ]
}`;

    const userPrompt = `Extract all entities and relationships from the following text:\n\n${text}`;

    // Use a lower temperature for more deterministic JSON extraction
    const response = await this.embeddings.generateResponse(
      userPrompt,
      '',
      systemPrompt,
      0.3 // Lower temperature for more structured/consistent output
    );

    // Parse JSON response from LLM
    // LLM may wrap response in markdown code blocks or add explanatory text
    let jsonText = response.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      const lines = jsonText.split('\n');
      const startIndex = lines.findIndex(line => line.trim().startsWith('```'));
      const endIndex = lines.findIndex((line, idx) => idx > startIndex && line.trim().endsWith('```'));
      if (startIndex !== -1 && endIndex !== -1) {
        jsonText = lines.slice(startIndex + 1, endIndex).join('\n');
      }
    }
    
    // Extract JSON object if wrapped in text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonText);
      
      // Validate structure
      if (!parsed.entities || !Array.isArray(parsed.entities)) {
        throw new Error('Invalid response: missing entities array');
      }
      if (!parsed.relationships || !Array.isArray(parsed.relationships)) {
        throw new Error('Invalid response: missing relationships array');
      }

      // Validate entities
      for (const entity of parsed.entities) {
        if (!entity.label || typeof entity.label !== 'string') {
          throw new Error('Invalid entity: missing label');
        }
        if (!entity.properties || typeof entity.properties !== 'object') {
          throw new Error('Invalid entity: missing properties');
        }
        // Ensure name or title property exists
        if (!entity.properties.name && !entity.properties.title) {
          throw new Error(`Invalid entity: missing name/title property for ${entity.label}`);
        }
      }

      // Validate and filter relationships
      const validRelationships: Array<{
        from: string;
        to: string;
        type: string;
        properties?: Record<string, unknown>;
      }> = [];
      
      // Track seen relationships to prevent duplicates
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
        
        // CRITICAL: Prevent self-referential relationships
        if (rel.from === rel.to) {
          console.warn(`Skipping self-referential relationship: ${rel.from} --[${rel.type}]--> ${rel.to}`);
          continue;
        }
        
        // CRITICAL: Prevent duplicates
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
      
      // Log if we filtered any relationships
      if (validRelationships.length < parsed.relationships.length) {
        console.warn(`Filtered ${parsed.relationships.length - validRelationships.length} invalid/duplicate relationships`);
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
   * Extract entities and relationships from text and create them in Neo4j
   * This is the end-to-end method that combines extraction and creation
   */
  async extractAndCreate(text: string): Promise<{
    entities: Entity[];
    relationships: Relationship[];
    summary: string;
    created: {
      entities: number;
      relationships: number;
    };
  }> {
    // Step 1: Extract structure from text using LLM
    const extracted = await this.extractEntitiesAndRelationships(text);

    // Step 2: Generate embeddings for entities and create them in Neo4j
    // Generate text representations for embedding
    const entityTexts = extracted.entities.map(entity => generateEntityText(entity));
    // Generate embeddings in batch
    const entityEmbeddings = await this.embeddings.generateEmbeddings(entityTexts);
    // Create entities with embeddings
    const createdEntities = await this.neo4j.createEntities(extracted.entities, entityEmbeddings);

    // Step 3: Build a map from entity name to entity ID for relationship creation
    const nameToEntityMap = new Map<string, Entity>();
    for (const entity of createdEntities) {
      const name = entity.properties.name as string || entity.properties.title as string;
      if (name) {
        nameToEntityMap.set(name, entity);
      }
    }

    // Step 4: Create relationships using entity IDs with semantic validation
    const relationshipsToCreate: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, unknown>;
    }> = [];
    
    // Track relationships to prevent duplicates (by entity ID)
    const seenRelationshipIds = new Set<string>();

    for (const rel of extracted.relationships) {
      const fromEntity = nameToEntityMap.get(rel.from);
      const toEntity = nameToEntityMap.get(rel.to);

      if (!fromEntity) {
        console.warn(`Warning: Could not find entity with name "${rel.from}" for relationship`);
        continue;
      }
      if (!toEntity) {
        console.warn(`Warning: Could not find entity with name "${rel.to}" for relationship`);
        continue;
      }

      // CRITICAL: Prevent self-referential relationships (additional check by ID)
      if (fromEntity.id === toEntity.id) {
        console.warn(`Skipping self-referential relationship: ${fromEntity.id} --[${rel.type}]--> ${toEntity.id}`);
        continue;
      }

      // CRITICAL: Prevent duplicates by entity ID
      const relIdKey = `${fromEntity.id}|||${toEntity.id}|||${rel.type}`;
      if (seenRelationshipIds.has(relIdKey)) {
        console.warn(`Skipping duplicate relationship: ${fromEntity.id} --[${rel.type}]--> ${toEntity.id}`);
        continue;
      }
      seenRelationshipIds.add(relIdKey);

      // Semantic validation: Check for category errors
      const fromLabel = fromEntity.label;
      const toLabel = toEntity.label;
      
      // Films, Books, Concepts cannot have FATHER_OF/MOTHER_OF relationships
      if ((rel.type === 'FATHER_OF' || rel.type === 'MOTHER_OF' || rel.type === 'SON_OF' || rel.type === 'DAUGHTER_OF') && 
          (fromLabel === 'Film' || fromLabel === 'Book' || fromLabel === 'Concept' || fromLabel === 'Work')) {
        console.warn(`Skipping invalid relationship: ${fromLabel} cannot have ${rel.type} relationship`);
        continue;
      }
      
      // Only Persons can have FATHER_OF/MOTHER_OF relationships, and they must point to Persons
      if ((rel.type === 'FATHER_OF' || rel.type === 'MOTHER_OF' || rel.type === 'SON_OF' || rel.type === 'DAUGHTER_OF')) {
        if (fromLabel !== 'Person') {
          console.warn(`Skipping invalid relationship: ${fromLabel} cannot have ${rel.type} relationship (only Person can)`);
          continue;
        }
        if (toLabel !== 'Person') {
          console.warn(`Skipping invalid relationship: ${rel.type} can only point to Person, not ${toLabel}`);
          continue;
        }
      }

      relationshipsToCreate.push({
        from: fromEntity.id,
        to: toEntity.id,
        type: rel.type,
        properties: rel.properties,
      });
    }

    // Step 5: Create relationships in Neo4j
    const createdRelationships = await this.neo4j.createRelationships(relationshipsToCreate);

    // Step 6: Format summary
    const entityNames = createdEntities.map(e => {
      const name = e.properties.name as string || e.properties.title as string || e.id;
      return `${e.label}: ${name}`;
    }).join(', ');
    
    // Build ID to entity map for summary
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

    return {
      entities: createdEntities,
      relationships: createdRelationships,
      summary,
      created: {
        entities: createdEntities.length,
        relationships: createdRelationships.length,
      },
    };
  }

  /**
   * Format graph data into text context for LLM
   * Filters out internal properties (embeddings, similarity scores) that are not useful for LLM context
   * and limits context size to avoid token limits
   */
  private formatGraphContext(graph: {
    entities: Array<{ id: string; label: string; properties: Record<string, unknown> }>;
    relationships: Array<{
      id: string;
      type: string;
      from: string;
      to: string;
      properties: Record<string, unknown>;
    }>;
  }): GraphContext {
    const entityMap = new Map(
      graph.entities.map((e) => [e.id, e])
    );

    // Internal properties to exclude from LLM context
    // Embeddings are huge (1536 floats = ~6000+ tokens each) and not useful for LLM understanding
    // Similarity scores are also internal metadata
    const internalProps = ['embedding', '_similarity'];
    
    // Limit context size to avoid token limits
    // Roughly 4 chars per token, so ~200,000 characters = ~50,000 tokens max
    const MAX_CONTEXT_CHARS = 200000;
    let contextChars = 0;
    const maxEntities = 100; // Hard limit on entities
    const maxRelationships = 200; // Hard limit on relationships

    // Build context string with size limits
    const entityDescriptions: string[] = [];
    for (let i = 0; i < Math.min(graph.entities.length, maxEntities); i++) {
      const entity = graph.entities[i];
      
      // Filter out internal properties and limit property values
      const relevantProps = Object.entries(entity.properties)
        .filter(([key]) => !internalProps.includes(key))
        .map(([key, value]) => {
          // Truncate long property values (e.g., descriptions)
          const valueStr = typeof value === 'string' 
            ? value.length > 200 
              ? value.substring(0, 200) + '...' 
              : value
            : String(value);
          return `${key}: ${valueStr}`;
        })
        .slice(0, 10); // Limit to 10 most important properties
      
      const propsStr = relevantProps.join(', ');
      const entityDesc = `${entity.label} (${entity.id}): ${propsStr || 'no properties'}`;
      
      if (contextChars + entityDesc.length > MAX_CONTEXT_CHARS) {
        break;
      }
      
      entityDescriptions.push(entityDesc);
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
      
      if (contextChars + relDesc.length > MAX_CONTEXT_CHARS) {
        break;
      }
      
      relationshipDescriptions.push(relDesc);
      contextChars += relDesc.length;
    }

    const summary = `
Knowledge Graph Context:

Entities (${entityDescriptions.length}${graph.entities.length > entityDescriptions.length ? ` of ${graph.entities.length} total` : ''}):
${entityDescriptions.join('\n')}

Relationships (${relationshipDescriptions.length}${graph.relationships.length > relationshipDescriptions.length ? ` of ${graph.relationships.length} total` : ''}):
${relationshipDescriptions.join('\n')}
`.trim();

    return {
      entities: graph.entities,
      relationships: graph.relationships,
      summary,
    };
  }
}

