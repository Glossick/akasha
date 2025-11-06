#!/usr/bin/env bun

/**
 * Process Ontology Example for Akasha
 * 
 * This example demonstrates how to use Akasha's template system to implement
 * a process ontology - where processes, events, and activities are primary,
 * rather than static entities.
 * 
 * Process ontology emphasizes:
 * - Events and processes as first-class citizens
 * - Temporal relationships and sequences
 * - Transformation and change
 * - Participation rather than static properties
 * 
 * Usage:
 *   bun run examples/process-ontology.ts
 * 
 * Requires:
 *   - NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
 *   - OPENAI_API_KEY
 */

import { akasha } from '../src/factory';
import type { ExtractionPromptTemplate, Scope } from '../src/types';

// Process Ontology Template
const processOntologyTemplate: Partial<ExtractionPromptTemplate> = {
  role: "You are an expert at extracting process-oriented knowledge structures from natural language text. You think in terms of events, processes, activities, and transformations rather than static entities.",
  
  task: "Your task is to analyze the provided text and extract:\n1. Processes, Events, and Activities (what happens, what changes, what occurs)\n2. Participating entities (who/what participates in these processes)\n3. Temporal and processual relationships (causation, sequence, participation, transformation)",
  
  formatRules: [
    "Process/Event labels should be singular, PascalCase (e.g., Working, Meeting, Transformation, Creation, Destruction, Movement)",
    "Participating entities should be labeled as their role in the process (e.g., Worker, Participant, Agent, Patient, Object)",
    "Each process/event must have temporal properties: startTime, endTime, duration, or timestamp",
    "Relationship types should be UPPERCASE with underscores, emphasizing processual relationships",
    "Extract all relevant temporal and processual properties"
  ],
  
  extractionConstraints: [
    "ONLY extract processes, events, and activities that are EXPLICITLY stated in the text",
    "Focus on what HAPPENS rather than what IS",
    "Extract temporal sequences and causal relationships",
    "NEVER create static entity-to-entity relationships without a process context",
    "NEVER create self-referential process relationships"
  ],
  
  semanticConstraints: [
    "Processes involve PARTICIPANTS - entities that take part in the process",
    "Processes can CAUSE other processes or events",
    "Processes can PRECEDE or FOLLOW other processes temporally",
    "Processes can TRANSFORM entities from one state to another",
    "Events are instantaneous processes (no duration)",
    "Activities are ongoing processes (have duration)",
    "Focus on verbs and action-oriented language",
    "Extract temporal relationships: BEFORE, AFTER, DURING, SIMULTANEOUS_WITH"
  ],
  
  entityTypes: [
    {
      label: 'Process',
      description: 'An ongoing activity or transformation that occurs over time',
      examples: ['Working', 'Meeting', 'Building', 'Learning', 'Transforming'],
      requiredProperties: ['name', 'startTime'],
      optionalProperties: ['endTime', 'duration', 'status', 'location']
    },
    {
      label: 'Event',
      description: 'An instantaneous occurrence or happening',
      examples: ['Arrival', 'Departure', 'Decision', 'Completion', 'Start'],
      requiredProperties: ['name', 'timestamp'],
      optionalProperties: ['location', 'cause', 'effect']
    },
    {
      label: 'Activity',
      description: 'A specific type of process involving action or work',
      examples: ['Development', 'Research', 'Production', 'Collaboration'],
      requiredProperties: ['name', 'startTime'],
      optionalProperties: ['endTime', 'duration', 'participants', 'goal']
    },
    {
      label: 'Transformation',
      description: 'A process that changes something from one state to another',
      examples: ['Conversion', 'Evolution', 'Metamorphosis', 'Transition'],
      requiredProperties: ['name', 'fromState', 'toState'],
      optionalProperties: ['startTime', 'endTime', 'duration', 'agent']
    },
    {
      label: 'Participant',
      description: 'An entity that takes part in a process or event',
      examples: ['Worker', 'Agent', 'Patient', 'Object', 'Subject'],
      requiredProperties: ['name', 'role'],
      optionalProperties: ['processId', 'contribution', 'responsibility']
    }
  ],
  
  relationshipTypes: [
    {
      type: 'PARTICIPATES_IN',
      description: 'Entity participates in a process or event',
      from: ['Participant'],
      to: ['Process', 'Event', 'Activity'],
      examples: ['Worker PARTICIPATES_IN Meeting', 'Agent PARTICIPATES_IN Transformation'],
      constraints: ['Participant must be actively involved in the process']
    },
    {
      type: 'CAUSES',
      description: 'One process or event causes another',
      from: ['Process', 'Event', 'Activity'],
      to: ['Process', 'Event', 'Activity'],
      examples: ['Decision CAUSES Action', 'Meeting CAUSES Agreement'],
      constraints: ['Causal relationship must be explicit or strongly implied']
    },
    {
      type: 'PRECEDES',
      description: 'One process occurs before another temporally',
      from: ['Process', 'Event', 'Activity'],
      to: ['Process', 'Event', 'Activity'],
      examples: ['Planning PRECEDES Execution', 'Preparation PRECEDES Action'],
      constraints: ['Temporal sequence must be clear']
    },
    {
      type: 'FOLLOWS',
      description: 'One process occurs after another temporally',
      from: ['Process', 'Event', 'Activity'],
      to: ['Process', 'Event', 'Activity'],
      examples: ['Execution FOLLOWS Planning', 'Completion FOLLOWS Work'],
      constraints: ['Temporal sequence must be clear']
    },
    {
      type: 'TRANSFORMS_INTO',
      description: 'A transformation process changes something from one state to another',
      from: ['Transformation'],
      to: ['Participant', 'Process'],
      examples: ['Transformation TRANSFORMS_INTO NewState', 'Evolution TRANSFORMS_INTO Species'],
      constraints: ['Must involve a clear before/after state']
    },
    {
      type: 'OCCURS_DURING',
      description: 'One process or event occurs during another',
      from: ['Process', 'Event'],
      to: ['Process', 'Activity'],
      examples: ['Break OCCURS_DURING Meeting', 'Decision OCCURS_DURING Discussion'],
      constraints: ['Temporal overlap must be clear']
    },
    {
      type: 'ENABLES',
      description: 'One process makes another possible',
      from: ['Process', 'Event', 'Activity'],
      to: ['Process', 'Event', 'Activity'],
      examples: ['Preparation ENABLES Execution', 'Learning ENABLES Application'],
      constraints: ['Enabling relationship must be clear']
    }
  ],
  
  outputFormat: `{
  "entities": [
    {
      "label": "Process",
      "properties": {
        "name": "Working",
        "startTime": "2024-01-01T09:00:00Z",
        "endTime": "2024-01-01T17:00:00Z",
        "duration": "8 hours"
      }
    },
    {
      "label": "Participant",
      "properties": {
        "name": "Alice",
        "role": "Worker"
      }
    }
  ],
  "relationships": [
    {
      "from": "Alice",
      "to": "Working",
      "type": "PARTICIPATES_IN",
      "properties": {
        "role": "primary worker"
      }
    }
  ]
}`
};

