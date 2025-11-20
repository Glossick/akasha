import type { AkashaEvent, EventType } from './types';

/**
 * EventEmitter - Core event system for Akasha
 * 
 * Follows Node.js EventEmitter pattern with async-friendly handlers.
 * Handlers are executed asynchronously (fire-and-forget) to avoid blocking operations.
 */
export class EventEmitter {
  private handlers: Map<EventType, Array<(event: AkashaEvent) => void | Promise<void>>> = new Map();
  private onceHandlers: Map<EventType, Array<(event: AkashaEvent) => void | Promise<void>>> = new Map();

  /**
   * Register an event handler
   * 
   * @param eventType - Type of event to listen for
   * @param handler - Handler function (can be async)
   */
  on(eventType: EventType, handler: (event: AkashaEvent) => void | Promise<void>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Remove an event handler
   * 
   * @param eventType - Type of event
   * @param handler - Handler function to remove
   */
  off(eventType: EventType, handler: (event: AkashaEvent) => void | Promise<void>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }

    const onceHandlers = this.onceHandlers.get(eventType);
    if (onceHandlers) {
      const index = onceHandlers.indexOf(handler);
      if (index > -1) {
        onceHandlers.splice(index, 1);
      }
    }
  }

  /**
   * Register an event handler that will only be called once
   * 
   * @param eventType - Type of event to listen for
   * @param handler - Handler function (can be async)
   */
  once(eventType: EventType, handler: (event: AkashaEvent) => void | Promise<void>): void {
    if (!this.onceHandlers.has(eventType)) {
      this.onceHandlers.set(eventType, []);
    }
    this.onceHandlers.get(eventType)!.push(handler);
  }

  /**
   * Emit an event to all registered handlers
   * 
   * Handlers are executed asynchronously (fire-and-forget) to avoid blocking.
   * Errors in handlers are caught and logged but don't crash the system.
   * 
   * @param event - Event to emit
   */
  emit(event: AkashaEvent): void {
    // Get all handlers for this event type
    const handlers = this.handlers.get(event.type) || [];
    const onceHandlers = this.onceHandlers.get(event.type) || [];

    // Execute regular handlers (fire-and-forget)
    for (const handler of handlers) {
      this.executeHandler(handler, event);
    }

    // Execute once handlers and remove them
    for (const handler of onceHandlers) {
      this.executeHandler(handler, event);
      // Remove from once handlers
      const index = onceHandlers.indexOf(handler);
      if (index > -1) {
        onceHandlers.splice(index, 1);
      }
    }
  }

  /**
   * Execute a handler asynchronously with error handling
   * 
   * Uses queueMicrotask to ensure handlers run asynchronously (fire-and-forget)
   * 
   * @private
   */
  private executeHandler(
    handler: (event: AkashaEvent) => void | Promise<void>,
    event: AkashaEvent
  ): void {
    // Schedule handler execution asynchronously (fire-and-forget)
    queueMicrotask(() => {
      try {
        const result = handler(event);
        // If handler returns a promise, catch errors
        if (result instanceof Promise) {
          result.catch((error) => {
            // Log error but don't crash
            console.error(`Error in event handler for ${event.type}:`, error);
          });
        }
      } catch (error) {
        // Log synchronous errors but don't crash
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    });
  }
}

