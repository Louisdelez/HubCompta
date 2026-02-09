// ============================================================================
// SCHEDULED LIST - Finance Hub
// List of scheduled transactions
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { ScheduledCard } from './ScheduledCard';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ScheduledTransaction {
  id: string;
  accountId: string;
  categoryId?: string | null;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  scheduledDate: string;
  notes?: string | null;
  isExecuted: boolean;
  executedAt?: string | null;
  transactionId?: string | null;
  account: {
    id: string;
    name: string;
    type: string;
    currency: string;
  };
  category?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

interface ScheduledListProps {
  scheduled: ScheduledTransaction[];
  workspaceId: string;
  onEdit: (scheduled: ScheduledTransaction) => void;
  counts: {
    upcoming: number;
    overdue: number;
    executed: number;
  };
}

type FilterType = 'all' | 'upcoming' | 'overdue' | 'executed' | 'income' | 'expense';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function isOverdue(date: string): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target < now;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ScheduledList({ scheduled, workspaceId, onEdit, counts }: ScheduledListProps) {
  const [filter, setFilter] = useState<FilterType>('upcoming');

  // Filter scheduled transactions
  const filteredScheduled = scheduled.filter((s) => {
    switch (filter) {
      case 'upcoming':
        return !s.isExecuted && !isOverdue(s.scheduledDate);
      case 'overdue':
        return !s.isExecuted && isOverdue(s.scheduledDate);
      case 'executed':
        return s.isExecuted;
      case 'income':
        return !s.isExecuted && s.type === 'income';
      case 'expense':
        return !s.isExecuted && s.type === 'expense';
      default:
        return true;
    }
  });

  // Group by status for display
  const overdueScheduled = filteredScheduled.filter((s) => !s.isExecuted && isOverdue(s.scheduledDate));
  const upcomingScheduled = filteredScheduled.filter((s) => !s.isExecuted && !isOverdue(s.scheduledDate));
  const executedScheduled = filteredScheduled.filter((s) => s.isExecuted);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { value: 'all', label: 'Toutes', count: scheduled.length },
          { value: 'upcoming', label: 'A venir', count: counts.upcoming, icon: Clock },
          { value: 'overdue', label: 'En retard', count: counts.overdue, icon: AlertTriangle, color: 'text-ctp-red' },
          { value: 'executed', label: 'Executees', count: counts.executed, icon: CheckCircle },
          { value: 'income', label: 'Revenus', icon: ArrowUpCircle, color: 'text-ctp-green' },
          { value: 'expense', label: 'Depenses', icon: ArrowDownCircle, color: 'text-ctp-red' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as FilterType)}
            className={clsx(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2',
              filter === f.value
                ? 'bg-ctp-blue text-ctp-base'
                : 'bg-ctp-surface1 text-ctp-subtext1 hover:bg-ctp-surface2'
            )}
          >
            {f.icon && <f.icon className={clsx('w-4 h-4', f.color)} />}
            {f.label}
            {f.count !== undefined && (
              <span
                className={clsx(
                  'ml-1 px-2 py-0.5 rounded-full text-xs',
                  filter === f.value ? 'bg-ctp-base/20' : 'bg-ctp-surface2'
                )}
              >
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Results */}
      {filteredScheduled.length > 0 ? (
        <div className="space-y-8">
          {/* Overdue Section */}
          {overdueScheduled.length > 0 && filter !== 'executed' && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-ctp-red" />
                En retard
                <span className="text-sm font-normal text-ctp-subtext0">
                  ({overdueScheduled.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {overdueScheduled.map((s) => (
                  <ScheduledCard
                    key={s.id}
                    scheduled={s}
                    workspaceId={workspaceId}
                    onEdit={() => onEdit(s)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming Section */}
          {upcomingScheduled.length > 0 && filter !== 'executed' && filter !== 'overdue' && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-ctp-blue" />
                A venir
                <span className="text-sm font-normal text-ctp-subtext0">
                  ({upcomingScheduled.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingScheduled.map((s) => (
                  <ScheduledCard
                    key={s.id}
                    scheduled={s}
                    workspaceId={workspaceId}
                    onEdit={() => onEdit(s)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Executed Section */}
          {executedScheduled.length > 0 && (filter === 'all' || filter === 'executed') && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-ctp-green" />
                Executees
                <span className="text-sm font-normal text-ctp-subtext0">
                  ({executedScheduled.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {executedScheduled.map((s) => (
                  <ScheduledCard
                    key={s.id}
                    scheduled={s}
                    workspaceId={workspaceId}
                    onEdit={() => onEdit(s)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Clock className="w-12 h-12 mx-auto mb-4 text-ctp-overlay1" />
          <p className="text-ctp-subtext0">
            {filter === 'all'
              ? 'Aucune transaction programmee'
              : `Aucune transaction ${
                  filter === 'upcoming'
                    ? 'a venir'
                    : filter === 'overdue'
                      ? 'en retard'
                      : filter === 'executed'
                        ? 'executee'
                        : filter === 'income'
                          ? 'de revenu'
                          : 'de depense'
                }`}
          </p>
        </div>
      )}
    </div>
  );
}

export default ScheduledList;
