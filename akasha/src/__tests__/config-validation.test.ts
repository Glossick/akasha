import { describe, expect, it } from 'bun:test';
import { Akasha } from '../akasha';
import type { AkashaConfig, ConfigValidationResult } from '../types';

describe('Akasha - Configuration Validation', () => {
  describe('static validateConfig', () => {
    it('should validate a complete valid configuration', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        openai: {
          apiKey: 'sk-test-key',
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
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
          database: 'test-db',
        },
        openai: {
          apiKey: 'sk-test-key',
          model: 'gpt-4',
          embeddingModel: 'text-embedding-3-small',
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate configuration without OpenAI (optional)', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate configuration without scope (optional)', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        openai: {
          apiKey: 'sk-test-key',
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should fail validation when neo4j.uri is missing', () => {
      const config = {
        neo4j: {
          user: 'neo4j',
          password: 'password',
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('neo4j.uri'))).toBe(true);
    });

    it('should fail validation when neo4j.uri is empty', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: '',
          user: 'neo4j',
          password: 'password',
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('neo4j.uri'))).toBe(true);
    });

    it('should fail validation when neo4j.user is missing', () => {
      const config = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          password: 'password',
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('neo4j.user'))).toBe(true);
    });

    it('should fail validation when neo4j.user is empty', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: '',
          password: 'password',
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('neo4j.user'))).toBe(true);
    });

    it('should fail validation when neo4j.password is missing', () => {
      const config = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('neo4j.password'))).toBe(true);
    });

    it('should fail validation when neo4j.password is empty', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: '',
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('neo4j.password'))).toBe(true);
    });

    it('should fail validation when neo4j is missing', () => {
      const config = {} as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('neo4j'))).toBe(true);
    });

    it('should fail validation when openai.apiKey is missing but openai is provided', () => {
      const config = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        openai: {},
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('openai.apiKey'))).toBe(true);
    });

    it('should fail validation when openai.apiKey is empty', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        openai: {
          apiKey: '',
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('openai.apiKey'))).toBe(true);
    });

    it('should validate scope when provided', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
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

    it('should fail validation when scope.id is missing', () => {
      const config = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope: {
          type: 'tenant',
          name: 'Test Tenant',
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('scope.id'))).toBe(true);
    });

    it('should fail validation when scope.id is empty', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope: {
          id: '',
          type: 'tenant',
          name: 'Test Tenant',
        },
      };

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('scope.id'))).toBe(true);
    });

    it('should fail validation when scope.type is missing', () => {
      const config = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope: {
          id: 'tenant-1',
          name: 'Test Tenant',
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('scope.type'))).toBe(true);
    });

    it('should fail validation when scope.name is missing', () => {
      const config = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        scope: {
          id: 'tenant-1',
          type: 'tenant',
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('scope.name'))).toBe(true);
    });

    it('should validate URI format (warn for non-standard URIs)', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: 'http://localhost:7474', // HTTP instead of bolt
          user: 'neo4j',
          password: 'password',
        },
      };

      const result = Akasha.validateConfig(config);

      // Should still be valid, but might have warnings
      expect(result.valid).toBe(true);
    });

    it('should return multiple errors for multiple issues', () => {
      const config = {
        neo4j: {
          uri: '',
          user: '',
          password: '',
        },
        openai: {
          apiKey: '',
        },
      } as any;

      const result = Akasha.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('instance validateConfig', () => {
    it('should validate instance configuration', () => {
      const config: AkashaConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          user: 'neo4j',
          password: 'password',
        },
        openai: {
          apiKey: 'sk-test-key',
        },
      };

      const akasha = new Akasha(config);
      const result = akasha.validateConfig();

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect invalid configuration in instance', () => {
      const config = {
        neo4j: {
          uri: '',
          user: 'neo4j',
          password: 'password',
        },
      } as any;

      const akasha = new Akasha(config);
      const result = akasha.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

