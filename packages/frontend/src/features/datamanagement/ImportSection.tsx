// ============================================================================
// IMPORT SECTION - Finance Hub
// Import wizard and history section
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { ImportPreview } from './ImportPreview';
import { ImportMapping } from './ImportMapping';
import { ImportProgress } from './ImportProgress';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ImportSectionProps {
  workspaceId: string;
}

interface ImportJob {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errorRows: number;
  createdAt: string;
  completedAt?: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'progress' | 'complete';

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

interface ImportState {
  jobId?: string;
  accountId?: string;
  fileName?: string;
  fileContent?: string;
  headers?: string[];
  detectedFormat?: DetectedFormat | null;
  columnMapping?: ColumnMapping;
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

export function ImportSection({ workspaceId }: ImportSectionProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [importState, setImportState] = useState<ImportState>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
  });

  // Fetch import history
  const { data: importHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['import-history', workspaceId],
    queryFn: () =>
      api.get<{ jobs: ImportJob[]; total: number }>(
        `/workspaces/${workspaceId}/import?limit=10`
      ),
  });

  const getStatusIcon = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-ctp-green" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-ctp-red" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-ctp-blue animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-ctp-subtext0" />;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Veuillez selectionner un fichier CSV');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedAccountId) {
      setError('Veuillez selectionner un fichier et un compte');
      return;
    }

    setError(null);

    try {
      // Upload file
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('accountId', selectedAccountId);

      const response = await fetch(
        `/api/v1/workspaces/${workspaceId}/import/upload`,
        {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message ?? 'Erreur lors du telechargement');
      }

      const result = await response.json();

      // Get preview to detect format
      const preview = await api.post<{
        headers: string[];
        detectedFormat: ImportState['detectedFormat'];
      }>(`/workspaces/${workspaceId}/import/preview`, {
        jobId: result.data.jobId,
        accountId: selectedAccountId,
      });

      // Update state and move to mapping step
      const newState: ImportState = {
        jobId: result.data.jobId,
        accountId: selectedAccountId,
        fileName: result.data.fileName,
        headers: preview.headers,
        detectedFormat: preview.detectedFormat ?? null,
      };

      if (preview.detectedFormat) {
        const mapping: ColumnMapping = {
          date: preview.detectedFormat.dateColumn,
          amount: preview.detectedFormat.amountColumn,
          description: preview.detectedFormat.descriptionColumn,
        };
        if (preview.detectedFormat.creditColumn) {
          mapping.credit = preview.detectedFormat.creditColumn;
        }
        if (preview.detectedFormat.debitColumn) {
          mapping.debit = preview.detectedFormat.debitColumn;
        }
        newState.columnMapping = mapping;
      }

      setImportState(newState);
      setStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du telechargement');
    }
  };

  const resetImport = () => {
    setStep('upload');
    setImportState({});
    setSelectedFile(null);
    setSelectedAccountId('');
    setError(null);
  };

  // Render different steps
  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-ctp-text mb-2">
          Importer des transactions
        </h2>
        <p className="text-ctp-subtext0 text-sm">
          Formats supportes : releves CSV de la plupart des banques francaises
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red border border-ctp-red/30 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Account Selection */}
      <div>
        <label className="block text-sm font-medium text-ctp-text mb-2">
          Compte de destination
        </label>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="input w-full"
        >
          <option value="">Selectionner un compte</option>
          {accounts?.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'border-2 border-dashed rounded-xl p-8 text-center transition-all',
          isDragging
            ? 'border-ctp-blue bg-ctp-blue/10'
            : 'border-ctp-surface1 hover:border-ctp-blue bg-ctp-surface0'
        )}
      >
        {selectedFile ? (
          <div>
            <FileText className="w-10 h-10 mx-auto mb-2 text-ctp-blue" />
            <p className="font-medium text-ctp-text">{selectedFile.name}</p>
            <p className="text-sm text-ctp-subtext0 mt-1">
              {(selectedFile.size / 1024).toFixed(1)} Ko
            </p>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-sm text-ctp-red mt-2 hover:underline"
            >
              Supprimer
            </button>
          </div>
        ) : (
          <div>
            <Upload className="w-10 h-10 mx-auto mb-2 text-ctp-overlay1" />
            <p className="font-medium text-ctp-text mb-1">
              Glissez-deposez votre fichier CSV ici
            </p>
            <p className="text-sm text-ctp-subtext0 mb-4">ou</p>
            <label className="btn-secondary cursor-pointer">
              Parcourir
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={!selectedFile || !selectedAccountId}
        className="btn-primary w-full"
      >
        Continuer
      </button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 'upload':
        return renderUploadStep();
      case 'mapping':
        return (
          <ImportMapping
            headers={importState.headers ?? []}
            detectedFormat={importState.detectedFormat ?? null}
            initialMapping={importState.columnMapping}
            onBack={() => setStep('upload')}
            onComplete={(mapping) => {
              setImportState((prev) => ({ ...prev, columnMapping: mapping }));
              setStep('preview');
            }}
          />
        );
      case 'preview':
        return (
          <ImportPreview
            workspaceId={workspaceId}
            jobId={importState.jobId!}
            accountId={importState.accountId!}
            columnMapping={importState.columnMapping!}
            dateFormat={importState.detectedFormat?.dateFormat ?? 'DD/MM/YYYY'}
            onBack={() => setStep('mapping')}
            onComplete={() => setStep('progress')}
            onPreviewData={(data) => {
              setImportState((prev) => ({ ...prev, previewData: data }));
            }}
          />
        );
      case 'progress':
        return (
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
        );
      case 'complete':
        return (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-ctp-green" />
            <h2 className="text-xl font-bold text-ctp-text mb-2">Import termine !</h2>
            <p className="text-ctp-subtext0 mb-6">
              {importState.result?.imported} transactions importees
              {importState.result?.duplicates && importState.result.duplicates > 0 && (
                <>, {importState.result.duplicates} doublons ignores</>
              )}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="p-4 bg-ctp-green/10 border border-ctp-green/30 rounded-lg">
                <p className="text-2xl font-bold text-ctp-green">
                  {importState.result?.imported}
                </p>
                <p className="text-sm text-ctp-green">Importees</p>
              </div>
              <div className="p-4 bg-ctp-surface0 rounded-lg">
                <p className="text-2xl font-bold text-ctp-text">
                  {importState.result?.skipped}
                </p>
                <p className="text-sm text-ctp-subtext0">Ignorees</p>
              </div>
              <div className="p-4 bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-lg">
                <p className="text-2xl font-bold text-ctp-yellow">
                  {importState.result?.duplicates}
                </p>
                <p className="text-sm text-ctp-yellow">Doublons</p>
              </div>
              <div className="p-4 bg-ctp-red/10 border border-ctp-red/30 rounded-lg">
                <p className="text-2xl font-bold text-ctp-red">
                  {importState.result?.errors}
                </p>
                <p className="text-sm text-ctp-red">Erreurs</p>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button onClick={resetImport} className="btn-secondary">
                Nouvel import
              </button>
              <a href="/transactions" className="btn-primary">
                Voir les transactions
              </a>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Import Wizard */}
      <div className="bg-ctp-base rounded-xl border border-ctp-surface1 p-6">
        {/* Progress Steps */}
        {step !== 'upload' && step !== 'complete' && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm">
              {['Fichier', 'Colonnes', 'Apercu', 'Import'].map((label, index) => {
                const stepIndex = ['upload', 'mapping', 'preview', 'progress'].indexOf(step);
                const isCompleted = index < stepIndex;
                const isCurrent = index === stepIndex;

                return (
                  <div key={label} className="flex items-center">
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center font-medium',
                        isCompleted
                          ? 'bg-ctp-green text-ctp-crust'
                          : isCurrent
                          ? 'bg-ctp-blue text-ctp-crust'
                          : 'bg-ctp-surface1 text-ctp-subtext0'
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span
                      className={clsx(
                        'ml-2 hidden sm:inline',
                        isCurrent ? 'font-medium text-ctp-text' : 'text-ctp-subtext0'
                      )}
                    >
                      {label}
                    </span>
                    {index < 3 && (
                      <ChevronRight className="w-4 h-4 mx-2 text-ctp-surface1" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {renderCurrentStep()}
      </div>

      {/* Import History */}
      {step === 'upload' && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-ctp-text">
            Historique des imports
          </h2>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-ctp-blue" />
            </div>
          ) : importHistory?.jobs && importHistory.jobs.length > 0 ? (
            <div className="bg-ctp-base rounded-xl border border-ctp-surface1 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-ctp-surface1">
                    <th className="text-left p-4 text-sm font-medium text-ctp-subtext0">
                      Fichier
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-ctp-subtext0">
                      Statut
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-ctp-subtext0">
                      Resultats
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-ctp-subtext0">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {importHistory.jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b border-ctp-surface0 last:border-0"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-ctp-subtext0" />
                          <span className="text-sm text-ctp-text truncate max-w-[200px]">
                            {job.fileName}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          <span className="text-sm text-ctp-text capitalize">
                            {job.status === 'completed'
                              ? 'Termine'
                              : job.status === 'failed'
                              ? 'Echoue'
                              : job.status === 'processing'
                              ? 'En cours'
                              : 'En attente'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        {job.status === 'completed' && (
                          <span className="text-sm text-ctp-subtext0">
                            {job.importedRows} importees, {job.skippedRows} ignorees
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-ctp-subtext0">
                        {new Date(job.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-ctp-base rounded-xl border border-ctp-surface1">
              <Upload className="w-12 h-12 mx-auto mb-3 text-ctp-overlay1" />
              <p className="text-ctp-subtext0">Aucun import recent</p>
              <p className="text-sm text-ctp-overlay0 mt-1">
                Vos imports precedents apparaitront ici
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ImportSection;
