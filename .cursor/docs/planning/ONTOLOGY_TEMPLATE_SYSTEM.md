# Ontology Template System Implementation Plan

**Status**: Design Complete - Ready for Implementation  
**Priority**: High  
**Related**: Akasha Library, Multi-Tenant Support

---

## Navigation Analysis

### Primary Semantic Region
**Configurable LLM Prompt Templates** / **Domain-Specific Ontology Systems** / **Extensible Knowledge Graph Schemas**

### Confidence Level
**HIGH** - Prompt engineering patterns well-understood, template systems are standard

### Navigation Strategy
**Iterative implementation** - Start with full template system, add ontology abstractions later

---

## Problem Statement

The current Akasha library has a hard-coded extraction prompt in `extractEntitiesAndRelationships()`. This limits:
- Domain-specific customization
- Opinionated ontologies for different problem spaces
- Flexibility for different use cases

**Goal**: Make the extraction prompt fully configurable while maintaining backward compatibility and good defaults.

---

## Design Decisions

### 1. Full Template System
- **Decision**: All prompt sections configurable, not just entity/relationship types
- **Rationale**: Maximum flexibility, allows domain-specific customization of any aspect
- **Default**: Current hard-coded prompt becomes the default template

### 2. Template Structure
- **Decision**: Template structure directly maps to prompt sections
- **Rationale**: Clear, intuitive, easy to understand and modify
- **Sections**: Role, Task, Format Rules, Extraction Constraints, Entity Types, Relationship Types, Output Format

### 3. Per-Scope Ontologies
- **Decision**: Each scope can have its own ontology
- **Rationale**: Enables multi-tenant scenarios with different domains per tenant
- **Implementation**: Ontology stored in Akasha instance (scope-specific)

### 4. Declarative Definition
- **Decision**: Simple object-based ontology definition
- **Rationale**: Easy to define, understand, and serialize
- **Alternative Considered**: Builder pattern (rejected - more complex)

---

## Implementation Plan

### Phase 1: Template System Foundation (MVP)

#### 1.1 Define Template Types

**Files**: `akasha/src/types.ts`

```typescript
export interface ExtractionPromptTemplate {
  // Core structure
  role?: string;
  task?: string;
  formatRules?: string[];
  extractionConstraints?: string[];
  
  // Domain-specific
  entityTypes?: EntityTypeDefinition[];
  relationshipTypes?: RelationshipTypeDefinition[];
  semanticConstraints?: string[];
  
  // Output
  outputFormat?: string;
}

export interface EntityTypeDefinition {
  label: string;
  description?: string;
  examples?: string[];
  requiredProperties?: string[];
  optionalProperties?: string[];
}

export interface RelationshipTypeDefinition {
  type: string;
  description?: string;
  from: string[];
  to: string[];
  examples?: string[];
  constraints?: string[];
}
```

**Tasks**:
- [ ] Add `ExtractionPromptTemplate` interface
- [ ] Add `EntityTypeDefinition` interface
- [ ] Add `RelationshipTypeDefinition` interface
- [ ] Add `extractionPrompt` to `AkashaConfig` (optional)

**Estimated Time**: 30 minutes

---

#### 1.2 Create Default Template

**Files**: `akasha/src/utils/prompt-template.ts` (new file)

```typescript
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
```

**Tasks**:
- [ ] Create `prompt-template.ts` file
- [ ] Extract current prompt into `DEFAULT_EXTRACTION_TEMPLATE`
- [ ] Ensure exact match with current prompt

**Estimated Time**: 1 hour

---

#### 1.3 Create Prompt Generator

**Files**: `akasha/src/utils/prompt-template.ts`

```typescript
export function generateExtractionPrompt(
  template?: Partial<ExtractionPromptTemplate>
): string {
  const fullTemplate = {
    ...DEFAULT_EXTRACTION_TEMPLATE,
    ...template,
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
```

**Tasks**:
- [ ] Implement `generateExtractionPrompt()` function
- [ ] Handle all template sections
- [ ] Merge custom template with defaults
- [ ] Test with default template (should match current prompt)

**Estimated Time**: 2 hours

