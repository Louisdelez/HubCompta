// ============================================================================
// DOCUMENT UPLOAD - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Image, BookOpen, Sheet, FileSpreadsheet, FileText, Folder, Clock, Check, X } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface DocumentUploadProps {
  workspaceId: string;
  onClose: () => void;
  onComplete: () => void;
}

interface UploadSession {
  sessionId: string;
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

interface FileUpload {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  documentId?: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string): { icon: LucideIcon; colorClass: string } {
  if (mimeType.startsWith('image/')) return { icon: Image, colorClass: 'text-ctp-green' };
  if (mimeType === 'application/pdf') return { icon: BookOpen, colorClass: 'text-ctp-red' };
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return { icon: Sheet, colorClass: 'text-ctp-green' };
  if (mimeType === 'text/csv') return { icon: FileSpreadsheet, colorClass: 'text-ctp-green' };
  return { icon: FileText, colorClass: 'text-ctp-blue' };
}

async function calculateHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DocumentUpload({ workspaceId, onClose, onComplete }: DocumentUploadProps) {
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Request upload URL mutation
  const requestUploadMutation = useMutation({
    mutationFn: (file: File) =>
      api.post<UploadSession>(`/workspaces/${workspaceId}/documents/upload-url`, {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      }),
  });

  // Confirm upload mutation
  const confirmUploadMutation = useMutation({
    mutationFn: (data: { sessionId: string; hash: string }) =>
      api.post<{ documentId: string; isDuplicate: boolean }>(
        `/workspaces/${workspaceId}/documents/confirm`,
        data
      ),
  });

  const uploadFile = async (file: File, index: number) => {
    try {
      // Update status to uploading
      setUploads((prev) =>
        prev.map((u, i) => (i === index ? { ...u, status: 'uploading' as const } : u))
      );

      // 1. Request upload URL
      const session = await requestUploadMutation.mutateAsync(file);

      // 2. Upload file directly to storage
      const xhr = new XMLHttpRequest();

      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploads((prev) =>
              prev.map((u, i) => (i === index ? { ...u, progress } : u))
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));

        xhr.open('PUT', session.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);
      });

      // 3. Calculate hash and confirm
      const hash = await calculateHash(file);
      const result = await confirmUploadMutation.mutateAsync({
        sessionId: session.sessionId,
        hash,
      });

      // Update status to success
      setUploads((prev) =>
        prev.map((u, i) =>
          i === index
            ? { ...u, status: 'success' as const, progress: 100, documentId: result.documentId }
            : u
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'upload';
      setUploads((prev) =>
        prev.map((u, i) =>
          i === index ? { ...u, status: 'error' as const, error: message } : u
        )
      );
    }
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const newUploads: FileUpload[] = Array.from(files).map((file) => ({
      file,
      progress: 0,
      status: 'pending' as const,
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    // Start uploading
    const startIndex = uploads.length;
    newUploads.forEach((upload, i) => {
      uploadFile(upload.file, startIndex + i);
    });
  }, [uploads.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const allComplete = uploads.length > 0 && uploads.every((u) => u.status === 'success' || u.status === 'error');
  const hasSuccess = uploads.some((u) => u.status === 'success');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-lg w-full animate-scale-in">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Ajouter des documents</h2>

          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
              isDragging
                ? 'border-ctp-blue bg-ctp-blue/10'
                : 'border-ctp-surface2 hover:border-ctp-blue'
            )}
          >
            <Folder className="w-10 h-10 mx-auto mb-3 text-ctp-overlay1" />
            <p className="text-ctp-subtext0 mb-2">
              Glissez vos fichiers ici ou
            </p>
            <label className="btn-primary cursor-pointer inline-block">
              Parcourir
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.csv,.xls,.xlsx"
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />
            </label>
            <p className="text-xs text-ctp-subtext0 mt-3">
              PDF, Images, CSV, Excel • Max 10MB par fichier
            </p>
          </div>

          {/* Upload List */}
          {uploads.length > 0 && (
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {uploads.map((upload, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-ctp-surface0 rounded-lg"
                >
                  {(() => { const { icon: Icon, colorClass } = getFileIcon(upload.file.type); return <Icon className={clsx('w-5 h-5', colorClass)} />; })()}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{upload.file.name}</p>
                    <p className="text-xs text-ctp-subtext0">
                      {formatFileSize(upload.file.size)}
                    </p>
                    {upload.status === 'uploading' && (
                      <div className="mt-1 h-1.5 bg-ctp-surface2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-ctp-blue transition-all"
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                    )}
                    {upload.status === 'error' && (
                      <p className="text-xs text-ctp-red mt-1">{upload.error}</p>
                    )}
                  </div>
                  <div>
                    {upload.status === 'pending' && (
                      <Clock className="w-4 h-4 text-ctp-overlay1" />
                    )}
                    {upload.status === 'uploading' && (
                      <span className="text-ctp-blue">{upload.progress}%</span>
                    )}
                    {upload.status === 'success' && (
                      <Check className="w-4 h-4 text-ctp-green" />
                    )}
                    {upload.status === 'error' && (
                      <X className="w-4 h-4 text-ctp-red" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="btn-secondary flex-1">
              {allComplete ? 'Fermer' : 'Annuler'}
            </button>
            {allComplete && hasSuccess && (
              <button onClick={onComplete} className="btn-primary flex-1">
                Terminé
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentUpload;
