import { describe, expect, it } from 'bun:test';
import { generateSystemMetadata, type SystemMetadataOptions } from '../utils/system-metadata';

describe('System Metadata Generator', () => {
  const baseOptions: SystemMetadataOptions = {
    contextId: 'test-context-1',
    timestamp: new Date('2024-01-15T10:00:00Z'),
  };

  describe('Basic metadata generation', () => {
    it('should generate contextIds array', () => {
      const metadata = generateSystemMetadata(baseOptions);

      expect(metadata.contextIds).toEqual(['test-context-1']);
      expect(Array.isArray(metadata.contextIds)).toBe(true);
    });

    it('should generate _recordedAt timestamp automatically', () => {
      const metadata = generateSystemMetadata(baseOptions);

      expect(metadata._recordedAt).toBe('2024-01-15T10:00:00.000Z');
      expect(typeof metadata._recordedAt).toBe('string');
    });

    it('should include scopeId when provided', () => {
      const metadata = generateSystemMetadata({
        ...baseOptions,
        scopeId: 'tenant-1',
      });

      expect(metadata.scopeId).toBe('tenant-1');
    });

    it('should not include scopeId when not provided', () => {
      const metadata = generateSystemMetadata(baseOptions);

      expect(metadata.scopeId).toBeUndefined();
    });
  });

  describe('Temporal metadata (_validFrom, _validTo)', () => {
    it('should default _validFrom to _recordedAt if not provided', () => {
      const metadata = generateSystemMetadata(baseOptions);

      expect(metadata._validFrom).toBe('2024-01-15T10:00:00.000Z');
      expect(metadata._validFrom).toBe(metadata._recordedAt);
    });

    it('should use provided _validFrom when specified (Date)', () => {
      const validFrom = new Date('2024-01-10T08:00:00Z');
      const metadata = generateSystemMetadata({
        ...baseOptions,
        validFrom,
      });

      expect(metadata._validFrom).toBe('2024-01-10T08:00:00.000Z');
      expect(metadata._validFrom).not.toBe(metadata._recordedAt);
    });

    it('should use provided _validFrom when specified (string)', () => {
      const validFrom = '2024-01-10T08:00:00Z';
      const metadata = generateSystemMetadata({
        ...baseOptions,
        validFrom,
      });

      expect(metadata._validFrom).toBe('2024-01-10T08:00:00Z');
    });

    it('should include _validTo when provided (Date)', () => {
      const validTo = new Date('2024-12-31T23:59:59Z');
      const metadata = generateSystemMetadata({
        ...baseOptions,
        validTo,
      });

      expect(metadata._validTo).toBe('2024-12-31T23:59:59.000Z');
    });

    it('should include _validTo when provided (string)', () => {
      const validTo = '2024-12-31T23:59:59Z';
      const metadata = generateSystemMetadata({
        ...baseOptions,
        validTo,
      });

      expect(metadata._validTo).toBe('2024-12-31T23:59:59Z');
    });

    it('should not include _validTo when not provided (ongoing fact)', () => {
      const metadata = generateSystemMetadata(baseOptions);

      expect(metadata._validTo).toBeUndefined();
    });

    it('should handle both validFrom and validTo together', () => {
      const validFrom = new Date('2024-01-10T08:00:00Z');
      const validTo = new Date('2024-12-31T23:59:59Z');
      const metadata = generateSystemMetadata({
        ...baseOptions,
        validFrom,
        validTo,
      });

      expect(metadata._validFrom).toBe('2024-01-10T08:00:00.000Z');
      expect(metadata._validTo).toBe('2024-12-31T23:59:59.000Z');
      expect(metadata._recordedAt).toBe('2024-01-15T10:00:00.000Z');
    });
  });

  describe('Complete metadata structure', () => {
    it('should generate all metadata fields when all options provided', () => {
      const metadata = generateSystemMetadata({
        scopeId: 'tenant-1',
        contextId: 'context-1',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        validFrom: new Date('2024-01-10T08:00:00Z'),
        validTo: new Date('2024-12-31T23:59:59Z'),
      });

      expect(metadata).toEqual({
        scopeId: 'tenant-1',
        contextIds: ['context-1'],
        _recordedAt: '2024-01-15T10:00:00.000Z',
        _validFrom: '2024-01-10T08:00:00.000Z',
        _validTo: '2024-12-31T23:59:59.000Z',
      });
    });

    it('should generate minimal metadata when only required options provided', () => {
      const metadata = generateSystemMetadata(baseOptions);

      expect(metadata).toEqual({
        contextIds: ['test-context-1'],
        _recordedAt: '2024-01-15T10:00:00.000Z',
        _validFrom: '2024-01-15T10:00:00.000Z',
      });
      expect(metadata.scopeId).toBeUndefined();
      expect(metadata._validTo).toBeUndefined();
    });
  });
});

