import { Akasha } from './akasha';
import type { AkashaConfig } from './types';

/**
 * Factory function to create an Akasha instance
 * 
 * @example
 * ```typescript
 * const kg = akasha({
 *   neo4j: { uri: '...', user: '...', password: '...' },
 *   scope: { id: 'tenant-1', type: 'tenant', name: 'My Tenant' },
 * });
 * ```
 */
export function akasha(config: AkashaConfig): Akasha {
  return new Akasha(config);
}

