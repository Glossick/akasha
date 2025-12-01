#!/usr/bin/env bun

/**
 * Database Comparison Benchmark
 * 
 * Compares performance and functionality between Neo4j and LadybugDB
 * across various Akasha operations.
 * 
 * Usage:
 *   bun run examples/database-comparison.ts
 * 
 * Environment Variables Required:
 *   - NEO4J_URI
 *   - NEO4J_USER
 *   - NEO4J_PASSWORD
 *   - OPENAI_API_KEY
 *   - DEEPSEEK_API_KEY
 */

import { akasha } from '../src/index';
import type { Akasha } from '../src/akasha';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  operation: string;
  neo4j: {
    time: number;
    success: boolean;
    error?: string;
    result?: any;
  };
  ladybug: {
    time: number;
    success: boolean;
    error?: string;
    result?: any;
  };
  difference: {
    timeDiff: number;
    timeDiffPercent: number;
    faster: 'neo4j' | 'ladybug' | 'tie';
  };
}

interface ComparisonSummary {
  totalOperations: number;
  neo4jWins: number;
  ladybugWins: number;
  ties: number;
  averageTimeDiff: number;
  results: BenchmarkResult[];
}

// Test data
const TEST_DOCUMENTS = [
  'Alice works for Acme Corp as a software engineer. She has been with the company for 5 years.',
  'Bob is the CEO of TechCorp. He founded the company in 2010.',
  'Alice and Bob met at a tech conference in 2020. They became friends.',
  'Acme Corp and TechCorp are competitors in the software industry.',
  'Charlie works for Acme Corp as a product manager. He reports to Alice.',
  'David is a consultant who works with both Acme Corp and TechCorp.',
  'Alice has expertise in machine learning and distributed systems.',
  'Bob has a background in business development and venture capital.',
  'TechCorp recently raised $50 million in Series B funding.',
  'Acme Corp is planning to expand into the European market.',
];

const TEST_QUERIES = [
  'Who works for Acme Corp?',
  'What is the relationship between Alice and Bob?',
  'What companies are mentioned?',
  'Who are the leaders mentioned?',
  'What are the key business activities?',
];

// Utility functions
function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

async function measureOperation<T>(
  name: string,
  operation: () => Promise<T>
): Promise<{ result: T; time: number }> {
  const start = performance.now();
  const result = await operation();
  const time = performance.now() - start;
  return { result, time };
}

// Benchmark operations
async function benchmarkOperation(
  name: string,
  neo4jKg: Akasha,
  ladybugKg: Akasha,
  operation: (kg: Akasha) => Promise<any>
): Promise<BenchmarkResult> {
  console.log(`\n🔄 Running: ${name}`);

  // Run on Neo4j
  let neo4jResult: { result?: any; time: number; success: boolean; error?: string };
  try {
    const { result, time } = await measureOperation(`Neo4j ${name}`, () => operation(neo4jKg));
    neo4jResult = { result, time, success: true };
    console.log(`  ✅ Neo4j: ${formatTime(time)}`);
  } catch (error: any) {
    neo4jResult = { time: 0, success: false, error: error.message };
    console.log(`  ❌ Neo4j: ${error.message}`);
  }

  // Run on LadybugDB
  let ladybugResult: { result?: any; time: number; success: boolean; error?: string };
  try {
    const { result, time } = await measureOperation(`LadybugDB ${name}`, () => operation(ladybugKg));
    ladybugResult = { result, time, success: true };
    console.log(`  ✅ LadybugDB: ${formatTime(time)}`);
  } catch (error: any) {
    ladybugResult = { time: 0, success: false, error: error.message };
    console.log(`  ❌ LadybugDB: ${error.message}`);
  }

  // Calculate difference
  const timeDiff = ladybugResult.time - neo4jResult.time;
  const timeDiffPercent = neo4jResult.time > 0
    ? (timeDiff / neo4jResult.time) * 100
    : 0;
  
  let faster: 'neo4j' | 'ladybug' | 'tie' = 'tie';
  if (neo4jResult.success && ladybugResult.success) {
    if (neo4jResult.time < ladybugResult.time) faster = 'neo4j';
    else if (ladybugResult.time < neo4jResult.time) faster = 'ladybug';
  }

  return {
    operation: name,
    neo4j: {
      time: neo4jResult.time,
      success: neo4jResult.success,
      error: neo4jResult.error,
      result: neo4jResult.result,
    },
    ladybug: {
      time: ladybugResult.time,
      success: ladybugResult.success,
      error: ladybugResult.error,
      result: ladybugResult.result,
    },
    difference: {
      timeDiff,
      timeDiffPercent,
      faster,
    },
  };
}

