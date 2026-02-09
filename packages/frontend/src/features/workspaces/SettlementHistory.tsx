// ============================================================================
// SETTLEMENT HISTORY - Finance Hub
// Display historical settlement data with member breakdown
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { clsx } from 'clsx';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { SettlementHistoryChart } from './SettlementHistoryChart';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface MemberBreakdown {
  userId: string;
  userName: string;
  spent: number;
  owes: number;
}

interface MonthData {
  month: string;
  totalExpenses: number;
  memberBreakdown: MemberBreakdown[];
}

interface HistoryResponse {
  months: MonthData[];
}

interface SettlementHistoryProps {
  currency?: string;
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

function formatMonthLabel(month: string): string {
  try {
    const date = parseISO(`${month}-01`);
    return format(date, 'MMMM yyyy', { locale: fr });
  } catch {
    return month;
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Avatar colors using Catppuccin accent colors
const AVATAR_COLORS = [
  'bg-ctp-blue',
  'bg-ctp-green',
  'bg-ctp-mauve',
  'bg-ctp-peach',
  'bg-ctp-pink',
  'bg-ctp-teal',
  'bg-ctp-sapphire',
  'bg-ctp-lavender',
  'bg-ctp-yellow',
  'bg-ctp-flamingo',
  'bg-ctp-sky',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? 'bg-ctp-blue';
}

// ----------------------------------------------------------------------------
// Month Detail Card Component
// ----------------------------------------------------------------------------

interface MonthCardProps {
  monthData: MonthData;
  currency: string;
  isCurrentMonth: boolean;
  previousMonthTotal: number | undefined;
}

function MonthCard({
  monthData,
  currency,
  isCurrentMonth,
  previousMonthTotal,
}: MonthCardProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentMonth);

  // Calculate trend vs previous month
  const trend = useMemo(() => {
    if (!previousMonthTotal || previousMonthTotal === 0) return null;
    return (
      ((monthData.totalExpenses - previousMonthTotal) / previousMonthTotal) *
      100
    );
  }, [monthData.totalExpenses, previousMonthTotal]);

  return (
    <div
      className={clsx(
        'rounded-lg border transition-all duration-200',
        isCurrentMonth
          ? 'bg-ctp-blue/10 border-ctp-blue'
          : 'bg-ctp-surface0 border-ctp-surface1 hover:border-ctp-surface2'
      )}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              isCurrentMonth ? 'bg-ctp-blue text-ctp-base' : 'bg-ctp-surface1'
            )}
          >
            <Users className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="font-medium capitalize">{formatMonthLabel(monthData.month)}</p>
            <p className="text-sm text-ctp-subtext0">
              {monthData.memberBreakdown.length} membre
              {monthData.memberBreakdown.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold">
              {formatCurrency(monthData.totalExpenses, currency)}
            </p>
            {trend !== null && (
              <p
                className={clsx(
                  'text-xs flex items-center justify-end gap-1',
                  trend >= 0 ? 'text-ctp-red' : 'text-ctp-green'
                )}
              >
                {trend >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {trend >= 0 ? '+' : ''}
                {trend.toFixed(1)}%
              </p>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-ctp-overlay1" />
          ) : (
            <ChevronDown className="w-5 h-5 text-ctp-overlay1" />
          )}
        </div>
      </button>

      {/* Expanded Content - Member Breakdown */}
      {isExpanded && monthData.memberBreakdown.length > 0 && (
        <div className="px-4 pb-4 border-t border-ctp-surface1 mt-2 pt-4">
          <div className="space-y-3">
            {monthData.memberBreakdown.map((member) => {
              const owesClass =
                member.owes > 0
                  ? 'text-ctp-red'
                  : member.owes < 0
                  ? 'text-ctp-green'
                  : 'text-ctp-subtext0';

              return (
                <div
                  key={member.userId}
                  className="flex items-center justify-between p-3 bg-ctp-mantle rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center text-ctp-base text-sm font-medium',
                        getAvatarColor(member.userName)
                      )}
                    >
                      {getInitials(member.userName)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{member.userName}</p>
                      <p className="text-xs text-ctp-subtext0">
                        A depense {formatCurrency(member.spent, currency)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={clsx('font-semibold text-sm', owesClass)}>
                      {member.owes > 0 ? 'Doit ' : member.owes < 0 ? 'Recoit ' : ''}
                      {member.owes !== 0
                        ? formatCurrency(Math.abs(member.owes), currency)
                        : 'Equilibre'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fair share info */}
          {monthData.memberBreakdown.length > 1 && (
            <div className="mt-3 pt-3 border-t border-ctp-surface1 text-center">
              <p className="text-sm text-ctp-subtext0">
                Part equitable par membre:{' '}
                <span className="font-medium text-ctp-text">
                  {formatCurrency(
                    monthData.totalExpenses / monthData.memberBreakdown.length,
                    currency
                  )}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------

export function SettlementHistory({ currency = 'EUR' }: SettlementHistoryProps) {
  const { currentWorkspaceId: workspaceId } = useWorkspace();

  const { data: historyResponse, isLoading } = useQuery({
    queryKey: ['settlement-history', workspaceId],
    queryFn: () =>
      api
        .get<{ data: HistoryResponse }>(
          `/workspaces/${workspaceId}/settlement/history?months=6`
        )
        .then((res) => res.data),
    enabled: !!workspaceId,
  });

  const history = useMemo(
    () => historyResponse?.months ?? [],
    [historyResponse?.months]
  );

  // Calculate stats
  const stats = useMemo(() => {
    if (history.length === 0) {
      return { total: 0, average: 0, trend: 0 };
    }

    const total = history.reduce((sum, h) => sum + h.totalExpenses, 0);
    const average = total / history.length;

    const currentMonth = history[0];
    const lastMonth = history[1];
    const trend =
      currentMonth && lastMonth && lastMonth.totalExpenses > 0
        ? ((currentMonth.totalExpenses - lastMonth.totalExpenses) /
            lastMonth.totalExpenses) *
          100
        : 0;

    return { total, average, trend };
  }, [history]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-ctp-surface1 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-ctp-surface1 rounded-lg animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-ctp-surface1 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 text-ctp-overlay1 mx-auto mb-3" />
        <p className="text-ctp-subtext0">Aucun historique disponible</p>
        <p className="text-sm text-ctp-overlay1 mt-1">
          L&apos;historique apparaitra une fois que vous aurez des depenses
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-sm text-ctp-subtext0">Total 6 mois</p>
          <p className="text-2xl font-bold">{formatCurrency(stats.total, currency)}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-ctp-subtext0">Moyenne mensuelle</p>
          <p className="text-2xl font-bold">{formatCurrency(stats.average, currency)}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-ctp-subtext0">Tendance</p>
          <div className="flex items-center justify-center gap-2">
            {stats.trend >= 0 ? (
              <TrendingUp className="h-5 w-5 text-ctp-red" />
            ) : (
              <TrendingDown className="h-5 w-5 text-ctp-green" />
            )}
            <p
              className={clsx(
                'text-2xl font-bold',
                stats.trend >= 0 ? 'text-ctp-red' : 'text-ctp-green'
              )}
            >
              {stats.trend >= 0 ? '+' : ''}
              {stats.trend.toFixed(1)}%
            </p>
          </div>
          <p className="text-xs text-ctp-subtext0 mt-1">vs mois precedent</p>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h3 className="font-semibold mb-4">Evolution des depenses par membre</h3>
        <SettlementHistoryChart data={history} currency={currency} />
      </div>

      {/* History List with Member Breakdown */}
      <div className="card">
        <h3 className="font-semibold mb-4">Detail mensuel</h3>
        <div className="space-y-3">
          {history.map((monthData, index) => (
            <MonthCard
              key={monthData.month}
              monthData={monthData}
              currency={currency}
              isCurrentMonth={index === 0}
              previousMonthTotal={history[index + 1]?.totalExpenses}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default SettlementHistory;
