#!/usr/bin/env bun

/**
 * Interactive Query CLI
 * 
 * Interactive command-line interface for querying the EstiMate knowledge base
 * with multi-dimensional context filtering.
 * 
 * Required environment variables:
 * - NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
 * - OPENAI_API_KEY, DEEPSEEK_API_KEY
 * 
 * Usage:
 *   bun run scripts/interactive-query.ts
 */

import { akasha } from '../../../akasha/src/factory';
import type { Scope, QueryOptions } from '../../../akasha/src/types';
import * as readline from 'readline';

// Check environment variables
const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  process.exit(1);
}

// Available context filters
const AVAILABLE_CONTEXTS = {
  time: ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'],
  team: ['henry', 'steven', 'sarah'],
  client: ['buildcorp', 'consultpro', 'designhub', 'megaconstruct', 'tinybuilders', 'precisioneng', 'quickbuild', 'urbandesign', 'infraworks', 'ecoconstruct'],
  source: ['meeting-notes', 'slack', 'customer-call', 'decision-log', 'support-ticket', 'internal-doc'],
  topic: ['pricing', 'architecture', 'features', 'hiring', 'fundraising', 'customer-success', 'product', 'sales', 'operations'],
};

const scope: Scope = {
  id: 'estimate-company',
  type: 'organization',
  name: 'EstiMate Company Knowledge Base',
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function printHeader() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║      🔍 EstiMate Knowledge Base - Interactive Query Tool 🔍           ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');
}

function printContextOptions() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║                     📋 CONTEXT FILTER GUIDE 📋                        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');
  
  console.log('⚠️  FORMAT: dimension:value (colon required!)\n');
  
  console.log('📅 TIME (months):');
  console.log('   time:2024-01, time:2024-02, time:2024-03, time:2024-04, time:2024-05, time:2024-06\n');
  
  console.log('👥 TEAM (people):');
  console.log('   team:henry, team:steven, team:sarah\n');
  
  console.log('🏢 CLIENT (customers):');
  console.log('   client:buildcorp, client:consultpro, client:megaconstruct, client:precisioneng,');
  console.log('   client:tinybuilders, client:quickbuild, client:urbandesign, client:infraworks,');
  console.log('   client:designhub, client:ecoconstruct\n');
  
  console.log('📝 SOURCE (where info came from):');
  console.log('   source:meeting-notes, source:slack, source:customer-call, source:decision-log,');
  console.log('   source:support-ticket, source:internal-doc\n');
  
  console.log('🎯 TOPIC (subject):');
  console.log('   topic:pricing, topic:architecture, topic:features, topic:hiring,');
  console.log('   topic:fundraising, topic:customer-success, topic:product, topic:sales,');
  console.log('   topic:operations\n');
  
  console.log('💡 EXAMPLES:\n');
  console.log('   Single filter:');
  console.log('     time:2024-02');
  console.log('     client:megaconstruct\n');
  console.log('   Multiple filters (comma-separated):');
  console.log('     time:2024-02,client:megaconstruct');
  console.log('     team:steven,topic:architecture');
  console.log('     time:2024-05,client:megaconstruct,topic:pricing\n');
  console.log('   No filter (leave empty to search everything)\n');
}

function parseContexts(input: string): string[] | undefined {
  if (!input || input.trim() === '') {
    return undefined;
  }
  
  const contexts = input.split(',').map(c => c.trim()).filter(c => c.length > 0);
  
  // Validate format (should contain colon)
  const invalid = contexts.filter(c => !c.includes(':'));
  if (invalid.length > 0) {
    console.log(`\n⚠️  Warning: These filters don't have the dimension:value format: ${invalid.join(', ')}`);
    console.log('   Correct format examples: time:2024-02, team:steven, client:megaconstruct');
  }
  
  return contexts;
}

