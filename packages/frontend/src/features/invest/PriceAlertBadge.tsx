// ============================================================================
// PRICE ALERT BADGE - Finance Hub
// Badge indicator for positions with active alerts
// ============================================================================

import { Bell } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface PriceAlertBadgeProps {
  hasAlert?: boolean;
  alertCount?: number;
  size?: 'sm' | 'md';
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PriceAlertBadge({ hasAlert, alertCount = 0, size = 'sm' }: PriceAlertBadgeProps) {
  if (!hasAlert && alertCount === 0) return null;

  const count = alertCount || (hasAlert ? 1 : 0);
  const sizeClasses = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className="relative inline-flex" title={`${count} alerte(s) active(s)`}>
      <Bell className={`${sizeClasses} text-primary-500`} />
      {count > 1 && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary-500 text-[8px] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </div>
  );
}

export default PriceAlertBadge;
