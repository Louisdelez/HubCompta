// ============================================================================
// LOADING COMPONENT - Finance Hub
// Provides spinner, skeleton, and page loading states for Suspense fallbacks
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type LoadingSize = 'sm' | 'md' | 'lg' | 'xl';
export type LoadingVariant = 'spinner' | 'skeleton' | 'dots';

export interface LoadingProps {
  /** Size of the loading indicator */
  size?: LoadingSize | undefined;
  /** Visual variant */
  variant?: LoadingVariant | undefined;
  /** Optional text to display below the spinner */
  text?: string | undefined;
  /** Additional CSS classes */
  className?: string | undefined;
  /** Accessible label for screen readers */
  'aria-label'?: string | undefined;
}

export interface SkeletonProps {
  /** Width of the skeleton (CSS value or Tailwind class) */
  width?: string;
  /** Height of the skeleton (CSS value or Tailwind class) */
  height?: string;
  /** Make the skeleton circular */
  circle?: boolean;
  /** Number of skeleton lines to render */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

export interface PageLoadingProps {
  /** Text to show while loading */
  text?: string;
  /** Show skeleton instead of spinner */
  showSkeleton?: boolean;
}

// ----------------------------------------------------------------------------
// Size Mappings
// ----------------------------------------------------------------------------

const spinnerSizes: Record<LoadingSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const dotSizes: Record<LoadingSize, string> = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
};

const textSizes: Record<LoadingSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

// ----------------------------------------------------------------------------
// Spinner Component
// ----------------------------------------------------------------------------

function Spinner({ size = 'md', className }: { size?: LoadingSize; className?: string }) {
  return (
    <Loader2
      className={clsx(
        spinnerSizes[size],
        'animate-spin text-ctp-blue',
        className
      )}
      aria-hidden="true"
    />
  );
}

// ----------------------------------------------------------------------------
// Dots Component
// ----------------------------------------------------------------------------

function Dots({ size = 'md', className }: { size?: LoadingSize; className?: string }) {
  return (
    <div className={clsx('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={clsx(
            dotSizes[size],
            'rounded-full bg-ctp-blue animate-pulse',
          )}
          style={{ animationDelay: `${i * 150}ms` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Skeleton Component
// ----------------------------------------------------------------------------

export function Skeleton({
  width = 'w-full',
  height = 'h-4',
  circle = false,
  count = 1,
  className,
}: SkeletonProps) {
  const skeletonClass = clsx(
    'bg-ctp-surface1 animate-pulse',
    circle ? 'rounded-full' : 'rounded-lg',
    className
  );

  // If width/height are Tailwind classes (start with w- or h-), use them as classes
  const widthIsClass = width.startsWith('w-');
  const heightIsClass = height.startsWith('h-');

  const style = {
    width: widthIsClass ? undefined : width,
    height: heightIsClass ? undefined : height,
  };

  const classes = clsx(
    skeletonClass,
    widthIsClass && width,
    heightIsClass && height
  );

  if (count === 1) {
    return <div className={classes} style={style} aria-hidden="true" />;
  }

  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={classes} style={style} />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Card Skeleton Component
// ----------------------------------------------------------------------------

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'p-6 rounded-xl bg-ctp-mantle border border-ctp-surface0 space-y-4',
        className
      )}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <Skeleton width="w-10" height="h-10" circle />
        <div className="flex-1 space-y-2">
          <Skeleton width="w-1/3" height="h-4" />
          <Skeleton width="w-1/4" height="h-3" />
        </div>
      </div>
      <Skeleton count={3} height="h-3" />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Table Skeleton Component
// ----------------------------------------------------------------------------

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={clsx('space-y-3', className)} aria-hidden="true">
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-ctp-surface0">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width="w-24" height="h-4" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              width={colIdx === 0 ? 'w-32' : 'w-20'}
              height="h-4"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Dashboard Skeleton Component
// ----------------------------------------------------------------------------

export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6" aria-hidden="true">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-ctp-mantle border border-ctp-surface0"
          >
            <Skeleton width="w-1/3" height="h-3" className="mb-3" />
            <Skeleton width="w-1/2" height="h-8" />
          </div>
        ))}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-ctp-mantle border border-ctp-surface0">
          <Skeleton width="w-1/4" height="h-4" className="mb-4" />
          <Skeleton width="w-full" height="h-64" />
        </div>
        <div className="p-6 rounded-xl bg-ctp-mantle border border-ctp-surface0">
          <Skeleton width="w-1/4" height="h-4" className="mb-4" />
          <Skeleton width="w-full" height="h-64" />
        </div>
      </div>
      {/* Table section */}
      <div className="p-6 rounded-xl bg-ctp-mantle border border-ctp-surface0">
        <Skeleton width="w-1/5" height="h-5" className="mb-4" />
        <TableSkeleton />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main Loading Component
// ----------------------------------------------------------------------------

export function Loading({
  size = 'md',
  variant = 'spinner',
  text,
  className,
  'aria-label': ariaLabel = 'Loading',
}: LoadingProps) {
  return (
    <div
      className={clsx('flex flex-col items-center justify-center gap-2', className)}
      role="status"
      aria-label={ariaLabel}
    >
      {variant === 'spinner' && <Spinner size={size} />}
      {variant === 'dots' && <Dots size={size} />}
      {variant === 'skeleton' && (
        <div className="w-full max-w-xs">
          <Skeleton count={3} />
        </div>
      )}
      {text && (
        <p className={clsx('text-ctp-subtext0', textSizes[size])}>{text}</p>
      )}
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Page Loading Component (for Suspense fallback)
// ----------------------------------------------------------------------------

export function PageLoading({ text, showSkeleton = false }: PageLoadingProps) {
  if (showSkeleton) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loading size="lg" text={text} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Full Screen Loading
// ----------------------------------------------------------------------------

export function FullScreenLoading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ctp-base/80 backdrop-blur-sm"
      role="status"
      aria-label={text}
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-ctp-blue" aria-hidden="true" />
        <p className="text-lg font-medium text-ctp-text">{text}</p>
        <span className="sr-only">{text}</span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

export default Loading;
