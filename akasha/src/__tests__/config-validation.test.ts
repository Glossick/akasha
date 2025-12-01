import { describe, expect, it } from 'bun:test';
import { Akasha } from '../akasha';
import type { AkashaConfig, ConfigValidationResult } from '../types';

describe('Akasha - Configuration Validation', () => {
  describe('static validateConfig', () => {
    it('should validate a complete valid configuration', () => {
      const config: AkashaConfig = {
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'gpt-4',
            },
          },
        },
        scope: {
          id: 'tenant-1',
          type: 'tenant',
          name: 'Test Tenant',
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate configuration with optional fields', () => {
      const config: AkashaConfig = {
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          database: 'test-db',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'text-embedding-3-small',
              dimensions: 1536,
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'gpt-4',
              temperature: 0.7,
            },
          },
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate LadybugDB configuration', () => {
      const config: AkashaConfig = {
        database: {
          type: 'ladybug',
          config: {
            databasePath: '/tmp/test-ladybug-db',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'gpt-4',
            },
          },
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should fail validation for LadybugDB without databasePath', () => {
      const config = {
        database: {
          type: 'ladybug',
          config: {
            // Missing databasePath
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'gpt-4',
            },
          },
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'database.config.databasePath')).toBe(true);
    });

    it('should fail validation without providers configuration', () => {
      const config = {
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'providers')).toBe(true);
    });

    it('should validate configuration without scope (optional)', () => {
      const config: AkashaConfig = {
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'text-embedding-3-small',
            },
          },
          llm: {
            type: 'openai',
            config: {
              apiKey: 'sk-test-key',
              model: 'gpt-4',
            },
          },
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should fail validation when neo4j.uri is missing', () => {
      const config = {
        database: {
          type: 'neo4j',
          config: {
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'text-embedding-3-small' },
          },
          llm: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'gpt-4' },
          },
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('database.config.uri'))).toBe(true);
    });

    it('should fail validation when providers.embedding.config.apiKey is missing', () => {
      const config = {
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: { model: 'text-embedding-3-small' },
          },
          llm: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'gpt-4' },
          },
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('providers.embedding.config.apiKey'))).toBe(true);
    });

    it('should fail validation when providers.llm.config.apiKey is missing', () => {
      const config = {
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'text-embedding-3-small' },
          },
          llm: {
            type: 'openai',
            config: { model: 'gpt-4' },
          },
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('providers.llm.config.apiKey'))).toBe(true);
    });

    it('should validate scope when provided', () => {
      const config: AkashaConfig = {
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'text-embedding-3-small' },
          },
          llm: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'gpt-4' },
          },
        },
        scope: {
          id: 'tenant-1',
          type: 'tenant',
          name: 'Test Tenant',
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should validate Anthropic LLM provider', () => {
      const config: AkashaConfig = {
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'text-embedding-3-small' },
          },
          llm: {
            type: 'anthropic',
            config: { apiKey: 'sk-ant-test-key', model: 'claude-3-5-sonnet-20241022' },
          },
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should fail validation for invalid embedding provider type', () => {
      const config = {
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'invalid-provider',
            config: { apiKey: 'sk-test-key', model: 'some-model' },
          },
          llm: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'gpt-4' },
          },
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'providers.embedding.type')).toBe(true);
    });

    it('should fail validation for deepseek embedding provider (not supported)', () => {
      const config = {
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'deepseek',
            config: { apiKey: 'sk-test-key', model: 'some-model' },
          },
          llm: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'gpt-4' },
          },
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'providers.embedding.type')).toBe(true);
      expect(result.errors.some(e => e.message.includes('openai'))).toBe(true);
    });

    it('should fail validation for invalid LLM provider type', () => {
      const config = {
        database: {
          type: 'neo4j',
          config: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'text-embedding-3-small' },
          },
          llm: {
            type: 'invalid-provider',
            config: { apiKey: 'sk-test-key', model: 'some-model' },
          },
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'providers.llm.type')).toBe(true);
    });

    it('should validate URI format (warn for non-standard URIs)', () => {
      const config: AkashaConfig = {
        database: {
          type: 'neo4j',
          config: {
          uri: 'http://localhost:7687',  // Non-standard URI
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'text-embedding-3-small' },
          },
          llm: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'gpt-4' },
          },
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.field === 'database.config.uri')).toBe(true);
    });
  });

  describe('instance validateConfig', () => {
    it('should detect invalid configuration in instance', () => {
      const config = {
        database: {
          type: 'neo4j',
          config: {
          uri: '',  // Invalid: empty string
          user: 'neo4j',
          password: 'password',
          },
        },
        providers: {
          embedding: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'text-embedding-3-small' },
          },
          llm: {
            type: 'openai',
            config: { apiKey: 'sk-test-key', model: 'gpt-4' },
          },
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('database.config.uri'))).toBe(true);
    });
  });
});