// Main benchmark function
async function runBenchmarks(): Promise<ComparisonSummary> {
  console.log('🚀 Starting Database Comparison Benchmark\n');
  console.log('=' .repeat(60));

  // Check environment variables
  const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY'];
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Initialize databases
  console.log('\n📦 Initializing databases...\n');

  // Clean up any existing LadybugDB database files to prevent WAL corruption
  const ladybugDbPath = path.join(process.cwd(), 'benchmark-ladybug-db');
  if (fs.existsSync(ladybugDbPath)) {
    console.log('🧹 Cleaning up existing LadybugDB database...');
    try {
      fs.rmSync(ladybugDbPath, { recursive: true, force: true });
    } catch (e: any) {
      console.warn(`⚠️  Warning: Could not remove database directory: ${e.message}`);
    }
  }
  
  // Clean up WAL file if it exists
  const walFile = `${ladybugDbPath}.wal`;
  if (fs.existsSync(walFile)) {
    console.log('🧹 Cleaning up existing WAL file...');
    try {
      fs.rmSync(walFile, { force: true });
    } catch (e: any) {
      console.warn(`⚠️  Warning: Could not remove WAL file: ${e.message}`);
    }
  }

  const neo4jKg = akasha({
    database: {
      type: 'neo4j',
      config: {
        uri: process.env.NEO4J_URI!,
        user: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
      },
    },
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
    scope: {
      id: 'benchmark-neo4j',
      type: 'benchmark',
      name: 'Neo4j Benchmark',
    },
  });

  const ladybugKg = akasha({
    database: {
      type: 'ladybug',
      config: {
        databasePath: ladybugDbPath, // Use absolute path
      },
    },
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
    scope: {
      id: 'benchmark-ladybug',
      type: 'benchmark',
      name: 'LadybugDB Benchmark',
    },
  });

  // Initialize both
  console.log('Initializing Neo4j...');
  await neo4jKg.initialize();
  console.log('✅ Neo4j initialized\n');

  console.log('Initializing LadybugDB...');
  await ladybugKg.initialize();
  console.log('✅ LadybugDB initialized\n');

  const results: BenchmarkResult[] = [];

  // 1. Learn Operations
  console.log('\n📚 Phase 1: Learning Operations');
  console.log('=' .repeat(60));

  // Single document learn
  results.push(await benchmarkOperation(
    'Learn (single document)',
    neo4jKg,
    ladybugKg,
    async (kg) => {
      return await kg.learn(TEST_DOCUMENTS[0]);
    }
  ));

  // Batch learn
  results.push(await benchmarkOperation(
    'Learn (batch - 10 documents)',
    neo4jKg,
    ladybugKg,
    async (kg) => {
      const batchResults = [];
      for (const doc of TEST_DOCUMENTS) {
        batchResults.push(await kg.learn(doc));
      }
      return batchResults;
    }
  ));

  // 2. Query Operations
  console.log('\n🔍 Phase 2: Query Operations');
  console.log('=' .repeat(60));

  for (const query of TEST_QUERIES) {
    results.push(await benchmarkOperation(
      `Ask: "${query.substring(0, 30)}..."`,
      neo4jKg,
      ladybugKg,
      async (kg) => {
        return await kg.ask(query);
      }
    ));
  }

  // 3. List Operations
  console.log('\n📋 Phase 3: List Operations');
  console.log('=' .repeat(60));

  results.push(await benchmarkOperation(
    'List Entities',
    neo4jKg,
    ladybugKg,
    async (kg) => {
      return await kg.listEntities();
    }
  ));

  results.push(await benchmarkOperation(
    'List Relationships',
    neo4jKg,
    ladybugKg,
    async (kg) => {
      return await kg.listRelationships();
    }
  ));

  results.push(await benchmarkOperation(
    'List Documents',
    neo4jKg,
    ladybugKg,
    async (kg) => {
      return await kg.listDocuments();
    }
  ));

  // 4. Vector Search Operations
  console.log('\n🔎 Phase 4: Vector Search Operations');
  console.log('=' .repeat(60));

  // Get entities with embeddings for vector search
  const neo4jEntitiesWithEmbeddings = await neo4jKg.listEntities({ limit: 5, includeEmbeddings: true });
  const ladybugEntitiesWithEmbeddings = await ladybugKg.listEntities({ limit: 5, includeEmbeddings: true });

  if (neo4jEntitiesWithEmbeddings.length > 0 && neo4jEntitiesWithEmbeddings[0].properties.embedding) {
    const testVector = neo4jEntitiesWithEmbeddings[0].properties.embedding as number[];
    
    // Use ask() with a query that will trigger vector search
    results.push(await benchmarkOperation(
      'Vector Search (via ask)',
      neo4jKg,
      ladybugKg,
      async (kg) => {
        // This will use vector search internally
        return await kg.ask('Find similar entities', { strategy: 'entities', topK: 5 });
      }
    ));
  }

  // 5. Graph Operations
  console.log('\n🕸️  Phase 5: Graph Operations');
  console.log('=' .repeat(60));

  // Get entities for subgraph retrieval
  const allNeo4jEntities = await neo4jKg.listEntities({ limit: 10 });
  const allLadybugEntities = await ladybugKg.listEntities({ limit: 10 });

  if (allNeo4jEntities.length > 0 && allLadybugEntities.length > 0) {
    // Use ask() which internally uses retrieveSubgraph
    results.push(await benchmarkOperation(
      'Graph Traversal (via ask with context)',
      neo4jKg,
      ladybugKg,
      async (kg) => {
        // This will use subgraph retrieval internally
        return await kg.ask('What are the relationships?', { strategy: 'both' });
      }
    ));
  }

  // 6. Health Check
  console.log('\n💚 Phase 6: Health Check');
  console.log('=' .repeat(60));

  results.push(await benchmarkOperation(
    'Health Check',
    neo4jKg,
    ladybugKg,
    async (kg) => {
      return await kg.healthCheck();
    }
  ));

  // Cleanup - use cleanup() method (not disconnect())
  // The Akasha class provides cleanup() for disconnecting from databases
  console.log('\n🧹 Cleaning up...\n');
  try {
    await neo4jKg.cleanup();
  } catch (e: any) {
    console.warn(`⚠️  Warning: Error cleaning up Neo4j: ${e.message}`);
  }
  
  try {
    await ladybugKg.cleanup();
  } catch (e: any) {
    console.warn(`⚠️  Warning: Error cleaning up LadybugDB: ${e.message}`);
  }

  // Clean up LadybugDB files after disconnect
  try {
    if (fs.existsSync(ladybugDbPath)) {
      fs.rmSync(ladybugDbPath, { recursive: true, force: true });
    }
    const walFile = `${ladybugDbPath}.wal`;
    if (fs.existsSync(walFile)) {
      fs.rmSync(walFile, { force: true });
    }
  } catch (e: any) {
    console.warn(`⚠️  Warning: Could not clean up database files: ${e.message}`);
  }

  // Calculate summary
  const successfulResults = results.filter(r => r.neo4j.success && r.ladybug.success);
  const neo4jWins = successfulResults.filter(r => r.difference.faster === 'neo4j').length;
  const ladybugWins = successfulResults.filter(r => r.difference.faster === 'ladybug').length;
  const ties = successfulResults.filter(r => r.difference.faster === 'tie').length;
  const averageTimeDiff = successfulResults.length > 0
    ? successfulResults.reduce((sum, r) => sum + Math.abs(r.difference.timeDiff), 0) / successfulResults.length
    : 0;

  return {
    totalOperations: results.length,
    neo4jWins,
    ladybugWins,
    ties,
    averageTimeDiff,
    results,
  };
}

