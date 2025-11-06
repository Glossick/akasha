# Working with Ontologies

An ontology defines what entities and relationships exist in your domain. Akasha's template system allows you to customize the extraction prompt to implement different ontological paradigms.

## The Default Template

When you don't provide a custom `extractionPrompt`, Akasha uses a default template that is substance-oriented: it emphasizes static entities (Person, Company, Object) and their relationships (WORKS_FOR, OWNS, KNOWS).

Here is the complete default template structure:

```typescript
const DEFAULT_EXTRACTION_TEMPLATE = {
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

### Understanding the Default Template

- **role**: Defines the LLM's role as an extraction expert
- **task**: Describes what to extract (entities and relationships)
- **formatRules**: How entities and relationships should be formatted (PascalCase labels, UPPERCASE relationship types, etc.)
- **extractionConstraints**: What NOT to extract (no inference, no self-referential relationships, no duplicates)
- **semanticConstraints**: Domain-specific rules about which relationship types apply to which entity types
- **outputFormat**: The JSON structure the LLM should return
- **entityTypes**: Not defined in default (LLM infers from context)
- **relationshipTypes**: Not defined in default (LLM infers from context)

## Overriding the Default Template

You can override any part of the default template by providing a partial template. Akasha merges your custom template with the defaults, so you only need to specify what you want to change.

### Partial Override: Adding Entity Types

To add specific entity types while keeping everything else default:

```typescript
const kg = akasha({
  neo4j: { /* ... */ },
  scope: { /* ... */ },
  extractionPrompt: {
    entityTypes: [
      {
        label: 'Customer',
        description: 'A customer who makes purchases',
        examples: ['John Doe', 'customer@example.com'],
        requiredProperties: ['email', 'name'],
      },
      {
        label: 'Product',
        description: 'A product for sale',
        examples: ['iPhone 15', 'SKU-12345'],
        requiredProperties: ['sku', 'name'],
      },
    ],
  },
});
```

This keeps all default rules, constraints, and format rules, but adds specific entity type definitions.

### Partial Override: Changing Role and Task

To change the LLM's role and task while keeping format rules:

```typescript
const kg = akasha({
  neo4j: { /* ... */ },
  scope: { /* ... */ },
  extractionPrompt: {
    role: "You are an expert at extracting process-oriented knowledge structures.",
    task: "Extract processes, events, activities, and their temporal relationships.",
  },
});
```

This changes the role and task, but keeps all default format rules, constraints, and output format.

### Partial Override: Custom Relationship Types

To define specific relationship types:

```typescript
const kg = akasha({
  neo4j: { /* ... */ },
  scope: { /* ... */ },
  extractionPrompt: {
    relationshipTypes: [
      {
        type: 'PURCHASED',
        description: 'Customer purchased a product',
        from: ['Customer'],
        to: ['Product'],
        examples: ['Customer PURCHASED Product'],
      },
      {
        type: 'CONTAINS',
        description: 'Order contains products',
        from: ['Order'],
        to: ['Product'],
        examples: ['Order CONTAINS Product'],
      },
    ],
  },
});
```

### Complete Override: Custom Ontology

You can override everything to create a completely custom ontology:

```typescript
const ecommerceOntology = {
  role: "You are an expert at extracting e-commerce knowledge structures.",
  task: "Extract customers, products, orders, and their relationships.",
  formatRules: [
    "Entity labels should be singular, PascalCase",
    "Each entity must have at least a 'name' property",
    "Relationship types should be UPPERCASE with underscores",
  ],
  extractionConstraints: [
    "ONLY extract relationships that are EXPLICITLY stated",
    "NEVER create self-referential relationships",
  ],
  entityTypes: [
    {
      label: 'Customer',
      description: 'A customer who makes purchases',
      examples: ['John Doe', 'customer@example.com'],
      requiredProperties: ['email', 'name'],
    },
    {
      label: 'Product',
      description: 'A product for sale',
      examples: ['iPhone 15', 'SKU-12345'],
      requiredProperties: ['sku', 'name'],
    },
    {
      label: 'Order',
      description: 'A customer order',
      examples: ['Order #12345'],
      requiredProperties: ['orderId', 'total'],
    },
  ],
  relationshipTypes: [
    {
      type: 'PURCHASED',
      description: 'Customer purchased a product',
      from: ['Customer'],
      to: ['Product'],
      examples: ['Customer PURCHASED Product'],
    },
    {
      type: 'CONTAINS',
      description: 'Order contains products',
      from: ['Order'],
      to: ['Product'],
      examples: ['Order CONTAINS Product'],
    },
  ],
  semanticConstraints: [
    "PURCHASED only from Customer to Product",
    "CONTAINS only from Order to Product",
  ],
  outputFormat: `{
  "entities": [
    {
      "label": "Customer",
      "properties": {
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "relationships": [
    {
      "from": "John Doe",
      "to": "iPhone 15",
      "type": "PURCHASED",
      "properties": {}
    }
  ]
}`,
};

