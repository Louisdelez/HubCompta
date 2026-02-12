// ============================================================================
// DOCUMENT CARD - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// Memoized for performance in lists
// ============================================================================

import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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

function getFileIcon(mimeType: string): { icon: LucideIcon; colorClass: string } {
  if (mimeType.startsWith('image/')) return { icon: Image, colorClass: 'text-ctp-green' };
  if (mimeType === 'application/pdf') return { icon: BookOpen, colorClass: 'text-ctp-red' };
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return { icon: Sheet, colorClass: 'text-ctp-green' };
  if (mimeType === 'text/csv') return { icon: FileSpreadsheet, colorClass: 'text-ctp-green' };
  return { icon: FileText, colorClass: 'text-ctp-blue' };
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

function DocumentCardComponent({
  document,
  workspaceId,
  onView,
  onLink,
  onAction,
}: DocumentCardProps) {
  const { t } = useTranslation();

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

  const handleDelete = useCallback(() => {
    if (confirm(t('documents.card.confirmDelete', { filename: document.filename }))) {
      deleteMutation.mutate();
    }
  }, [document.filename, deleteMutation, t]);

  const handleUnlink = useCallback((transactionId: string) => {
    if (confirm(t('documents.card.confirmUnlink'))) {
      unlinkMutation.mutate(transactionId);
    }
  }, [unlinkMutation, t]);

  return (
    <div
      className={clsx(
        'card hover:shadow-md transition-shadow cursor-pointer',
        document.status === 'inbox' && 'ring-2 ring-ctp-yellow',
        document.status === 'linked' && 'bg-ctp-green/10 border-ctp-green/30',
        document.status !== 'linked' && 'bg-ctp-surface0'
      )}
      onClick={onView}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {(() => { const { icon: Icon, colorClass } = getFileIcon(document.mimeType); return <Icon className={clsx('w-8 h-8', colorClass)} />; })()}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate" title={document.filename}>
            {document.filename}
          </p>
          <p className="text-sm text-ctp-subtext0">
            {formatFileSize(document.size)} • {formatDate(document.createdAt)}
          </p>
        </div>
        {document.isVault && (
          <span title={t('documents.card.encryptedDocument')}><Lock className="w-5 h-5 text-ctp-subtext0" /></span>
        )}
      </div>

      {/* Status Badge */}
      <div className="mb-3">
        {document.status === 'inbox' && (
          <span className="px-2 py-1 text-xs rounded-full bg-ctp-yellow/20 text-ctp-yellow inline-flex items-center gap-1">
            <Inbox className="w-3 h-3" /> {t('documents.card.toProcess')}
          </span>
        )}
        {document.status === 'linked' && (
          <span className="px-2 py-1 text-xs rounded-full bg-ctp-green/20 text-ctp-green inline-flex items-center gap-1">
            <Link2 className="w-3 h-3" /> {t('documents.card.linked')} ({document.links.length})
          </span>
        )}
        {document.status === 'archived' && (
          <span className="px-2 py-1 text-xs rounded-full bg-ctp-surface1 text-ctp-subtext0 inline-flex items-center gap-1">
            <Archive className="w-3 h-3" /> {t('documents.card.archived')}
          </span>
        )}
      </div>

      {/* Linked Transactions */}
      {document.links.length > 0 && (
        <div className="space-y-1 mb-3">
          {document.links.slice(0, 2).map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between text-sm p-2 bg-ctp-surface0 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="truncate flex-1">{link.transaction.description}</span>
              <span
                className={clsx(
                  'font-medium ml-2',
                  link.transaction.amount >= 0 ? 'text-ctp-green' : ''
                )}
              >
                {formatCurrency(link.transaction.amount)}
              </span>
              <button
                onClick={() => handleUnlink(link.transaction.id)}
                className="ml-2 text-ctp-overlay1 hover:text-ctp-red"
                title={t('documents.card.unlink')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {document.links.length > 2 && (
            <p className="text-xs text-ctp-subtext0 text-center">
              {t('documents.card.moreLinks', { count: document.links.length - 2 })}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div
        className="flex gap-2 pt-3 border-t border-ctp-surface1"
        onClick={(e) => e.stopPropagation()}
      >
        {document.status === 'inbox' && (
          <button onClick={onLink} className="btn-primary text-sm flex-1 inline-flex items-center justify-center gap-1">
            <Link2 className="w-4 h-4" /> {t('documents.card.link')}
          </button>
        )}
        {document.status !== 'inbox' && (
          <button onClick={onLink} className="btn-secondary text-sm flex-1">
            + {t('documents.card.link')}
          </button>
        )}
        {document.status !== 'archived' && (
          <button
            onClick={() => archiveMutation.mutate()}
            className="btn-ghost text-sm"
            title={t('documents.card.archive')}
          >
            <Archive className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleDelete}
          className="btn-ghost text-ctp-red text-sm"
          title={t('documents.card.delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders in lists
export const DocumentCard = memo(DocumentCardComponent);

export default DocumentCard;
