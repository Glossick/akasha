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
} from './types';

