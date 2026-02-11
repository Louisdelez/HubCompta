// ============================================================================
// RATE LIMIT ALERT COMPONENT - HubCompta
// Displays user-friendly rate limit error messages
// ============================================================================

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface RateLimitAlertProps {
  /** Whether rate limit is active */
  isActive: boolean;
  /** Seconds remaining until retry is allowed */
  retryAfter: number;
  /** Custom message to display */
  message?: string;
  /** Callback when countdown reaches zero */
  onExpire?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Variant style */
  variant?: 'banner' | 'toast' | 'inline';
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RateLimitAlert({
  isActive,
  retryAfter,
  message,
  onExpire,
  className,
  variant = 'inline',
}: RateLimitAlertProps) {
  const [timeRemaining, setTimeRemaining] = useState(retryAfter);

  // Update time remaining when retryAfter changes
  useEffect(() => {
    setTimeRemaining(retryAfter);
  }, [retryAfter]);

  // Countdown timer
  useEffect(() => {
    if (!isActive || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timer);
          onExpire?.();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeRemaining, onExpire]);

  if (!isActive || timeRemaining <= 0) {
    return null;
  }

  const formattedTime = formatTime(timeRemaining);
  const displayMessage =
    message || 'Trop de tentatives. Veuillez patienter avant de reessayer.';

  const baseStyles =
    'flex items-center gap-3 rounded-lg p-4 text-sm font-medium';

  const variantStyles = {
    banner: 'bg-ctp-yellow/20 text-ctp-yellow border border-ctp-yellow/30 w-full',
    toast:
      'bg-ctp-surface0 text-ctp-text border border-ctp-surface2 shadow-lg fixed bottom-4 right-4 max-w-sm z-50',
    inline: 'bg-ctp-yellow/10 text-ctp-yellow border border-ctp-yellow/20',
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={clsx(baseStyles, variantStyles[variant], className)}
    >
      {/* Warning Icon */}
      <svg
        className="h-5 w-5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>

      {/* Message and Countdown */}
      <div className="flex-1">
        <p className="mb-1">{displayMessage}</p>
        <p className="text-ctp-subtext0">
          Reessayez dans{' '}
          <span className="font-mono font-bold text-ctp-text">
            {formattedTime}
          </span>
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center">
        <div className="relative h-10 w-10">
          <svg className="h-10 w-10 -rotate-90 transform" viewBox="0 0 36 36">
            <circle
              className="text-ctp-surface1"
              strokeWidth="3"
              stroke="currentColor"
              fill="none"
              r="16"
              cx="18"
              cy="18"
            />
            <circle
              className="text-ctp-yellow transition-all duration-1000"
              strokeWidth="3"
              strokeDasharray={`${(timeRemaining / retryAfter) * 100}, 100`}
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              r="16"
              cx="18"
              cy="18"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
            {timeRemaining}
          </span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconde${seconds !== 1 ? 's' : ''}`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

export default RateLimitAlert;
