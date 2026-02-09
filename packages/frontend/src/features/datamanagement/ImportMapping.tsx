// ============================================================================
// IMPORT MAPPING - Finance Hub
// Map CSV columns to transaction fields
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, AlertCircle, HelpCircle } from 'lucide-react';
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

interface InitialMapping {
  date: string;
  amount: string;
  description: string;
  credit?: string;
  debit?: string;
}

interface ImportMappingProps {
  headers: string[];
  detectedFormat: DetectedFormat | null | undefined;
  initialMapping: InitialMapping | undefined;
  onBack: () => void;
  onComplete: (mapping: {
    date: string;
    amount: string;
    description: string;
    credit?: string;
    debit?: string;
  }) => void;
}

interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  credit: string;
  debit: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ImportMapping({
  headers,
  detectedFormat,
  initialMapping,
  onBack,
  onComplete,
}: ImportMappingProps) {
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: initialMapping?.date ?? detectedFormat?.dateColumn ?? '',
    amount: initialMapping?.amount ?? detectedFormat?.amountColumn ?? '',
    description: initialMapping?.description ?? detectedFormat?.descriptionColumn ?? '',
    credit: initialMapping?.credit ?? detectedFormat?.creditColumn ?? '',
    debit: initialMapping?.debit ?? detectedFormat?.debitColumn ?? '',
  });

  const [useSeparateColumns, setUseSeparateColumns] = useState(
    !!(mapping.credit || mapping.debit)
  );

  const [dateFormat, setDateFormat] = useState(detectedFormat?.dateFormat ?? 'DD/MM/YYYY');

  // Update separate columns toggle when mapping changes
  useEffect(() => {
    if (mapping.credit || mapping.debit) {
      setUseSeparateColumns(true);
    }
  }, [mapping.credit, mapping.debit]);

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = () => {
    // Required fields
    if (!mapping.date || !mapping.description) return false;

    // Need either amount column OR both credit and debit columns
    if (useSeparateColumns) {
      return !!(mapping.credit && mapping.debit);
    }
    return !!mapping.amount;
  };

  const handleSubmit = () => {
    if (!isValid()) return;

    const result: {
      date: string;
      amount: string;
      description: string;
      credit?: string;
      debit?: string;
    } = {
      date: mapping.date,
      amount: useSeparateColumns ? '' : mapping.amount,
      description: mapping.description,
    };

    if (useSeparateColumns) {
      result.credit = mapping.credit;
      result.debit = mapping.debit;
    }

    onComplete(result);
  };

  const fields = [
    {
      id: 'date' as const,
      label: 'Date',
      required: true,
      description: 'Colonne contenant la date de la transaction',
    },
    {
      id: 'description' as const,
      label: 'Description',
      required: true,
      description: 'Colonne contenant le libelle ou la description',
    },
  ];

  const amountFields = useSeparateColumns
    ? [
        {
          id: 'credit' as const,
          label: 'Credit',
          required: true,
          description: 'Colonne des entrees (montants positifs)',
        },
        {
          id: 'debit' as const,
          label: 'Debit',
          required: true,
          description: 'Colonne des sorties (montants negatifs)',
        },
      ]
    : [
        {
          id: 'amount' as const,
          label: 'Montant',
          required: true,
          description: 'Colonne contenant le montant',
        },
      ];

  const dateFormats = [
    { value: 'DD/MM/YYYY', label: 'JJ/MM/AAAA (01/12/2024)' },
    { value: 'MM/DD/YYYY', label: 'MM/JJ/AAAA (12/01/2024)' },
    { value: 'YYYY-MM-DD', label: 'AAAA-MM-JJ (2024-12-01)' },
    { value: 'DD-MM-YYYY', label: 'JJ-MM-AAAA (01-12-2024)' },
    { value: 'DD.MM.YYYY', label: 'JJ.MM.AAAA (01.12.2024)' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ctp-text mb-2">
          Correspondance des colonnes
        </h2>
        <p className="text-ctp-subtext0 text-sm">
          Associez les colonnes de votre fichier aux champs de transaction.
          {detectedFormat && (
            <span className="ml-1 text-ctp-green">
              Format detecte : {detectedFormat.bank}
            </span>
          )}
        </p>
      </div>

      {/* Main Fields */}
      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.id}>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium text-ctp-text">
                {field.label}
              </label>
              {field.required && (
                <span className="text-xs text-ctp-red">*</span>
              )}
              <div className="group relative">
                <HelpCircle className="w-3.5 h-3.5 text-ctp-overlay0 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-ctp-surface1 text-ctp-text text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {field.description}
                </div>
              </div>
            </div>
            <select
              value={mapping[field.id]}
              onChange={(e) => handleMappingChange(field.id, e.target.value)}
              className={clsx(
                'input w-full',
                !mapping[field.id] && field.required && 'border-ctp-red/50'
              )}
            >
              <option value="">Selectionner une colonne</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Amount Configuration */}
      <div className="p-4 bg-ctp-surface0 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ctp-text">
            Configuration du montant
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useSeparateColumns}
              onChange={(e) => setUseSeparateColumns(e.target.checked)}
              className="w-4 h-4 rounded border-ctp-surface1 text-ctp-blue focus:ring-ctp-blue"
            />
            <span className="text-sm text-ctp-subtext0">
              Colonnes credit/debit separees
            </span>
          </label>
        </div>

        <div className={clsx('grid gap-4', useSeparateColumns ? 'grid-cols-2' : 'grid-cols-1')}>
          {amountFields.map((field) => (
            <div key={field.id}>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-ctp-text">
                  {field.label}
                </label>
                <span className="text-xs text-ctp-red">*</span>
              </div>
              <select
                value={mapping[field.id]}
                onChange={(e) => handleMappingChange(field.id, e.target.value)}
                className={clsx(
                  'input w-full',
                  !mapping[field.id] && 'border-ctp-red/50'
                )}
              >
                <option value="">Selectionner une colonne</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Date Format */}
      <div>
        <label className="block text-sm font-medium text-ctp-text mb-2">
          Format de date
        </label>
        <select
          value={dateFormat}
          onChange={(e) => setDateFormat(e.target.value)}
          className="input w-full"
        >
          {dateFormats.map((format) => (
            <option key={format.value} value={format.value}>
              {format.label}
            </option>
          ))}
        </select>
      </div>

      {/* Validation Summary */}
      <div
        className={clsx(
          'p-4 rounded-lg border',
          isValid()
            ? 'bg-ctp-green/10 border-ctp-green/30'
            : 'bg-ctp-yellow/10 border-ctp-yellow/30'
        )}
      >
        <div className="flex items-center gap-2">
          {isValid() ? (
            <>
              <Check className="w-4 h-4 text-ctp-green" />
              <span className="text-sm text-ctp-green">
                Configuration valide
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-ctp-yellow" />
              <span className="text-sm text-ctp-yellow">
                Veuillez mapper tous les champs requis
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid()}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          Continuer
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default ImportMapping;
