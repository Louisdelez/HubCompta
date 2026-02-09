// ============================================================================
// DOCUMENT CARD - Finance Hub
// ============================================================================

import { useMutation } from '@tanstack/react-query';
import { Image, BookOpen, Sheet, FileSpreadsheet, FileText, Lock, Inbox, Link2, Archive, X, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

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

interface DocumentCardProps {
  document: Document;
  workspaceId: string;
  onView: () => void;
  onLink: () => void;
  onAction: () => void;
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
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return Sheet;
  if (mimeType === 'text/csv') return FileSpreadsheet;
  return FileText;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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

export function DocumentCard({
  document,
  workspaceId,
  onView,
  onLink,
  onAction,
}: DocumentCardProps) {
  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspaceId}/documents/${document.id}/archive`),
    onSuccess: onAction,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/workspaces/${workspaceId}/documents/${document.id}`),
    onSuccess: onAction,
  });

  // Unlink mutation
  const unlinkMutation = useMutation({
    mutationFn: (transactionId: string) =>
      api.delete(`/workspaces/${workspaceId}/documents/${document.id}/link/${transactionId}`),
    onSuccess: onAction,
  });

  const handleDelete = () => {
    if (confirm(`Supprimer "${document.filename}" ?`)) {
      deleteMutation.mutate();
    }
  };

  const handleUnlink = (transactionId: string) => {
    if (confirm('Délier ce document de la transaction ?')) {
      unlinkMutation.mutate(transactionId);
    }
  };

  return (
    <div
      className={clsx(
        'card hover:shadow-md transition-shadow cursor-pointer',
        document.status === 'inbox' && 'ring-2 ring-warning-300 dark:ring-warning-700'
      )}
      onClick={onView}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {(() => { const Icon = getFileIcon(document.mimeType); return <Icon className="w-8 h-8 text-gray-500 dark:text-gray-400" />; })()}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate" title={document.filename}>
            {document.filename}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatFileSize(document.size)} • {formatDate(document.createdAt)}
          </p>
        </div>
        {document.isVault && (
          <span title="Document chiffré"><Lock className="w-5 h-5 text-gray-500 dark:text-gray-400" /></span>
        )}
      </div>

      {/* Status Badge */}
      <div className="mb-3">
        {document.status === 'inbox' && (
          <span className="px-2 py-1 text-xs rounded-full bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300 inline-flex items-center gap-1">
            <Inbox className="w-3 h-3" /> À traiter
          </span>
        )}
        {document.status === 'linked' && (
          <span className="px-2 py-1 text-xs rounded-full bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300 inline-flex items-center gap-1">
            <Link2 className="w-3 h-3" /> Lié ({document.links.length})
          </span>
        )}
        {document.status === 'archived' && (
          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 dark:bg-gray-700 dark:text-gray-300 inline-flex items-center gap-1">
            <Archive className="w-3 h-3" /> Archivé
          </span>
        )}
      </div>

      {/* Linked Transactions */}
      {document.links.length > 0 && (
        <div className="space-y-1 mb-3">
          {document.links.slice(0, 2).map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-900 dark:bg-gray-700 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="truncate flex-1">{link.transaction.description}</span>
              <span
                className={clsx(
                  'font-medium ml-2',
                  link.transaction.amount >= 0 ? 'text-success-600' : ''
                )}
              >
                {formatCurrency(link.transaction.amount)}
              </span>
              <button
                onClick={() => handleUnlink(link.transaction.id)}
                className="ml-2 text-gray-400 hover:text-danger-500"
                title="Délier"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {document.links.length > 2 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              + {document.links.length - 2} autre(s)
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div
        className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {document.status === 'inbox' && (
          <button onClick={onLink} className="btn-primary text-sm flex-1 inline-flex items-center justify-center gap-1">
            <Link2 className="w-4 h-4" /> Lier
          </button>
        )}
        {document.status !== 'inbox' && (
          <button onClick={onLink} className="btn-secondary text-sm flex-1">
            + Lier
          </button>
        )}
        {document.status !== 'archived' && (
          <button
            onClick={() => archiveMutation.mutate()}
            className="btn-ghost text-sm"
            title="Archiver"
          >
            <Archive className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleDelete}
          className="btn-ghost text-danger-600 text-sm"
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default DocumentCard;
