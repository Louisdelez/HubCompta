// ============================================================================
// BILL CARD - Finance Hub
// Individual bill card with due date countdown
// Uses Catppuccin colors: red for overdue, yellow for due soon, green for paid
// ============================================================================

import { useState } from 'react';
import {
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Building,
} from 'lucide-react';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Bill } from './BillsPage';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BillCardProps {
  bill: Bill;
  onEdit: () => void;
  onPay: () => void;
  onUnpay: () => void;
  onDelete: () => void;
  isPayLoading?: boolean;
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

function getFrequencyLabel(frequency: Bill['frequency']): string {
  const labels: Record<string, string> = {
    once: 'Unique',
    weekly: 'Hebdomadaire',
    monthly: 'Mensuel',
    yearly: 'Annuel',
  };
  return labels[frequency] ?? frequency;
}

function getDueDateInfo(dueDate: string, isPaid: boolean): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (isPaid) {
    return {
      label: 'Payee',
      color: 'text-ctp-green',
      bgColor: 'bg-ctp-green/10',
    };
  }

  const date = new Date(dueDate);
  const today = new Date();
  const daysUntil = differenceInDays(date, today);

  if (isPast(date) && !isToday(date)) {
    const daysOverdue = Math.abs(daysUntil);
    return {
      label: `${daysOverdue} jour${daysOverdue > 1 ? 's' : ''} de retard`,
      color: 'text-ctp-red',
      bgColor: 'bg-ctp-red/10',
    };
  }

  if (isToday(date)) {
    return {
      label: "Aujourd'hui",
      color: 'text-ctp-red',
      bgColor: 'bg-ctp-red/10',
    };
  }

  if (daysUntil <= 3) {
    return {
      label: `Dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''}`,
      color: 'text-ctp-yellow',
      bgColor: 'bg-ctp-yellow/10',
    };
  }

  if (daysUntil <= 7) {
    return {
      label: `Dans ${daysUntil} jours`,
      color: 'text-ctp-peach',
      bgColor: 'bg-ctp-peach/10',
    };
  }

  return {
    label: `Dans ${daysUntil} jours`,
    color: 'text-ctp-subtext0',
    bgColor: 'bg-ctp-surface1',
  };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BillCard({
  bill,
  onEdit,
  onPay,
  onUnpay,
  onDelete,
  isPayLoading,
}: BillCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const dueDateInfo = getDueDateInfo(bill.dueDate, bill.isPaid);

  return (
    <div className={`card relative ${bill.isPaid ? 'opacity-75' : ''}`}>
      {/* Status Badge */}
      <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium ${dueDateInfo.bgColor} ${dueDateInfo.color}`}>
        {dueDateInfo.label}
      </div>

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start gap-3">
          {/* Category Icon */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: bill.category?.color
                ? `${bill.category.color}20`
                : 'var(--ctp-surface1)',
            }}
          >
            <span className="text-lg">
              {bill.category?.icon ?? <Building className="w-5 h-5" />}
            </span>
          </div>

          <div className="flex-1 min-w-0 pr-16">
            <h3 className="font-semibold truncate">{bill.name}</h3>
            {bill.vendor && (
              <p className="text-sm text-ctp-subtext0 truncate">{bill.vendor}</p>
            )}
          </div>
        </div>
      </div>

      {/* Amount */}
      <div className="text-2xl font-bold mb-4">
        {formatCurrency(bill.amount, bill.currency)}
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-ctp-subtext0">
          <Calendar className="w-4 h-4" />
          <span>
            Echeance: {format(new Date(bill.dueDate), 'dd MMM yyyy', { locale: fr })}
          </span>
        </div>

        {bill.frequency !== 'once' && (
          <div className="flex items-center gap-2 text-ctp-subtext0">
            <RefreshCw className="w-4 h-4" />
            <span>{getFrequencyLabel(bill.frequency)}</span>
          </div>
        )}

        {bill.category && (
          <div className="flex items-center gap-2 text-ctp-subtext0">
            <span>{bill.category.icon}</span>
            <span>{bill.category.name}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-4 border-t border-ctp-surface1 flex items-center gap-2">
        {bill.isPaid ? (
          <button
            onClick={onUnpay}
            className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            Marquer non payee
          </button>
        ) : (
          <button
            onClick={onPay}
            disabled={isPayLoading}
            className="flex-1 btn-primary text-sm flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Marquer payee
          </button>
        )}

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-lg hover:bg-ctp-surface1 transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 bottom-full mb-1 w-48 bg-ctp-surface0 rounded-lg shadow-lg border border-ctp-surface1 z-20">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-ctp-surface1 flex items-center gap-2 rounded-t-lg"
                >
                  <Edit className="w-4 h-4" />
                  Modifier
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-ctp-surface1 flex items-center gap-2 text-ctp-red rounded-b-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BillCard;
