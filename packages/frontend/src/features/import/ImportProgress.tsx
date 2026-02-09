// ============================================================================
// IMPORT PROGRESS - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { XCircle } from 'lucide-react';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

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
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start import mutation
  const executeMutation = useMutation({
    mutationFn: () =>
      api.post<ImportResult>(`/workspaces/${workspaceId}/import/execute`, {
        jobId,
        accountId,
        columnMapping,
        dateFormat,
        skipDuplicates: true,
        applyRules: true,
        async: false, // Synchronous for now
      }),
    onSuccess: (result) => {
      onComplete(result);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'import');
    },
  });

  // Poll job status for async imports
  const { data: jobStatus } = useQuery({
    queryKey: ['import-job', jobId],
    queryFn: () => api.get<JobStatus>(`/workspaces/${workspaceId}/import/${jobId}`),
    enabled: started && !executeMutation.isPending,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 1000; // Poll every second
    },
  });

  // Start import on mount
  useEffect(() => {
    if (!started) {
      setStarted(true);
      void executeMutation.mutateAsync();
    }
  }, [started, executeMutation]);

  // Handle job completion
  useEffect(() => {
    if (jobStatus?.status === 'completed') {
      onComplete({
        imported: jobStatus.importedRows,
        skipped: jobStatus.skippedRows,
        duplicates: 0, // Would need to track this separately
        errors: jobStatus.errorRows,
      });
    }
    if (jobStatus?.status === 'failed') {
      setError(jobStatus.error ?? 'Import échoué');
    }
  }, [jobStatus, onComplete]);

  const progress = jobStatus
    ? jobStatus.totalRows > 0
      ? Math.round((jobStatus.processedRows / jobStatus.totalRows) * 100)
      : 0
    : 0;

  if (error) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 mx-auto mb-4 text-ctp-red" />
        <h2 className="text-xl font-bold mb-2 text-ctp-red">Erreur</h2>
        <p className="text-ctp-subtext0 mb-6">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setStarted(false);
          }}
          className="btn-secondary"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      {/* Spinner */}
      <div className="relative w-24 h-24 mx-auto mb-6">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-ctp-surface1"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${progress * 2.83} 283`}
            className="text-ctp-blue transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold">{progress}%</span>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-2">Import en cours...</h2>
      <p className="text-ctp-subtext0">
        {jobStatus
          ? `${jobStatus.processedRows} / ${jobStatus.totalRows} lignes traitées`
          : 'Préparation de l\'import...'}
      </p>

      {/* Live Stats */}
      {jobStatus && jobStatus.processedRows > 0 && (
        <div className="flex justify-center gap-6 mt-6 text-sm">
          <div>
            <span className="font-medium text-ctp-green">{jobStatus.importedRows}</span>
            <span className="text-ctp-subtext0 ml-1">importées</span>
          </div>
          <div>
            <span className="font-medium text-ctp-subtext0">{jobStatus.skippedRows}</span>
            <span className="text-ctp-subtext0 ml-1">ignorées</span>
          </div>
          {jobStatus.errorRows > 0 && (
            <div>
              <span className="font-medium text-ctp-red">{jobStatus.errorRows}</span>
              <span className="text-ctp-subtext0 ml-1">erreurs</span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-ctp-overlay1 mt-4">
        Ne fermez pas cette fenêtre
      </p>
    </div>
  );
}

export default ImportProgress;
