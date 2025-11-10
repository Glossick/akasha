#!/usr/bin/env bun

/**
 * DeepSeek E2E Integration Test
 * 
 * Validates DeepSeek provider integration with real API calls.
 * Requires environment variables: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, OPENAI_API_KEY, DEEPSEEK_API_KEY
 * 
 * Usage:
 *   bun run scripts/test-deepseek-e2e.ts
 */

import { akasha } from '../src/factory';
import type { Scope } from '../src/types';

async function testDeepSeek() {
  console.log('🧪 DeepSeek E2E Integration Test\n');

  // Check environment variables
  const requiredVars = {
    NEO4J_URI: process.env.NEO4J_URI,
    NEO4J_USER: process.env.NEO4J_USER,
    NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  };

  console.log('📋 Environment Check:');
  for (const [key, value] of Object.entries(requiredVars)) {
    console.log(`   ${value ? '✅' : '❌'} ${key}: ${value ? '***' + value.slice(-4) : 'NOT SET'}`);
  }
  console.log('');

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease set these environment variables before running the test.');
    process.exit(1);
  }

  const scope: Scope = {
    id: `deepseek-e2e-test-${Date.now()}`,
    type: 'test',
    name: 'DeepSeek E2E Test',
  };

  console.log(`🎯 Test Scope: ${scope.id}\n`);

  try {
    // Test 1: DeepSeek Chat (standard mode)
    console.log('1️⃣  Testing DeepSeek Chat...');
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

    console.log('   📡 Initializing...');
    await kg.initialize();
    console.log('   ✅ Connected\n');

    // Test learning
    console.log('2️⃣  Testing entity extraction...');
    const text = 'Alice is a software engineer at Acme Corp. She specializes in distributed systems.';
    console.log(`   📝 Input: "${text}"`);
    
    const learnResult = await kg.learn(text);
    console.log(`   ✅ Entities: ${learnResult.entities.length}`);
    console.log(`   ✅ Relationships: ${learnResult.relationships.length}`);
    
    if (learnResult.entities.length === 0) {
      throw new Error('No entities extracted!');
    }

    // Test querying
    console.log('\n3️⃣  Testing query answering...');
    const queryResult = await kg.ask('What does Alice do?', { includeStats: true });
    console.log(`   ✅ Answer: ${queryResult.answer.substring(0, 100)}...`);
    
    if (queryResult.statistics) {
      console.log(`   ⏱️  Total time: ${queryResult.statistics.totalTimeMs}ms`);
    }

    await kg.cleanup();

    console.log('\n✅ ALL TESTS PASSED!\n');
    console.log(`🗑️  Cleanup: Delete scope "${scope.id}" using scripts/cleanup-test-data.ts`);

  } catch (error) {
    console.error('\n❌ Test Failed!');
    console.error(error);
    process.exit(1);
  }
}

testDeepSeek();

