// ============================================================================
// OVERDUE BANNER - Finance Hub
// Banner showing overdue bills count and amount
// Uses Catppuccin red color for emphasis
// ============================================================================

import { AlertTriangle, ChevronRight } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface OverdueBannerProps {
  count: number;
  amount: number;
  currency?: string;
  onClick: () => void;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(value);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function OverdueBanner({
  count,
  amount,
  currency = 'EUR',
  onClick,
}: OverdueBannerProps) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="w-full mb-6 p-4 bg-ctp-red/10 border border-ctp-red/30 rounded-xl flex items-center justify-between group hover:bg-ctp-red/15 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-ctp-red/20 rounded-lg">
          <AlertTriangle className="w-6 h-6 text-ctp-red" />
        </div>
        <div className="text-left">
          <p className="font-semibold text-ctp-red">
            {count} facture{count > 1 ? 's' : ''} en retard
          </p>
          <p className="text-sm text-ctp-red/80">
            Total de {formatCurrency(amount, currency)} a regulariser
          </p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-ctp-red group-hover:translate-x-1 transition-transform" />
    </button>
  );
}

export default OverdueBanner;
