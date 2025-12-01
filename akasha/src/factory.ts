import { Akasha } from './akasha';
import type { AkashaConfig } from './types';

/**
 * Factory function to create an Akasha instance
 * 
 * @example
 * ```typescript
 * const kg = akasha({
 *   database: {
 *     type: 'neo4j',
 *     config: { uri: '...', user: '...', password: '...' }
 *   },
 *   providers: {
 *     embedding: { type: 'openai', config: { apiKey: '...', model: '...' } },
 *     llm: { type: 'openai', config: { apiKey: '...', model: '...' } }
 *   },
 *   scope: { id: 'tenant-1', type: 'tenant', name: 'My Tenant' },
 * });
 * ```
 */
export function akasha(config: AkashaConfig): Akasha {
  return new Akasha(config);
}

