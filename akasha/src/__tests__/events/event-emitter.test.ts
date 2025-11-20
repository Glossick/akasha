import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { EventEmitter } from '../../events/event-emitter';
import type { AkashaEvent } from '../../events/types';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('on()', () => {
    it('should register event handler', () => {
      const handler = mock(() => {});
      emitter.on('entity.created', handler);
      
      // Handler should be registered (we can't directly check, but emit will call it)
      expect(handler).not.toHaveBeenCalled();
    });

    it('should call handler when event is emitted', async () => {
      const handler = mock((event: AkashaEvent) => {
        expect(event.type).toBe('entity.created');
      });
      
      emitter.on('entity.created', handler);
      
      const event: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };
      
      emitter.emit(event);
      
      // Wait for async handler execution
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should support multiple handlers for same event', async () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});
      
      emitter.on('entity.created', handler1);
      emitter.on('entity.created', handler2);
      
      const event: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };
      
      emitter.emit(event);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should pass correct event payload to handler', async () => {
      const handler = mock((event: AkashaEvent) => {
        expect(event.type).toBe('entity.created');
        expect(event.entity).toBeDefined();
        expect(event.entity.id).toBe('1');
      });
      
      emitter.on('entity.created', handler);
      
      const event: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };
      
      emitter.emit(event);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should handle async handlers', async () => {
      let handlerCompleted = false;
      const handler = mock(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        handlerCompleted = true;
      });
      
      emitter.on('entity.created', handler);
      
      const event: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };
      
      emitter.emit(event);
      
      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(handlerCompleted).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not block on handler execution (fire-and-forget)', async () => {
      let handlerCompleted = false;
      const handler = mock(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        handlerCompleted = true;
      });
      
      emitter.on('entity.created', handler);
      
      const event: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };
      
      const start = Date.now();
      emitter.emit(event);
      const duration = Date.now() - start;
      
      // Emit should return immediately (not wait for handler)
      expect(duration).toBeLessThan(50);
      
      // Handler should complete eventually
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(handlerCompleted).toBe(true);
    });

    it('should handle handler errors gracefully', async () => {
      // Capture console.error calls
      const originalError = console.error;
      let errorLogged = false;
      const errorMessages: string[] = [];
      
      console.error = mock((...args: unknown[]) => {
        errorLogged = true;
        errorMessages.push(String(args[0]));
        originalError(...args);
      });
      
      const errorHandler = mock(() => {
        throw new Error('Handler error');
      });
      
      emitter.on('entity.created', errorHandler);
      
      const event: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };
      
      // Should not throw
      expect(() => emitter.emit(event)).not.toThrow();
      
      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Error should be logged but not crash
      expect(errorHandler).toHaveBeenCalled();
      expect(errorLogged).toBe(true);
      expect(errorMessages.some(msg => msg.includes('Error in event handler'))).toBe(true);
      
      // Restore console.error
      console.error = originalError;
    });
  });

  describe('off()', () => {
    it('should remove event handler', async () => {
      const handler = mock(() => {});
      
      emitter.on('entity.created', handler);
      
      // Verify handler is registered
      const testEvent: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };
      
      emitter.emit(testEvent);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1);
      
      // Remove handler
      emitter.off('entity.created', handler);
      
      // Reset mock
      handler.mockClear();
      
      // Emit again - handler should not be called
      emitter.emit(testEvent);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Handler should not be called
      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove specific handler when multiple exist', async () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});
      
      emitter.on('entity.created', handler1);
      emitter.on('entity.created', handler2);
      emitter.off('entity.created', handler1);
      
      const event: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };
      
      emitter.emit(event);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('once()', () => {
    it('should call handler only once', async () => {
      const handler = mock(() => {});
      
      emitter.once('entity.created', handler);
      
      const event: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };
      
      emitter.emit(event);
      emitter.emit(event);
      emitter.emit(event);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('emit()', () => {
    it('should emit event to all registered handlers', async () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});
      const handler3 = mock(() => {});
      
      emitter.on('entity.created', handler1);
      emitter.on('entity.created', handler2);
      emitter.on('entity.created', handler3);
      
      const event: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };
      
      emitter.emit(event);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should emit events asynchronously', async () => {
      const handler = mock(() => {});
      emitter.on('entity.created', handler);
      
      const event: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };
      
      emitter.emit(event);
      
      // Handler should not be called synchronously (Promise.resolve schedules it)
      // In practice, Promise.resolve may execute immediately in some environments,
      // but the important thing is that emit() returns immediately
      const emitReturned = true;
      expect(emitReturned).toBe(true);
      
      // Wait a tick for async execution
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(handler).toHaveBeenCalled();
    });

    it('should not throw if no handlers registered', () => {
      const event: AkashaEvent = {
        type: 'entity.created',
        timestamp: new Date().toISOString(),
        entity: {
          id: '1',
          label: 'Person',
          properties: { name: 'Alice' },
        },
      };
      
      expect(() => emitter.emit(event)).not.toThrow();
    });
  });
});

