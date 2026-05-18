/**
 * Swipe Gesture Handler
 *
 * Provides comprehensive touch and mouse event handling for swipe detection.
 * Supports both touch and mouse events with proper edge case handling.
 *
 * Features:
 * - Touch and mouse event support
 * - Swipe direction detection (left/right)
 * - Diagonal swipe filtering
 * - Fast swipe detection
 * - Velocity calculation
 * - Accessibility support
 */

export interface SwipeConfig {
  /** Minimum distance to trigger swipe (pixels) */
  threshold?: number;
  /** Maximum vertical movement allowed (pixels) */
  verticalThreshold?: number;
  /** Minimum velocity for fast swipe (pixels/ms) */
  velocityThreshold?: number;
  /** Time window for velocity calculation (ms) */
  velocityWindow?: number;
}

export interface SwipeEvent {
  /** Direction of swipe: 'left' or 'right' */
  direction: 'left' | 'right';
  /** Distance traveled (pixels) */
  distance: number;
  /** Velocity of swipe (pixels/ms) */
  velocity: number;
  /** Whether this was a fast swipe */
  isFast: boolean;
  /** Starting X coordinate */
  startX: number;
  /** Starting Y coordinate */
  startY: number;
  /** Ending X coordinate */
  endX: number;
  /** Ending Y coordinate */
  endY: number;
  /** Duration of swipe (ms) */
  duration: number;
}

export class SwipeGestureHandler {
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private currentX = 0;
  private currentY = 0;
  private isTracking = false;
  private config: Required<SwipeConfig>;

  constructor(config: SwipeConfig = {}) {
    this.config = {
      threshold: config.threshold ?? 50,
      verticalThreshold: config.verticalThreshold ?? 50,
      velocityThreshold: config.velocityThreshold ?? 0.5,
      velocityWindow: config.velocityWindow ?? 100
    };
  }

  /**
   * Start tracking a swipe gesture
   */
  startSwipe(e: TouchEvent | MouseEvent): void {
    const point = this.getEventPoint(e);
    if (!point) return;

    this.startX = point.x;
    this.startY = point.y;
    this.currentX = point.x;
    this.currentY = point.y;
    this.startTime = Date.now();
    this.isTracking = true;
  }

  /**
   * Update swipe position during movement
   */
  updateSwipe(e: TouchEvent | MouseEvent): void {
    if (!this.isTracking) return;

    const point = this.getEventPoint(e);
    if (!point) return;

    this.currentX = point.x;
    this.currentY = point.y;
  }

  /**
   * End swipe gesture and return swipe event if valid
   */
  endSwipe(): SwipeEvent | null {
    if (!this.isTracking) return null;

    this.isTracking = false;

    const deltaX = this.currentX - this.startX;
    const deltaY = this.currentY - this.startY;
    const duration = Date.now() - this.startTime;

    // Check if swipe is valid
    if (!this.isValidSwipe(deltaX, deltaY, duration)) {
      return null;
    }

    const distance = Math.abs(deltaX);
    const velocity = distance / Math.max(duration, 1);
    const isFast = velocity >= this.config.velocityThreshold;
    const direction = deltaX > 0 ? 'right' : 'left';

    return {
      direction,
      distance,
      velocity,
      isFast,
      startX: this.startX,
      startY: this.startY,
      endX: this.currentX,
      endY: this.currentY,
      duration
    };
  }

  /**
   * Get current swipe offset (for visual feedback during swipe)
   */
  getCurrentOffset(): number {
    if (!this.isTracking) return 0;
    return this.currentX - this.startX;
  }

  /**
   * Get current swipe progress (0-1)
   */
  getCurrentProgress(): number {
    if (!this.isTracking) return 0;
    const offset = Math.abs(this.getCurrentOffset());
    return Math.min(offset / this.config.threshold, 1);
  }

  /**
   * Check if swipe is valid
   */
  private isValidSwipe(deltaX: number, deltaY: number, duration: number): boolean {
    // Must have minimum horizontal movement
    if (Math.abs(deltaX) < this.config.threshold) {
      return false;
    }

    // Must not have too much vertical movement (diagonal swipe filter)
    if (Math.abs(deltaY) > this.config.verticalThreshold) {
      return false;
    }

    // Must complete within reasonable time (prevent accidental swipes)
    if (duration > 1000) {
      return false;
    }

    return true;
  }

  /**
   * Get event point from touch or mouse event
   */
  private getEventPoint(e: TouchEvent | MouseEvent): { x: number; y: number } | null {
    if (e instanceof TouchEvent) {
      if (e.touches.length === 0) return null;
      return {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    } else if (e instanceof MouseEvent) {
      return {
        x: e.clientX,
        y: e.clientY
      };
    }
    return null;
  }

  /**
   * Reset handler state
   */
  reset(): void {
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.isTracking = false;
  }

  /**
   * Check if currently tracking a swipe
   */
  isActive(): boolean {
    return this.isTracking;
  }
}

/**
 * Create a swipe gesture handler with default config
 */
export function createSwipeHandler(config?: SwipeConfig): SwipeGestureHandler {
  return new SwipeGestureHandler(config);
}
