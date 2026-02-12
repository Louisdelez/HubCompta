// ============================================================================
// DOCUMENT ATTACHMENT - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image, BookOpen, FileText, Download, X } from 'lucide-react';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import type { LucideIcon } from 'lucide-react';

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

function getFileIcon(mimeType: string): LucideIcon {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType === 'application/pdf') return BookOpen;
  return FileText;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DocumentAttachment({ workspaceId, transactionId }: DocumentAttachmentProps) {
  const { t } = useTranslation();
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
      void queryClient.invalidateQueries({ queryKey: ['transaction-documents', transactionId] });
      void queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
      setShowPicker(false);
    },
  });

  // Unlink mutation
  const unlinkMutation = useMutation({
    mutationFn: (documentId: string) =>
      api.delete(`/workspaces/${workspaceId}/documents/${documentId}/link/${transactionId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transaction-documents', transactionId] });
      void queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
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
      logger.error('Failed to get download URL', error);
    }
  };

  return (
    <div>
      <label className="label">{t('transactions.documents')}</label>

      {/* Attached Documents */}
      {isLoading ? (
        <div className="text-sm text-ctp-subtext0">{t('transactions.loadingDocuments')}</div>
      ) : attachedDocs && attachedDocs.length > 0 ? (
        <div className="space-y-2 mb-3">
          {attachedDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 p-2 bg-ctp-surface0 border border-ctp-surface1 rounded-lg"
            >
              {(() => { const Icon = getFileIcon(doc.mimeType); return <Icon className="w-5 h-5 text-ctp-subtext0" />; })()}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ctp-text truncate">{doc.filename}</p>
                <p className="text-xs text-ctp-subtext0">{formatFileSize(doc.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(doc.id)}
                className="text-ctp-blue hover:text-ctp-blue/80 text-sm"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => unlinkMutation.mutate(doc.id)}
                className="text-ctp-overlay1 hover:text-ctp-red"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ctp-subtext0 mb-3">{t('transactions.noDocumentsAttached')}</p>
      )}

      {/* Add Button / Picker */}
      {showPicker ? (
        <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ctp-text">{t('transactions.selectDocument')}</span>
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="text-ctp-subtext0 hover:text-ctp-text"
            >
              <X className="w-4 h-4" />
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
                  className="w-full flex items-center gap-2 p-2 text-left hover:bg-ctp-surface1 rounded"
                >
                  {(() => { const Icon = getFileIcon(doc.mimeType); return <Icon className="w-5 h-5 text-ctp-subtext0" />; })()}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ctp-text truncate">{doc.filename}</p>
                    <p className="text-xs text-ctp-subtext0">{formatFileSize(doc.size)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ctp-subtext0 text-center py-4">
              {t('transactions.noDocumentsInInbox')}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full py-2 bg-ctp-surface0 border-2 border-dashed border-ctp-surface1 rounded-lg text-ctp-subtext0 hover:border-ctp-blue hover:text-ctp-blue transition-colors text-sm"
        >
          {t('transactions.addDocument')}
        </button>
      )}
    </div>
  );
}

export default DocumentAttachment;
