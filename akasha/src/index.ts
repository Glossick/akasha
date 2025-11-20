/**
 * Akasha - A minimal, developer-friendly GraphRAG library
 * 
 * @example
 * ```typescript
 * import { akasha } from 'akasha';
 * 
 * const kg = akasha({
 *   neo4j: {
 *     uri: 'bolt://localhost:7687',
 *     user: 'neo4j',
 *     password: 'password',
 *   },
 *   scope: {
 *     id: 'tenant-1',
 *     type: 'tenant',
 *     name: 'My Tenant',
 *   },
 * });
 * 
 * await kg.init();
 * const result = await kg.ask('What is the relationship between X and Y?');
 * ```
 */

export { Akasha } from './akasha';
export { akasha } from './factory';
export type {
  Scope,
  Context,
  AkashaConfig,
  QueryOptions,
  QueryStrategy,
  GraphRAGQuery,
  GraphRAGResponse,
  Entity,
  Relationship,
  Document,
  ExtractResult,
  LearnOptions,
  ProvidersConfig,
  EmbeddingProviderConfig,
  LLMProviderConfig,
} from './types';

// Export event types
export type {
  EventType,
  AkashaEvent,
  EntityEvent,
  RelationshipEvent,
  DocumentEvent,
  LearnEvent,
  ExtractionEvent,
  QueryEvent,
  BatchEvent,
} from './events/types';

// Export provider interfaces for advanced usage
export type {
  EmbeddingProvider,
  LLMProvider,
} from './services/providers/interfaces';

// Export provider implementations for advanced usage
export { OpenAIEmbeddingProvider } from './services/providers/embedding/openai-embedding.provider';
export { OpenAILLMProvider } from './services/providers/llm/openai-llm.provider';
export { AnthropicLLMProvider } from './services/providers/llm/anthropic-llm.provider';
export { DeepSeekLLMProvider } from './services/providers/llm/deepseek-llm.provider';

