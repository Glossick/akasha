import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Neo4jService } from '../services/neo4j.service';
import type { Driver, Session, Result } from 'neo4j-driver';

describe('Neo4j Vector Search Filtering', () => {
  let neo4jService: Neo4jService;
  let mockDriver: any;
  let mockSession: any;
  let mockResult: any;
  let capturedQuery: string;
  let capturedParams: any;

  beforeEach(() => {
    capturedQuery = '';
    capturedParams = {};

    mockResult = {
      records: [],
    };

    mockSession = {
      run: mock((query: string, params: any) => {
        capturedQuery = query;
        capturedParams = params;
        return Promise.resolve(mockResult);
      }),
      close: mock(() => Promise.resolve()),
    };

    mockDriver = {
      session: mock(() => mockSession),
      close: mock(() => Promise.resolve()),
      verifyConnectivity: mock(() => Promise.resolve()),
    } as any;

    neo4jService = new Neo4jService({
      uri: 'bolt://localhost:7687',
      user: 'neo4j',
      password: 'password',
    });

    // Inject mock driver
    (neo4jService as any).driver = mockDriver;
  });

  afterEach(async () => {
    await neo4jService.disconnect();
  });

  describe('findDocumentsByVector - WHERE clause insertion', () => {
    it('should insert WHERE clause with scopeId filter', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await neo4jService.findDocumentsByVector(
        queryEmbedding,
        10,
        0.7,
        'test-scope'
      );

      expect(mockSession.run).toHaveBeenCalled();
      // Check for scope filter (works with both vector and fallback paths)
      expect(capturedQuery).toMatch(/scopeId = \$scopeId/);
      expect(capturedParams.scopeId).toBe('test-scope');
    });

    it('should insert WHERE clause with contexts filter', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await neo4jService.findDocumentsByVector(
        queryEmbedding,
        10,
        0.7,
        undefined,
        ['context-1', 'context-2']
      );

      expect(mockSession.run).toHaveBeenCalled();
      expect(capturedQuery).toContain('WHERE');
      expect(capturedQuery).toMatch(/contextIds IS NULL OR ANY\(ctx IN .*contextIds WHERE ctx IN \$contexts\)/);
      expect(capturedParams.contexts).toEqual(['context-1', 'context-2']);
    });

    it('should insert WHERE clause with validAt temporal filter', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      const validAt = '2024-06-01T00:00:00Z';
      
      await neo4jService.findDocumentsByVector(
        queryEmbedding,
        10,
        0.7,
        undefined,
        undefined,
        validAt
      );

      expect(mockSession.run).toHaveBeenCalled();
      expect(capturedQuery).toContain('WHERE');
      expect(capturedQuery).toMatch(/_validFrom IS NULL OR .*_validFrom <= \$validAt/);
      expect(capturedQuery).toMatch(/_validTo IS NULL OR .*_validTo >= \$validAt/);
      expect(capturedParams.validAt).toBe(validAt);
    });

    it('should combine multiple WHERE conditions with AND', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      const validAt = '2024-06-01T00:00:00Z';
      
      await neo4jService.findDocumentsByVector(
        queryEmbedding,
        10,
        0.7,
        'test-scope',
        ['context-1'],
        validAt
      );

      expect(mockSession.run).toHaveBeenCalled();
      expect(capturedQuery).toContain('WHERE');
      expect(capturedQuery).toMatch(/scopeId = \$scopeId/);
      expect(capturedQuery).toMatch(/contextIds IS NULL OR ANY/);
      expect(capturedQuery).toMatch(/_validFrom IS NULL OR/);
      expect(capturedQuery).toContain('AND');
      
      // Verify all params are passed
      expect(capturedParams.scopeId).toBe('test-scope');
      expect(capturedParams.contexts).toEqual(['context-1']);
      expect(capturedParams.validAt).toBe(validAt);
    });

    it('should not add scope/context/temporal filters when none provided', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await neo4jService.findDocumentsByVector(
        queryEmbedding,
        10,
        0.7
      );

      expect(mockSession.run).toHaveBeenCalled();
      // Should not have scopeId, contexts, or validAt filters
      expect(capturedQuery).not.toMatch(/scopeId = \$scopeId/);
      expect(capturedQuery).not.toMatch(/contextIds.*\$contexts/);
      expect(capturedQuery).not.toMatch(/_validFrom.*\$validAt/);
    });

    it('should insert WHERE clause BEFORE RETURN statement (regression test)', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await neo4jService.findDocumentsByVector(
        queryEmbedding,
        10,
        0.7,
        'test-scope'
      );

      expect(mockSession.run).toHaveBeenCalled();
      
      // Critical: WHERE must come before RETURN
      const whereIndex = capturedQuery.indexOf('WHERE');
      const returnIndex = capturedQuery.indexOf('RETURN');
      
      expect(whereIndex).toBeGreaterThan(-1);
      expect(returnIndex).toBeGreaterThan(-1);
      expect(whereIndex).toBeLessThan(returnIndex);
    });
  });

  describe('findEntitiesByVector - WHERE clause insertion', () => {
    it('should insert WHERE clause with scopeId filter', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await neo4jService.findEntitiesByVector(
        queryEmbedding,
        10,
        0.7,
        'test-scope'
      );

      expect(mockSession.run).toHaveBeenCalled();
      expect(capturedQuery).toMatch(/scopeId = \$scopeId/);
      expect(capturedParams.scopeId).toBe('test-scope');
    });

    it('should insert WHERE clause with contexts filter', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await neo4jService.findEntitiesByVector(
        queryEmbedding,
        10,
        0.7,
        undefined,
        ['context-1']
      );

      expect(mockSession.run).toHaveBeenCalled();
      expect(capturedQuery).toContain('WHERE');
      expect(capturedQuery).toMatch(/contextIds IS NULL OR ANY\(ctx IN .*contextIds WHERE ctx IN \$contexts\)/);
      expect(capturedParams.contexts).toEqual(['context-1']);
    });

    it('should combine scopeId and contexts filters', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await neo4jService.findEntitiesByVector(
        queryEmbedding,
        10,
        0.7,
        'test-scope',
        ['context-1', 'context-2']
      );

      expect(mockSession.run).toHaveBeenCalled();
      expect(capturedQuery).toContain('WHERE');
      expect(capturedQuery).toMatch(/scopeId = \$scopeId/);
      expect(capturedQuery).toMatch(/contextIds IS NULL OR ANY/);
      expect(capturedQuery).toContain('AND');
      
      expect(capturedParams.scopeId).toBe('test-scope');
      expect(capturedParams.contexts).toEqual(['context-1', 'context-2']);
    });

    it('should insert WHERE clause BEFORE RETURN statement (regression test)', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await neo4jService.findEntitiesByVector(
        queryEmbedding,
        10,
        0.7,
        'test-scope'
      );

      expect(mockSession.run).toHaveBeenCalled();
      
      // Critical: WHERE must come before RETURN
      const whereIndex = capturedQuery.indexOf('WHERE');
      const returnIndex = capturedQuery.indexOf('RETURN');
      
      expect(whereIndex).toBeGreaterThan(-1);
      expect(returnIndex).toBeGreaterThan(-1);
      expect(whereIndex).toBeLessThan(returnIndex);
    });
  });

  describe('Query structure validation', () => {
    it('should apply filters correctly for documents', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await neo4jService.findDocumentsByVector(
        queryEmbedding,
        10,
        0.7,
        'test-scope',
        ['context-1']
      );

      // Should have scope and context filters applied
      expect(capturedQuery).toMatch(/scopeId = \$scopeId/);
      expect(capturedQuery).toMatch(/contextIds/);
      expect(capturedQuery).toContain('WHERE');
      expect(capturedQuery).toContain('RETURN');
    });

    it('should apply filters correctly for entities', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      
      await neo4jService.findEntitiesByVector(
        queryEmbedding,
        10,
        0.7,
        'test-scope'
      );

      // Should have scope filter applied
      expect(capturedQuery).toMatch(/scopeId = \$scopeId/);
      expect(capturedQuery).toContain('WHERE');
      expect(capturedQuery).toContain('RETURN');
    });
  });
});

