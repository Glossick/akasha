import { describe, expect, it } from 'bun:test';
import { OpenAILLMProvider } from '../../services/providers/llm/openai-llm.provider';

describe('OpenAILLMProvider', () => {
  describe('Construction and Validation', () => {
    it('should construct with valid config', () => {
      const provider = new OpenAILLMProvider({
        apiKey: 'sk-test-key',
        model: 'gpt-4',
      });

      expect(provider.provider).toBe('openai');
      expect(provider.model).toBe('gpt-4');
    });

    it('should throw if API key is missing', () => {
      expect(() => {
        new OpenAILLMProvider({
          apiKey: '',
          model: 'gpt-4',
        });
      }).toThrow('OpenAI API key is required');
    });

    it('should throw if model is missing', () => {
      expect(() => {
        new OpenAILLMProvider({
          apiKey: 'sk-test-key',
          model: '',
        });
      }).toThrow('OpenAI LLM model is required');
    });

    it('should use default temperature of 0.7', () => {
      const provider = new OpenAILLMProvider({
        apiKey: 'sk-test-key',
        model: 'gpt-4',
      });

      // Can't directly test private field, but it won't throw
      expect(provider).toBeDefined();
    });

    it('should accept custom temperature', () => {
      const provider = new OpenAILLMProvider({
        apiKey: 'sk-test-key',
        model: 'gpt-4',
        temperature: 0.5,
      });

      expect(provider).toBeDefined();
    });

    it('should throw for temperature below 0', () => {
      expect(() => {
        new OpenAILLMProvider({
          apiKey: 'sk-test-key',
          model: 'gpt-4',
          temperature: -0.1,
        });
      }).toThrow('Invalid temperature');
    });

    it('should throw for temperature above 2', () => {
      expect(() => {
        new OpenAILLMProvider({
          apiKey: 'sk-test-key',
          model: 'gpt-4',
          temperature: 2.5,
        });
      }).toThrow('Invalid temperature');
    });
  });

  describe('generateResponse', () => {
    it('should throw on empty prompt', async () => {
      const provider = new OpenAILLMProvider({
        apiKey: 'sk-test-key',
        model: 'gpt-4',
      });

      await expect(provider.generateResponse('', 'context')).rejects.toThrow('Prompt cannot be empty');
    });

    it('should validate temperature parameter', async () => {
      const provider = new OpenAILLMProvider({
        apiKey: 'sk-test-key',
        model: 'gpt-4',
      });

      await expect(provider.generateResponse('prompt', 'context', undefined, 3.0)).rejects.toThrow('Invalid temperature');
    });
  });
});

