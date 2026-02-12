// ============================================================================
// DOCUMENTS PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// Virtualized for performance with large document collections
// ============================================================================

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Inbox, Link2, Archive, FileText } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DocumentCard } from './DocumentCard';
import { DocumentUpload } from './DocumentUpload';
import { DocumentViewer } from './DocumentViewer';
import { LinkToTransaction } from './LinkToTransaction';
import { clsx } from 'clsx';

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

type FilterStatus = 'all' | 'inbox' | 'linked' | 'archived';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const CARD_HEIGHT = 260; // Approximate height of a document card
const CARD_GAP = 16; // Gap between cards

// ----------------------------------------------------------------------------
// Hooks - Responsive columns
// ----------------------------------------------------------------------------

function useGridColumns() {
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    function updateColumns() {
      const width = window.innerWidth;
      if (width < 768) {
        setColumns(1);
      } else if (width < 1024) {
        setColumns(2);
      } else {
        setColumns(3);
      }
    }

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  return columns;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DocumentsPage() {
  const { t } = useTranslation();
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const columns = useGridColumns();
  const parentRef = useRef<HTMLDivElement>(null);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [linkingDocument, setLinkingDocument] = useState<Document | null>(null);

  // Fetch documents
  const { data, isLoading } = useQuery({
    queryKey: ['documents', workspaceId, filterStatus, searchQuery],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (searchQuery) params.append('search', searchQuery);
      return api.get<{ documents: Document[]; total: number }>(
        `/workspaces/${workspaceId}/documents?${params}`
      );
    },
    enabled: !!workspaceId,
  });

  // Fetch inbox count
  const { data: inboxCount } = useQuery({
    queryKey: ['documents', workspaceId, 'inbox-count'],
    queryFn: () => api.get<{ count: number }>(`/workspaces/${workspaceId}/documents/inbox-count`),
    enabled: !!workspaceId,
  });

  const documents = data?.documents ?? [];

  // Group documents into rows for virtualization
  const rows = useMemo(() => {
    const result: Document[][] = [];
    for (let i = 0; i < documents.length; i += columns) {
      result.push(documents.slice(i, i + columns));
    }
    return result;
  }, [documents, columns]);

  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT + CARD_GAP,
    overscan: 2,
    getItemKey: (index) => `row-${index}`,
  });

  const handleUploadComplete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
    setShowUpload(false);
  }, [queryClient, workspaceId]);

  const handleDocumentAction = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
  }, [queryClient, workspaceId]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const container = parentRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    const rowHeight = CARD_HEIGHT + CARD_GAP;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        container.scrollTop = currentScrollTop + rowHeight;
        break;
      case 'ArrowUp':
        e.preventDefault();
        container.scrollTop = currentScrollTop - rowHeight;
        break;
      case 'PageDown':
        e.preventDefault();
        container.scrollTop = currentScrollTop + clientHeight;
        break;
      case 'PageUp':
        e.preventDefault();
        container.scrollTop = currentScrollTop - clientHeight;
        break;
      case 'Home':
        e.preventDefault();
        container.scrollTop = 0;
        break;
      case 'End':
        e.preventDefault();
        container.scrollTop = container.scrollHeight;
        break;
    }
  }, []);

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        {t('documents.selectWorkspace')}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('documents.title')}</h1>
          <p className="text-ctp-subtext0">
            {t('documents.description')}
          </p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary">
          {t('documents.addDocument')}
        </button>
      </div>

      {/* Inbox Alert */}
      {inboxCount && inboxCount.count > 0 && (
        <div className="card bg-ctp-yellow/10 border-ctp-yellow mb-6">
          <div className="flex items-center gap-3">
            <Inbox className="w-6 h-6 text-ctp-yellow" />
            <div className="flex-1">
              <p className="font-medium text-ctp-yellow">
                {t('documents.inbox.alert', { count: inboxCount.count })}
              </p>
              <p className="text-sm text-ctp-yellow/80">
                {t('documents.inbox.description')}
              </p>
            </div>
            <button
              onClick={() => setFilterStatus('inbox')}
              className="btn-secondary text-sm"
            >
              {t('documents.inbox.view')}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Status Filter */}
        <div className="flex rounded-lg border border-ctp-surface1 overflow-hidden">
          {(['all', 'inbox', 'linked', 'archived'] as FilterStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={clsx(
                'px-4 py-2 text-sm font-medium transition-colors',
                filterStatus === status
                  ? 'bg-ctp-blue text-white'
                  : 'bg-ctp-base text-ctp-subtext0 hover:bg-ctp-surface0'
              )}
            >
              {status === 'all' && t('documents.filter.all')}
              {status === 'inbox' && <><Inbox className="w-4 h-4 inline mr-1" />{t('documents.filter.toProcess')}</>}
              {status === 'linked' && <><Link2 className="w-4 h-4 inline mr-1" />{t('documents.filter.linked')}</>}
              {status === 'archived' && <><Archive className="w-4 h-4 inline mr-1" />{t('documents.filter.archived')}</>}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder={t('documents.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-ctp-surface0 border border-ctp-surface1 text-ctp-text placeholder-ctp-overlay0 focus:border-ctp-blue focus:ring-2 focus:ring-ctp-blue/20 outline-none transition-colors"
          />
        </div>
      </div>

      {/* Documents Grid - Virtualized */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 bg-ctp-surface1 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : documents.length > 0 ? (
        <div
          ref={parentRef}
          className="flex-1 overflow-auto min-h-0"
          style={{ height: 'calc(100vh - 400px)' }}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="grid"
          aria-label={t('documents.documentsGrid')}
          aria-rowcount={rows.length}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index] as Document[];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  role="row"
                  aria-rowindex={virtualRow.index + 1}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className={clsx(
                      'grid gap-4 pb-4',
                      columns === 1 && 'grid-cols-1',
                      columns === 2 && 'grid-cols-2',
                      columns === 3 && 'grid-cols-3'
                    )}
                  >
                    {row.map((doc) => (
                      <div key={doc.id} role="gridcell">
                        <DocumentCard
                          document={doc}
                          workspaceId={workspaceId}
                          onView={() => setSelectedDocument(doc)}
                          onLink={() => setLinkingDocument(doc)}
                          onAction={handleDocumentAction}
                        />
                      </div>
                    ))}
                    {/* Add empty placeholders to maintain grid layout */}
                    {row.length < columns &&
                      Array.from({ length: columns - row.length }).map((_, i) => (
                        <div key={`placeholder-${i}`} role="gridcell" aria-hidden="true" />
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 mx-auto mb-4 text-ctp-overlay1" />
          <h2 className="text-xl font-bold mb-2">{t('documents.noDocuments')}</h2>
          <p className="text-ctp-subtext0 mb-6">
            {filterStatus !== 'all'
              ? t('documents.noDocumentsInCategory')
              : t('documents.startAddingDocuments')}
          </p>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            {t('documents.addDocument')}
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <DocumentUpload
          workspaceId={workspaceId}
          onClose={() => setShowUpload(false)}
          onComplete={handleUploadComplete}
        />
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <DocumentViewer
          workspaceId={workspaceId}
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onLink={() => {
            setLinkingDocument(selectedDocument);
            setSelectedDocument(null);
          }}
        />
      )}

      {/* Link to Transaction Modal */}
      {linkingDocument && (
        <LinkToTransaction
          workspaceId={workspaceId}
          document={linkingDocument}
          onClose={() => setLinkingDocument(null)}
          onLinked={() => {
            handleDocumentAction();
            setLinkingDocument(null);
          }}
        />
      )}
    </div>
  );
}

export default DocumentsPage;
