import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { akasha } from '../../factory';
import type { Scope } from '../../types';

/**
 * Multi-Provider Integration Tests
 * 
 * These tests verify that different provider combinations work correctly
 * with REAL API calls (no mocks). Tests are skipped if required environment 
 * variables are missing.
 * 
 * Coverage:
 * - OpenAI embedding + OpenAI LLM
 * - OpenAI embedding + Anthropic LLM  
 * - OpenAI embedding + DeepSeek LLM
 * - Different embedding dimensions
 * - Different temperature settings
 * - Real entity extraction quality
 * - Real semantic search
 * - Multi-provider query consistency
 */

const hasOpenAI = process.env.OPENAI_API_KEY;
const hasAnthropic = process.env.ANTHROPIC_API_KEY;
const hasDeepSeek = process.env.DEEPSEEK_API_KEY;
const hasNeo4j = process.env.NEO4J_URI && process.env.NEO4J_USER && process.env.NEO4J_PASSWORD;

const canTestOpenAI = hasOpenAI && hasNeo4j;
const canTestAnthropic = hasOpenAI && hasAnthropic && hasNeo4j; // Need OpenAI for embeddings
const canTestDeepSeek = hasOpenAI && hasDeepSeek && hasNeo4j; // Need OpenAI for embeddings

// Track created scopes for cleanup
const createdScopes: string[] = [];

