# Akasha Ontology Examples

This directory contains examples demonstrating how to use Akasha's template system to implement different ontological paradigms.

## Process Ontology

**File**: `process-ontology.ts`

Demonstrates a process-oriented ontology where:
- Processes, events, and activities are primary entities
- Temporal relationships are emphasized
- Focus on "what happens" rather than "what is"

### Key Features

1. **Process-First Entities**:
   - `Process`: Ongoing activities (Working, Meeting, Building)
   - `Event`: Instantaneous occurrences (Arrival, Decision, Completion)
   - `Activity`: Specific types of processes (Development, Research)
   - `Transformation`: Processes that change states
   - `Participant`: Entities that take part in processes

2. **Processual Relationships**:
   - `PARTICIPATES_IN`: Entity participates in process
   - `CAUSES`: One process causes another
   - `PRECEDES`/`FOLLOWS`: Temporal sequence
   - `TRANSFORMS_INTO`: State transformation
   - `OCCURS_DURING`: Temporal overlap
   - `ENABLES`: One process enables another

3. **Temporal Properties**:
   - Processes have `startTime`, `endTime`, `duration`
   - Events have `timestamp`
   - Temporal relationships capture sequence and causality

### Usage

```bash
bun run examples/process-ontology.ts
```

### Example Output

The process ontology will extract:
- "Alice started working" → `Process: Working` with `startTime`
- "attended a meeting" → `Event: Meeting` with `timestamp`
- "decision led to development" → `CAUSES` relationship
- "Alice" → `Participant` with `role: Worker`

## Comparison: Substance vs Process

### Substance Ontology (Default)
- Entities: Person, Company, Object
- Relationships: WORKS_FOR, OWNS, KNOWS
- Focus: Static properties and connections
- Example: "Alice is a software engineer at Acme Corp"

### Process Ontology
- Entities: Process, Event, Activity, Participant
- Relationships: PARTICIPATES_IN, CAUSES, PRECEDES
- Focus: Dynamic processes and temporal sequences
- Example: "Alice is working at Acme Corp" (ongoing process)

## Creating Your Own Ontology

To create a custom ontology:

1. **Define Entity Types**:
   ```typescript
   entityTypes: [
     {
       label: 'YourEntity',
       description: 'What it represents',
       examples: ['Example1', 'Example2'],
       requiredProperties: ['prop1', 'prop2']
     }
   ]
   ```

2. **Define Relationship Types**:
   ```typescript
   relationshipTypes: [
     {
       type: 'YOUR_RELATIONSHIP',
       description: 'What it means',
       from: ['Entity1'],
       to: ['Entity2'],
       examples: ['Entity1 YOUR_RELATIONSHIP Entity2']
     }
   ]
   ```

3. **Customize Role and Task**:
   ```typescript
   role: "Your custom role description",
   task: "Your custom task description"
   ```

4. **Add Semantic Constraints**:
   ```typescript
   semanticConstraints: [
     "Your constraint 1",
     "Your constraint 2"
   ]
   ```

5. **Use in Akasha**:
   ```typescript
   const kg = akasha({
     neo4j: {...},
     scope: {...},
     extractionPrompt: yourOntologyTemplate
   });
   ```

## Future Examples

- **Relational Ontology**: Relationships as primary, entities defined by relations
- **Four-Category Ontology**: Universals vs particulars, substantial vs non-substantial
- **Mereology**: Part-whole relationships
- **Domain-Specific**: E-commerce, healthcare, legal ontologies

