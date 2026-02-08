// ============================================================================
// DOCUMENT ATTACHMENT - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Document {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface InboxDocument extends Document {
  status: 'inbox';
  createdAt: string;
}

interface DocumentAttachmentProps {
  workspaceId: string;
  transactionId: string;
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

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📕';
  return '📄';
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DocumentAttachment({ workspaceId, transactionId }: DocumentAttachmentProps) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);

  // Fetch documents attached to this transaction
  const { data: attachedDocs, isLoading } = useQuery({
    queryKey: ['transaction-documents', transactionId],
    queryFn: async () => {
      // Get transaction with linked documents
      const result = await api.get<{
        linkedDocuments: Document[];
      }>(`/workspaces/${workspaceId}/transactions/${transactionId}`);
      return result.linkedDocuments ?? [];
    },
  });

  // Fetch inbox documents for picker
  const { data: inboxDocs } = useQuery({
    queryKey: ['documents', workspaceId, 'inbox'],
    queryFn: () =>
      api.get<{ documents: InboxDocument[] }>(
        `/workspaces/${workspaceId}/documents?status=inbox&limit=20`
      ),
    enabled: showPicker,
  });

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: (documentId: string) =>
      api.post(`/workspaces/${workspaceId}/documents/${documentId}/link`, {
        transactionId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-documents', transactionId] });
      queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
      setShowPicker(false);
    },
  });

  // Unlink mutation
  const unlinkMutation = useMutation({
    mutationFn: (documentId: string) =>
      api.delete(`/workspaces/${workspaceId}/documents/${documentId}/link/${transactionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-documents', transactionId] });
      queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
    },
  });

  // Get download URL
  const handleDownload = async (documentId: string) => {
    try {
      const { url } = await api.get<{ url: string }>(
        `/workspaces/${workspaceId}/documents/${documentId}/download`
      );
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to get download URL:', error);
    }
  };

  return (
    <div>
      <label className="label">Justificatifs</label>

      {/* Attached Documents */}
      {isLoading ? (
        <div className="text-sm text-gray-500">Chargement...</div>
      ) : attachedDocs && attachedDocs.length > 0 ? (
        <div className="space-y-2 mb-3">
          {attachedDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <span>{getFileIcon(doc.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.filename}</p>
                <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(doc.id)}
                className="text-primary-600 hover:text-primary-700 text-sm"
              >
                ⬇️
              </button>
              <button
                type="button"
                onClick={() => unlinkMutation.mutate(doc.id)}
                className="text-gray-400 hover:text-danger-500"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-3">Aucun justificatif attaché</p>
      )}

      {/* Add Button / Picker */}
      {showPicker ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Sélectionner un document</span>
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {inboxDocs?.documents && inboxDocs.documents.length > 0 ? (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {inboxDocs.documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => linkMutation.mutate(doc.id)}
                  disabled={linkMutation.isPending}
                  className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                >
                  <span>{getFileIcon(doc.mimeType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              Aucun document dans la boîte de réception
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors text-sm"
        >
          + Ajouter un justificatif
        </button>
      )}
    </div>
  );
}

export default DocumentAttachment;