describe('Multi-Provider Integration Tests', () => {
  beforeAll(() => {
    if (!hasNeo4j) {
      console.warn('⚠️  Skipping multi-provider tests - Neo4j credentials missing');
    }
    if (!hasOpenAI) {
      console.warn('⚠️  Skipping multi-provider tests - OPENAI_API_KEY missing');
    }
    if (!hasAnthropic) {
      console.warn('⚠️  Anthropic tests will be skipped - ANTHROPIC_API_KEY missing');
    }
    if (!hasDeepSeek) {
      console.warn('⚠️  DeepSeek tests will be skipped - DEEPSEEK_API_KEY missing');
    }
  });

  afterAll(async () => {
    // Note: Cleanup should be done via scripts/cleanup-test-data.ts
    // We log the scopes created for manual cleanup if needed
    if (createdScopes.length > 0) {
      console.log(`\n📝 Test scopes created (cleanup via scripts/cleanup-test-data.ts):`);
      createdScopes.forEach(id => console.log(`   - ${id}`));
    }
  });

  describe('OpenAI Embedding + OpenAI LLM', () => {
    it.skipIf(!canTestOpenAI)('should work with OpenAI for both embedding and LLM', async () => {
      const scope: Scope = {
        id: `test-openai-openai-${Date.now()}`,
        type: 'test',
        name: 'OpenAI+OpenAI Test',
      };
      createdScopes.push(scope.id);

      const kg = akasha({
        database: {
          type: 'neo4j',
          config: {
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
            type: 'openai',
            config: {
              apiKey: process.env.OPENAI_API_KEY!,
              model: 'gpt-4',
            },
          },
        },
      });

      await kg.initialize();

      // Test learning (real entity extraction via OpenAI)
      const learnResult = await kg.learn('Alice is a software engineer at Acme Corp. She specializes in distributed systems.');
      
      // Verify extraction worked
      expect(learnResult.entities.length).toBeGreaterThan(0);
      expect(learnResult.relationships.length).toBeGreaterThanOrEqual(0);
      expect(learnResult.document).toBeDefined();
      expect(learnResult.document.properties.text).toBe('Alice is a software engineer at Acme Corp. She specializes in distributed systems.');
      expect(learnResult.created.document).toBe(1); // First time, should create
      
      // Verify all have scopeId
      learnResult.entities.forEach(e => {
        expect(e.properties.scopeId).toBe(scope.id);
      });

      // Test querying (real semantic search + LLM generation)
      const queryResult = await kg.ask('What does Alice do?');
      expect(queryResult.answer).toBeDefined();
      expect(queryResult.answer.length).toBeGreaterThan(0);
      expect(queryResult.context.entities.length).toBeGreaterThan(0);

      // Test query with statistics
      const statsResult = await kg.ask('Who works at Acme Corp?', {
        includeStats: true,
      });
      expect(statsResult.statistics).toBeDefined();
      expect(statsResult.statistics!.totalTimeMs).toBeGreaterThan(0);
      expect(statsResult.statistics!.strategy).toBe('both');

      await kg.cleanup();
    });
  });

  describe('OpenAI Embedding + Anthropic LLM', () => {
    it.skipIf(!canTestAnthropic)('should work with OpenAI embeddings and Anthropic LLM', async () => {
      const scope: Scope = {
        id: `test-openai-anthropic-${Date.now()}`,
        type: 'test',
        name: 'OpenAI+Anthropic Test',
      };
      createdScopes.push(scope.id);

      const kg = akasha({
        database: {
          type: 'neo4j',
          config: {
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
            type: 'anthropic',
            config: {
              apiKey: process.env.ANTHROPIC_API_KEY!,
              model: 'claude-3-5-sonnet-20241022',
            },
          },
        },
      });

      await kg.initialize();

      // Test learning with Anthropic (real Claude extraction)
      const learnResult = await kg.learn('Bob is a designer at TechCorp. He has 5 years of experience in UX design.');
      
      // Verify Claude extracted entities correctly
      expect(learnResult.entities.length).toBeGreaterThan(0);
      expect(learnResult.relationships.length).toBeGreaterThanOrEqual(0);
      expect(learnResult.document).toBeDefined();
      expect(learnResult.created.document).toBe(1);
      
      // Verify scopeId on all entities
      learnResult.entities.forEach(e => {
        expect(e.properties.scopeId).toBe(scope.id);
      });

      // Test querying with Claude (real Claude answer generation)
      const queryResult = await kg.ask('What is Bob\'s role and experience?');
      expect(queryResult.answer).toBeDefined();
      expect(queryResult.answer.length).toBeGreaterThan(0);
      
      // Claude should provide contextual answer
      const answerLower = queryResult.answer.toLowerCase();
      expect(answerLower.includes('bob') || answerLower.includes('designer') || answerLower.includes('ux')).toBe(true);

      await kg.cleanup();
    });

    it.skipIf(!canTestAnthropic)('should use Claude for entity extraction with custom temperature', async () => {
      const scope: Scope = {
        id: `test-anthropic-extraction-${Date.now()}`,
        type: 'test',
        name: 'Anthropic Extraction Test',
      };
      createdScopes.push(scope.id);

      const kg = akasha({
        database: {
          type: 'neo4j',
          config: {
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
            type: 'anthropic',
            config: {
              apiKey: process.env.ANTHROPIC_API_KEY!,
              model: 'claude-3-5-sonnet-20241022',
              temperature: 0.3, // Lower temperature for consistent extraction
            },
          },
        },
      });

      await kg.initialize();

      const text = 'Charlie works for StartupCo as a manager. StartupCo is a technology startup founded in 2024 in San Francisco.';
      const learnResult = await kg.learn(text, {
        contextName: 'Anthropic Extraction Test',
      });

      // Claude should extract multiple entities with properties
      expect(learnResult.entities.length).toBeGreaterThanOrEqual(2);
      expect(learnResult.relationships.length).toBeGreaterThanOrEqual(1);
      
      // Verify document was created
      expect(learnResult.document).toBeDefined();
      expect(learnResult.document.properties.text).toBe(text);
      expect(learnResult.document.properties.scopeId).toBe(scope.id);
      expect(learnResult.document.properties.contextIds).toContain(learnResult.context.id);
      
      // Verify contextIds on entities
      learnResult.entities.forEach(e => {
        expect(e.properties.contextIds).toBeDefined();
        expect(Array.isArray(e.properties.contextIds)).toBe(true);
      });

      // Test batch learning with Claude
      const batchResult = await kg.learnBatch([
        'Diana is a CEO at MegaCorp.',
        'Eva is a CTO at MegaCorp.',
      ], {
        contextName: 'Batch Test',
      });

      expect(batchResult.summary.succeeded).toBe(2);
      expect(batchResult.summary.failed).toBe(0);
      expect(batchResult.summary.totalEntitiesCreated).toBeGreaterThan(0);

      await kg.cleanup();
    });
  });

  describe('Cross-Provider Consistency', () => {
    it.skipIf(!canTestAnthropic || !canTestDeepSeek)('should extract similar entities across different LLM providers', async () => {
      const testText = 'Grace is a product manager at InnovateCo. She leads the mobile app development team.';
      
      // Test with OpenAI
      const scopeOpenAI: Scope = {
        id: `test-cross-openai-${Date.now()}`,
        type: 'test',
        name: 'Cross-Provider OpenAI',
      };
      createdScopes.push(scopeOpenAI.id);

      const kgOpenAI = akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: scopeOpenAI,
        providers: {
          embedding: {
            type: 'openai',
            config: { apiKey: process.env.OPENAI_API_KEY!, model: 'text-embedding-3-small' },
          },
          llm: {
            type: 'openai',
            config: { apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4', temperature: 0.3 },
          },
        },
      });

      await kgOpenAI.initialize();
      const resultOpenAI = await kgOpenAI.learn(testText);
      await kgOpenAI.cleanup();

      // Test with Anthropic
      const scopeAnthropic: Scope = {
        id: `test-cross-anthropic-${Date.now()}`,
        type: 'test',
        name: 'Cross-Provider Anthropic',
      };
      createdScopes.push(scopeAnthropic.id);

      const kgAnthropic = akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: scopeAnthropic,
        providers: {
          embedding: {
            type: 'openai',
            config: { apiKey: process.env.OPENAI_API_KEY!, model: 'text-embedding-3-small' },
          },
          llm: {
            type: 'anthropic',
            config: { apiKey: process.env.ANTHROPIC_API_KEY!, model: 'claude-3-5-sonnet-20241022', temperature: 0.3 },
          },
        },
      });

      await kgAnthropic.initialize();
      const resultAnthropic = await kgAnthropic.learn(testText);
      await kgAnthropic.cleanup();

      // Test with DeepSeek
      const scopeDeepSeek: Scope = {
        id: `test-cross-deepseek-${Date.now()}`,
        type: 'test',
        name: 'Cross-Provider DeepSeek',
      };
      createdScopes.push(scopeDeepSeek.id);

      const kgDeepSeek = akasha({
        database: {
          type: 'neo4j',
          config: {
          uri: process.env.NEO4J_URI!,
          user: process.env.NEO4J_USER!,
          password: process.env.NEO4J_PASSWORD!,
        },
        scope: scopeDeepSeek,
        providers: {
          embedding: {
            type: 'openai',
            config: { apiKey: process.env.OPENAI_API_KEY!, model: 'text-embedding-3-small' },
          },
          llm: {
            type: 'deepseek',
            config: { apiKey: process.env.DEEPSEEK_API_KEY!, model: 'deepseek-chat', temperature: 0.3 },
          },
        },
      });

      await kgDeepSeek.initialize();
      const resultDeepSeek = await kgDeepSeek.learn(testText);
      await kgDeepSeek.cleanup();

      // All should extract at least some entities
      expect(resultOpenAI.entities.length).toBeGreaterThan(0);
      expect(resultAnthropic.entities.length).toBeGreaterThan(0);
      expect(resultDeepSeek.entities.length).toBeGreaterThan(0);

      // All should create documents
      expect(resultOpenAI.created.document).toBe(1);
      expect(resultAnthropic.created.document).toBe(1);
      expect(resultDeepSeek.created.document).toBe(1);
    });
  });

  describe('Embedding Dimensionality', () => {
    it.skipIf(!canTestOpenAI)('should handle text-embedding-3-small with default 1536 dimensions', async () => {
      const scope: Scope = {
        id: `test-dim-1536-${Date.now()}`,
        type: 'test',
        name: 'Dimension 1536 Test',
      };
      createdScopes.push(scope.id);

      const kg = akasha({
        database: {
          type: 'neo4j',
          config: {
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
              dimensions: 1536,
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: process.env.OPENAI_API_KEY!,
              model: 'gpt-4',
            },
          },
        },
      });

      await kg.initialize();

      const result = await kg.learn('Test dimensionality handling with explicit 1536 dimensions.');
      expect(result.entities.length).toBeGreaterThanOrEqual(0);
      expect(result.document).toBeDefined();

      // Test semantic search works with these dimensions
      const queryResult = await kg.ask('What is being tested?');
      expect(queryResult.answer).toBeDefined();

      await kg.cleanup();
    });

    it.skipIf(!canTestOpenAI)('should handle custom reduced dimensions (512)', async () => {
      const scope: Scope = {
        id: `test-dim-512-${Date.now()}`,
        type: 'test',
        name: 'Dimension 512 Test',
      };
      createdScopes.push(scope.id);

      const kg = akasha({
        database: {
          type: 'neo4j',
          config: {
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
              dimensions: 512, // Reduced dimensions for faster performance
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: process.env.OPENAI_API_KEY!,
              model: 'gpt-4',
            },
          },
        },
      });

      await kg.initialize();

      const result = await kg.learn('Testing reduced 512-dimensional embeddings for performance.');
      expect(result.document).toBeDefined();

      // Verify semantic search still works with reduced dimensions
      const queryResult = await kg.ask('What dimensionality is being tested?');
      expect(queryResult.answer).toBeDefined();
      expect(queryResult.answer.length).toBeGreaterThan(0);

      await kg.cleanup();
    });
  });

  describe('OpenAI Embedding + DeepSeek LLM', () => {
    it.skipIf(!canTestDeepSeek)('should work with OpenAI embeddings and DeepSeek LLM', async () => {
      const scope: Scope = {
        id: `test-openai-deepseek-${Date.now()}`,
        type: 'test',
        name: 'OpenAI+DeepSeek Test',
      };
      createdScopes.push(scope.id);

      const kg = akasha({
        database: {
          type: 'neo4j',
          config: {
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

      // Test learning with DeepSeek (real DeepSeek extraction)
      const learnResult = await kg.learn('Eva is a data scientist at DataCorp. She specializes in machine learning and has published 10 papers.');
      
      // Verify DeepSeek extracted entities
      expect(learnResult.entities.length).toBeGreaterThan(0);
      expect(learnResult.relationships.length).toBeGreaterThanOrEqual(0);
      expect(learnResult.document).toBeDefined();
      expect(learnResult.created.document).toBe(1);

      // Test querying with DeepSeek (real DeepSeek answer generation)
      const queryResult = await kg.ask('What is Eva\'s expertise?');
      expect(queryResult.answer).toBeDefined();
      expect(queryResult.answer.length).toBeGreaterThan(0);
      
      // Verify answer is contextual
      const answerLower = queryResult.answer.toLowerCase();
      expect(
        answerLower.includes('eva') || 
        answerLower.includes('data') || 
        answerLower.includes('machine learning') ||
        answerLower.includes('scientist')
      ).toBe(true);

      await kg.cleanup();
    });

    it.skipIf(!canTestDeepSeek)('should use deepseek-reasoner for complex reasoning', async () => {
      const scope: Scope = {
        id: `test-deepseek-reasoner-${Date.now()}`,
        type: 'test',
        name: 'DeepSeek Reasoner Test',
      };
      createdScopes.push(scope.id);

      const kg = akasha({
        database: {
          type: 'neo4j',
          config: {
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
              model: 'deepseek-reasoner', // Thinking mode
              temperature: 0.5,
            },
          },
        },
      });

      await kg.initialize();

      // Test with more complex relationships
      const text = 'Frank manages both the Engineering and Design teams. The Engineering team reports to the CTO. The Design team reports to the CPO.';
      const learnResult = await kg.learn(text);

      // DeepSeek reasoner should extract complex relationships
      expect(learnResult.entities.length).toBeGreaterThanOrEqual(3);
      expect(learnResult.relationships.length).toBeGreaterThanOrEqual(2);

      // Test complex query with reasoner
      const queryResult = await kg.ask('What is Frank\'s organizational structure?');
      expect(queryResult.answer).toBeDefined();
      expect(queryResult.answer.length).toBeGreaterThan(0);

      await kg.cleanup();
    });
  });

  describe('Provider Configuration Validation', () => {
    it('should reject config without providers', () => {
      expect(() => {
        akasha({
          database: {
          type: 'neo4j',
          config: {
            uri: 'bolt://localhost:7687',
            user: 'neo4j',
            password: 'password',
          },
        } as any);
      }).toThrow('Provider configuration is required');
    });

    it('should reject invalid embedding provider type', () => {
      expect(() => {
        akasha({
          database: {
          type: 'neo4j',
          config: {
            uri: 'bolt://localhost:7687',
            user: 'neo4j',
            password: 'password',
          },
          providers: {
            embedding: {
              type: 'invalid' as any,
              config: { apiKey: 'key', model: 'model' },
            },
            llm: {
              type: 'openai',
              config: { apiKey: 'key', model: 'gpt-4' },
            },
          },
        });
      }).toThrow('Unknown embedding provider type');
    });

    it('should reject invalid LLM provider type', () => {
      expect(() => {
        akasha({
          database: {
          type: 'neo4j',
          config: {
            uri: 'bolt://localhost:7687',
            user: 'neo4j',
            password: 'password',
          },
          providers: {
            embedding: {
              type: 'openai',
              config: { apiKey: 'key', model: 'text-embedding-3-small' },
            },
            llm: {
              type: 'invalid' as any,
              config: { apiKey: 'key', model: 'model' },
            },
          },
        });
      }).toThrow('Unknown LLM provider type');
    });
  });
});

