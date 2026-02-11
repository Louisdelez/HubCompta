// ============================================================================
// USE SWIPE GESTURE HOOK - HubCompta
// Touch-based swipe gesture detection for mobile navigation
// ============================================================================

import { useState, useCallback, useRef } from 'react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

export interface SwipeState {
  /** Current swipe direction */
  direction: SwipeDirection;
  /** Whether a swipe is in progress */
  isSwiping: boolean;
  /** Horizontal swipe distance */
  deltaX: number;
  /** Vertical swipe distance */
  deltaY: number;
  /** Swipe velocity (pixels per ms) */
  velocity: number;
  /** Progress as percentage for the active direction (0-100) */
  progress: number;
}

export interface SwipeGestureOptions {
  /** Minimum distance to trigger a swipe (default: 50) */
  threshold?: number;
  /** Minimum velocity to trigger a swipe (default: 0.3) */
  velocityThreshold?: number;
  /** Whether to prevent default touch behavior (default: false) */
  preventDefault?: boolean;
  /** Element ref to attach listeners to (default: window) */
  containerRef?: React.RefObject<HTMLElement>;
  /** Callbacks for swipe directions */
  onSwipeLeft?: (() => void) | undefined;
  onSwipeRight?: (() => void) | undefined;
  onSwipeUp?: (() => void) | undefined;
  onSwipeDown?: (() => void) | undefined;
  /** Called during swipe with current state */
  onSwiping?: ((state: SwipeState) => void) | undefined;
  /** Called when swipe ends */
  onSwipeEnd?: ((state: SwipeState) => void) | undefined;
  /** Whether swipe gestures are enabled (default: true) */
  enabled?: boolean;
  /** Edge width for edge swipes (default: 20) */
  edgeWidth?: number;
  /** Only trigger on edge swipes (default: false) */
  edgeOnly?: boolean;
}

export interface UseSwipeGestureResult {
  state: SwipeState;
  /** Props to spread on the container element */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: (e: React.TouchEvent) => void;
  };
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useSwipeGesture(
  options: SwipeGestureOptions = {}
): UseSwipeGestureResult {
  const {
    threshold = 50,
    velocityThreshold = 0.3,
    preventDefault = false,
    // containerRef is defined but reserved for future use with ref-based listeners
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwiping,
    onSwipeEnd,
    enabled = true,
    edgeWidth = 20,
    edgeOnly = false,
  } = options;

  const [state, setState] = useState<SwipeState>({
    direction: null,
    isSwiping: false,
    deltaX: 0,
    deltaY: 0,
    velocity: 0,
    progress: 0,
  });

  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const isTracking = useRef(false);
  const isEdgeSwipe = useRef(false);

  // Determine dominant direction
  const getDirection = useCallback(
    (deltaX: number, deltaY: number): SwipeDirection => {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Need to exceed some minimum to determine direction
      if (absX < 10 && absY < 10) return null;

      // Horizontal swipe
      if (absX > absY) {
        return deltaX > 0 ? 'right' : 'left';
      }
      // Vertical swipe
      return deltaY > 0 ? 'down' : 'up';
    },
    []
  );

  // Handle touch start
  const handleTouchStart = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      if (!touch) return;

      startX.current = touch.clientX;
      startY.current = touch.clientY;
      startTime.current = Date.now();
      isTracking.current = true;

      // Check if this is an edge swipe
      const screenWidth = window.innerWidth;
      isEdgeSwipe.current =
        touch.clientX < edgeWidth || touch.clientX > screenWidth - edgeWidth;

      // If edge only mode, only track edge swipes
      if (edgeOnly && !isEdgeSwipe.current) {
        isTracking.current = false;
        return;
      }

      setState({
        direction: null,
        isSwiping: true,
        deltaX: 0,
        deltaY: 0,
        velocity: 0,
        progress: 0,
      });
    },
    [enabled, edgeWidth, edgeOnly]
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      if (!enabled || !isTracking.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;
      const direction = getDirection(deltaX, deltaY);

      // Calculate velocity
      const elapsed = Date.now() - startTime.current;
      const velocity =
        elapsed > 0
          ? Math.sqrt(deltaX * deltaX + deltaY * deltaY) / elapsed
          : 0;

      // Calculate progress based on direction
      let progress = 0;
      if (direction === 'left' || direction === 'right') {
        progress = Math.min((Math.abs(deltaX) / threshold) * 100, 100);
      } else if (direction === 'up' || direction === 'down') {
        progress = Math.min((Math.abs(deltaY) / threshold) * 100, 100);
      }

      const newState: SwipeState = {
        direction,
        isSwiping: true,
        deltaX,
        deltaY,
        velocity,
        progress,
      };

      setState(newState);
      onSwiping?.(newState);

      // Prevent default if configured and swiping horizontally
      if (
        preventDefault &&
        direction &&
        (direction === 'left' || direction === 'right')
      ) {
        e.preventDefault();
      }
    },
    [enabled, getDirection, threshold, onSwiping, preventDefault]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      if (!enabled || !isTracking.current) return;

      isTracking.current = false;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;
      const direction = getDirection(deltaX, deltaY);

      // Calculate final velocity
      const elapsed = Date.now() - startTime.current;
      const velocity =
        elapsed > 0
          ? Math.sqrt(deltaX * deltaX + deltaY * deltaY) / elapsed
          : 0;

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Check if swipe meets threshold
      const meetsThreshold =
        (direction === 'left' || direction === 'right'
          ? absX >= threshold
          : absY >= threshold) || velocity >= velocityThreshold;

      const finalState: SwipeState = {
        direction,
        isSwiping: false,
        deltaX,
        deltaY,
        velocity,
        progress: meetsThreshold ? 100 : 0,
      };

      // Trigger callbacks if threshold met
      if (meetsThreshold && direction) {
        switch (direction) {
          case 'left':
            onSwipeLeft?.();
            break;
          case 'right':
            onSwipeRight?.();
            break;
          case 'up':
            onSwipeUp?.();
            break;
          case 'down':
            onSwipeDown?.();
            break;
        }
      }

      onSwipeEnd?.(finalState);

      // Reset state
      setState({
        direction: null,
        isSwiping: false,
        deltaX: 0,
        deltaY: 0,
        velocity: 0,
        progress: 0,
      });
    },
    [
      enabled,
      getDirection,
      threshold,
      velocityThreshold,
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
      onSwipeEnd,
    ]
  );

  // Handle touch cancel
  const handleTouchCancel = useCallback(() => {
    isTracking.current = false;
    setState({
      direction: null,
      isSwiping: false,
      deltaX: 0,
      deltaY: 0,
      velocity: 0,
      progress: 0,
    });
  }, []);

  return {
    state,
    handlers: {
      onTouchStart: handleTouchStart as (e: React.TouchEvent) => void,
      onTouchMove: handleTouchMove as (e: React.TouchEvent) => void,
      onTouchEnd: handleTouchEnd as (e: React.TouchEvent) => void,
      onTouchCancel: handleTouchCancel as (e: React.TouchEvent) => void,
    },
  };
}

