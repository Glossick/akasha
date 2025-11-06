import { describe, expect, it } from 'bun:test';
import { validateLabel, validateRelationshipType, validateEntityId } from '../utils/validation.ts';

describe('Validation Utilities', () => {
  describe('validateLabel', () => {
    it('should accept valid labels starting with uppercase', () => {
      expect(validateLabel('Person')).toEqual({ valid: true });
      expect(validateLabel('Company')).toEqual({ valid: true });
      expect(validateLabel('Project_123')).toEqual({ valid: true });
      expect(validateLabel('Entity_With_Underscores')).toEqual({ valid: true });
    });

    it('should reject labels starting with lowercase', () => {
      const result = validateLabel('person');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('uppercase');
    });

    it('should reject labels with special characters', () => {
      expect(validateLabel('Person-Name')).toEqual({
        valid: false,
        error: expect.stringContaining('alphanumeric'),
      });
      expect(validateLabel('Person Name')).toEqual({
        valid: false,
        error: expect.stringContaining('alphanumeric'),
      });
      expect(validateLabel('Person@Name')).toEqual({
        valid: false,
        error: expect.stringContaining('alphanumeric'),
      });
    });

    it('should reject empty or null labels', () => {
      expect(validateLabel('')).toEqual({
        valid: false,
        error: expect.stringContaining('required'),
      });
      expect(validateLabel(null as unknown as string)).toEqual({
        valid: false,
        error: expect.stringContaining('required'),
      });
    });
  });

  describe('validateRelationshipType', () => {
    it('should accept valid uppercase relationship types', () => {
      expect(validateRelationshipType('WORKS_FOR')).toEqual({ valid: true });
      expect(validateRelationshipType('KNOWS')).toEqual({ valid: true });
      expect(validateRelationshipType('WORKS_ON')).toEqual({ valid: true });
      expect(validateRelationshipType('RELATED_TO')).toEqual({ valid: true });
      expect(validateRelationshipType('TYPE_123')).toEqual({ valid: true });
    });

    it('should reject lowercase relationship types', () => {
      const result = validateRelationshipType('works_for');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('uppercase');
    });

    it('should reject relationship types with special characters', () => {
      expect(validateRelationshipType('WORKS-FOR')).toEqual({
        valid: false,
        error: expect.stringContaining('alphanumeric'),
      });
      expect(validateRelationshipType('WORKS FOR')).toEqual({
        valid: false,
        error: expect.stringContaining('alphanumeric'),
      });
    });

    it('should reject empty or null types', () => {
      expect(validateRelationshipType('')).toEqual({
        valid: false,
        error: expect.stringContaining('required'),
      });
    });
  });

  describe('validateEntityId', () => {
    it('should accept valid entity IDs', () => {
      expect(validateEntityId('123')).toEqual({ valid: true });
      expect(validateEntityId('entity-123')).toEqual({ valid: true });
      expect(validateEntityId('abc123')).toEqual({ valid: true });
    });

    it('should reject empty entity IDs', () => {
      const result1 = validateEntityId('');
      expect(result1.valid).toBe(false);
      expect(result1.error).toBeDefined();
      
      const result2 = validateEntityId('   ');
      expect(result2.valid).toBe(false);
      expect(result2.error).toBeDefined();
    });

    it('should reject null or undefined entity IDs', () => {
      expect(validateEntityId(null as unknown as string)).toEqual({
        valid: false,
        error: expect.stringContaining('required'),
      });
      expect(validateEntityId(undefined as unknown as string)).toEqual({
        valid: false,
        error: expect.stringContaining('required'),
      });
    });
  });
});

