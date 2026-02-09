// ============================================================================
// TAX BRACKETS - Finance Hub
// Visual display of French tax brackets (bareme progressif)
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Check, Info } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
}

interface TaxBracketsProps {
  taxableIncome: number;
  estimatedTax: number;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

// Bracket colors from Catppuccin
const bracketColors = [
  'bg-ctp-green',  // 0%
  'bg-ctp-teal',   // 11%
  'bg-ctp-blue',   // 30%
  'bg-ctp-mauve',  // 41%
  'bg-ctp-red',    // 45%
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TaxBrackets({ taxableIncome, estimatedTax }: TaxBracketsProps) {
  const { currentWorkspaceId: workspaceId } = useWorkspace();

  // Fetch brackets
  const { data: brackets } = useQuery({
    queryKey: ['tax', workspaceId, 'brackets'],
    queryFn: () => api.get<TaxBracket[]>(`/workspaces/${workspaceId}/tax/brackets`),
    enabled: !!workspaceId,
  });

  // Calculate tax contribution per bracket
  const calculateBracketDetails = (brackets: TaxBracket[]) => {
    const details: {
      bracket: TaxBracket;
      taxableInBracket: number;
      taxAmount: number;
      isActive: boolean;
    }[] = [];

    let remainingIncome = taxableIncome;

    for (const bracket of brackets) {
      const bracketSize = bracket.max !== null
        ? bracket.max - bracket.min
        : Infinity;

      const taxableInBracket = Math.max(0, Math.min(remainingIncome, bracketSize));
      const taxAmount = taxableInBracket * bracket.rate;
      const isActive = taxableIncome > bracket.min;

      details.push({ bracket, taxableInBracket, taxAmount, isActive });
      remainingIncome -= taxableInBracket;
    }

    return details;
  };

  const bracketDetails = brackets ? calculateBracketDetails(brackets) : [];

  // Find the current marginal bracket
  const currentBracketIndex = bracketDetails.findIndex(
    (d, i) => {
      const next = bracketDetails[i + 1];
      return d.isActive && (!next || !next.isActive);
    }
  );

  return (
    <div className="space-y-6">
      {/* Info Header */}
      <div className="card bg-ctp-blue/5 border border-ctp-blue/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-ctp-blue flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-ctp-blue">Bareme progressif de l'impot sur le revenu 2024</h3>
            <p className="text-sm text-ctp-subtext0 mt-1">
              L'impot est calcule par tranches : chaque tranche de revenu est imposee a son propre taux.
              Votre revenu imposable de <strong>{formatCurrency(taxableIncome)}</strong> genere un impot
              estime de <strong className="text-ctp-mauve">{formatCurrency(estimatedTax)}</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Brackets Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ctp-surface1">
              <th className="text-left py-3 px-4 font-medium text-ctp-subtext0">Tranche</th>
              <th className="text-center py-3 px-4 font-medium text-ctp-subtext0">Taux</th>
              <th className="text-right py-3 px-4 font-medium text-ctp-subtext0">Imposable</th>
              <th className="text-right py-3 px-4 font-medium text-ctp-subtext0">Impot</th>
            </tr>
          </thead>
          <tbody>
            {bracketDetails.map((detail, index) => {
              const isCurrentBracket = index === currentBracketIndex;

              return (
                <tr
                  key={index}
                  className={`border-b border-ctp-surface0 last:border-0 ${
                    isCurrentBracket ? 'bg-ctp-mauve/5' : ''
                  } ${!detail.isActive ? 'opacity-50' : ''}`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${bracketColors[index] ?? 'bg-ctp-overlay1'}`} />
                      <span>
                        {formatCurrency(detail.bracket.min)}
                        {' - '}
                        {detail.bracket.max !== null
                          ? formatCurrency(detail.bracket.max)
                          : '+'}
                      </span>
                      {isCurrentBracket && (
                        <span className="ml-2 text-ctp-mauve">
                          <Check className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-sm font-medium ${bracketColors[index] ?? 'bg-ctp-overlay1'} text-white`}>
                      {formatPercent(detail.bracket.rate)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {detail.taxableInBracket > 0 ? formatCurrency(detail.taxableInBracket) : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium">
                    {detail.taxAmount > 0 ? formatCurrency(detail.taxAmount) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-ctp-surface0">
              <td colSpan={3} className="py-3 px-4 font-medium text-right">
                Total impot
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-ctp-mauve">
                {formatCurrency(estimatedTax)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Visual Breakdown */}
      <div className="card">
        <h3 className="font-medium mb-4">Repartition visuelle</h3>
        <div className="flex rounded-lg overflow-hidden h-8">
          {bracketDetails
            .filter((d) => d.taxableInBracket > 0)
            .map((detail, index) => {
              const width = (detail.taxableInBracket / taxableIncome) * 100;
              const originalIndex = bracketDetails.indexOf(detail);

              return (
                <div
                  key={index}
                  className={`${bracketColors[originalIndex] ?? 'bg-ctp-overlay1'} flex items-center justify-center text-white text-xs font-medium transition-all`}
                  style={{ width: `${width}%` }}
                  title={`${formatCurrency(detail.taxableInBracket)} a ${formatPercent(detail.bracket.rate)}`}
                >
                  {width > 10 && formatPercent(detail.bracket.rate)}
                </div>
              );
            })}
        </div>
        <div className="flex justify-between mt-2 text-sm text-ctp-subtext0">
          <span>0 EUR</span>
          <span>{formatCurrency(taxableIncome)}</span>
        </div>
      </div>

      {/* Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h4 className="font-medium mb-2">Optimisez votre TMI</h4>
          <p className="text-sm text-ctp-subtext0">
            Votre taux marginal d'imposition (TMI) est le taux de la tranche la plus haute.
            Chaque euro de deduction vous fait economiser{' '}
            <strong className="text-ctp-green">
              {formatPercent(bracketDetails[currentBracketIndex]?.bracket.rate ?? 0)}
            </strong>{' '}
            d'impot.
          </p>
        </div>
        <div className="card">
          <h4 className="font-medium mb-2">Quotient familial</h4>
          <p className="text-sm text-ctp-subtext0">
            Ce calcul est pour une personne seule (1 part). Le quotient familial permet de
            reduire l'impot pour les couples et familles avec enfants.
          </p>
        </div>
      </div>
    </div>
  );
}

export default TaxBrackets;