const kg = akasha({
  neo4j: { /* ... */ },
  scope: { /* ... */ },
  extractionPrompt: ecommerceOntology,
});
```

This completely replaces the default template with your custom ontology.

### Example: Process Ontology

Process ontology emphasizes events, activities, and temporal relationships. This example shows a partial override—it changes the role, task, and adds entity/relationship types, but keeps the default format rules and constraints:

```typescript
const processOntology = {
  role: "You are an expert at extracting process-oriented knowledge structures.",
  task: "Extract processes, events, activities, and their temporal relationships.",
  entityTypes: [
    {
      label: 'Process',
      description: 'An ongoing activity',
      examples: ['Working', 'Meeting', 'Building'],
      requiredProperties: ['name', 'startTime'],
    },
    {
      label: 'Event',
      description: 'An instantaneous occurrence',
      examples: ['Arrival', 'Decision', 'Completion'],
      requiredProperties: ['name', 'timestamp'],
    },
  ],
  relationshipTypes: [
    {
      type: 'PARTICIPATES_IN',
      description: 'Entity participates in a process',
      from: ['Participant'],
      to: ['Process', 'Event'],
    },
    {
      type: 'CAUSES',
      description: 'One process causes another',
      from: ['Process', 'Event'],
      to: ['Process', 'Event'],
    },
    {
      type: 'PRECEDES',
      description: 'Temporal sequence',
      from: ['Process', 'Event'],
      to: ['Process', 'Event'],
    },
  ],
};

