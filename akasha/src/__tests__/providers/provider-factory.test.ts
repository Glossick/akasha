import { describe, expect, it } from 'bun:test';
import { createEmbeddingProvider, createLLMProvider, createProvidersFromConfig } from '../../services/providers/factory';
import type { AkashaConfig } from '../../types';
import { OpenAIEmbeddingProvider } from '../../services/providers/embedding/openai-embedding.provider';
import { OpenAILLMProvider } from '../../services/providers/llm/openai-llm.provider';
import { AnthropicLLMProvider } from '../../services/providers/llm/anthropic-llm.provider';
import { DeepSeekLLMProvider } from '../../services/providers/llm/deepseek-llm.provider';

describe('Provider Factory', () => {
  describe('createEmbeddingProvider', () => {
    it('should create OpenAI embedding provider', () => {
      const provider = createEmbeddingProvider({
        type: 'openai',
        config: {
          apiKey: 'sk-test-key',
          model: 'text-embedding-3-small',
        },
      });

      expect(provider).toBeInstanceOf(OpenAIEmbeddingProvider);
      expect(provider.provider).toBe('openai');
      expect(provider.dimensions).toBe(1536);
    });

    it('should throw for unknown provider type', () => {
      expect(() => {
        createEmbeddingProvider({
          type: 'unknown' as any,
          config: {
            apiKey: 'test-key',
            model: 'some-model',
          },
        });
      }).toThrow('Unknown embedding provider type');
    });

    it('should pass through dimension override', () => {
      const provider = createEmbeddingProvider({
        type: 'openai',
        config: {
          apiKey: 'sk-test-key',
          model: 'text-embedding-3-small',
          dimensions: 512,
        },
      });

      expect(provider.dimensions).toBe(512);
    });
  });

  describe('createLLMProvider', () => {
    it('should create OpenAI LLM provider', () => {
      const provider = createLLMProvider({
        type: 'openai',
        config: {
          apiKey: 'sk-test-key',
          model: 'gpt-4',
        },
      });

      expect(provider).toBeInstanceOf(OpenAILLMProvider);
      expect(provider.provider).toBe('openai');
      expect(provider.model).toBe('gpt-4');
    });

    it('should create Anthropic LLM provider', () => {
      const provider = createLLMProvider({
        type: 'anthropic',
        config: {
          apiKey: 'sk-ant-test-key',
          model: 'claude-3-5-sonnet-20241022',
        },
      });

      expect(provider).toBeInstanceOf(AnthropicLLMProvider);
      expect(provider.provider).toBe('anthropic');
      expect(provider.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should throw for unknown provider type', () => {
      expect(() => {
        createLLMProvider({
          type: 'unknown' as any,
          config: {
            apiKey: 'test-key',
            model: 'some-model',
          },
        });
      }).toThrow('Unknown LLM provider type');
    });

    it('should pass through temperature setting', () => {
      const provider = createLLMProvider({
        type: 'openai',
        config: {
          apiKey: 'sk-test-key',
          model: 'gpt-4',
          temperature: 0.3,
        },
      });

      expect(provider).toBeInstanceOf(OpenAILLMProvider);
    });

    it('should create DeepSeek LLM provider', () => {
      const provider = createLLMProvider({
        type: 'deepseek',
        config: {
          apiKey: 'sk-test-key',
          model: 'deepseek-chat',
        },
      });

      expect(provider).toBeInstanceOf(DeepSeekLLMProvider);
      expect(provider.provider).toBe('deepseek');
      expect(provider.model).toBe('deepseek-chat');
    });
  });

  describe('createProvidersFromConfig', () => {
    it('should create both providers from config', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'gpt-4',
            },
          },
        },
      };

      const result = createProvidersFromConfig(config);

      expect(result.embeddingProvider).toBeInstanceOf(OpenAIEmbeddingProvider);
      expect(result.llmProvider).toBeInstanceOf(OpenAILLMProvider);
    });

    it('should create mixed providers (OpenAI embedding + Anthropic LLM)', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'anthropic',
            config: {
              apiKey: 'sk-ant-test-key',
              model: 'claude-3-5-sonnet-20241022',
            },
          },
        },
      };

      const result = createProvidersFromConfig(config);

      expect(result.embeddingProvider).toBeInstanceOf(OpenAIEmbeddingProvider);
      expect(result.llmProvider).toBeInstanceOf(AnthropicLLMProvider);
    });

    it('should throw if providers config is missing', () => {
      const config = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
      } as any;

      expect(() => {
        createProvidersFromConfig(config);
      }).toThrow('Provider configuration is required');
    });
  });
});