async function executeQuery(kg: any, query: string, options: QueryOptions) {
  console.log('\n⏳ Querying knowledge base...\n');
  
  const startTime = Date.now();
  const result = await kg.ask(query, options);
  const duration = Date.now() - startTime;
  
  console.log('═'.repeat(80));
  console.log('💬 ANSWER:');
  console.log('═'.repeat(80));
  console.log(`\n${result.answer}\n`);
  
  console.log('═'.repeat(80));
  console.log('📊 STATISTICS:');
  console.log('═'.repeat(80));
  
  if (result.statistics) {
    console.log(`  Query time:       ${result.statistics.totalTimeMs}ms`);
    console.log(`  Search time:      ${result.statistics.searchTimeMs}ms`);
    console.log(`  LLM time:         ${result.statistics.llmGenerationTimeMs}ms`);
    console.log(`  Documents found:  ${result.statistics.documentsFound}`);
    console.log(`  Entities found:   ${result.statistics.entitiesFound}`);
    console.log(`  Relationships:    ${result.statistics.relationshipsFound}`);
    console.log(`  Strategy:         ${result.statistics.strategy}`);
  } else {
    console.log(`  Total time:       ${duration}ms`);
  }
  
  console.log('\n📦 CONTEXT RETRIEVED:');
  console.log(`  Documents:        ${result.context.documents?.length || 0}`);
  console.log(`  Entities:         ${result.context.entities.length}`);
  console.log(`  Relationships:    ${result.context.relationships.length}`);
  
  // Show sample entities
  if (result.context.entities.length > 0) {
    console.log('\n  Top Entities:');
    result.context.entities.slice(0, 5).forEach((entity: any) => {
      const name = entity.properties.name || entity.properties.title || 'unnamed';
      const similarity = entity.properties._similarity 
        ? ` (similarity: ${entity.properties._similarity.toFixed(3)})` 
        : '';
      console.log(`    • ${entity.label}: ${name}${similarity}`);
    });
  }
  
  // Show sample documents
  if (result.context.documents && result.context.documents.length > 0) {
    console.log('\n  Top Documents:');
    result.context.documents.slice(0, 3).forEach((doc: any) => {
      const similarity = doc.properties._similarity 
        ? ` (similarity: ${doc.properties._similarity.toFixed(3)})` 
        : '';
      const contextIds = doc.properties.contextIds || [];
      console.log(`    • ${similarity}`);
      console.log(`      Contexts: ${contextIds.slice(0, 5).join(', ')}${contextIds.length > 5 ? '...' : ''}`);
    });
  }
  
  console.log('\n' + '═'.repeat(80) + '\n');
}

async function interactiveMode(kg: any) {
  while (true) {
    console.log('\n' + '─'.repeat(80));
    console.log('🎯 QUERY CONFIGURATION');
    console.log('─'.repeat(80) + '\n');
    
    // Get query
    const query = await question('❓ Enter your question:\n   (type "exit" to quit, "help" to see context filter options)\n> ');
    
    if (query.toLowerCase() === 'exit') {
      console.log('\n👋 Goodbye!\n');
      break;
    }
    
    if (query.toLowerCase() === 'help') {
      printContextOptions();
      continue;
    }
    
    if (!query || query.trim() === '') {
      console.log('\n⚠️  Please enter a question.\n');
      continue;
    }
    
    // Get context filters
    console.log('\n🏷️  Context Filters (type "help" to see all options)');
    console.log('    Format: dimension:value (e.g., time:2024-02, team:steven, client:megaconstruct)');
    console.log('    Multiple: separate with commas (e.g., time:2024-02,client:megaconstruct)');
    const contextsInput = await question('    Press Enter for no filters, or type filters:\n> ');
    const contexts = parseContexts(contextsInput);
    
    // Get similarity threshold
    const thresholdInput = await question('\n📊 Similarity threshold (0.0-1.0, default 0.7, lower = more results):\n> ');
    const similarityThreshold = thresholdInput ? parseFloat(thresholdInput) : 0.7;
    
    // Get strategy
    const strategyInput = await question('\n🎯 Query strategy (documents/entities/both, default: both):\n> ');
    const strategy = strategyInput || 'both';
    
    // Build options
    const options: QueryOptions = {
      includeStats: true,
      similarityThreshold,
      strategy: strategy as any,
    };
    
    if (contexts && contexts.length > 0) {
      options.contexts = contexts;
    }
    
    // Show configuration
    console.log('\n' + '─'.repeat(80));
    console.log('⚙️  Configuration:');
    console.log('─'.repeat(80));
    console.log(`  Question:         ${query}`);
    console.log(`  Contexts:         ${contexts ? contexts.join(', ') : 'none (search all)'}`);
    console.log(`  Threshold:        ${similarityThreshold}`);
    console.log(`  Strategy:         ${strategy}`);
    
    // Execute query
    try {
      await executeQuery(kg, query, options);
    } catch (error) {
      console.log('\n❌ Error executing query:');
      console.log(`   ${error instanceof Error ? error.message : String(error)}\n`);
    }
    
    // Ask if they want to continue
    const continueAnswer = await question('\n🔄 Query again? (yes/no, default: yes):\n> ');
    if (continueAnswer.toLowerCase() === 'no' || continueAnswer.toLowerCase() === 'n') {
      console.log('\n👋 Goodbye!\n');
      break;
    }
    
    console.clear();
    printHeader();
  }
}

async function main() {
  printHeader();
  
  console.log('📦 Connecting to knowledge base...\n');
  
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
  console.log('✅ Connected!\n');
  
  // Quick stats
  const entities = await kg.listEntities({ limit: 1 });
  const documents = await kg.listDocuments({ limit: 1 });
  console.log(`📊 Knowledge Base Stats:`);
  console.log(`   Entities in scope:  ${entities.length > 0 ? 'present' : 'empty'}`);
  console.log(`   Documents in scope: ${documents.length > 0 ? 'present' : 'empty'}`);
  
  printContextOptions();
  
  try {
    await interactiveMode(kg);
  } finally {
    await kg.cleanup();
    rl.close();
  }
}

main();