const kg = akasha({
  neo4j: { /* ... */ },
  scope: { /* ... */ },
  extractionPrompt: processOntology,
});
```

Note: This keeps the default `formatRules`, `extractionConstraints`, and `outputFormat`. Only the role, task, and type definitions are overridden.

See `examples/process-ontology.ts` for a complete process ontology implementation.

## Template Structure

An extraction prompt template has several sections:

### Role and Task

Define the LLM's role and what it should extract:

```typescript
{
  role: "You are an expert at extracting knowledge graph structures...",
  task: "Your task is to analyze the provided text and extract...",
}
```

### Format Rules

Define how entities and relationships should be formatted:

```typescript
{
  formatRules: [
    "Entity labels should be singular, PascalCase",
    "Relationship types should be UPPERCASE with underscores",
    "Each entity must have at least a 'name' property",
  ],
}
```

### Extraction Constraints

Define what the LLM should and shouldn't extract:

```typescript
{
  extractionConstraints: [
    "ONLY extract relationships that are EXPLICITLY stated",
    "NEVER create self-referential relationships",
    "NEVER create duplicate relationships",
  ],
}
```

### Entity Types

Define what entity types exist in your domain:

```typescript
{
  entityTypes: [
    {
      label: 'EntityName',
      description: 'What this entity represents',
      examples: ['Example1', 'Example2'],
      requiredProperties: ['prop1', 'prop2'],
      optionalProperties: ['prop3'],
    },
  ],
}
```

### Relationship Types

Define what relationship types exist:

```typescript
{
  relationshipTypes: [
    {
      type: 'RELATIONSHIP_TYPE',
      description: 'What this relationship means',
      from: ['SourceEntityType'],
      to: ['TargetEntityType'],
      examples: ['Source RELATIONSHIP_TYPE Target'],
      constraints: ['Additional constraints'],
    },
  ],
}
```

### Semantic Constraints

Define domain-specific rules:

```typescript
{
  semanticConstraints: [
    "PURCHASED only from Customer to Product",
    "CONTAINS only from Order to Product",
  ],
}
```

### Output Format

Define the JSON structure the LLM should return:

```typescript
{
  outputFormat: `{
  "entities": [
    {
      "label": "EntityName",
      "properties": { ... }
    }
  ],
  "relationships": [
    {
      "from": "Entity1",
      "to": "Entity2",
      "type": "RELATIONSHIP_TYPE"
    }
  ]
}`,
}
```

## How Overriding Works

When you provide a custom template, Akasha merges it with the default template using the following rules:

1. **Top-level properties** (role, task, outputFormat): If you provide them, they replace the defaults completely
2. **Array properties** (formatRules, extractionConstraints, etc.): If you provide them, they replace the defaults completely (not merged)
3. **Type definitions** (entityTypes, relationshipTypes): If you provide them, they replace the defaults completely

This means you can override just what you need:

```typescript
// Only override entity types, keep everything else default
const customTemplate = {
  entityTypes: [
    {
      label: 'CustomEntity',
      description: 'A custom entity type',
      requiredProperties: ['name'],
    },
  ],
};
```

The resulting template will have:
- Default `role` and `task`
- Default `formatRules` and `extractionConstraints`
- Default `semanticConstraints`
- Default `outputFormat`
- Your custom `entityTypes` (replacing the default, which is undefined)

### Override Examples

**Minimal override** (just add entity types):
```typescript
extractionPrompt: {
  entityTypes: [{ label: 'Product', /* ... */ }],
}
```

**Medium override** (change role and add types):
```typescript
extractionPrompt: {
  role: "Custom role...",
  entityTypes: [{ label: 'Product', /* ... */ }],
  relationshipTypes: [{ type: 'RELATES_TO', /* ... */ }],
}
```

**Complete override** (replace everything):
```typescript
extractionPrompt: {
  role: "...",
  task: "...",
  formatRules: [...],
  extractionConstraints: [...],
  semanticConstraints: [...],
  entityTypes: [...],
  relationshipTypes: [...],
  outputFormat: "...",
}
```

## Ontological Paradigms

Different domains benefit from different ontological approaches:

### Substance Ontology (Default)

Emphasizes static entities and their properties. Good for:
- Organizational structures
- Product catalogs
- Entity-relationship models

### Process Ontology

Emphasizes events, activities, and temporal sequences. Good for:
- Workflow tracking
- Event logs
- Temporal analysis

### Relational Ontology

Emphasizes relationships as primary, entities defined by relations. Good for:
- Social networks
- Dependency graphs
- Relationship-heavy domains

## Best Practices

1. **Start Simple**: Begin with the default ontology, then customize as needed.

2. **Provide Examples**: Examples in entity and relationship definitions help the LLM understand your domain.

3. **Be Specific**: Clear descriptions and constraints lead to better extraction.

4. **Test Iteratively**: Extract from sample text, review results, refine the template.

5. **Document Your Ontology**: Keep notes on why you chose certain entity types and relationships.

## Example: Domain-Specific Ontology

Here's a healthcare ontology example:

```typescript
const healthcareOntology = {
  entityTypes: [
    {
      label: 'Patient',
      description: 'A person receiving medical care',
      requiredProperties: ['name', 'patientId'],
    },
    {
      label: 'Provider',
      description: 'A healthcare provider',
      requiredProperties: ['name', 'providerId', 'specialty'],
    },
    {
      label: 'Condition',
      description: 'A medical condition or diagnosis',
      requiredProperties: ['name', 'icd10Code'],
    },
    {
      label: 'Treatment',
      description: 'A medical treatment or procedure',
      requiredProperties: ['name', 'cptCode'],
    },
  ],
  relationshipTypes: [
    {
      type: 'HAS_CONDITION',
      description: 'Patient has a medical condition',
      from: ['Patient'],
      to: ['Condition'],
    },
    {
      type: 'RECEIVES_TREATMENT',
      description: 'Patient receives treatment',
      from: ['Patient'],
      to: ['Treatment'],
    },
    {
      type: 'PRESCRIBES',
      description: 'Provider prescribes treatment',
      from: ['Provider'],
      to: ['Treatment'],
    },
  ],
};
```

---

**Next**: Read [Multi-Tenancy](./multi-tenancy.md) to understand scope and context management, or see [Examples](./examples.md) for practical patterns.

