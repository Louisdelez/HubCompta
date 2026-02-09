// ============================================================================
// DOCUMENTS PAGE - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
// Component
// ----------------------------------------------------------------------------

export function DocumentsPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

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

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
    setShowUpload(false);
  };

  const handleDocumentAction = () => {
    queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Sélectionnez un espace de travail
      </div>
    );
  }

  const documents = data?.documents ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gérez vos justificatifs et pièces jointes
          </p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary">
          + Ajouter un document
        </button>
      </div>

      {/* Inbox Alert */}
      {inboxCount && inboxCount.count > 0 && (
        <div className="card bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800 mb-6">
          <div className="flex items-center gap-3">
            <Inbox className="w-6 h-6 text-warning-600" />
            <div className="flex-1">
              <p className="font-medium text-warning-800 dark:text-warning-200">
                {inboxCount.count} document{inboxCount.count > 1 ? 's' : ''} à traiter
              </p>
              <p className="text-sm text-warning-700 dark:text-warning-300">
                Ces documents n'ont pas encore été liés à une transaction
              </p>
            </div>
            <button
              onClick={() => setFilterStatus('inbox')}
              className="btn-secondary text-sm"
            >
              Voir
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Status Filter */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {(['all', 'inbox', 'linked', 'archived'] as FilterStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={clsx(
                'px-4 py-2 text-sm font-medium transition-colors',
                filterStatus === status
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              {status === 'all' && 'Tous'}
              {status === 'inbox' && <><Inbox className="w-4 h-4 inline mr-1" />À traiter</>}
              {status === 'linked' && <><Link2 className="w-4 h-4 inline mr-1" />Liés</>}
              {status === 'archived' && <><Archive className="w-4 h-4 inline mr-1" />Archivés</>}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Rechercher un document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input"
          />
        </div>
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              workspaceId={workspaceId}
              onView={() => setSelectedDocument(doc)}
              onLink={() => setLinkingDocument(doc)}
              onAction={handleDocumentAction}
            />
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold mb-2">Aucun document</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {filterStatus !== 'all'
              ? 'Aucun document dans cette catégorie'
              : 'Commencez par ajouter vos premiers justificatifs'}
          </p>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            Ajouter un document
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
