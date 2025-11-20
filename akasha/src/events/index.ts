/**
 * Events module - Core event system for Akasha
 * 
 * Provides type-safe event emission and subscription following
 * Node.js EventEmitter patterns.
 */

export { EventEmitter } from './event-emitter';
export type {
  EventType,
  AkashaEvent,
  BaseEvent,
  EntityEvent,
  RelationshipEvent,
  DocumentEvent,
  LearnEvent,
  ExtractionEvent,
  QueryEvent,
  BatchEvent,
} from './types';

