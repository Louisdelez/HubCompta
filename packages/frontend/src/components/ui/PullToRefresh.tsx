// ============================================================================
// PULL TO REFRESH COMPONENT - HubCompta
// Visual indicator for pull-to-refresh functionality
// ============================================================================

import { clsx } from 'clsx';
import { RefreshCw, ArrowDown, Check } from 'lucide-react';
import type { PullToRefreshState } from '@/hooks/usePullToRefresh';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface PullToRefreshIndicatorProps {
  /** Pull to refresh state from usePullToRefresh hook */
  state: PullToRefreshState;
  /** Additional CSS classes */
  className?: string;
}

// ----------------------------------------------------------------------------
// Pull to Refresh Indicator
// ----------------------------------------------------------------------------

export function PullToRefreshIndicator({
  state,
  className,
}: PullToRefreshIndicatorProps) {
  const { isPulling, pullDistance, isRefreshReady, isRefreshing, progress } = state;

  // Don't render if not active
  if (!isPulling && !isRefreshing && pullDistance === 0) {
    return null;
  }

  return (
    <div
      className={clsx(
        'fixed top-0 left-0 right-0 z-50',
        'flex items-center justify-center',
        'pointer-events-none',
        'transition-opacity duration-200',
        isPulling || isRefreshing ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{
        height: `${Math.max(pullDistance, 0)}px`,
        paddingTop: 'env(safe-area-inset-top)',
      }}
      role="status"
      aria-live="polite"
      aria-label={
        isRefreshing
          ? 'Actualisation en cours'
          : isRefreshReady
          ? 'Relacher pour actualiser'
          : 'Tirer pour actualiser'
      }
    >
      <div
        className={clsx(
          'w-10 h-10 rounded-full',
          'bg-ctp-surface0 border border-ctp-surface1',
          'flex items-center justify-center',
          'shadow-lg',
          'transition-all duration-200',
          isRefreshReady && !isRefreshing && 'bg-ctp-blue/20 border-ctp-blue/30'
        )}
        style={{
          transform: `scale(${Math.min(progress / 100, 1)})`,
          opacity: Math.min(progress / 50, 1),
        }}
      >
        {isRefreshing ? (
          <RefreshCw className="w-5 h-5 text-ctp-blue animate-spin" />
        ) : isRefreshReady ? (
          <Check className="w-5 h-5 text-ctp-blue" />
        ) : (
          <ArrowDown
            className={clsx(
              'w-5 h-5 text-ctp-subtext1',
              'transition-transform duration-200'
            )}
            style={{
              transform: `rotate(${progress * 1.8}deg)`,
            }}
          />
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pull to Refresh Container
// Wraps content and provides pull-to-refresh functionality
// ----------------------------------------------------------------------------

interface PullToRefreshContainerProps {
  /** Children to render inside the container */
  children: React.ReactNode;
  /** Pull to refresh state from usePullToRefresh hook */
  state: PullToRefreshState;
  /** Container props from usePullToRefresh hook */
  containerProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  /** Additional CSS classes */
  className?: string;
}

export function PullToRefreshContainer({
  children,
  state,
  containerProps,
  className,
}: PullToRefreshContainerProps) {
  const { pullDistance, isRefreshing } = state;

  return (
    <div
      className={clsx('relative min-h-full', className)}
      {...containerProps}
    >
      {/* Indicator */}
      <PullToRefreshIndicator state={state} />

      {/* Content wrapper with transform */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `translateY(${pullDistance}px)`,
          willChange: isRefreshing ? 'transform' : 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Inline Refresh Indicator (alternative style)
// ----------------------------------------------------------------------------

interface InlineRefreshIndicatorProps {
  state: PullToRefreshState;
  className?: string;
}

export function InlineRefreshIndicator({
  state,
  className,
}: InlineRefreshIndicatorProps) {
  const { isPulling, isRefreshing, isRefreshReady, progress } = state;

  if (!isPulling && !isRefreshing) {
    return null;
  }

  return (
    <div
      className={clsx(
        'flex items-center justify-center gap-2 py-3',
        'text-sm text-ctp-subtext1',
        className
      )}
    >
      <div
        className={clsx(
          'w-5 h-5 transition-all duration-200',
          isRefreshing && 'animate-spin'
        )}
        style={{
          transform: !isRefreshing ? `rotate(${progress * 3.6}deg)` : undefined,
        }}
      >
        <RefreshCw
          className={clsx(
            'w-5 h-5',
            isRefreshReady || isRefreshing ? 'text-ctp-blue' : 'text-ctp-subtext0'
          )}
        />
      </div>
      <span>
        {isRefreshing
          ? 'Actualisation...'
          : isRefreshReady
          ? 'Relacher pour actualiser'
          : 'Tirer pour actualiser'}
      </span>
    </div>
  );
}

export default PullToRefreshIndicator;