---

#### 1.4 Integrate into Akasha Class

**Files**: `akasha/src/akasha.ts`

**Changes**:
1. Add `extractionPromptConfig` to constructor
2. Store in private field
3. Use in `extractEntitiesAndRelationships()`

```typescript
export class Akasha {
  private extractionPromptConfig?: Partial<ExtractionPromptTemplate>;
  
  constructor(config: AkashaConfig, ...) {
    this.extractionPromptConfig = config.extractionPrompt;
    // ...
  }
  
  private async extractEntitiesAndRelationships(text: string): Promise<{...}> {
    const systemPrompt = generateExtractionPrompt(this.extractionPromptConfig);
    // ... rest of method
  }
}
```

**Tasks**:
- [ ] Add `extractionPrompt` to `AkashaConfig` type
- [ ] Store config in Akasha instance
- [ ] Replace hard-coded prompt with `generateExtractionPrompt()`
- [ ] Verify backward compatibility (no config = default prompt)

**Estimated Time**: 1 hour

---

#### 1.5 Tests

**Files**: `akasha/src/__tests__/prompt-template.test.ts` (new file)

**Test Cases**:
- [ ] Default template generates current prompt exactly
- [ ] Custom role overrides default
- [ ] Custom entity types added to prompt
- [ ] Custom relationship types added to prompt
- [ ] Partial template merges with defaults
- [ ] Empty template uses all defaults

**Estimated Time**: 1.5 hours

---

### Phase 2: Ontology Abstraction (Next Iteration)

**Status**: Planned, not yet implemented

#### 2.1 Ontology Type Definition

```typescript
interface Ontology {
  entities: Record<string, EntityTypeDefinition>;
  relationships: Record<string, RelationshipTypeDefinition>;
  metadata?: {
    name: string;
    description?: string;
    version?: string;
  };
}
```

#### 2.2 Ontology → Template Conversion

```typescript
function ontologyToTemplate(ontology: Ontology): ExtractionPromptTemplate {
  // Convert ontology object to prompt template
  // Generate examples, constraints, etc. from ontology
}
```

#### 2.3 Ontology Registry

```typescript
const ONTOLOGIES = {
  'ecommerce': ecommerceOntology,
  'healthcare': healthcareOntology,
  // ...
};

const kg = akasha({
  ontology: ONTOLOGIES.ecommerce
});
```

**Estimated Time**: 4-6 hours (future work)

---

## Testing Strategy

### Unit Tests
- Template generation with defaults
- Template generation with custom values
- Template merging logic
- Prompt string formatting

### Integration Tests
- Extraction with default template (should match current behavior)
- Extraction with custom template
- Domain-specific ontologies (e-commerce, healthcare, etc.)

### Backward Compatibility Tests
- No config provided = uses default (current prompt)
- Existing code continues to work
- API contracts unchanged

---

## Success Criteria

1. ✅ Default template generates exact current prompt
2. ✅ All prompt sections configurable
3. ✅ Backward compatible (no breaking changes)
4. ✅ Tests pass (unit + integration)
5. ✅ Documentation updated
6. ✅ Example ontologies provided

---

## Implementation Order

1. **Phase 1.1**: Define types (30 min)
2. **Phase 1.2**: Create default template (1 hour)
3. **Phase 1.3**: Create prompt generator (2 hours)
4. **Phase 1.4**: Integrate into Akasha (1 hour)
5. **Phase 1.5**: Write tests (1.5 hours)

**Total Estimated Time**: ~6 hours

---

## Open Questions

1. Should ontologies be stored in Neo4j? (Future consideration)
2. Should ontologies support versioning? (Future consideration)
3. Should ontologies support inheritance? (Future consideration)
4. How to handle ontology validation? (Future consideration)

---

## Related Documents

- `docs/status/STATUS.md` - Current project status
- `akasha/src/akasha.ts` - Current implementation
- `backend/MIGRATION_TO_AKASHA.md` - Backend migration details

---

**Last Updated**: 2025-01-27  
**Status**: Design Complete - Ready for Implementation  
**Next Step**: Begin Phase 1.1 (Define Template Types)

