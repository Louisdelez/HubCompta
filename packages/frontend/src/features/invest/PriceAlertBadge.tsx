// ============================================================================
// PRICE ALERT BADGE - Finance Hub
// Badge indicator for positions with active alerts
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface PriceAlert {
  id: string;
  isTriggered: boolean;
}

interface PriceAlertBadgeProps {
  positionId?: string;
  symbol?: string;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PriceAlertBadge({
  positionId,
  symbol,
  size = 'sm',
  showCount = true,
  className,
}: PriceAlertBadgeProps) {
  const { currentWorkspace } = useWorkspace();

  const { data: alerts } = useQuery({
    queryKey: ['price-alerts', currentWorkspace?.id, positionId, symbol],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (positionId) params.set('positionId', positionId);
      if (symbol) params.set('symbol', symbol);
      const queryString = params.toString();
      const url = `/workspaces/${currentWorkspace?.id}/alerts/price${queryString ? `?${queryString}` : ''}`;
      const response = await api.get<{ data: PriceAlert[] }>(url);
      return response.data;
    },
    enabled: !!currentWorkspace?.id && !!(positionId || symbol),
  });

  // Count active (not triggered) alerts
  const activeAlerts = alerts?.filter((a) => !a.isTriggered) || [];
  const triggeredAlerts = alerts?.filter((a) => a.isTriggered) || [];
  const activeCount = activeAlerts.length;
  const triggeredCount = triggeredAlerts.length;
  const totalCount = activeCount + triggeredCount;

  if (totalCount === 0) return null;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const countSizeClasses = {
    sm: 'h-3 w-3 text-[8px]',
    md: 'h-4 w-4 text-[10px]',
    lg: 'h-5 w-5 text-xs',
  };

  // Use yellow for triggered alerts, blue for active
  const hasTriggered = triggeredCount > 0;
  const iconColor = hasTriggered ? 'text-ctp-yellow' : 'text-ctp-blue';
  const countBgColor = hasTriggered ? 'bg-ctp-yellow' : 'bg-ctp-blue';

  const title = activeCount > 0 && triggeredCount > 0
    ? `${activeCount} alerte(s) active(s), ${triggeredCount} declenchee(s)`
    : activeCount > 0
      ? `${activeCount} alerte(s) active(s)`
      : `${triggeredCount} alerte(s) declenchee(s)`;

  return (
    <div className={cn('relative inline-flex', className)} title={title}>
      <Bell className={cn(sizeClasses[size], iconColor)} />
      {showCount && totalCount > 1 && (
        <span
          className={cn(
            'absolute -top-1 -right-1 flex items-center justify-center rounded-full font-bold text-ctp-base',
            countSizeClasses[size],
            countBgColor
          )}
        >
          {totalCount > 9 ? '9+' : totalCount}
        </span>
      )}
      {showCount && totalCount === 1 && hasTriggered && (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full',
            countBgColor
          )}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Static Badge (no data fetching, for use with already-loaded data)
// ----------------------------------------------------------------------------

interface StaticPriceAlertBadgeProps {
  alertCount?: number;
  hasTriggered?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StaticPriceAlertBadge({
  alertCount = 0,
  hasTriggered = false,
  size = 'sm',
  className,
}: StaticPriceAlertBadgeProps) {
  if (alertCount === 0) return null;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const countSizeClasses = {
    sm: 'h-3 w-3 text-[8px]',
    md: 'h-4 w-4 text-[10px]',
    lg: 'h-5 w-5 text-xs',
  };

  const iconColor = hasTriggered ? 'text-ctp-yellow' : 'text-ctp-blue';
  const countBgColor = hasTriggered ? 'bg-ctp-yellow' : 'bg-ctp-blue';

  return (
    <div
      className={cn('relative inline-flex', className)}
      title={`${alertCount} alerte(s)`}
    >
      <Bell className={cn(sizeClasses[size], iconColor)} />
      {alertCount > 1 && (
        <span
          className={cn(
            'absolute -top-1 -right-1 flex items-center justify-center rounded-full font-bold text-ctp-base',
            countSizeClasses[size],
            countBgColor
          )}
        >
          {alertCount > 9 ? '9+' : alertCount}
        </span>
      )}
      {alertCount === 1 && hasTriggered && (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full',
            countBgColor
          )}
        />
      )}
    </div>
  );
}

export default PriceAlertBadge;
