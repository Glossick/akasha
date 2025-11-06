import { describe, it, expect } from 'bun:test';
import { generateExtractionPrompt } from '../utils/prompt-template';

/**
 * Test to ensure backward compatibility - default template should generate
 * the same prompt as the original hard-coded prompt
 */
describe('Template Backward Compatibility', () => {
  it('should generate prompt that contains all original sections', () => {
    const prompt = generateExtractionPrompt();
    
    // Check all original sections are present
    expect(prompt).toContain('You are an expert at extracting knowledge graph structures from natural language text.');
    expect(prompt).toContain('Your task is to analyze the provided text and extract:');
    expect(prompt).toContain('1. Entities (people, places, organizations, concepts, works, etc.) with their properties');
    expect(prompt).toContain('2. Relationships between entities');
    expect(prompt).toContain('CRITICAL RULES:');
    expect(prompt).toContain('Entity labels should be singular, PascalCase');
    expect(prompt).toContain('Each entity must have at least a "name" property');
    expect(prompt).toContain('Relationship types should be UPPERCASE with underscores');
    expect(prompt).toContain('ONLY extract relationships that are EXPLICITLY stated');
    expect(prompt).toContain('NEVER create self-referential relationships');
    expect(prompt).toContain('NEVER create duplicate relationships');
    expect(prompt).toContain('Use semantically appropriate relationship types:');
    expect(prompt).toContain('FATHER_OF, MOTHER_OF, SON_OF, DAUGHTER_OF only for familial relationships between Persons');
    expect(prompt).toContain('Return ONLY valid JSON in this format:');
    expect(prompt).toContain('"label": "Person"');
    expect(prompt).toContain('"name": "Alice"');
    expect(prompt).toContain('"type": "WORKS_FOR"');
  });

  it('should work with no config (backward compatible)', () => {
    // This should work exactly like before - no config = default prompt
    const prompt1 = generateExtractionPrompt();
    const prompt2 = generateExtractionPrompt(undefined);
    const prompt3 = generateExtractionPrompt({});
    
    // All should be identical
    expect(prompt1).toBe(prompt2);
    expect(prompt2).toBe(prompt3);
  });
});

