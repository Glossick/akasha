#!/usr/bin/env bun

/**
 * Query Knowledge Base Script
 * 
 * Interactive CLI for querying EstiMate's knowledge base with multi-dimensional context filtering.
 * 
 * Required environment variables:
 * - NEO4J_URI
 * - NEO4J_USER
 * - NEO4J_PASSWORD
 * - OPENAI_API_KEY (for embeddings)
 * - DEEPSEEK_API_KEY (for LLM)
 * 
 * Usage:
 *   bun run scripts/query-knowledge.ts
 */

import { akasha } from '../../../akasha/src/factory';
import type { Scope, QueryOptions } from '../../../akasha/src/types';

// Check environment variables
const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  process.exit(1);
}

// Predefined queries demonstrating multi-dimensional context filtering
const EXAMPLE_QUERIES = [
  {
    name: 'Temporal: What happened in February 2024?',
    question: 'What were the major events and decisions in February 2024?',
    options: {
      contexts: ['time:2024-02'],
      includeStats: true,
    },
  },
  {
    name: 'Client: What do we know about MegaConstruct?',
    question: 'Tell me everything about MegaConstruct as a customer',
    options: {
      contexts: ['client:megaconstruct'],
      includeStats: true,
    },
  },
  {
    name: 'Topic: Pricing evolution over time',
    question: 'How did our pricing strategy evolve over the 6 months?',
    options: {
      contexts: ['topic:pricing'],
      includeStats: true,
    },
  },
  {
    name: 'Team: What was Steven working on?',
    question: 'What were Steven\'s main concerns and responsibilities?',
    options: {
      contexts: ['team:steven'],
      includeStats: true,
    },
  },
  {
    name: 'Source: What did customers say in calls?',
    question: 'What feedback did we get from customer calls?',
    options: {
      contexts: ['source:customer-call'],
      includeStats: true,
    },
  },
  {
    name: 'Multi-dimension: Architecture decisions involving MegaConstruct',
    question: 'What architecture decisions were influenced by MegaConstruct?',
    options: {
      contexts: ['client:megaconstruct', 'topic:architecture'],
      includeStats: true,
    },
  },
  {
    name: 'Temporal range: Q1 2024 (Jan-Mar)',
    question: 'What were the key developments in Q1 2024?',
    options: {
      contexts: ['time:2024-01', 'time:2024-02', 'time:2024-03'],
      includeStats: true,
    },
  },
  {
    name: 'Ambiguity test: Different views on pricing',
    question: 'Did Henry and Steven agree on pricing strategy?',
    options: {
      contexts: ['team:henry', 'team:steven', 'topic:pricing'],
      includeStats: true,
    },
  },
  {
    name: 'Temporal: Compare burnout before and after',
    question: 'How did team morale change between April and June?',
    options: {
      contexts: ['time:2024-04', 'time:2024-05', 'time:2024-06'],
      includeStats: true,
    },
  },
  {
    name: 'Complex: Feature prioritization across teams and clients',
    question: 'How did different stakeholders influence feature prioritization?',
    options: {
      contexts: ['topic:features', 'topic:product'],
      includeStats: true,
    },
  },
];

