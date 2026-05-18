import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SwipeGestureHandler, createSwipeHandler, type SwipeEvent } from './swipeGesture';

describe('SwipeGestureHandler', () => {
  let handler: SwipeGestureHandler;

  beforeEach(() => {
    handler = new SwipeGestureHandler();
    vi.useFakeTimers();
  });

  describe('Initialization', () => {
    it('should create handler with default config', () => {
      const h = new SwipeGestureHandler();
      expect(h.isActive()).toBe(false);
      expect(h.getCurrentOffset()).toBe(0);
      expect(h.getCurrentProgress()).toBe(0);
    });

    it('should create handler with custom config', () => {
      const h = new SwipeGestureHandler({
        threshold: 100,
        verticalThreshold: 75,
        velocityThreshold: 1.0
      });
      expect(h.isActive()).toBe(false);
    });

    it('should create handler using factory function', () => {
      const h = createSwipeHandler({ threshold: 80 });
      expect(h).toBeInstanceOf(SwipeGestureHandler);
    });
  });

  describe('Touch Event Handling', () => {
    it('should start tracking on touch start', () => {
      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(touchEvent);
      expect(handler.isActive()).toBe(true);
    });

    it('should update position on touch move', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 150, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);
      handler.updateSwipe(moveEvent);

      expect(handler.getCurrentOffset()).toBe(50);
    });

    it('should detect right swipe on touch end', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      const endEvent = new TouchEvent('touchend', {
        touches: [] as any
      });

      handler.startSwipe(startEvent);

      // Simulate swipe right
      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 160, clientY: 100 } as Touch]
        })
      );

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.direction).toBe('right');
      expect(swipeEvent?.distance).toBeGreaterThanOrEqual(50);
    });

    it('should detect left swipe on touch end', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);

      // Simulate swipe left
      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 40, clientY: 100 } as Touch]
        })
      );

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.direction).toBe('left');
      expect(swipeEvent?.distance).toBeGreaterThanOrEqual(50);
    });

    it('should handle empty touches array', () => {
      const emptyTouchEvent = new TouchEvent('touchstart', {
        touches: [] as any
      });

      handler.startSwipe(emptyTouchEvent);
      expect(handler.isActive()).toBe(false);
    });
  });

  describe('Mouse Event Handling', () => {
    it('should start tracking on mouse down', () => {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100
      });

      handler.startSwipe(mouseEvent);
      expect(handler.isActive()).toBe(true);
    });

    it('should update position on mouse move', () => {
      const startEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100
      });
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 160,
        clientY: 100
      });

      handler.startSwipe(startEvent);
      handler.updateSwipe(moveEvent);

      expect(handler.getCurrentOffset()).toBe(60);
    });

    it('should detect right swipe on mouse up', () => {
      const startEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100
      });

      handler.startSwipe(startEvent);

      handler.updateSwipe(
        new MouseEvent('mousemove', {
          clientX: 160,
          clientY: 100
        })
      );

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.direction).toBe('right');
    });

    it('should detect left swipe on mouse up', () => {
      const startEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100
      });

      handler.startSwipe(startEvent);

      handler.updateSwipe(
        new MouseEvent('mousemove', {
          clientX: 30,
          clientY: 100
        })
      );

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.direction).toBe('left');
    });
  });

  describe('Swipe Validation', () => {
    it('should reject swipe below threshold', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);

      // Only move 30 pixels (below default 50 threshold)
      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 130, clientY: 100 } as Touch]
        })
      );

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).toBeNull();
    });

    it('should reject diagonal swipe (too much vertical movement)', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);

      // Move 60 pixels right and 60 pixels down (diagonal)
      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 160, clientY: 160 } as Touch]
        })
      );

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).toBeNull();
    });

    it('should reject swipe that takes too long', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);

      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 160, clientY: 100 } as Touch]
        })
      );

      // Advance time beyond 1 second
      vi.advanceTimersByTime(1100);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).toBeNull();
    });

    it('should accept swipe with minimal vertical movement', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);

      // Move 60 pixels right and 30 pixels down (within vertical threshold)
      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 160, clientY: 130 } as Touch]
        })
      );

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.direction).toBe('right');
    });
  });

  describe('Velocity Calculation', () => {
    it('should calculate velocity correctly', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);

      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 200, clientY: 100 } as Touch]
        })
      );

      vi.advanceTimersByTime(100);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.velocity).toBeGreaterThan(0);
      // 100 pixels / 100ms = 1 pixel/ms
      expect(swipeEvent?.velocity).toBeCloseTo(1, 1);
    });

    it('should detect fast swipe', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);

      // Fast swipe: 100 pixels in 50ms = 2 pixels/ms
      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 200, clientY: 100 } as Touch]
        })
      );

      vi.advanceTimersByTime(50);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.isFast).toBe(true);
    });

    it('should detect slow swipe', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);

      // Slow swipe: 60 pixels in 200ms = 0.3 pixels/ms
      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 160, clientY: 100 } as Touch]
        })
      );

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.isFast).toBe(false);
    });
  });

  describe('Progress Tracking', () => {
    it('should calculate progress during swipe', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);

      // Move 25 pixels (50% of threshold)
      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 125, clientY: 100 } as Touch]
        })
      );

      expect(handler.getCurrentProgress()).toBeCloseTo(0.5, 1);
    });

    it('should cap progress at 1.0', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);

      // Move 200 pixels (4x threshold)
      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 300, clientY: 100 } as Touch]
        })
      );

      expect(handler.getCurrentProgress()).toBe(1);
    });

    it('should return 0 progress when not tracking', () => {
      expect(handler.getCurrentProgress()).toBe(0);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset handler state', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);
      expect(handler.isActive()).toBe(true);

      handler.reset();
      expect(handler.isActive()).toBe(false);
      expect(handler.getCurrentOffset()).toBe(0);
      expect(handler.getCurrentProgress()).toBe(0);
    });
  });

  describe('Swipe Event Properties', () => {
    it('should include all required properties in swipe event', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);

      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 160, clientY: 100 } as Touch]
        })
      );

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).toHaveProperty('direction');
      expect(swipeEvent).toHaveProperty('distance');
      expect(swipeEvent).toHaveProperty('velocity');
      expect(swipeEvent).toHaveProperty('isFast');
      expect(swipeEvent).toHaveProperty('startX');
      expect(swipeEvent).toHaveProperty('startY');
      expect(swipeEvent).toHaveProperty('endX');
      expect(swipeEvent).toHaveProperty('endY');
      expect(swipeEvent).toHaveProperty('duration');
    });

    it('should track correct coordinates', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 150 } as Touch]
      });

      handler.startSwipe(startEvent);

      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 160, clientY: 150 } as Touch]
        })
      );

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent?.startX).toBe(100);
      expect(swipeEvent?.startY).toBe(150);
      expect(swipeEvent?.endX).toBe(160);
      expect(swipeEvent?.endY).toBe(150);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple swipes in sequence', () => {
      // First swipe
      const start1 = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(start1);
      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 160, clientY: 100 } as Touch]
        })
      );
      vi.advanceTimersByTime(200);
      const swipe1 = handler.endSwipe();

      expect(swipe1?.direction).toBe('right');

      // Second swipe
      const start2 = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(start2);
      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 40, clientY: 100 } as Touch]
        })
      );
      vi.advanceTimersByTime(200);
      const swipe2 = handler.endSwipe();

      expect(swipe2?.direction).toBe('left');
    });

    it('should handle end swipe without start', () => {
      const swipeEvent = handler.endSwipe();
      expect(swipeEvent).toBeNull();
    });

    it('should handle update without start', () => {
      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 160, clientY: 100 } as Touch]
      });

      // Should not throw
      handler.updateSwipe(moveEvent);
      expect(handler.isActive()).toBe(false);
    });

    it('should handle very fast swipe', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(startEvent);

      handler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 200, clientY: 100 } as Touch]
        })
      );

      vi.advanceTimersByTime(10); // Very fast
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.isFast).toBe(true);
      expect(swipeEvent?.velocity).toBeGreaterThan(5);
    });
  });

  describe('Custom Configuration', () => {
    it('should respect custom threshold', () => {
      const customHandler = new SwipeGestureHandler({ threshold: 100 });

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      customHandler.startSwipe(startEvent);

      // Move 60 pixels (below custom 100 threshold)
      customHandler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 160, clientY: 100 } as Touch]
        })
      );

      vi.advanceTimersByTime(200);
      const swipeEvent = customHandler.endSwipe();

      expect(swipeEvent).toBeNull();
    });

    it('should respect custom vertical threshold', () => {
      const customHandler = new SwipeGestureHandler({ verticalThreshold: 20 });

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      customHandler.startSwipe(startEvent);

      // Move 60 pixels right and 30 pixels down (exceeds custom 20 threshold)
      customHandler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 160, clientY: 130 } as Touch]
        })
      );

      vi.advanceTimersByTime(200);
      const swipeEvent = customHandler.endSwipe();

      expect(swipeEvent).toBeNull();
    });

    it('should respect custom velocity threshold', () => {
      const customHandler = new SwipeGestureHandler({ velocityThreshold: 2.0 });

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      customHandler.startSwipe(startEvent);

      // Move 100 pixels in 100ms = 1 pixel/ms (below custom 2.0 threshold)
      customHandler.updateSwipe(
        new TouchEvent('touchmove', {
          touches: [{ clientX: 200, clientY: 100 } as Touch]
        })
      );

      vi.advanceTimersByTime(100);
      const swipeEvent = customHandler.endSwipe();

      expect(swipeEvent?.isFast).toBe(false);
    });
  });
});
