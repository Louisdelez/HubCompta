// ============================================================================
// COLUMN MAPPING STEP - Finance Hub
// ============================================================================

import { useState } from 'react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface DetectedFormat {
  bank: string;
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  dateFormat: string;
  amountFormat: string;
  creditColumn?: string;
  debitColumn?: string;
}

interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  credit?: string;
  debit?: string;
}

interface ColumnMappingStepProps {
  headers: string[];
  detectedFormat: DetectedFormat | null | undefined;
  initialMapping?: ColumnMapping;
  onBack: () => void;
  onComplete: (mapping: ColumnMapping) => void;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

// Date formats for future use in format selection UI
export const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY (31-12-2024)' },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (31.12.2024)' },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ColumnMappingStep({
  headers,
  detectedFormat,
  initialMapping,
  onBack,
  onComplete,
}: ColumnMappingStepProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(() => {
    if (initialMapping) {
      return initialMapping;
    }
    const baseMapping: ColumnMapping = {
      date: detectedFormat?.dateColumn ?? '',
      amount: detectedFormat?.amountColumn ?? '',
      description: detectedFormat?.descriptionColumn ?? '',
    };
    if (detectedFormat?.creditColumn) {
      baseMapping.credit = detectedFormat.creditColumn;
    }
    if (detectedFormat?.debitColumn) {
      baseMapping.debit = detectedFormat.debitColumn;
    }
    return baseMapping;
  });
  const [useSplitAmount, setUseSplitAmount] = useState(
    detectedFormat?.amountFormat === 'split'
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    // Validate mapping
    if (!mapping.date) {
      setError('Sélectionnez la colonne de date');
      return;
    }
    if (!mapping.description) {
      setError('Sélectionnez la colonne de description');
      return;
    }
    if (useSplitAmount) {
      if (!mapping.credit || !mapping.debit) {
        setError('Sélectionnez les colonnes crédit et débit');
        return;
      }
    } else {
      if (!mapping.amount) {
        setError('Sélectionnez la colonne de montant');
        return;
      }
    }

    onComplete(mapping);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Mapper les colonnes</h2>
        {detectedFormat && (
          <div className="p-3 rounded-lg bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> Format détecté : {detectedFormat.bank}
          </div>
        )}
        {!detectedFormat && (
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Associez les colonnes de votre fichier aux champs requis.
          </p>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Date Column */}
        <div>
          <label className="label">
            Date <span className="text-danger-500">*</span>
          </label>
          <select
            value={mapping.date}
            onChange={(e) => setMapping({ ...mapping, date: e.target.value })}
            className="input"
          >
            <option value="">Sélectionner une colonne</option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </div>

        {/* Description Column */}
        <div>
          <label className="label">
            Description / Libellé <span className="text-danger-500">*</span>
          </label>
          <select
            value={mapping.description}
            onChange={(e) => setMapping({ ...mapping, description: e.target.value })}
            className="input"
          >
            <option value="">Sélectionner une colonne</option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </div>

        {/* Amount Type Toggle */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={useSplitAmount}
              onChange={(e) => setUseSplitAmount(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300"
            />
            <div>
              <p className="font-medium">Colonnes crédit/débit séparées</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Cochez si votre fichier a des colonnes séparées pour les crédits et débits
              </p>
            </div>
          </label>
        </div>

        {useSplitAmount ? (
          <>
            {/* Credit Column */}
            <div>
              <label className="label">
                Crédit <span className="text-danger-500">*</span>
              </label>
              <select
                value={mapping.credit ?? ''}
                onChange={(e) => setMapping({ ...mapping, credit: e.target.value })}
                className="input"
              >
                <option value="">Sélectionner une colonne</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>

            {/* Debit Column */}
            <div>
              <label className="label">
                Débit <span className="text-danger-500">*</span>
              </label>
              <select
                value={mapping.debit ?? ''}
                onChange={(e) => setMapping({ ...mapping, debit: e.target.value })}
                className="input"
              >
                <option value="">Sélectionner une colonne</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          /* Amount Column */
          <div>
            <label className="label">
              Montant <span className="text-danger-500">*</span>
            </label>
            <select
              value={mapping.amount}
              onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}
              className="input"
            >
              <option value="">Sélectionner une colonne</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Les montants négatifs seront traités comme des dépenses
            </p>
          </div>
        )}
      </div>

      {/* Column Preview */}
      {headers.length > 0 && (
        <div className="overflow-x-auto">
          <p className="text-sm font-medium mb-2">Colonnes disponibles :</p>
          <div className="flex flex-wrap gap-2">
            {headers.map((header) => (
              <span
                key={header}
                className={clsx(
                  'px-2 py-1 rounded text-sm',
                  header === mapping.date ||
                    header === mapping.amount ||
                    header === mapping.description ||
                    header === mapping.credit ||
                    header === mapping.debit
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                )}
              >
                {header}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex-1">
          Retour
        </button>
        <button onClick={handleSubmit} className="btn-primary flex-1">
          Continuer
        </button>
      </div>
    </div>
  );
}

export default ColumnMappingStep;
