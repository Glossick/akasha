import { describe, expect, it } from 'bun:test';
import { OpenAIEmbeddingProvider } from '../../services/providers/embedding/openai-embedding.provider';

describe('OpenAIEmbeddingProvider', () => {
  describe('Construction and Validation', () => {
    it('should construct with valid config', () => {
      const provider = new OpenAIEmbeddingProvider({
        apiKey: 'sk-test-key',
        model: 'text-embedding-3-small',
      });

      expect(provider.provider).toBe('openai');
      expect(provider.model).toBe('text-embedding-3-small');
      expect(provider.dimensions).toBe(1536);
    });

    it('should throw if API key is missing', () => {
      expect(() => {
        new OpenAIEmbeddingProvider({
          apiKey: '',
          model: 'text-embedding-3-small',
        });
      }).toThrow('OpenAI API key is required');
    });

    it('should throw if model is missing', () => {
      expect(() => {
        new OpenAIEmbeddingProvider({
          apiKey: 'sk-test-key',
          model: '',
        });
      }).toThrow('OpenAI embedding model is required');
    });

    it('should throw for unknown model without explicit dimensions', () => {
      expect(() => {
        new OpenAIEmbeddingProvider({
          apiKey: 'sk-test-key',
          model: 'unknown-model',
        });
      }).toThrow('Unknown OpenAI embedding model');
    });

    it('should accept unknown model with explicit dimensions', () => {
      const provider = new OpenAIEmbeddingProvider({
        apiKey: 'sk-test-key',
        model: 'custom-model',
        dimensions: 2048,
      });

      expect(provider.dimensions).toBe(2048);
    });

    it('should use correct dimensions for text-embedding-3-small', () => {
      const provider = new OpenAIEmbeddingProvider({
        apiKey: 'sk-test-key',
        model: 'text-embedding-3-small',
      });

      expect(provider.dimensions).toBe(1536);
    });

    it('should use correct dimensions for text-embedding-3-large', () => {
      const provider = new OpenAIEmbeddingProvider({
        apiKey: 'sk-test-key',
        model: 'text-embedding-3-large',
      });

      expect(provider.dimensions).toBe(3072);
    });

    it('should allow dimension override for text-embedding-3 models', () => {
      const provider = new OpenAIEmbeddingProvider({
        apiKey: 'sk-test-key',
        model: 'text-embedding-3-small',
        dimensions: 512, // Custom dimension
      });

      expect(provider.dimensions).toBe(512);
    });

    it('should throw for invalid dimension override', () => {
      expect(() => {
        new OpenAIEmbeddingProvider({
          apiKey: 'sk-test-key',
          model: 'text-embedding-3-small',
          dimensions: -100,
        });
      }).toThrow('Invalid embedding dimensions');
    });
  });

  describe('Methods', () => {
    it('should throw on empty text in generateEmbedding', async () => {
      const provider = new OpenAIEmbeddingProvider({
        apiKey: 'sk-test-key',
        model: 'text-embedding-3-small',
      });

      await expect(provider.generateEmbedding('')).rejects.toThrow('Text cannot be empty');
    });

    it('should throw on empty texts array in generateEmbeddings', async () => {
      const provider = new OpenAIEmbeddingProvider({
        apiKey: 'sk-test-key',
        model: 'text-embedding-3-small',
      });

      await expect(provider.generateEmbeddings([])).rejects.toThrow('Texts array cannot be empty');
    });

    it('should throw on empty text in batch', async () => {
      const provider = new OpenAIEmbeddingProvider({
        apiKey: 'sk-test-key',
        model: 'text-embedding-3-small',
      });

      await expect(provider.generateEmbeddings(['valid', '', 'also valid'])).rejects.toThrow('Empty texts found');
    });
  });
});

