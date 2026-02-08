// ============================================================================
// IMPORT WIZARD - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { FileUploadStep } from './FileUploadStep';
import { ColumnMappingStep } from './ColumnMappingStep';
import { PreviewStep } from './PreviewStep';
import { ImportProgress } from './ImportProgress';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type WizardStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

interface ImportState {
  jobId?: string;
  accountId?: string;
  fileName?: string;
  headers?: string[];
  detectedFormat?: {
    bank: string;
    dateColumn: string;
    amountColumn: string;
    descriptionColumn: string;
    dateFormat: string;
    amountFormat: string;
    creditColumn?: string;
    debitColumn?: string;
  } | null;
  columnMapping?: {
    date: string;
    amount: string;
    description: string;
    credit?: string;
    debit?: string;
  };
  previewData?: {
    totalRows: number;
    validRows: number;
    duplicates: number;
    sampleTransactions: Array<{
      date: string;
      amount: number;
      description: string;
      isDuplicate: boolean;
      suggestedCategory?: { id: string; name: string };
    }>;
  };
  result?: {
    imported: number;
    skipped: number;
    duplicates: number;
    errors: number;
  };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ImportWizard() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const [step, setStep] = useState<WizardStep>('upload');
  const [importState, setImportState] = useState<ImportState>({});

  const steps = [
    { key: 'upload', label: 'Fichier' },
    { key: 'mapping', label: 'Colonnes' },
    { key: 'preview', label: 'Aperçu' },
    { key: 'importing', label: 'Import' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-gray-500">
        Sélectionnez un espace de travail
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Importer des transactions</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Importez vos relevés bancaires au format CSV
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((s, index) => (
            <div key={s.key} className="flex items-center">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm',
                  index < currentStepIndex
                    ? 'bg-success-500 text-white'
                    : index === currentStepIndex
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                )}
              >
                {index < currentStepIndex ? '✓' : index + 1}
              </div>
              <span
                className={clsx(
                  'ml-2 text-sm hidden sm:inline',
                  index === currentStepIndex
                    ? 'font-medium'
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                {s.label}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={clsx(
                    'w-12 sm:w-24 h-1 mx-2',
                    index < currentStepIndex
                      ? 'bg-success-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="card">
        {step === 'upload' && (
          <FileUploadStep
            workspaceId={workspaceId}
            onComplete={(data) => {
              const newState: ImportState = {
                jobId: data.jobId,
                accountId: data.accountId,
                fileName: data.fileName,
                headers: data.headers,
              };
              if (data.detectedFormat !== null) {
                newState.detectedFormat = data.detectedFormat;
              }
              if (data.detectedFormat) {
                const mapping: NonNullable<ImportState['columnMapping']> = {
                  date: data.detectedFormat.dateColumn,
                  amount: data.detectedFormat.amountColumn,
                  description: data.detectedFormat.descriptionColumn,
                };
                if (data.detectedFormat.creditColumn) {
                  mapping.credit = data.detectedFormat.creditColumn;
                }
                if (data.detectedFormat.debitColumn) {
                  mapping.debit = data.detectedFormat.debitColumn;
                }
                newState.columnMapping = mapping;
              }
              setImportState(newState);
              setStep('mapping');
            }}
          />
        )}

        {step === 'mapping' && (
          <ColumnMappingStep
            headers={importState.headers ?? []}
            detectedFormat={importState.detectedFormat}
            {...(importState.columnMapping ? { initialMapping: importState.columnMapping } : {})}
            onBack={() => setStep('upload')}
            onComplete={(mapping) => {
              setImportState((prev) => ({ ...prev, columnMapping: mapping }));
              setStep('preview');
            }}
          />
        )}

        {step === 'preview' && (
          <PreviewStep
            workspaceId={workspaceId}
            jobId={importState.jobId!}
            accountId={importState.accountId!}
            columnMapping={importState.columnMapping!}
            dateFormat={importState.detectedFormat?.dateFormat ?? 'DD/MM/YYYY'}
            onBack={() => setStep('mapping')}
            onComplete={() => setStep('importing')}
            onPreviewData={(data) => {
              setImportState((prev) => ({ ...prev, previewData: data }));
            }}
          />
        )}

        {step === 'importing' && (
          <ImportProgress
            workspaceId={workspaceId}
            jobId={importState.jobId!}
            accountId={importState.accountId!}
            columnMapping={importState.columnMapping!}
            dateFormat={importState.detectedFormat?.dateFormat ?? 'DD/MM/YYYY'}
            onComplete={(result) => {
              setImportState((prev) => ({ ...prev, result }));
              setStep('complete');
            }}
          />
        )}

        {step === 'complete' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold mb-2">Import terminé !</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {importState.result?.imported} transactions importées
              {importState.result?.duplicates && importState.result.duplicates > 0 && (
                <>, {importState.result.duplicates} doublons ignorés</>
              )}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-lg">
                <p className="text-2xl font-bold text-success-600">
                  {importState.result?.imported}
                </p>
                <p className="text-sm text-success-700 dark:text-success-400">
                  Importées
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-2xl font-bold">{importState.result?.skipped}</p>
                <p className="text-sm text-gray-500">Ignorées</p>
              </div>
              <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
                <p className="text-2xl font-bold text-warning-600">
                  {importState.result?.duplicates}
                </p>
                <p className="text-sm text-warning-700 dark:text-warning-400">
                  Doublons
                </p>
              </div>
              <div className="p-4 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
                <p className="text-2xl font-bold text-danger-600">
                  {importState.result?.errors}
                </p>
                <p className="text-sm text-danger-700 dark:text-danger-400">
                  Erreurs
                </p>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setStep('upload');
                  setImportState({});
                }}
                className="btn-secondary"
              >
                Nouvel import
              </button>
              <a href="/transactions" className="btn-primary">
                Voir les transactions
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportWizard;
