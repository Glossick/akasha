/**
 * Provider interfaces for embedding and LLM services
 * 
 * These interfaces define the contracts that all provider implementations must follow,
 * enabling configurable and interchangeable providers for semantic operations.
 */

/**
 * Embedding Provider Interface
 * 
 * Generates vector embeddings from text for semantic search.
 * Different providers may produce vectors of different dimensions.
 */
export interface EmbeddingProvider {
  /**
   * The dimensionality of embeddings produced by this provider
   * Must match the database vector index configuration
   */
  readonly dimensions: number;
  
  /**
   * Provider identifier for logging and debugging
   */
  readonly provider: string;
  
  /**
   * Model name used by this provider
   */
  readonly model: string;
  
  /**
   * Generate embedding vector for a single text
   * 
   * @param text - Text to embed
   * @returns Promise resolving to embedding vector
   */
  generateEmbedding(text: string): Promise<number[]>;
  
  /**
   * Generate embedding vectors for multiple texts (batch operation)
   * 
   * @param texts - Array of texts to embed
   * @returns Promise resolving to array of embedding vectors
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

/**
 * LLM Provider Interface
 * 
 * Generates natural language responses for entity extraction and query answering.
 */
export interface LLMProvider {
  /**
   * Provider identifier for logging and debugging
   */
  readonly provider: string;
  
  /**
   * Model name used by this provider
   */
  readonly model: string;
  
  /**
   * Generate natural language response based on prompt and context
   * 
   * @param prompt - The user's question or extraction prompt
   * @param context - Relevant context (e.g., graph data, document text)
   * @param systemMessage - Optional system message to guide model behavior
   * @param temperature - Optional sampling temperature (0.0 = deterministic, 1.0 = creative)
   * @returns Promise resolving to generated text response
   */
  generateResponse(
    prompt: string,
    context: string,
    systemMessage?: string,
    temperature?: number
  ): Promise<string>;
}

