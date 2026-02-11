// ============================================================================
// USE PULL TO REFRESH HOOK - HubCompta
// Touch-based pull-to-refresh functionality for mobile
// ============================================================================

import { useState, useCallback, useRef } from 'react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface PullToRefreshState {
  /** Whether the user is currently pulling */
  isPulling: boolean;
  /** Current pull distance in pixels */
  pullDistance: number;
  /** Whether the refresh threshold has been reached */
  isRefreshReady: boolean;
  /** Whether a refresh is in progress */
  isRefreshing: boolean;
  /** Pull progress as a percentage (0-100) */
  progress: number;
}

export interface PullToRefreshOptions {
  /** The element to attach the listener to (default: window) */
  containerRef?: React.RefObject<HTMLElement>;
  /** Minimum distance to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance (default: 150) */
  maxPull?: number;
  /** Resistance factor for overscroll (default: 2.5) */
  resistance?: number;
  /** Callback when refresh is triggered */
  onRefresh: () => Promise<void>;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
}

export interface UsePullToRefreshResult {
  state: PullToRefreshState;
  /** Props to spread on the container element */
  containerProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function usePullToRefresh(
  options: PullToRefreshOptions
): UsePullToRefreshResult {
  const {
    containerRef,
    threshold = 80,
    maxPull = 150,
    resistance = 2.5,
    onRefresh,
    enabled = true,
  } = options;

  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startY = useRef(0);
  const currentY = useRef(0);
  const isAtTop = useRef(false);

  // Check if we're at the top of the page
  const checkIsAtTop = useCallback((): boolean => {
    if (containerRef?.current) {
      return containerRef.current.scrollTop === 0;
    }
    return window.scrollY === 0;
  }, [containerRef]);

  // Handle touch start
  const handleTouchStart = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      if (!enabled || isRefreshing) return;

      isAtTop.current = checkIsAtTop();
      if (!isAtTop.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      startY.current = touch.clientY;
      currentY.current = startY.current;
    },
    [enabled, isRefreshing, checkIsAtTop]
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      if (!enabled || isRefreshing || !isAtTop.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      currentY.current = touch.clientY;
      const diff = currentY.current - startY.current;

      // Only allow pulling down
      if (diff <= 0) {
        setPullDistance(0);
        setIsPulling(false);
        return;
      }

      // Apply resistance for overscroll effect
      const resistedDistance = Math.min(diff / resistance, maxPull);

      // Prevent default scroll when pulling
      if (resistedDistance > 0 && checkIsAtTop()) {
        e.preventDefault();
      }

      setPullDistance(resistedDistance);
      setIsPulling(true);
    },
    [enabled, isRefreshing, resistance, maxPull, checkIsAtTop]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(async () => {
    if (!enabled || isRefreshing || !isPulling) return;

    setIsPulling(false);

    if (pullDistance >= threshold) {
      // Trigger refresh
      setIsRefreshing(true);
      setPullDistance(threshold / 2); // Keep some visual feedback

      try {
        await onRefresh();
      } catch (error) {
        console.error('[PullToRefresh] Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Reset
      setPullDistance(0);
    }
  }, [enabled, isRefreshing, isPulling, pullDistance, threshold, onRefresh]);

  // Manual refresh
  const refresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setPullDistance(threshold / 2);

    try {
      await onRefresh();
    } catch (error) {
      console.error('[PullToRefresh] Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, threshold, onRefresh]);

  // Calculate progress
  const progress = Math.min((pullDistance / threshold) * 100, 100);
  const isRefreshReady = pullDistance >= threshold;

  return {
    state: {
      isPulling,
      pullDistance,
      isRefreshReady,
      isRefreshing,
      progress,
    },
    containerProps: {
      onTouchStart: handleTouchStart as (e: React.TouchEvent) => void,
      onTouchMove: handleTouchMove as (e: React.TouchEvent) => void,
      onTouchEnd: handleTouchEnd as (e: React.TouchEvent) => void,
    },
    refresh,
  };
}

// ----------------------------------------------------------------------------
// Pull to Refresh Indicator Component Props
// ----------------------------------------------------------------------------

export interface PullToRefreshIndicatorProps {
  state: PullToRefreshState;
  className?: string;
}

export default usePullToRefresh;
