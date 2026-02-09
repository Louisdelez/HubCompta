// ============================================================================
// UPCOMING OCCURRENCES - Finance Hub
// Preview of next recurrence executions
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Recurrence {
  id: string;
  name: string;
  template: {
    type: 'income' | 'expense';
    amount: number;
    description: string;
  };
}

interface UpcomingOccurrencesProps {
  workspaceId: string;
  recurrence: Recurrence;
  onClose: () => void;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getRelativeLabel(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff < 7) return `Dans ${diff} jours`;
  if (diff < 14) return 'La semaine prochaine';
  if (diff < 30) return `Dans ${Math.ceil(diff / 7)} semaines`;
  if (diff < 60) return 'Le mois prochain';
  return `Dans ${Math.ceil(diff / 30)} mois`;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function UpcomingOccurrences({
  workspaceId,
  recurrence,
  onClose,
}: UpcomingOccurrencesProps) {
  const { data: dates, isLoading } = useQuery({
    queryKey: ['recurrences', workspaceId, recurrence.id, 'upcoming'],
    queryFn: () =>
      api.get<string[]>(
        `/workspaces/${workspaceId}/recurrences/${recurrence.id}/upcoming?count=10`
      ),
  });

  const isExpense = recurrence.template.type === 'expense';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full animate-scale-in">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Prochaines executions</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{recurrence.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-700 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Amount preview */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900 dark:bg-gray-700/50 rounded-lg mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Montant par occurrence</p>
            <p
              className={`text-lg font-bold ${
                isExpense ? 'text-danger-600' : 'text-success-600'
              }`}
            >
              {isExpense ? '-' : '+'}
              {formatCurrency(Number(recurrence.template.amount))}
            </p>
          </div>

          {/* Dates list */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-1" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : dates && dates.length > 0 ? (
            <div className="space-y-2">
              {dates.map((date, index) => (
                <div
                  key={date}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 dark:hover:bg-gray-700/50"
                >
                  <div className="w-10 h-10 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium capitalize">{formatDate(date)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{getRelativeLabel(date)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Aucune occurrence programmee</p>
              <p className="text-sm mt-1">
                La recurrence est peut-etre terminee ou en pause
              </p>
            </div>
          )}

          {/* Total projection */}
          {dates && dates.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  Total sur {dates.length} occurrences
                </span>
                <span
                  className={`font-bold ${
                    isExpense ? 'text-danger-600' : 'text-success-600'
                  }`}
                >
                  {isExpense ? '-' : '+'}
                  {formatCurrency(Number(recurrence.template.amount) * dates.length)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary w-full">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpcomingOccurrences;