// Print results
function printResults(summary: ComparisonSummary) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 BENCHMARK RESULTS');
  console.log('='.repeat(60));

  console.log('\n📈 Summary:');
  console.log(`  Total Operations: ${summary.totalOperations}`);
  console.log(`  Neo4j Wins: ${summary.neo4jWins}`);
  console.log(`  LadybugDB Wins: ${summary.ladybugWins}`);
  console.log(`  Ties: ${summary.ties}`);
  console.log(`  Average Time Difference: ${formatTime(summary.averageTimeDiff)}`);

  console.log('\n📋 Detailed Results:\n');

  for (const result of summary.results) {
    console.log(`\n${result.operation}`);
    console.log('  ' + '-'.repeat(50));
    
    if (result.neo4j.success && result.ladybug.success) {
      console.log(`  Neo4j:     ${formatTime(result.neo4j.time)}`);
      console.log(`  LadybugDB: ${formatTime(result.ladybug.time)}`);
      
      const diff = result.difference.timeDiff;
      const diffPercent = result.difference.timeDiffPercent;
      const sign = diff > 0 ? '+' : '';
      const faster = result.difference.faster === 'neo4j' ? 'Neo4j' : 
                     result.difference.faster === 'ladybug' ? 'LadybugDB' : 'Tie';
      
      console.log(`  Difference: ${sign}${formatTime(diff)} (${sign}${diffPercent.toFixed(1)}%)`);
      console.log(`  Faster: ${faster}`);
    } else {
      if (!result.neo4j.success) {
        console.log(`  ❌ Neo4j: ${result.neo4j.error}`);
      }
      if (!result.ladybug.success) {
        console.log(`  ❌ LadybugDB: ${result.ladybug.error}`);
      }
    }
  }

  // Winner analysis
  console.log('\n' + '='.repeat(60));
  console.log('🏆 Overall Winner Analysis');
  console.log('='.repeat(60));

  if (summary.neo4jWins > summary.ladybugWins) {
    console.log('\n🎯 Neo4j is faster overall');
    console.log(`   Wins: ${summary.neo4jWins} vs ${summary.ladybugWins}`);
  } else if (summary.ladybugWins > summary.neo4jWins) {
    console.log('\n🎯 LadybugDB is faster overall');
    console.log(`   Wins: ${summary.ladybugWins} vs ${summary.neo4jWins}`);
  } else {
    console.log('\n🤝 Performance is comparable');
    console.log(`   Both databases perform similarly across operations`);
  }

  // Operation-specific insights
  console.log('\n💡 Insights:');
  const learnOps = summary.results.filter(r => r.operation.includes('Learn'));
  const queryOps = summary.results.filter(r => r.operation.includes('Ask'));
  const listOps = summary.results.filter(r => r.operation.includes('List'));

  if (learnOps.length > 0) {
    const learnNeo4jWins = learnOps.filter(r => r.difference.faster === 'neo4j').length;
    const learnLadybugWins = learnOps.filter(r => r.difference.faster === 'ladybug').length;
    console.log(`  Learning Operations: ${learnNeo4jWins > learnLadybugWins ? 'Neo4j' : 'LadybugDB'} tends to be faster`);
  }

  if (queryOps.length > 0) {
    const queryNeo4jWins = queryOps.filter(r => r.difference.faster === 'neo4j').length;
    const queryLadybugWins = queryOps.filter(r => r.difference.faster === 'ladybug').length;
    console.log(`  Query Operations: ${queryNeo4jWins > queryLadybugWins ? 'Neo4j' : 'LadybugDB'} tends to be faster`);
  }

  if (listOps.length > 0) {
    const listNeo4jWins = listOps.filter(r => r.difference.faster === 'neo4j').length;
    const listLadybugWins = listOps.filter(r => r.difference.faster === 'ladybug').length;
    console.log(`  List Operations: ${listNeo4jWins > listLadybugWins ? 'Neo4j' : 'LadybugDB'} tends to be faster`);
  }
}

// Main execution
async function main() {
  // Define database path at module level for cleanup
  const ladybugDbPath = path.join(process.cwd(), 'benchmark-ladybug-db');
  
  try {
    const summary = await runBenchmarks();
    printResults(summary);
    
    console.log('\n✅ Benchmark complete!\n');
  } catch (error: any) {
    console.error('\n❌ Benchmark failed:', error.message);
    console.error(error.stack);
    
    // Attempt cleanup on error
    console.log('\n🧹 Attempting cleanup after error...');
    try {
      if (fs.existsSync(ladybugDbPath)) {
        fs.rmSync(ladybugDbPath, { recursive: true, force: true });
      }
      const walFile = `${ladybugDbPath}.wal`;
      if (fs.existsSync(walFile)) {
        fs.rmSync(walFile, { force: true });
      }
      console.log('✅ Cleanup complete');
    } catch (cleanupError: any) {
      console.warn(`⚠️  Cleanup warning: ${cleanupError.message}`);
    }
    
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