// ----------------------------------------------------------------------------
// Navigation Swipe Hook
// Specialized hook for back/forward navigation
// ----------------------------------------------------------------------------

export interface UseNavigationSwipeOptions {
  /** Called when user swipes to go back */
  onBack?: () => void;
  /** Called when user swipes to go forward */
  onForward?: () => void;
  /** Whether navigation swipe is enabled (default: true) */
  enabled?: boolean;
}

export function useNavigationSwipe(
  options: UseNavigationSwipeOptions = {}
): UseSwipeGestureResult {
  const { onBack, onForward, enabled = true } = options;

  return useSwipeGesture({
    enabled,
    edgeOnly: true,
    edgeWidth: 30,
    threshold: 80,
    onSwipeRight: onBack, // Swipe right from left edge = go back
    onSwipeLeft: onForward, // Swipe left from right edge = go forward
  });
}

// ----------------------------------------------------------------------------
// Swipe to Dismiss Hook
// For modals and bottom sheets
// ----------------------------------------------------------------------------

export interface UseSwipeToDismissOptions {
  /** Called when modal should be dismissed */
  onDismiss: () => void;
  /** Direction to swipe for dismissal (default: 'down') */
  direction?: 'down' | 'up';
  /** Whether dismiss is enabled (default: true) */
  enabled?: boolean;
  /** Threshold as percentage of container height (default: 25) */
  thresholdPercent?: number;
}

export interface UseSwipeToDismissResult {
  state: SwipeState;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: (e: React.TouchEvent) => void;
  };
  /** Current offset to apply to the element */
  offset: number;
  /** Whether the dismiss threshold has been reached */
  shouldDismiss: boolean;
}

export function useSwipeToDismiss(
  options: UseSwipeToDismissOptions
): UseSwipeToDismissResult {
  const {
    onDismiss,
    direction = 'down',
    enabled = true,
    thresholdPercent = 25,
  } = options;

  const [offset, setOffset] = useState(0);
  const [shouldDismiss, setShouldDismiss] = useState(false);

  const handleSwiping = useCallback(
    (state: SwipeState) => {
      if (direction === 'down' && state.deltaY > 0) {
        setOffset(state.deltaY);
        setShouldDismiss(state.progress >= thresholdPercent);
      } else if (direction === 'up' && state.deltaY < 0) {
        setOffset(state.deltaY);
        setShouldDismiss(state.progress >= thresholdPercent);
      }
    },
    [direction, thresholdPercent]
  );

  const handleSwipeEnd = useCallback(
    (state: SwipeState) => {
      const shouldTrigger =
        direction === 'down'
          ? state.deltaY > 0 && state.progress >= thresholdPercent
          : state.deltaY < 0 && state.progress >= thresholdPercent;

      if (shouldTrigger) {
        onDismiss();
      } else {
        // Reset offset
        setOffset(0);
        setShouldDismiss(false);
      }
    },
    [direction, thresholdPercent, onDismiss]
  );

  const swipe = useSwipeGesture({
    enabled,
    threshold: 100,
    onSwiping: handleSwiping,
    onSwipeEnd: handleSwipeEnd,
    [direction === 'down' ? 'onSwipeDown' : 'onSwipeUp']: () => {
      // Will be handled by onSwipeEnd
    },
  });

  return {
    ...swipe,
    offset,
    shouldDismiss,
  };
}

export default useSwipeGesture;
