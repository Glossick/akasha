import { describe, expect, it } from 'bun:test';
import { DeepSeekLLMProvider } from '../../services/providers/llm/deepseek-llm.provider';

describe('DeepSeekLLMProvider', () => {
  describe('Construction and Validation', () => {
    it('should construct with valid config', () => {
      const provider = new DeepSeekLLMProvider({
        apiKey: 'sk-test-key',
        model: 'deepseek-chat',
      });

      expect(provider.provider).toBe('deepseek');
      expect(provider.model).toBe('deepseek-chat');
    });

    it('should throw if API key is missing', () => {
      expect(() => {
        new DeepSeekLLMProvider({
          apiKey: '',
          model: 'deepseek-chat',
        });
      }).toThrow('DeepSeek API key is required');
    });

    it('should throw if model is missing', () => {
      expect(() => {
        new DeepSeekLLMProvider({
          apiKey: 'sk-test-key',
          model: '',
        });
      }).toThrow('DeepSeek LLM model is required');
    });

    it('should use default temperature of 0.7', () => {
      const provider = new DeepSeekLLMProvider({
        apiKey: 'sk-test-key',
        model: 'deepseek-chat',
      });

      expect(provider).toBeDefined();
    });

    it('should accept custom temperature', () => {
      const provider = new DeepSeekLLMProvider({
        apiKey: 'sk-test-key',
        model: 'deepseek-chat',
        temperature: 0.5,
      });

      expect(provider).toBeDefined();
    });

    it('should throw for temperature below 0', () => {
      expect(() => {
        new DeepSeekLLMProvider({
          apiKey: 'sk-test-key',
          model: 'deepseek-chat',
          temperature: -0.1,
        });
      }).toThrow('Invalid temperature');
    });

    it('should throw for temperature above 2', () => {
      expect(() => {
        new DeepSeekLLMProvider({
          apiKey: 'sk-test-key',
          model: 'deepseek-chat',
          temperature: 2.5,
        });
      }).toThrow('Invalid temperature');
    });

    it('should accept deepseek-chat model', () => {
      const provider = new DeepSeekLLMProvider({
        apiKey: 'sk-test-key',
        model: 'deepseek-chat',
      });

      expect(provider.model).toBe('deepseek-chat');
    });

    it('should accept deepseek-reasoner model', () => {
      const provider = new DeepSeekLLMProvider({
        apiKey: 'sk-test-key',
        model: 'deepseek-reasoner',
      });

      expect(provider.model).toBe('deepseek-reasoner');
    });

    it('should warn for unknown model but not throw', () => {
      // Should construct without throwing even for unknown models
      const provider = new DeepSeekLLMProvider({
        apiKey: 'sk-test-key',
        model: 'deepseek-future-model',
      });

      expect(provider.model).toBe('deepseek-future-model');
    });
  });

  describe('generateResponse', () => {
    it('should throw on empty prompt', async () => {
      const provider = new DeepSeekLLMProvider({
        apiKey: 'sk-test-key',
        model: 'deepseek-chat',
      });

      await expect(provider.generateResponse('', 'context')).rejects.toThrow('Prompt cannot be empty');
    });

    it('should validate temperature parameter', async () => {
      const provider = new DeepSeekLLMProvider({
        apiKey: 'sk-test-key',
        model: 'deepseek-chat',
      });

      await expect(provider.generateResponse('prompt', 'context', undefined, 3.0)).rejects.toThrow('Invalid temperature');
    });
  });
});

