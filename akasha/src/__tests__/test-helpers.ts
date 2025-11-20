/**
 * Test helpers for mocking providers and creating test configurations
 */

import type { AkashaConfig } from '../types';
import type { EmbeddingProvider, LLMProvider } from '../services/providers/interfaces';

/**
 * Create a mock embedding provider
 */
export function createMockEmbeddingProvider(): EmbeddingProvider {
  return {
    provider: 'test',
    model: 'test-embedding',
    dimensions: 1536,
    generateEmbedding: async (text: string) => {
      return new Array(1536).fill(0).map((_, i) => i * 0.001);
    },
    generateEmbeddings: async (texts: string[]) => {
      return texts.map(() => new Array(1536).fill(0).map((_, i) => i * 0.001));
    },
  };
}

/**
 * Create a mock LLM provider
 */
export function createMockLLMProvider(): LLMProvider {
  return {
    provider: 'test',
    model: 'test-llm',
    generateResponse: async (prompt: string, context: string, systemMessage?: string, temperature?: number) => {
      // Check if this is an extraction prompt (contains "extract" or asks for JSON)
      if (prompt.includes('extract') || prompt.includes('JSON') || prompt.includes('entities') || prompt.includes('relationships')) {
        // Return valid JSON for extraction
        return JSON.stringify({
          entities: [
            { label: 'Person', properties: { name: 'Alice' } },
            { label: 'Company', properties: { name: 'Acme Corp' } },
          ],
          relationships: [
            { from: 'Alice', to: 'Acme Corp', type: 'WORKS_FOR', properties: {} },
          ],
        });
      }
      // Default response for queries
      return 'Test response';
    },
  };
}

/**
 * Create a valid test configuration with providers
 */
export function createTestConfig(overrides?: Partial<AkashaConfig>): AkashaConfig {
  return {
    neo4j: {
      uri: 'bolt://localhost:7687',
      user: 'neo4j',
      password: 'password',
    },
    providers: {
      embedding: {
        type: 'openai',
        config: {
          apiKey: 'test-key',
          model: 'text-embedding-3-small',
        },
      },
      llm: {
        type: 'openai',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4',
        },
      },
    },
    ...overrides,
  };
}

/**
 * Create a config with Anthropic LLM provider (for multi-provider tests)
 */
export function createAnthropicConfig(overrides?: Partial<AkashaConfig>): AkashaConfig {
  return {
    neo4j: {
      uri: 'bolt://localhost:7687',
      user: 'neo4j',
      password: 'password',
    },
    providers: {
      embedding: {
        type: 'openai',
        config: {
          apiKey: 'test-key',
          model: 'text-embedding-3-small',
        },
      },
      llm: {
        type: 'anthropic',
        config: {
          apiKey: 'test-key',
          model: 'claude-3-5-sonnet-20241022',
        },
      },
    },
    ...overrides,
  };
}

