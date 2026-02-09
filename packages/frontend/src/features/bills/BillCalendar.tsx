// ============================================================================
// BILL CALENDAR - Finance Hub
// Calendar view of bill due dates
// Uses Catppuccin colors: red for overdue, yellow for due soon, green for paid
// ============================================================================

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isPast,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BillCalendarProps {
  workspaceId: string;
}

interface CalendarBill {
  id: string;
  name: string;
  vendor: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  isPaid: boolean;
  isOverdue: boolean;
  category?: { name: string; color: string | null } | null;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    notation: 'compact',
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BillCalendar({ workspaceId }: BillCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Fetch calendar data
  const { data: bills, isLoading } = useQuery({
    queryKey: ['bills', workspaceId, 'calendar', format(monthStart, 'yyyy-MM')],
    queryFn: () =>
      api.get<CalendarBill[]>(
        `/workspaces/${workspaceId}/bills/calendar?startDate=${format(calendarStart, 'yyyy-MM-dd')}&endDate=${format(calendarEnd, 'yyyy-MM-dd')}`
      ),
    enabled: !!workspaceId,
  });

  // Group bills by date
  const billsByDate = useMemo(() => {
    const map = new Map<string, CalendarBill[]>();
    bills?.forEach((bill) => {
      const dateKey = format(new Date(bill.dueDate), 'yyyy-MM-dd');
      const existing = map.get(dateKey) ?? [];
      map.set(dateKey, [...existing, bill]);
    });
    return map;
  }, [bills]);

  // Generate calendar days
  const days = useMemo(() => {
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [calendarStart, calendarEnd]);

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-ctp-blue" />
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-ctp-surface1 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold min-w-[200px] text-center">
            {format(currentDate, 'MMMM yyyy', { locale: fr })}
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-ctp-surface1 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <button onClick={handleToday} className="btn-secondary text-sm">
          Aujourd'hui
        </button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-ctp-subtext0 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayBills = billsByDate.get(dateKey) ?? [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const isDayPast = isPast(day) && !isCurrentDay;

          return (
            <div
              key={dateKey}
              className={`min-h-[100px] p-2 rounded-lg border transition-colors ${
                isCurrentMonth
                  ? 'bg-ctp-surface0 border-ctp-surface1'
                  : 'bg-ctp-mantle border-ctp-surface0'
              } ${isCurrentDay ? 'ring-2 ring-ctp-blue' : ''}`}
            >
              {/* Day number */}
              <div
                className={`text-sm font-medium mb-1 ${
                  isCurrentMonth
                    ? isCurrentDay
                      ? 'text-ctp-blue'
                      : 'text-ctp-text'
                    : 'text-ctp-overlay0'
                }`}
              >
                {format(day, 'd')}
              </div>

              {/* Bills */}
              <div className="space-y-1">
                {dayBills.slice(0, 3).map((bill) => (
                  <div
                    key={bill.id}
                    className={`text-xs px-1.5 py-0.5 rounded truncate ${
                      bill.isPaid
                        ? 'bg-ctp-green/20 text-ctp-green'
                        : bill.isOverdue || (isDayPast && !bill.isPaid)
                        ? 'bg-ctp-red/20 text-ctp-red'
                        : isCurrentDay
                        ? 'bg-ctp-yellow/20 text-ctp-yellow'
                        : 'bg-ctp-surface1 text-ctp-text'
                    }`}
                    title={`${bill.name} - ${formatCurrency(bill.amount, bill.currency)}`}
                  >
                    {formatCurrency(bill.amount, bill.currency)} {bill.name}
                  </div>
                ))}
                {dayBills.length > 3 && (
                  <div className="text-xs text-ctp-subtext0 px-1">
                    +{dayBills.length - 3} de plus
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-ctp-surface1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-ctp-red/20" />
          <span className="text-xs text-ctp-subtext0">En retard</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-ctp-yellow/20" />
          <span className="text-xs text-ctp-subtext0">Aujourd'hui</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-ctp-green/20" />
          <span className="text-xs text-ctp-subtext0">Payee</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-ctp-surface1" />
          <span className="text-xs text-ctp-subtext0">A venir</span>
        </div>
      </div>
    </div>
  );
}

export default BillCalendar;
