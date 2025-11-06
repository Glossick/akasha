import type { ExtractionPromptTemplate } from '../types';

/**
 * Default extraction prompt template matching current hard-coded prompt
 */
export const DEFAULT_EXTRACTION_TEMPLATE: ExtractionPromptTemplate = {
  role: "You are an expert at extracting knowledge graph structures from natural language text.",
  task: "Your task is to analyze the provided text and extract:\n1. Entities (people, places, organizations, concepts, works, etc.) with their properties\n2. Relationships between entities",
  formatRules: [
    "Entity labels should be singular, PascalCase (e.g., Person, Company, Film, Book, Location, Concept)",
    "Each entity must have at least a \"name\" property (or \"title\" if more appropriate for works/creations)",
    "Relationship types should be UPPERCASE with underscores (e.g., WORKS_FOR, LOCATED_IN, OWNS, CREATED, DIRECTED, WROTE, INSPIRED_BY, FATHER_OF)",
    "Relationships should reference entities by their \"name\" property (or \"title\" for works)",
    "Extract all relevant properties from the text for each entity"
  ],
  extractionConstraints: [
    "ONLY extract relationships that are EXPLICITLY stated in the text - do not infer or create relationships",
    "NEVER create self-referential relationships (from and to cannot be the same entity)",
    "NEVER create duplicate relationships (same from, to, and type combination)"
  ],
  semanticConstraints: [
    "FATHER_OF, MOTHER_OF, SON_OF, DAUGHTER_OF only for familial relationships between Persons",
    "CREATED, DIRECTED, WROTE, PRODUCED for creative works (Films, Books, etc.)",
    "WORKS_FOR, OWNS, FOUNDED for organizations",
    "INSPIRED_BY, BASED_ON for conceptual relationships",
    "SIMILAR_TO, RELATED_TO for comparisons",
    "Films, Books, Concepts cannot have FATHER_OF, MOTHER_OF relationships",
    "Only Persons can have FATHER_OF, MOTHER_OF relationships",
    "Be precise: \"X wrote Y\" means Person wrote Work, not Work wrote Person"
  ],
  outputFormat: `{
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
}`
};

/**
 * Generate extraction prompt from template
 * Merges custom template with defaults
 */
export function generateExtractionPrompt(
  template?: Partial<ExtractionPromptTemplate>
): string {
  const fullTemplate: ExtractionPromptTemplate = {
    ...DEFAULT_EXTRACTION_TEMPLATE,
    ...template,
    // Deep merge for arrays - if custom provided, use it, otherwise use default
    formatRules: template?.formatRules ?? DEFAULT_EXTRACTION_TEMPLATE.formatRules,
    extractionConstraints: template?.extractionConstraints ?? DEFAULT_EXTRACTION_TEMPLATE.extractionConstraints,
    semanticConstraints: template?.semanticConstraints ?? DEFAULT_EXTRACTION_TEMPLATE.semanticConstraints,
    entityTypes: template?.entityTypes ?? DEFAULT_EXTRACTION_TEMPLATE.entityTypes,
    relationshipTypes: template?.relationshipTypes ?? DEFAULT_EXTRACTION_TEMPLATE.relationshipTypes,
  };
  
  // Build prompt string from template
  const parts: string[] = [];
  
  // Role
  parts.push(fullTemplate.role!);
  parts.push('');
  
  // Task
  parts.push(fullTemplate.task!);
  parts.push('');
  
  // Format Rules
  parts.push('CRITICAL RULES:');
  fullTemplate.formatRules?.forEach(rule => {
    parts.push(`- ${rule}`);
  });
  
  // Extraction Constraints
  fullTemplate.extractionConstraints?.forEach(constraint => {
    parts.push(`- ${constraint}`);
  });
  
  // Semantic Constraints
  if (fullTemplate.semanticConstraints && fullTemplate.semanticConstraints.length > 0) {
    parts.push('- Use semantically appropriate relationship types:');
    fullTemplate.semanticConstraints.forEach(constraint => {
      parts.push(`  * ${constraint}`);
    });
  }
  
  // Entity Types (if provided)
  if (fullTemplate.entityTypes && fullTemplate.entityTypes.length > 0) {
    parts.push('');
    parts.push('ENTITY TYPES:');
    fullTemplate.entityTypes.forEach(entityType => {
      parts.push(`- ${entityType.label}: ${entityType.description || ''}`);
      if (entityType.examples && entityType.examples.length > 0) {
        parts.push(`  Examples: ${entityType.examples.join(', ')}`);
      }
      if (entityType.requiredProperties && entityType.requiredProperties.length > 0) {
        parts.push(`  Required properties: ${entityType.requiredProperties.join(', ')}`);
      }
    });
  }
  
  // Relationship Types (if provided)
  if (fullTemplate.relationshipTypes && fullTemplate.relationshipTypes.length > 0) {
    parts.push('');
    parts.push('RELATIONSHIP TYPES:');
    fullTemplate.relationshipTypes.forEach(relType => {
      parts.push(`- ${relType.type}: ${relType.description || ''}`);
      parts.push(`  From: ${relType.from.join(', ')}`);
      parts.push(`  To: ${relType.to.join(', ')}`);
      if (relType.examples && relType.examples.length > 0) {
        parts.push(`  Examples: ${relType.examples.join(', ')}`);
      }
      if (relType.constraints && relType.constraints.length > 0) {
        relType.constraints.forEach(constraint => {
          parts.push(`  Constraint: ${constraint}`);
        });
      }
    });
  }
  
  // Output Format
  parts.push('');
  parts.push(`Return ONLY valid JSON in this format:`);
  parts.push(fullTemplate.outputFormat!);
  
  return parts.join('\n');
}

