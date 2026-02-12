// ============================================================================
// FILE UPLOAD STEP - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FileText, Upload } from 'lucide-react';
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
  const { t } = useTranslation();
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
        throw new Error(data.error?.message ?? t('import.upload.uploadError'));
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
      setError(err instanceof Error ? err.message : t('import.upload.uploadError'));
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
      setError(t('import.upload.selectCsvError'));
    }
  }, [t]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSubmit = () => {
    if (!selectedFile) {
      setError(t('import.upload.selectFileError'));
      return;
    }
    if (!selectedAccountId) {
      setError(t('import.upload.selectAccountError'));
      return;
    }

    uploadMutation.mutate(selectedFile);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">{t('import.upload.title')}</h2>
        <p className="text-ctp-subtext0 text-sm">
          {t('import.upload.supportedFormats')}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red border border-ctp-red/30 text-sm">
          {error}
        </div>
      )}

      {/* Account Selection */}
      <div>
        <label htmlFor="account" className="label">
          {t('import.upload.destinationAccount')}
        </label>
        <select
          id="account"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="input"
        >
          <option value="">{t('import.upload.selectAccount')}</option>
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
            ? 'border-ctp-blue bg-ctp-blue/10'
            : 'border-ctp-surface1 hover:border-ctp-blue bg-ctp-surface0'
        )}
      >
        {selectedFile ? (
          <div>
            <FileText className="w-10 h-10 mx-auto mb-2 text-ctp-blue" />
            <p className="font-medium">{selectedFile.name}</p>
            <p className="text-sm text-ctp-subtext0 mt-1">
              {(selectedFile.size / 1024).toFixed(1)} Ko
            </p>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-sm text-ctp-red mt-2 hover:underline"
            >
              {t('import.upload.remove')}
            </button>
          </div>
        ) : (
          <div>
            <Upload className="w-10 h-10 mx-auto mb-2 text-ctp-overlay1" />
            <p className="font-medium mb-1">
              {t('import.upload.dragAndDrop')}
            </p>
            <p className="text-sm text-ctp-subtext0 mb-4">{t('import.upload.or')}</p>
            <label className="btn-secondary cursor-pointer">
              {t('import.upload.browse')}
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
        {uploadMutation.isPending ? t('import.upload.analyzing') : t('import.upload.continue')}
      </button>
    </div>
  );
}

export default FileUploadStep;
