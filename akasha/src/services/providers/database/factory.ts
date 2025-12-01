import type { DatabaseProvider } from './interfaces';
import type { DatabaseConfig } from '../../../types';
import { Neo4jProvider } from './neo4j-provider';
import { LadybugProvider } from './ladybug-provider';

/**
 * Create a database provider from configuration
 */
export function createDatabaseProvider(config: DatabaseConfig): DatabaseProvider {
  if (config.type === 'neo4j') {
    return new Neo4jProvider(config.config);
  } else if (config.type === 'ladybug') {
    return new LadybugProvider(config.config);
  } else {
    throw new Error(`Unknown database type: ${(config as any).type}`);
  }
}

