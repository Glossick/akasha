import { describe, expect, it } from 'bun:test';
import { generateEntityText } from '../../utils/entity-embedding';

describe('generateEntityText', () => {
  it('should generate text from entity with name property', () => {
    const entity = {
      label: 'Person',
      properties: {
        name: 'Alice',
        age: 30,
        occupation: 'Engineer',
      },
    };

    const text = generateEntityText(entity);
    
    expect(text).toContain('Person');
    expect(text).toContain('Alice');
    expect(text).toContain('age: 30');
    expect(text).toContain('occupation: Engineer');
  });

  it('should generate text from entity with title property', () => {
    const entity = {
      label: 'Book',
      properties: {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        year: 1925,
      },
    };

    const text = generateEntityText(entity);
    
    expect(text).toContain('Book');
    expect(text).toContain('The Great Gatsby');
    expect(text).toContain('author: F. Scott Fitzgerald');
    expect(text).toContain('year: 1925');
  });

  it('should include description if available', () => {
    const entity = {
      label: 'Company',
      properties: {
        name: 'TechCorp',
        description: 'A leading technology company',
        industry: 'Technology',
      },
    };

    const text = generateEntityText(entity);
    
    expect(text).toContain('TechCorp');
    expect(text).toContain('A leading technology company');
    expect(text).toContain('industry: Technology');
  });

  it('should exclude internal properties', () => {
    const entity = {
      label: 'Person',
      properties: {
        name: 'Bob',
        id: 'internal-id',
        embedding: [0.1, 0.2, 0.3],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      },
    };

    const text = generateEntityText(entity);
    
    expect(text).toContain('Bob');
    expect(text).not.toContain('internal-id');
    expect(text).not.toContain('embedding');
    expect(text).not.toContain('createdAt');
    expect(text).not.toContain('updatedAt');
  });

  it('should include boolean and number properties', () => {
    const entity = {
      label: 'Person',
      properties: {
        name: 'Charlie',
        age: 25,
        isActive: true,
        score: 95.5,
      },
    };

    const text = generateEntityText(entity);
    
    expect(text).toContain('age: 25');
    expect(text).toContain('isActive: true');
    expect(text).toContain('score: 95.5');
  });

  it('should exclude very long string values', () => {
    const longString = 'A'.repeat(300);
    const entity = {
      label: 'Document',
      properties: {
        name: 'Long Document',
        content: longString,
        shortProp: 'Short',
      },
    };

    const text = generateEntityText(entity);
    
    expect(text).toContain('Long Document');
    expect(text).toContain('shortProp: Short');
    // Long content should not be included
    expect(text).not.toContain(longString);
  });

  it('should handle entity with only label and name', () => {
    const entity = {
      label: 'Person',
      properties: {
        name: 'David',
      },
    };

    const text = generateEntityText(entity);
    
    expect(text).toBe('Person David');
  });

  it('should not duplicate name or description in other properties', () => {
    const entity = {
      label: 'Person',
      properties: {
        name: 'Eve',
        description: 'A person named Eve',
        otherField: 'Eve', // Should not duplicate
      },
    };

    const text = generateEntityText(entity);
    
    // Should contain name and description
    expect(text).toContain('Eve');
    expect(text).toContain('A person named Eve');
    // But should not duplicate in otherField section
    const occurrences = (text.match(/Eve/g) || []).length;
    expect(occurrences).toBeLessThanOrEqual(3); // Label, name, description at most
  });

  it('should handle empty properties object', () => {
    const entity = {
      label: 'Entity',
      properties: {},
    };

    const text = generateEntityText(entity);
    
    expect(text).toBe('Entity');
  });

  it('should handle entity with title but no name', () => {
    const entity = {
      label: 'Film',
      properties: {
        title: 'Inception',
        director: 'Christopher Nolan',
      },
    };

    const text = generateEntityText(entity);
    
    expect(text).toContain('Film');
    expect(text).toContain('Inception');
    expect(text).toContain('director: Christopher Nolan');
  });
});

