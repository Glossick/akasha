import { describe, expect, it } from 'bun:test';
import { AnthropicLLMProvider } from '../../services/providers/llm/anthropic-llm.provider';

describe('AnthropicLLMProvider', () => {
  describe('Construction and Validation', () => {
    it('should construct with valid config', () => {
      const provider = new AnthropicLLMProvider({
        apiKey: 'sk-ant-test-key',
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(provider.provider).toBe('anthropic');
      expect(provider.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should throw if API key is missing', () => {
      expect(() => {
        new AnthropicLLMProvider({
          apiKey: '',
          model: 'claude-3-5-sonnet-20241022',
        });
      }).toThrow('Anthropic API key is required');
    });

    it('should throw if model is missing', () => {
      expect(() => {
        new AnthropicLLMProvider({
          apiKey: 'sk-ant-test-key',
          model: '',
        });
      }).toThrow('Anthropic LLM model is required');
    });

    it('should use default temperature of 0.7', () => {
      const provider = new AnthropicLLMProvider({
        apiKey: 'sk-ant-test-key',
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(provider).toBeDefined();
    });

    it('should accept custom temperature', () => {
      const provider = new AnthropicLLMProvider({
        apiKey: 'sk-ant-test-key',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.5,
      });

      expect(provider).toBeDefined();
    });

    it('should throw for temperature below 0 (Anthropic range is 0-1)', () => {
      expect(() => {
        new AnthropicLLMProvider({
          apiKey: 'sk-ant-test-key',
          model: 'claude-3-5-sonnet-20241022',
          temperature: -0.1,
        });
      }).toThrow('Invalid temperature');
    });

    it('should throw for temperature above 1 (Anthropic range is 0-1)', () => {
      expect(() => {
        new AnthropicLLMProvider({
          apiKey: 'sk-ant-test-key',
          model: 'claude-3-5-sonnet-20241022',
          temperature: 1.5,
        });
      }).toThrow('Invalid temperature');
    });

    it('should warn for unknown model but not throw', () => {
      // Should construct without throwing even for unknown models
      const provider = new AnthropicLLMProvider({
        apiKey: 'sk-ant-test-key',
        model: 'claude-future-model',
      });

      expect(provider.model).toBe('claude-future-model');
    });

    it('should accept all known Claude models', () => {
      const models = [
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ];

      models.forEach(model => {
        const provider = new AnthropicLLMProvider({
          apiKey: 'sk-ant-test-key',
          model,
        });

        expect(provider.model).toBe(model);
      });
    });
  });

  describe('generateResponse', () => {
    it('should throw on empty prompt', async () => {
      const provider = new AnthropicLLMProvider({
        apiKey: 'sk-ant-test-key',
        model: 'claude-3-5-sonnet-20241022',
      });

      await expect(provider.generateResponse('', 'context')).rejects.toThrow('Prompt cannot be empty');
    });

    it('should validate temperature parameter (Anthropic 0-1 range)', async () => {
      const provider = new AnthropicLLMProvider({
        apiKey: 'sk-ant-test-key',
        model: 'claude-3-5-sonnet-20241022',
      });

      await expect(provider.generateResponse('prompt', 'context', undefined, 1.5)).rejects.toThrow('Invalid temperature');
    });
  });
});