async function runQuery(kg: any, queryDef: typeof EXAMPLE_QUERIES[0], queryNum: number) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`QUERY ${queryNum}: ${queryDef.name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`\n❓ Question: ${queryDef.question}`);
  
  if (queryDef.options.contexts && queryDef.options.contexts.length > 0) {
    console.log(`🏷️  Context filters: ${queryDef.options.contexts.join(', ')}`);
  }
  
  console.log('\n⏳ Querying...\n');

  const startTime = Date.now();
  const result = await kg.ask(queryDef.question, queryDef.options);
  const duration = Date.now() - startTime;

  console.log(`💬 Answer:\n`);
  console.log(result.answer);
  
  console.log(`\n📊 Query Statistics:`);
  if (result.statistics) {
    console.log(`   Search time: ${result.statistics.searchTimeMs}ms`);
    console.log(`   Subgraph retrieval: ${result.statistics.subgraphRetrievalTimeMs}ms`);
    console.log(`   LLM generation: ${result.statistics.llmGenerationTimeMs}ms`);
    console.log(`   Total time: ${result.statistics.totalTimeMs}ms`);
    console.log(`   Documents found: ${result.statistics.documentsFound}`);
    console.log(`   Entities found: ${result.statistics.entitiesFound}`);
    console.log(`   Relationships found: ${result.statistics.relationshipsFound}`);
    console.log(`   Strategy: ${result.statistics.strategy}`);
  } else {
    console.log(`   Total time: ${duration}ms`);
  }

  console.log(`\n🔍 Context Retrieved:`);
  console.log(`   Documents: ${result.context.documents?.length || 0}`);
  console.log(`   Entities: ${result.context.entities.length}`);
  console.log(`   Relationships: ${result.context.relationships.length}`);

  // Show top entities found
  if (result.context.entities.length > 0) {
    console.log(`\n   Top entities:`);
    result.context.entities.slice(0, 5).forEach((entity: any) => {
      const name = entity.properties.name || entity.properties.title || entity.id;
      const similarity = entity.properties._similarity 
        ? ` (similarity: ${entity.properties._similarity.toFixed(3)})` 
        : '';
      console.log(`      - ${entity.label}: ${name}${similarity}`);
    });
  }

  // Show documents found with their contexts
  if (result.context.documents && result.context.documents.length > 0) {
    console.log(`\n   Documents found:`);
    result.context.documents.slice(0, 3).forEach((doc: any) => {
      const contextIds = doc.properties.contextIds || [];
      const similarity = doc.properties._similarity 
        ? ` (similarity: ${doc.properties._similarity.toFixed(3)})` 
        : '';
      console.log(`      - Document ${doc.id.substring(0, 8)}...${similarity}`);
      console.log(`        Contexts: ${contextIds.join(', ')}`);
    });
  }
}

async function queryKnowledgeBase() {
  console.log('🔍 EstiMate Knowledge Base Query Tool\n');

  // Create scope (same as load script)
  const scope: Scope = {
    id: 'estimate-company',
    type: 'organization',
    name: 'EstiMate Company Knowledge Base',
  };

  console.log('📦 Initializing Akasha...\n');

  const kg = akasha({
    neo4j: {
      uri: process.env.NEO4J_URI!,
      user: process.env.NEO4J_USER!,
      password: process.env.NEO4J_PASSWORD!,
    },
    scope,
    providers: {
      embedding: {
        type: 'openai',
        config: {
          apiKey: process.env.OPENAI_API_KEY!,
          model: 'text-embedding-3-small',
        },
      },
      llm: {
        type: 'deepseek',
        config: {
          apiKey: process.env.DEEPSEEK_API_KEY!,
          model: 'deepseek-chat',
        },
      },
    },
  });

  await kg.initialize();
  console.log('✅ Connected to knowledge base\n');

  try {
    console.log(`Running ${EXAMPLE_QUERIES.length} example queries to demonstrate multi-dimensional context filtering...\n`);
    console.log('These queries showcase:');
    console.log('  ✨ Temporal filtering (time dimension)');
    console.log('  👥 Team filtering (who was involved)');
    console.log('  🏢 Client filtering (which customers)');
    console.log('  📝 Source filtering (where information came from)');
    console.log('  🎯 Topic filtering (what subjects)');
    console.log('  🔀 Multi-dimensional combinations');
    console.log('  ⏱️  Temporal complexity and evolution');
    console.log('  ❓ Ambiguity detection (conflicting information)');

    for (const [index, queryDef] of EXAMPLE_QUERIES.entries()) {
      await runQuery(kg, queryDef, index + 1);
      
      // Pause between queries for readability
      if (index < EXAMPLE_QUERIES.length - 1) {
        console.log('\n⏸️  Press Enter to continue to next query...');
        // Wait for user input using process.stdin
        await new Promise<void>((resolve) => {
          process.stdin.once('data', () => resolve());
        });
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('✨ All example queries complete!');
    console.log(`${'='.repeat(80)}\n`);

    console.log('💡 Key Insights Demonstrated:');
    console.log('   ✅ Context filtering works across multiple dimensions simultaneously');
    console.log('   ✅ Documents and entities can belong to multiple contexts');
    console.log('   ✅ Temporal queries show how facts evolved over time');
    console.log('   ✅ Ambiguous/conflicting information is surfaced in query results');
    console.log('   ✅ Same entity (e.g., Henry, Steven, MegaConstruct) appears in many contexts');
    console.log('   ✅ Query strategies (documents/entities/both) adapt to query type');

    console.log('\n🎯 Steelman Arguments for Akasha Design:');
    console.log('   1. Multi-dimensional contexts are just arrays of strings—no schema changes needed');
    console.log('   2. Entities deduplicate automatically across contexts (Henry appears once, linked to many)');
    console.log('   3. Scope isolation ensures data never leaks between tenants');
    console.log('   4. Temporal tracking enables point-in-time queries without complex versioning');
    console.log('   5. Document nodes provide full-text retrieval + entity relationships');
    console.log('   6. Semantic search finds connections even when terms don\'t match exactly');

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
  } finally {
    await kg.cleanup();
    console.log('\n🧹 Cleaned up connections');
  }
}

queryKnowledgeBase();

