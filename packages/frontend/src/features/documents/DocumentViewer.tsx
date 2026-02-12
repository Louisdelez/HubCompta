// ============================================================================
// DOCUMENT VIEWER - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Image, FileText, X, EyeOff, Eye, Download, Inbox, Link2, Archive, Lock } from 'lucide-react';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Document {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  status: 'inbox' | 'linked' | 'archived';
  isVault: boolean;
  createdAt: string;
  uploader: {
    id: string;
    email: string;
    displayName: string | null;
  };
  links: {
    id: string;
    transaction: {
      id: string;
      description: string;
      amount: number;
      date: string;
    };
  }[];
}

interface DocumentViewerProps {
  workspaceId: string;
  document: Document;
  onClose: () => void;
  onLink: () => void;
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DocumentViewer({ workspaceId, document, onClose, onLink }: DocumentViewerProps) {
  const { t } = useTranslation();
  const [showPreview, setShowPreview] = useState(false);

  // Fetch download URL
  const { data: downloadData, isLoading: isLoadingUrl } = useQuery({
    queryKey: ['document-download', document.id],
    queryFn: () =>
      api.get<{ url: string; filename: string }>(
        `/workspaces/${workspaceId}/documents/${document.id}/download`
      ),
  });

  const canPreview = document.mimeType.startsWith('image/') || document.mimeType === 'application/pdf';

  const handleDownload = () => {
    if (downloadData?.url) {
      window.open(downloadData.url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto animate-scale-in">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">
                {document.mimeType.startsWith('image/') ? (
                  <Image className="w-10 h-10 text-ctp-green" />
                ) : document.mimeType === 'application/pdf' ? (
                  <FileText className="w-10 h-10 text-ctp-red" />
                ) : document.mimeType.includes('spreadsheet') || document.mimeType.includes('excel') || document.mimeType === 'text/csv' ? (
                  <FileText className="w-10 h-10 text-ctp-green" />
                ) : (
                  <FileText className="w-10 h-10 text-ctp-blue" />
                )}
              </span>
              <div>
                <h2 className="text-xl font-bold break-all">{document.filename}</h2>
                <p className="text-sm text-ctp-subtext0">
                  {formatFileSize(document.size)} • {document.mimeType}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preview Toggle for images/PDFs */}
          {canPreview && downloadData?.url && (
            <div className="mb-4">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="btn-secondary w-full"
              >
                {showPreview ? <><EyeOff className="w-4 h-4 inline mr-2" />{t('documents.viewer.hidePreview')}</> : <><Eye className="w-4 h-4 inline mr-2" />{t('documents.viewer.showPreview')}</>}
              </button>

              {showPreview && (
                <div className="mt-4 rounded-lg overflow-hidden border border-ctp-surface1">
                  {document.mimeType.startsWith('image/') ? (
                    <img
                      src={downloadData.url}
                      alt={document.filename}
                      className="w-full max-h-96 object-contain bg-ctp-surface0"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <iframe
                      src={downloadData.url}
                      className="w-full h-96"
                      title={document.filename}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-ctp-subtext0">{t('documents.viewer.addedOn')}</p>
              <p className="font-medium">{formatDate(document.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-ctp-subtext0">{t('documents.viewer.by')}</p>
              <p className="font-medium">
                {document.uploader.displayName || document.uploader.email}
              </p>
            </div>
            <div>
              <p className="text-sm text-ctp-subtext0">{t('documents.viewer.status')}</p>
              <p className="font-medium flex items-center gap-1">
                {document.status === 'inbox' && <><Inbox className="w-4 h-4" /> {t('documents.viewer.toProcess')}</>}
                {document.status === 'linked' && <><Link2 className="w-4 h-4" /> {t('documents.viewer.linked')}</>}
                {document.status === 'archived' && <><Archive className="w-4 h-4" /> {t('documents.viewer.archived')}</>}
              </p>
            </div>
            <div>
              <p className="text-sm text-ctp-subtext0">{t('documents.viewer.security')}</p>
              <p className="font-medium flex items-center gap-1">
                {document.isVault ? <><Lock className="w-4 h-4" /> {t('documents.viewer.encrypted')}</> : <><FileText className="w-4 h-4" /> {t('documents.viewer.standard')}</>}
              </p>
            </div>
          </div>

          {/* Linked Transactions */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{t('documents.viewer.linkedTransactions')}</h3>
              <button onClick={onLink} className="text-sm text-ctp-blue hover:underline">
                {t('documents.viewer.add')}
              </button>
            </div>

            {document.links.length > 0 ? (
              <div className="space-y-2">
                {document.links.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 bg-ctp-green/10 border border-ctp-green/30 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{link.transaction.description}</p>
                      <p className="text-sm text-ctp-subtext0">
                        {new Date(link.transaction.date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <p
                      className={`font-bold ${
                        link.transaction.amount >= 0 ? 'text-ctp-green' : ''
                      }`}
                    >
                      {formatCurrency(link.transaction.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-ctp-surface0 rounded-lg">
                <p className="text-ctp-subtext0 mb-2">{t('documents.viewer.noLinkedTransaction')}</p>
                <button onClick={onLink} className="btn-primary text-sm">
                  {t('documents.viewer.linkToTransaction')}
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">
              {t('documents.viewer.close')}
            </button>
            <button
              onClick={handleDownload}
              disabled={isLoadingUrl}
              className="btn-primary flex-1"
            >
              {isLoadingUrl ? t('documents.viewer.loading') : <><Download className="w-4 h-4 inline mr-2" />{t('documents.viewer.download')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentViewer;
