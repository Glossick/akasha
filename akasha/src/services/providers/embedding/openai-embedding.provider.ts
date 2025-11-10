import OpenAI from 'openai';
import type { EmbeddingProvider } from '../interfaces';

/**
 * Configuration for OpenAI Embedding Provider
 */
export interface OpenAIEmbeddingConfig {
  apiKey: string;
  model: string;
  dimensions?: number; // Optional: Override dimensions for text-embedding-3 models
}

/**
 * OpenAI Embedding Provider
 * 
 * Generates embeddings using OpenAI's embedding models.
 * Supports text-embedding-3-small (1536 dims) and text-embedding-3-large (3072 dims).
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  public readonly provider = 'openai';
  public readonly model: string;
  public readonly dimensions: number;
  
  private client: OpenAI;
  
  constructor(config: OpenAIEmbeddingConfig) {
    // Validation
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('OpenAI API key is required for embedding provider');
    }
    
    if (!config.model || config.model.trim() === '') {
      throw new Error('OpenAI embedding model is required');
    }
    
    this.model = config.model;
    
    // Determine dimensions based on model
    this.dimensions = this.resolveDimensions(config.model, config.dimensions);
    
    // Initialize OpenAI client
    this.client = new OpenAI({ apiKey: config.apiKey });
  }
  
  /**
   * Resolve embedding dimensions based on model and optional override
   */
  private resolveDimensions(model: string, override?: number): number {
    // If explicit override provided, use it
    if (override !== undefined) {
      if (override <= 0 || !Number.isInteger(override)) {
        throw new Error(`Invalid embedding dimensions: ${override}. Must be a positive integer.`);
      }
      return override;
    }
    
    // Default dimensions based on known models
    const knownDimensions: Record<string, number> = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536,
    };
    
    const dimensions = knownDimensions[model];
    
    if (dimensions === undefined) {
      throw new Error(
        `Unknown OpenAI embedding model: ${model}. ` +
        `Known models: ${Object.keys(knownDimensions).join(', ')}. ` +
        `If using a custom model, specify dimensions explicitly.`
      );
    }
    
    return dimensions;
  }
  
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      throw new Error('Text cannot be empty for embedding generation');
    }
    
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
        ...(this.model.startsWith('text-embedding-3') && this.dimensions 
          ? { dimensions: this.dimensions } 
          : {}),
      });
      
      return response.data[0].embedding;
    } catch (error) {
      throw new Error(
        `Failed to generate OpenAI embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      throw new Error('Texts array cannot be empty for batch embedding generation');
    }
    
    // Validate all texts are non-empty
    const emptyIndices = texts
      .map((t, i) => (t.trim() === '' ? i : -1))
      .filter(i => i !== -1);
    
    if (emptyIndices.length > 0) {
      throw new Error(`Empty texts found at indices: ${emptyIndices.join(', ')}`);
    }
    
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
        ...(this.model.startsWith('text-embedding-3') && this.dimensions 
          ? { dimensions: this.dimensions } 
          : {}),
      });
      
      return response.data.map(item => item.embedding);
    } catch (error) {
      throw new Error(
        `Failed to generate OpenAI embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
