// ============================================================================
// FILE UPLOAD STEP - Finance Hub
// ============================================================================

import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Account {
  id: string;
  name: string;
  type: string;
}

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

interface FileUploadStepProps {
  workspaceId: string;
  onComplete: (data: {
    jobId: string;
    accountId: string;
    fileName: string;
    headers: string[];
    detectedFormat: DetectedFormat | null;
  }) => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function FileUploadStep({ workspaceId, onComplete }: FileUploadStepProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
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
        throw new Error(data.error?.message ?? 'Erreur lors du téléchargement');
      }

      return response.json();
    },
    onSuccess: async (result) => {
      // Get preview to detect format
      const preview = await api.post<{
        headers: string[];
        detectedFormat: DetectedFormat | null;
      }>(`/workspaces/${workspaceId}/import/preview`, {
        jobId: result.data.jobId,
        accountId: selectedAccountId,
      });

      onComplete({
        jobId: result.data.jobId,
        accountId: selectedAccountId,
        fileName: result.data.fileName,
        headers: preview.headers,
        detectedFormat: preview.detectedFormat,
      });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors du téléchargement');
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Veuillez sélectionner un fichier CSV');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSubmit = () => {
    if (!selectedFile) {
      setError('Veuillez sélectionner un fichier');
      return;
    }
    if (!selectedAccountId) {
      setError('Veuillez sélectionner un compte');
      return;
    }

    uploadMutation.mutate(selectedFile);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Sélectionnez un fichier CSV</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Formats supportés : relevés de Boursorama, Crédit Agricole, BNP, Société Générale,
          La Banque Postale, N26, Revolut et autres formats CSV standard.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm">
          {error}
        </div>
      )}

      {/* Account Selection */}
      <div>
        <label htmlFor="account" className="label">
          Compte de destination
        </label>
        <select
          id="account"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="input"
        >
          <option value="">Sélectionner un compte</option>
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
          'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
          isDragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
        )}
      >
        {selectedFile ? (
          <div>
            <div className="text-4xl mb-2">📄</div>
            <p className="font-medium">{selectedFile.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              {(selectedFile.size / 1024).toFixed(1)} Ko
            </p>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-sm text-danger-600 mt-2 hover:underline"
            >
              Supprimer
            </button>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-2">📤</div>
            <p className="font-medium mb-1">
              Glissez-déposez votre fichier CSV ici
            </p>
            <p className="text-sm text-gray-500 mb-4">ou</p>
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

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!selectedFile || !selectedAccountId || uploadMutation.isPending}
        className="btn-primary w-full"
      >
        {uploadMutation.isPending ? 'Analyse en cours...' : 'Continuer'}
      </button>
    </div>
  );
}

export default FileUploadStep;
