// ============================================================================
// DOCUMENT VIEWER - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto animate-scale-in">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">
                {document.mimeType.startsWith('image/') ? '🖼️' : '📄'}
              </span>
              <div>
                <h2 className="text-xl font-bold break-all">{document.filename}</h2>
                <p className="text-sm text-gray-500">
                  {formatFileSize(document.size)} • {document.mimeType}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost text-xl">
              ✕
            </button>
          </div>

          {/* Preview Toggle for images/PDFs */}
          {canPreview && downloadData?.url && (
            <div className="mb-4">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="btn-secondary w-full"
              >
                {showPreview ? '🙈 Masquer l\'aperçu' : '👁️ Afficher l\'aperçu'}
              </button>

              {showPreview && (
                <div className="mt-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  {document.mimeType.startsWith('image/') ? (
                    <img
                      src={downloadData.url}
                      alt={document.filename}
                      className="w-full max-h-96 object-contain bg-gray-100 dark:bg-gray-900"
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
              <p className="text-sm text-gray-500">Ajouté le</p>
              <p className="font-medium">{formatDate(document.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Par</p>
              <p className="font-medium">
                {document.uploader.displayName || document.uploader.email}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Statut</p>
              <p className="font-medium">
                {document.status === 'inbox' && '📥 À traiter'}
                {document.status === 'linked' && '🔗 Lié'}
                {document.status === 'archived' && '📦 Archivé'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sécurité</p>
              <p className="font-medium">
                {document.isVault ? '🔐 Chiffré (Vault)' : '📄 Standard'}
              </p>
            </div>
          </div>

          {/* Linked Transactions */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Transactions liées</h3>
              <button onClick={onLink} className="text-sm text-primary-600 hover:underline">
                + Ajouter
              </button>
            </div>

            {document.links.length > 0 ? (
              <div className="space-y-2">
                {document.links.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{link.transaction.description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(link.transaction.date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <p
                      className={`font-bold ${
                        link.transaction.amount >= 0 ? 'text-success-600' : ''
                      }`}
                    >
                      {formatCurrency(link.transaction.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-gray-500 mb-2">Aucune transaction liée</p>
                <button onClick={onLink} className="btn-primary text-sm">
                  Lier à une transaction
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">
              Fermer
            </button>
            <button
              onClick={handleDownload}
              disabled={isLoadingUrl}
              className="btn-primary flex-1"
            >
              {isLoadingUrl ? 'Chargement...' : '⬇️ Télécharger'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentViewer;