async function demonstrateProcessOntology() {
  console.log('🔄 Process Ontology Demonstration\n');
  console.log('This example shows how to use Akasha with a process ontology template.\n');
  
  // Check environment variables
  const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'OPENAI_API_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease set these environment variables before running.');
    process.exit(1);
  }
  
  const processScope: Scope = {
    id: `process-ontology-${Date.now()}`,
    type: 'example',
    name: 'Process Ontology Example',
  };
  
  try {
    // Create Akasha instance with process ontology template
    const kg = akasha({
      neo4j: {
        uri: process.env.NEO4J_URI!,
        user: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
      },
      scope: processScope,
      openai: {
        apiKey: process.env.OPENAI_API_KEY!,
      },
      extractionPrompt: processOntologyTemplate,
    });
    
    await kg.initialize();
    console.log('✅ Akasha initialized with process ontology template\n');
    
    // Example 1: Process-oriented text
    console.log('📝 Example 1: Extracting processes and events...\n');
    const text1 = `
      Alice started working at Acme Corp on Monday at 9 AM. 
      She attended a team meeting at 10 AM that lasted one hour. 
      During the meeting, the team decided to launch a new project. 
      This decision led to Alice beginning development work on Tuesday. 
      The development process transformed the initial concept into a working prototype.
    `;
    
    console.log('Text:', text1.trim());
    console.log('\nExtracting with process ontology...\n');
    
    const result1 = await kg.learn(text1, {
      contextName: 'Process Example 1',
    });
    
    console.log(`✅ Extracted ${result1.created.entities} entities and ${result1.created.relationships} relationships\n`);
    console.log('Entities:');
    result1.entities.forEach(entity => {
      console.log(`  - ${entity.label}: ${JSON.stringify(entity.properties)}`);
    });
    console.log('\nRelationships:');
    result1.relationships.forEach(rel => {
      console.log(`  - ${rel.from} --[${rel.type}]--> ${rel.to}`);
    });
    
    // Example 2: Query about processes
    console.log('\n\n📝 Example 2: Querying about processes...\n');
    const query = 'What processes did Alice participate in?';
    console.log('Query:', query);
    
    const answer = await kg.ask(query);
    console.log('\nAnswer:', answer.answer);
    console.log('\nContext used:');
    console.log(`  - ${answer.context.entities.length} entities`);
    console.log(`  - ${answer.context.relationships.length} relationships`);
    
    await kg.cleanup();
    console.log('\n✅ Process ontology demonstration complete!');
    console.log('\nNote: The process ontology emphasizes:');
    console.log('  - Processes, events, and activities as primary entities');
    console.log('  - Temporal relationships (PRECEDES, FOLLOWS, OCCURS_DURING)');
    console.log('  - Causal relationships (CAUSES, ENABLES)');
    console.log('  - Participation relationships (PARTICIPATES_IN)');
    console.log('  - Transformation relationships (TRANSFORMS_INTO)');
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  demonstrateProcessOntology();
}

export { processOntologyTemplate, demonstrateProcessOntology };

