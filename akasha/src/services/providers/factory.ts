/**
 * Provider Factory
 * 
 * Creates provider instances based on configuration type discrimination.
 * Handles provider resolution and backward compatibility with legacy config.
 */

import type { 
  EmbeddingProvider, 
  LLMProvider,
} from './interfaces';
import type {
  EmbeddingProviderConfig,
  LLMProviderConfig,
  ProvidersConfig,
} from '../types';
import type { AkashaConfig } from '../types';
import { OpenAIEmbeddingProvider } from './embedding/openai-embedding.provider';
import { OpenAILLMProvider } from './llm/openai-llm.provider';
import { AnthropicLLMProvider } from './llm/anthropic-llm.provider';
import { DeepSeekLLMProvider } from './llm/deepseek-llm.provider';

/**
 * Create embedding provider based on configuration
 * 
 * @param config - Embedding provider configuration
 * @returns Configured embedding provider instance
 * @throws Error if provider type is unknown or configuration is invalid
 */
export function createEmbeddingProvider(config: EmbeddingProviderConfig): EmbeddingProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAIEmbeddingProvider({
        apiKey: config.config.apiKey,
        model: config.config.model,
        dimensions: config.config.dimensions,
      });
    
    default:
      throw new Error(
        `Unknown embedding provider type: '${(config as any).type}'. ` +
        `Supported providers: 'openai'.`
      );
  }
}

/**
 * Create LLM provider based on configuration
 * 
 * @param config - LLM provider configuration
 * @returns Configured LLM provider instance
 * @throws Error if provider type is unknown or configuration is invalid
 */
export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAILLMProvider({
        apiKey: config.config.apiKey,
        model: config.config.model,
        temperature: config.config.temperature,
      });
    
    case 'anthropic':
      return new AnthropicLLMProvider({
        apiKey: config.config.apiKey,
        model: config.config.model,
        temperature: config.config.temperature,
      });
    
    case 'deepseek':
      return new DeepSeekLLMProvider({
        apiKey: config.config.apiKey,
        model: config.config.model,
        temperature: config.config.temperature,
      });
    
    default:
      throw new Error(
        `Unknown LLM provider type: '${(config as any).type}'. ` +
        `Supported providers: 'openai', 'anthropic', 'deepseek'.`
      );
  }
}

/**
 * Create all providers from Akasha configuration
 * 
 * @param config - Akasha configuration with providers
 * @returns Object with embedding and LLM provider instances
 * @throws Error if providers config is missing
 */
export function createProvidersFromConfig(config: AkashaConfig): {
  embeddingProvider: EmbeddingProvider;
  llmProvider: LLMProvider;
} {
  if (!config.providers) {
    throw new Error(
      'Provider configuration is required. ' +
      'Please specify config.providers.embedding and config.providers.llm'
    );
  }
  
  return {
    embeddingProvider: createEmbeddingProvider(config.providers.embedding),
    llmProvider: createLLMProvider(config.providers.llm),
  };
}
