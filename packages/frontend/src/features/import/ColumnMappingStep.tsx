// ============================================================================
// COLUMN MAPPING STEP - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      setError(t('import.mapping.selectDateError'));
      return;
    }
    if (!mapping.description) {
      setError(t('import.mapping.selectDescriptionError'));
      return;
    }
    if (useSplitAmount) {
      if (!mapping.credit || !mapping.debit) {
        setError(t('import.mapping.selectCreditDebitError'));
        return;
      }
    } else {
      if (!mapping.amount) {
        setError(t('import.mapping.selectAmountError'));
        return;
      }
    }

    onComplete(mapping);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">{t('import.mapping.title')}</h2>
        {detectedFormat && (
          <div className="p-3 rounded-lg bg-ctp-green/10 text-ctp-green border border-ctp-green/30 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> {t('import.mapping.detectedFormat')} : {detectedFormat.bank}
          </div>
        )}
        {!detectedFormat && (
          <p className="text-ctp-subtext0 text-sm">
            {t('import.mapping.mapColumnsDescription')}
          </p>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red border border-ctp-red/30 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Date Column */}
        <div>
          <label className="label">
            {t('import.mapping.date')} <span className="text-ctp-red">*</span>
          </label>
          <select
            value={mapping.date}
            onChange={(e) => setMapping({ ...mapping, date: e.target.value })}
            className="input"
          >
            <option value="">{t('import.mapping.selectColumn')}</option>
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
            {t('import.mapping.description')} <span className="text-ctp-red">*</span>
          </label>
          <select
            value={mapping.description}
            onChange={(e) => setMapping({ ...mapping, description: e.target.value })}
            className="input"
          >
            <option value="">{t('import.mapping.selectColumn')}</option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </div>

        {/* Amount Type Toggle */}
        <div className="p-4 bg-ctp-surface0 rounded-lg">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={useSplitAmount}
              onChange={(e) => setUseSplitAmount(e.target.checked)}
              className="w-5 h-5 rounded border-ctp-surface1"
            />
            <div>
              <p className="font-medium">{t('import.mapping.separateCreditDebit')}</p>
              <p className="text-sm text-ctp-subtext0">
                {t('import.mapping.separateCreditDebitDescription')}
              </p>
            </div>
          </label>
        </div>

        {useSplitAmount ? (
          <>
            {/* Credit Column */}
            <div>
              <label className="label">
                {t('import.mapping.credit')} <span className="text-ctp-red">*</span>
              </label>
              <select
                value={mapping.credit ?? ''}
                onChange={(e) => setMapping({ ...mapping, credit: e.target.value })}
                className="input"
              >
                <option value="">{t('import.mapping.selectColumn')}</option>
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
                {t('import.mapping.debit')} <span className="text-ctp-red">*</span>
              </label>
              <select
                value={mapping.debit ?? ''}
                onChange={(e) => setMapping({ ...mapping, debit: e.target.value })}
                className="input"
              >
                <option value="">{t('import.mapping.selectColumn')}</option>
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
              {t('import.mapping.amount')} <span className="text-ctp-red">*</span>
            </label>
            <select
              value={mapping.amount}
              onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}
              className="input"
            >
              <option value="">{t('import.mapping.selectColumn')}</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
            <p className="text-xs text-ctp-subtext0 mt-1">
              {t('import.mapping.negativeAmountsNote')}
            </p>
          </div>
        )}
      </div>

      {/* Column Preview */}
      {headers.length > 0 && (
        <div className="overflow-x-auto">
          <p className="text-sm font-medium mb-2">{t('import.mapping.availableColumns')}</p>
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
                    ? 'bg-ctp-blue/20 text-ctp-blue'
                    : 'bg-ctp-surface1 text-ctp-subtext0'
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
          {t('import.mapping.back')}
        </button>
        <button onClick={handleSubmit} className="btn-primary flex-1">
          {t('import.mapping.continue')}
        </button>
      </div>
    </div>
  );
}

export default ColumnMappingStep;
