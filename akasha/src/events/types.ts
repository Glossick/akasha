import type { Entity, Relationship, Document, ExtractResult, BatchLearnResult } from '../types';

/**
 * Event type definitions for Akasha event system
 * 
 * Following Node.js EventEmitter pattern with type-safe events
 */

/**
 * All possible event types in Akasha
 */
export type EventType =
  // Graph mutation events
  | 'entity.created' | 'entity.updated' | 'entity.deleted'
  | 'relationship.created' | 'relationship.updated' | 'relationship.deleted'
  | 'document.created' | 'document.updated' | 'document.deleted'
  // Learning lifecycle events
  | 'learn.started' | 'learn.completed' | 'learn.failed'
  | 'extraction.started' | 'extraction.completed'
  // Query events
  | 'query.started' | 'query.completed'
  // Batch events
  | 'batch.progress' | 'batch.completed';

/**
 * Base event interface with common properties
 */
export interface BaseEvent {
  type: EventType;
  timestamp: string; // ISO timestamp
  scopeId?: string; // Optional scope ID for multi-tenancy
}

/**
 * Entity event - emitted when entities are created, updated, or deleted
 */
export interface EntityEvent extends BaseEvent {
  type: 'entity.created' | 'entity.updated' | 'entity.deleted';
  entity: Entity;
}

/**
 * Relationship event - emitted when relationships are created, updated, or deleted
 */
export interface RelationshipEvent extends BaseEvent {
  type: 'relationship.created' | 'relationship.updated' | 'relationship.deleted';
  relationship: Relationship;
}

/**
 * Document event - emitted when documents are created, updated, or deleted
 */
export interface DocumentEvent extends BaseEvent {
  type: 'document.created' | 'document.updated' | 'document.deleted';
  document: Document;
}

/**
 * Learning event - emitted during the learning process
 */
export interface LearnEvent extends BaseEvent {
  type: 'learn.started' | 'learn.completed' | 'learn.failed';
  text?: string; // Original text being learned
  result?: ExtractResult; // Result for completed events
  error?: Error; // Error for failed events
}

/**
 * Extraction event - emitted during entity/relationship extraction
 */
export interface ExtractionEvent extends BaseEvent {
  type: 'extraction.started' | 'extraction.completed';
  text?: string; // Text being extracted
}

/**
 * Query event - emitted during query operations
 */
export interface QueryEvent extends BaseEvent {
  type: 'query.started' | 'query.completed';
  query: string; // Query string
}

/**
 * Batch event - emitted during batch operations
 */
export interface BatchEvent extends BaseEvent {
  type: 'batch.progress' | 'batch.completed';
  progress?: {
    current: number;
    total: number;
    completed: number;
    failed: number;
    currentText?: string;
    estimatedTimeRemainingMs?: number;
  };
  summary?: BatchLearnResult['summary'];
}

/**
 * Union type of all possible Akasha events
 */
export type AkashaEvent =
  | EntityEvent
  | RelationshipEvent
  | DocumentEvent
  | LearnEvent
  | ExtractionEvent
  | QueryEvent
  | BatchEvent;

