/**
 * Swipe Gesture Detection Utilities
 *
 * Provides utilities for detecting and handling swipe gestures on touch and mouse events.
 * Supports left/right swipes with configurable thresholds and callbacks.
 */

export interface SwipeOptions {
  /** Minimum distance (in pixels) to register as a swipe */
  minDistance?: number;
  /** Maximum time (in milliseconds) for a swipe */
  maxTime?: number;
  /** Callback when swipe left is detected */
  onSwipeLeft?: () => void;
  /** Callback when swipe right is detected */
  onSwipeRight?: () => void;
  /** Callback when swipe up is detected */
  onSwipeUp?: () => void;
  /** Callback when swipe down is detected */
  onSwipeDown?: () => void;
}

export interface SwipeState {
  startX: number;
  startY: number;
  startTime: number;
  isActive: boolean;
}

/**
 * Create a swipe gesture handler
 *
 * @param element - The element to attach swipe handlers to
 * @param options - Swipe detection options
 * @returns Function to remove event listeners
 */
export function createSwipeHandler(
  element: HTMLElement,
  options: SwipeOptions = {}
): () => void {
  const {
    minDistance = 50,
    maxTime = 500,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown
  } = options;

  const state: SwipeState = {
    startX: 0,
    startY: 0,
    startTime: 0,
    isActive: false
  };

  /**
   * Handle touch start
   */
  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    state.startX = touch.clientX;
    state.startY = touch.clientY;
    state.startTime = Date.now();
    state.isActive = true;
  }

  /**
   * Handle touch end
   */
  function handleTouchEnd(e: TouchEvent) {
    if (!state.isActive) return;

    const touch = e.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    const endTime = Date.now();

    detectSwipe(
      state.startX,
      state.startY,
      endX,
      endY,
      endTime - state.startTime,
      minDistance,
      maxTime,
      { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown }
    );

    state.isActive = false;
  }

  /**
   * Handle mouse down
   */
  function handleMouseDown(e: MouseEvent) {
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.startTime = Date.now();
    state.isActive = true;
  }

  /**
   * Handle mouse up
   */
  function handleMouseUp(e: MouseEvent) {
    if (!state.isActive) return;

    const endX = e.clientX;
    const endY = e.clientY;
    const endTime = Date.now();

    detectSwipe(
      state.startX,
      state.startY,
      endX,
      endY,
      endTime - state.startTime,
      minDistance,
      maxTime,
      { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown }
    );

    state.isActive = false;
  }

  // Attach event listeners
  element.addEventListener('touchstart', handleTouchStart, false);
  element.addEventListener('touchend', handleTouchEnd, false);
  element.addEventListener('mousedown', handleMouseDown, false);
  element.addEventListener('mouseup', handleMouseUp, false);

  // Return cleanup function
  return () => {
    element.removeEventListener('touchstart', handleTouchStart, false);
    element.removeEventListener('touchend', handleTouchEnd, false);
    element.removeEventListener('mousedown', handleMouseDown, false);
    element.removeEventListener('mouseup', handleMouseUp, false);
  };
}

/**
 * Detect swipe direction and call appropriate callback
 */
function detectSwipe(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  duration: number,
  minDistance: number,
  maxTime: number,
  callbacks: {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
  }
) {
  // Check if swipe was too slow
  if (duration > maxTime) return;

  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  // Check if swipe distance is sufficient
  if (absDeltaX < minDistance && absDeltaY < minDistance) return;

  // Determine swipe direction (horizontal takes precedence)
  if (absDeltaX > absDeltaY) {
    // Horizontal swipe
    if (deltaX < -minDistance) {
      // Swipe left
      callbacks.onSwipeLeft?.();
    } else if (deltaX > minDistance) {
      // Swipe right
      callbacks.onSwipeRight?.();
    }
  } else {
    // Vertical swipe
    if (deltaY < -minDistance) {
      // Swipe up
      callbacks.onSwipeUp?.();
    } else if (deltaY > minDistance) {
      // Swipe down
      callbacks.onSwipeDown?.();
    }
  }
}

/**
 * Svelte action for swipe detection
 *
 * Usage:
 * ```svelte
 * <div use:swipe={{ onSwipeLeft: () => {}, onSwipeRight: () => {} }}>
 *   Content
 * </div>
 * ```
 */
export function swipe(
  element: HTMLElement,
  options: SwipeOptions = {}
) {
  const cleanup = createSwipeHandler(element, options);

  return {
    destroy() {
      cleanup();
    },
    update(newOptions: SwipeOptions) {
      cleanup();
      createSwipeHandler(element, newOptions);
    }
  };
}

