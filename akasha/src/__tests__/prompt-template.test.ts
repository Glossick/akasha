import { describe, it, expect } from 'bun:test';
import { DEFAULT_EXTRACTION_TEMPLATE, generateExtractionPrompt } from '../utils/prompt-template';
import type { ExtractionPromptTemplate } from '../types';

describe('Prompt Template System', () => {
  describe('DEFAULT_EXTRACTION_TEMPLATE', () => {
    it('should have all required fields', () => {
      expect(DEFAULT_EXTRACTION_TEMPLATE.role).toBeDefined();
      expect(DEFAULT_EXTRACTION_TEMPLATE.task).toBeDefined();
      expect(DEFAULT_EXTRACTION_TEMPLATE.formatRules).toBeDefined();
      expect(DEFAULT_EXTRACTION_TEMPLATE.extractionConstraints).toBeDefined();
      expect(DEFAULT_EXTRACTION_TEMPLATE.semanticConstraints).toBeDefined();
      expect(DEFAULT_EXTRACTION_TEMPLATE.outputFormat).toBeDefined();
    });

    it('should have format rules array', () => {
      expect(Array.isArray(DEFAULT_EXTRACTION_TEMPLATE.formatRules)).toBe(true);
      expect(DEFAULT_EXTRACTION_TEMPLATE.formatRules!.length).toBeGreaterThan(0);
    });

    it('should have extraction constraints array', () => {
      expect(Array.isArray(DEFAULT_EXTRACTION_TEMPLATE.extractionConstraints)).toBe(true);
      expect(DEFAULT_EXTRACTION_TEMPLATE.extractionConstraints!.length).toBeGreaterThan(0);
    });

    it('should have semantic constraints array', () => {
      expect(Array.isArray(DEFAULT_EXTRACTION_TEMPLATE.semanticConstraints)).toBe(true);
      expect(DEFAULT_EXTRACTION_TEMPLATE.semanticConstraints!.length).toBeGreaterThan(0);
    });
  });

  describe('generateExtractionPrompt', () => {
    it('should generate prompt with default template', () => {
      const prompt = generateExtractionPrompt();
      
      expect(prompt).toContain('You are an expert at extracting knowledge graph structures');
      expect(prompt).toContain('Your task is to analyze the provided text');
      expect(prompt).toContain('CRITICAL RULES:');
      expect(prompt).toContain('Entity labels should be singular, PascalCase');
      expect(prompt).toContain('Return ONLY valid JSON in this format:');
      expect(prompt).toContain('"label": "Person"');
    });

    it('should include all format rules in prompt', () => {
      const prompt = generateExtractionPrompt();
      
      DEFAULT_EXTRACTION_TEMPLATE.formatRules!.forEach(rule => {
        expect(prompt).toContain(rule);
      });
    });

    it('should include all extraction constraints in prompt', () => {
      const prompt = generateExtractionPrompt();
      
      DEFAULT_EXTRACTION_TEMPLATE.extractionConstraints!.forEach(constraint => {
        expect(prompt).toContain(constraint);
      });
    });

    it('should include semantic constraints in prompt', () => {
      const prompt = generateExtractionPrompt();
      
      expect(prompt).toContain('Use semantically appropriate relationship types:');
      DEFAULT_EXTRACTION_TEMPLATE.semanticConstraints!.forEach(constraint => {
        expect(prompt).toContain(constraint);
      });
    });

    it('should override role when provided', () => {
      const customRole = 'You are an expert at extracting e-commerce data.';
      const prompt = generateExtractionPrompt({ role: customRole });
      
      expect(prompt).toContain(customRole);
      expect(prompt).not.toContain(DEFAULT_EXTRACTION_TEMPLATE.role);
    });

    it('should override task when provided', () => {
      const customTask = 'Your task is to extract customer and product information.';
      const prompt = generateExtractionPrompt({ task: customTask });
      
      expect(prompt).toContain(customTask);
      expect(prompt).not.toContain(DEFAULT_EXTRACTION_TEMPLATE.task);
    });

    it('should include custom entity types when provided', () => {
      const customTemplate: Partial<ExtractionPromptTemplate> = {
        entityTypes: [
          {
            label: 'Customer',
            description: 'A customer who makes purchases',
            examples: ['John Doe', 'Jane Smith'],
            requiredProperties: ['email', 'name']
          },
          {
            label: 'Product',
            description: 'A product for sale',
            examples: ['iPhone 15', 'MacBook Pro'],
            requiredProperties: ['sku', 'name']
          }
        ]
      };
      
      const prompt = generateExtractionPrompt(customTemplate);
      
      expect(prompt).toContain('ENTITY TYPES:');
      expect(prompt).toContain('Customer: A customer who makes purchases');
      expect(prompt).toContain('Examples: John Doe, Jane Smith');
      expect(prompt).toContain('Required properties: email, name');
      expect(prompt).toContain('Product: A product for sale');
      expect(prompt).toContain('Examples: iPhone 15, MacBook Pro');
      expect(prompt).toContain('Required properties: sku, name');
    });

    it('should include custom relationship types when provided', () => {
      const customTemplate: Partial<ExtractionPromptTemplate> = {
        relationshipTypes: [
          {
            type: 'PURCHASED',
            description: 'Customer purchased a product',
            from: ['Customer'],
            to: ['Product'],
            examples: ['Customer purchased Product'],
            constraints: ['PURCHASED only from Customer to Product']
          }
        ]
      };
      
      const prompt = generateExtractionPrompt(customTemplate);
      
      expect(prompt).toContain('RELATIONSHIP TYPES:');
      expect(prompt).toContain('PURCHASED: Customer purchased a product');
      expect(prompt).toContain('From: Customer');
      expect(prompt).toContain('To: Product');
      expect(prompt).toContain('Examples: Customer purchased Product');
      expect(prompt).toContain('Constraint: PURCHASED only from Customer to Product');
    });

    it('should override format rules when provided', () => {
      const customRules = [
        'Entity labels should be camelCase',
        'Relationship types should be lowercase'
      ];
      
      const prompt = generateExtractionPrompt({ formatRules: customRules });
      
      expect(prompt).toContain('Entity labels should be camelCase');
      expect(prompt).toContain('Relationship types should be lowercase');
      // Should not contain default rules
      expect(prompt).not.toContain('Entity labels should be singular, PascalCase');
    });

    it('should override output format when provided', () => {
      const customFormat = `{
  "custom": "format"
}`;
      
      const prompt = generateExtractionPrompt({ outputFormat: customFormat });
      
      expect(prompt).toContain(customFormat);
      expect(prompt).not.toContain('"label": "Person"');
    });

    it('should merge custom template with defaults', () => {
      const customTemplate: Partial<ExtractionPromptTemplate> = {
        role: 'Custom role',
        entityTypes: [
          { label: 'CustomEntity', description: 'A custom entity' }
        ]
      };
      
      const prompt = generateExtractionPrompt(customTemplate);
      
      // Should have custom role
      expect(prompt).toContain('Custom role');
      
      // Should have custom entity types
      expect(prompt).toContain('CustomEntity: A custom entity');
      
      // Should still have default format rules
      expect(prompt).toContain('Entity labels should be singular, PascalCase');
      
      // Should still have default extraction constraints
      expect(prompt).toContain('ONLY extract relationships that are EXPLICITLY stated');
    });

    it('should handle empty custom template (use all defaults)', () => {
      const prompt = generateExtractionPrompt({});
      
      expect(prompt).toContain(DEFAULT_EXTRACTION_TEMPLATE.role);
      expect(prompt).toContain(DEFAULT_EXTRACTION_TEMPLATE.task);
      expect(prompt).toContain(DEFAULT_EXTRACTION_TEMPLATE.formatRules![0]);
    });

    it('should generate prompt that matches current hard-coded format', () => {
      const prompt = generateExtractionPrompt();
      
      // Check structure matches current prompt
      expect(prompt).toMatch(/You are an expert at extracting knowledge graph structures/);
      expect(prompt).toMatch(/Your task is to analyze the provided text and extract:/);
      expect(prompt).toMatch(/CRITICAL RULES:/);
      expect(prompt).toMatch(/Return ONLY valid JSON in this format:/);
      expect(prompt).toMatch(/\{[\s\S]*"entities"[\s\S]*"relationships"[\s\S]*\}/);
    });
  });
});

