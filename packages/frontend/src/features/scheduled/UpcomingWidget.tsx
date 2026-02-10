// ============================================================================
// UPCOMING WIDGET - Finance Hub
// Widget showing next 5 scheduled transactions
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Clock, ArrowRight, ArrowUpCircle, ArrowDownCircle, Calendar } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ScheduledTransaction {
  id: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  scheduledDate: string;
  account: {
    id: string;
    name: string;
  };
  category?: {
    id: string;
    name: string;
    icon: string | null;
  } | null;
}

interface UpcomingWidgetProps {
  workspaceId: string;
  limit?: number;
  days?: number;
  showLink?: boolean;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

function getDaysUntil(date: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getCountdownBadge(date: string): { text: string; className: string } {
  const days = getDaysUntil(date);

  if (days < 0) {
    return { text: 'En retard', className: 'bg-ctp-red/20 text-ctp-red' };
  }
  if (days === 0) {
    return { text: "Aujourd'hui", className: 'bg-ctp-peach/20 text-ctp-peach' };
  }
  if (days === 1) {
    return { text: 'Demain', className: 'bg-ctp-yellow/20 text-ctp-yellow' };
  }
  if (days <= 7) {
    return { text: `${days}j`, className: 'bg-ctp-blue/20 text-ctp-blue' };
  }
  return { text: `${days}j`, className: 'bg-ctp-surface2 text-ctp-subtext0' };
}

function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function UpcomingWidget({
  workspaceId,
  limit = 5,
  days = 30,
  showLink = true,
}: UpcomingWidgetProps) {
  // Fetch upcoming scheduled transactions
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['scheduled', workspaceId, 'upcoming', days, limit],
    queryFn: () =>
      api.get<ScheduledTransaction[]>(
        `/workspaces/${workspaceId}/scheduled/upcoming?days=${days}&limit=${limit}`
      ),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-ctp-surface1 rounded w-1/3" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-ctp-surface1 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-ctp-blue" />
          Transactions programmees
        </h3>
        {showLink && transactions.length > 0 && (
          <Link
            to={`/workspaces/${workspaceId}/scheduled`}
            className="text-sm text-ctp-blue hover:underline flex items-center gap-1"
          >
            Voir tout <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Content */}
      {transactions.length > 0 ? (
        <div className="space-y-2">
          {transactions.map((t) => {
            const badge = getCountdownBadge(t.scheduledDate);
            const isExpense = t.type === 'expense';
            const amount = typeof t.amount === 'number' ? t.amount : Number(t.amount);

            return (
              <div
                key={t.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-ctp-surface0 transition-colors"
              >
                {/* Icon */}
                <span className="text-xl shrink-0">
                  {t.category?.icon ? (
                    <span>{t.category.icon}</span>
                  ) : isExpense ? (
                    <ArrowDownCircle className="w-5 h-5 text-ctp-red" />
                  ) : (
                    <ArrowUpCircle className="w-5 h-5 text-ctp-green" />
                  )}
                </span>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.description}</p>
                  <div className="flex items-center gap-2 text-xs text-ctp-subtext0">
                    <Calendar className="w-3 h-3" />
                    {formatShortDate(t.scheduledDate)}
                    <span className="text-ctp-overlay0">|</span>
                    {t.account.name}
                  </div>
                </div>

                {/* Countdown */}
                <span className={clsx('px-2 py-1 rounded-full text-xs font-medium shrink-0', badge.className)}>
                  {badge.text}
                </span>

                {/* Amount */}
                <span
                  className={clsx(
                    'font-bold shrink-0',
                    isExpense ? 'text-ctp-red' : 'text-ctp-green'
                  )}
                >
                  {isExpense ? '-' : '+'}
                  {formatCurrency(amount, t.currency)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6">
          <Clock className="w-10 h-10 mx-auto mb-2 text-ctp-overlay1" />
          <p className="text-ctp-subtext0 text-sm">Aucune transaction programmee</p>
          {showLink && (
            <Link
              to={`/workspaces/${workspaceId}/scheduled`}
              className="text-sm text-ctp-blue hover:underline mt-2 inline-block"
            >
              Programmer une transaction
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default UpcomingWidget;
