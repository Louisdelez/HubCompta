// ============================================================================
// UPCOMING WIDGET - Finance Hub Dashboard
// Displays upcoming scheduled transactions and bills
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Calendar, Receipt, Clock, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import type { WidgetProps } from './index';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface UpcomingItem {
  id: string;
  type: 'scheduled' | 'bill' | 'recurrence';
  name: string;
  description?: string;
  amount: number;
  dueDate: string;
  isOverdue?: boolean;
  category?: {
    name: string;
    icon: string | null;
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Demain';
  if (diffDays < 7) return `Dans ${diffDays} jours`;

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function getDaysUntil(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function UpcomingWidget({ workspaceId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['upcoming-widget', workspaceId],
    queryFn: async () => {
      const [bills, scheduled] = await Promise.all([
        api.get<UpcomingItem[]>(`/workspaces/${workspaceId}/bills?isPaid=false&limit=5`).catch(() => []),
        api.get<UpcomingItem[]>(`/workspaces/${workspaceId}/scheduled?isExecuted=false&limit=5`).catch(() => []),
      ]);

      // Combine and sort by date
      const items = [
        ...((bills as UpcomingItem[]) || []).map((b) => ({ ...b, type: 'bill' as const })),
        ...((scheduled as UpcomingItem[]) || []).map((s) => ({ ...s, type: 'scheduled' as const })),
      ].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      return { items: items.slice(0, 6), total: items.length };
    },
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="animate-pulse space-y-3 flex-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 bg-ctp-surface1 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-ctp-surface1 rounded w-3/4 mb-1" />
                <div className="h-3 bg-ctp-surface1 rounded w-1/2" />
              </div>
              <div className="h-4 bg-ctp-surface1 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { items = [], total = 0 } = data ?? {};
  const overdueCount = items.filter((item) => getDaysUntil(item.dueDate) < 0).length;

  return (
    <div className="h-full flex flex-col">
      {/* Overdue Alert */}
      {overdueCount > 0 && (
        <div className="mb-3 p-2 bg-ctp-red/10 border border-ctp-red/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-ctp-red flex-shrink-0" />
          <p className="text-xs text-ctp-red">
            {overdueCount} paiement{overdueCount > 1 ? 's' : ''} en retard
          </p>
        </div>
      )}

      {/* Upcoming List */}
      <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
        {items.length === 0 ? (
          <div className="text-center py-4">
            <Calendar className="w-8 h-8 mx-auto text-ctp-overlay1 mb-2" />
            <p className="text-sm text-ctp-subtext0">Rien de prevu</p>
          </div>
        ) : (
          items.map((item) => {
            const daysUntil = getDaysUntil(item.dueDate);
            const isOverdue = daysUntil < 0;
            const isUrgent = daysUntil <= 3 && daysUntil >= 0;

            return (
              <Link
                key={`${item.type}-${item.id}`}
                to={item.type === 'bill' ? '/bills' : '/scheduled'}
                className={clsx(
                  'flex items-center gap-2 p-2 rounded-lg transition-colors',
                  isOverdue
                    ? 'bg-ctp-red/5 hover:bg-ctp-red/10'
                    : 'hover:bg-ctp-mantle'
                )}
              >
                {/* Icon */}
                <div
                  className={clsx(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    isOverdue
                      ? 'bg-ctp-red/20 text-ctp-red'
                      : isUrgent
                        ? 'bg-ctp-yellow/20 text-ctp-yellow'
                        : 'bg-ctp-surface1 text-ctp-overlay1'
                  )}
                >
                  {item.category?.icon ? (
                    <span className="text-sm">{item.category.icon}</span>
                  ) : item.type === 'bill' ? (
                    <Receipt className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ctp-text truncate">
                    {item.name}
                  </p>
                  <p className={clsx(
                    'text-xs',
                    isOverdue ? 'text-ctp-red' : isUrgent ? 'text-ctp-yellow' : 'text-ctp-subtext0'
                  )}>
                    {formatDate(item.dueDate)}
                  </p>
                </div>

                {/* Amount */}
                <p className="text-sm font-semibold text-ctp-red flex-shrink-0">
                  -{formatCurrency(Math.abs(Number(item.amount)))}
                </p>
              </Link>
            );
          })
        )}
      </div>

      {/* View All Link */}
      {total > 6 && (
        <Link
          to="/bills"
          className="mt-2 pt-2 border-t border-ctp-surface1 text-center text-sm text-ctp-blue hover:text-ctp-sapphire transition-colors"
        >
          Voir tout ({total})
        </Link>
      )}
    </div>
  );
}

export default UpcomingWidget;
