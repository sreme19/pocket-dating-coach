import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SwipeGestureHandler } from '../utils/swipeGesture';

/**
 * Validates: Requirements 17 - Swipe Gesture Handling
 *
 * Tests for swipe gesture handling which provides:
 * - Touch and mouse event listeners for swipe detection
 * - Swipe left (pass) and swipe right (like) detection
 * - Card animation on swipe
 * - Smooth next card loading
 * - Visual feedback during swipe
 * - Edge case handling (fast swipes, diagonal swipes)
 * - Mobile responsiveness
 * - Keyboard accessibility
 */

describe('SwipeCard Gesture Handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Swipe Gesture Detection', () => {
    it('should detect right swipe (like)', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 160, clientY: 100 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.direction).toBe('right');
      expect(swipeEvent?.distance).toBeGreaterThanOrEqual(50);
    });

    it('should detect left swipe (pass)', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 40, clientY: 100 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.direction).toBe('left');
      expect(swipeEvent?.distance).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Touch Event Handling', () => {
    it('should handle touch start event', () => {
      const handler = new SwipeGestureHandler();

      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      handler.startSwipe(touchEvent);
      expect(handler.isActive()).toBe(true);
    });

    it('should handle touch move event', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 150, clientY: 100 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      expect(handler.getCurrentOffset()).toBe(50);
    });

    it('should handle touch end event', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 160, clientY: 100 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.direction).toBe('right');
    });
  });

  describe('Mouse Event Handling', () => {
    it('should handle mouse down event', () => {
      const handler = new SwipeGestureHandler();

      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100
      });

      handler.startSwipe(mouseEvent);
      expect(handler.isActive()).toBe(true);
    });

    it('should handle mouse move event', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100
      });
      handler.startSwipe(startEvent);

      const moveEvent = new MouseEvent('mousemove', {
        clientX: 160,
        clientY: 100
      });
      handler.updateSwipe(moveEvent);

      expect(handler.getCurrentOffset()).toBe(60);
    });

    it('should handle mouse up event', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100
      });
      handler.startSwipe(startEvent);

      const moveEvent = new MouseEvent('mousemove', {
        clientX: 160,
        clientY: 100
      });
      handler.updateSwipe(moveEvent);

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.direction).toBe('right');
    });
  });

  describe('Swipe Validation', () => {
    it('should reject swipe below threshold', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 130, clientY: 100 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).toBeNull();
    });

    it('should reject diagonal swipe', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 160, clientY: 160 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).toBeNull();
    });

    it('should reject swipe that takes too long', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 160, clientY: 100 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      vi.advanceTimersByTime(1100);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).toBeNull();
    });
  });

  describe('Velocity Calculation', () => {
    it('should detect fast swipe', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 200, clientY: 100 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      vi.advanceTimersByTime(50);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.isFast).toBe(true);
    });

    it('should detect slow swipe', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 160, clientY: 100 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).not.toBeNull();
      expect(swipeEvent?.isFast).toBe(false);
    });
  });

  describe('Progress Tracking', () => {
    it('should calculate progress during swipe', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 125, clientY: 100 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      expect(handler.getCurrentProgress()).toBeCloseTo(0.5, 1);
    });

    it('should cap progress at 1.0', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 300, clientY: 100 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      expect(handler.getCurrentProgress()).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple swipes in sequence', () => {
      const handler = new SwipeGestureHandler();

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
  });

  describe('Custom Configuration', () => {
    it('should respect custom threshold', () => {
      const handler = new SwipeGestureHandler({ threshold: 100 });

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 160, clientY: 100 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent).toBeNull();
    });
  });

  describe('Swipe Event Properties', () => {
    it('should include all required properties', () => {
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 160, clientY: 100 } as Touch]
      });
      handler.updateSwipe(moveEvent);

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
      const handler = new SwipeGestureHandler();

      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 150 } as Touch]
      });
      handler.startSwipe(startEvent);

      const moveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 160, clientY: 150 } as Touch]
      });
      handler.updateSwipe(moveEvent);

      vi.advanceTimersByTime(200);
      const swipeEvent = handler.endSwipe();

      expect(swipeEvent?.startX).toBe(100);
      expect(swipeEvent?.startY).toBe(150);
      expect(swipeEvent?.endX).toBe(160);
      expect(swipeEvent?.endY).toBe(150);
    });
  });
});
