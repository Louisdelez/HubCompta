// ============================================================================
// IMPORT PROGRESS - Finance Hub
// Progress indicator during import execution
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ImportProgressProps {
  workspaceId: string;
  jobId: string;
  accountId: string;
  columnMapping: {
    date: string;
    amount: string;
    description: string;
    credit?: string;
    debit?: string;
  };
  dateFormat: string;
  onComplete: (result: ImportResult) => void;
}

interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: number;
}

interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  importedRows: number;
  skippedRows: number;
  errorRows: number;
  error?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ImportProgress({
  workspaceId,
  jobId,
  accountId,
  columnMapping,
  dateFormat,
  onComplete,
}: ImportProgressProps) {
  // Initialize as 'executing' since we start the import immediately on mount
  const [status, setStatus] = useState<'idle' | 'executing' | 'polling' | 'completed' | 'error'>('executing');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Execute import mutation
  const executeMutation = useMutation({
    mutationFn: () =>
      api.post<ImportResult>(`/workspaces/${workspaceId}/import/execute`, {
        jobId,
        accountId,
        columnMapping,
        dateFormat,
        skipDuplicates: true,
        applyRules: true,
        async: false, // Synchronous for progress tracking
      }),
    onSuccess: (data) => {
      setStatus('completed');
      setProgress(100);
      onComplete(data);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'import');
      setStatus('error');
    },
  });

  // Start polling for async imports (when needed)
  const startPolling = () => {
    setStatus('polling');
    pollIntervalRef.current = setInterval(() => {
      api.get<JobStatus>(
        `/workspaces/${workspaceId}/import/${jobId}`
      ).then((job) => {
        if (job.totalRows > 0) {
          setProgress(Math.round((job.processedRows / job.totalRows) * 100));
        }

        if (job.status === 'completed') {
          setStatus('completed');
          onComplete({
            imported: job.importedRows,
            skipped: job.skippedRows,
            duplicates: 0,
            errors: job.errorRows,
          });
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        } else if (job.status === 'failed') {
          setError(job.error ?? 'Import echoue');
          setStatus('error');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
      }).catch((err) => {
        // Continue polling on error
        console.error('Error polling job status:', err);
      });
    }, 2000);
  };

  // Expose for potential future use
  void startPolling;

  // Start import on mount (status is already 'executing' from initialization)
  useEffect(() => {
    executeMutation.mutate();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulate progress for synchronous imports
  useEffect(() => {
    if (status === 'executing' && progress < 90) {
      const timer = setTimeout(() => {
        setProgress((prev) => Math.min(prev + Math.random() * 15, 90));
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, progress]);

  const getStatusMessage = () => {
    switch (status) {
      case 'idle':
        return 'Preparation de l\'import...';
      case 'executing':
        return 'Import en cours...';
      case 'polling':
        return 'Traitement en cours...';
      case 'completed':
        return 'Import termine !';
      case 'error':
        return 'Erreur lors de l\'import';
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'idle':
      case 'executing':
      case 'polling':
        return <Loader2 className="w-8 h-8 animate-spin text-ctp-blue" />;
      case 'completed':
        return <CheckCircle className="w-8 h-8 text-ctp-green" />;
      case 'error':
        return <XCircle className="w-8 h-8 text-ctp-red" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 py-8">
      {/* Status Icon and Message */}
      <div className="text-center">
        <div className="mb-4">{getStatusIcon()}</div>
        <h2 className="text-lg font-semibold text-ctp-text mb-2">
          {getStatusMessage()}
        </h2>
        {status !== 'completed' && status !== 'error' && (
          <p className="text-ctp-subtext0 text-sm">
            Veuillez patienter pendant l'importation de vos transactions...
          </p>
        )}
      </div>

      {/* Progress Bar */}
      {(status === 'executing' || status === 'polling') && (
        <div className="max-w-md mx-auto">
          <div className="flex justify-between text-sm text-ctp-subtext0 mb-2">
            <span>Progression</span>
            <span>{progress}%</span>
          </div>
          <div className="h-3 bg-ctp-surface0 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ctp-blue to-ctp-sapphire transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Processing Animation */}
      {(status === 'executing' || status === 'polling') && (
        <div className="flex justify-center gap-1 mt-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-ctp-blue animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}

      {/* Error Display */}
      {status === 'error' && error && (
        <div className="max-w-md mx-auto p-4 bg-ctp-red/10 border border-ctp-red/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-ctp-red flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-ctp-red mb-1">
                Une erreur est survenue
              </p>
              <p className="text-sm text-ctp-red/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tips during loading */}
      {(status === 'executing' || status === 'polling') && (
        <div className="max-w-md mx-auto mt-8 p-4 bg-ctp-surface0 rounded-lg">
          <p className="text-sm text-ctp-subtext0 text-center">
            <strong className="text-ctp-text">Astuce :</strong> Les transactions
            sont verifiees pour eviter les doublons et categorisees automatiquement
            grace a vos regles.
          </p>
        </div>
      )}
    </div>
  );
}

export default ImportProgress;
