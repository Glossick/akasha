import { describe, expect, it } from 'bun:test';
import { createDatabaseProvider } from '../../../services/providers/database/factory';
import type { DatabaseConfig } from '../../../types';
import { Neo4jProvider } from '../../../services/providers/database/neo4j-provider';
import { LadybugProvider } from '../../../services/providers/database/ladybug-provider';

describe('Database Provider Factory', () => {
  it('should create Neo4jProvider for neo4j config', () => {
    const config: DatabaseConfig = {
      type: 'neo4j',
      config: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: 'password',
      },
    };

    const provider = createDatabaseProvider(config);

    expect(provider).toBeInstanceOf(Neo4jProvider);
  });

  it('should create LadybugProvider for ladybug config', () => {
    const config: DatabaseConfig = {
      type: 'ladybug',
      config: {
        databasePath: '/tmp/test-ladybug-db',
      },
    };

    const provider = createDatabaseProvider(config);

    expect(provider).toBeInstanceOf(LadybugProvider);
  });

  it('should throw error for unknown database type', () => {
    const config = {
      type: 'unknown',
      config: {},
    } as any;

    expect(() => createDatabaseProvider(config)).toThrow('Unknown database type: unknown');
  });
});

