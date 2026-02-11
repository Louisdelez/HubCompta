// ============================================================================
// BANK CONNECTIONS PAGE - Finance Hub
// Manage Open Banking connections
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  RefreshCw,
  Unlink,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Link2,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';
import { AddBankModal } from './AddBankModal';
import { LinkAccountModal } from './LinkAccountModal';

interface BankAccount {
  id: string;
  name: string;
  iban: string | null;
  balance: number;
  currency: string;
  type: string;
  linkedAccountId: string | null;
  lastSyncAt: string | null;
}

interface BankConnection {
  id: string;
  provider: string;
  institutionId: string;
  institutionName: string;
  institutionLogo: string | null;
  status: 'active' | 'expired' | 'error' | 'disconnected' | 'pending_auth';
  lastSyncAt: string | null;
  lastSyncError: string | null;
  consentExpiresAt: string | null;
  accounts: BankAccount[];
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(date: string | null): string {
  if (!date) return 'Jamais';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: BankConnection['status'] }) {
  const config = {
    active: { icon: CheckCircle, color: 'text-ctp-green bg-ctp-green/20', label: 'Connecte' },
    expired: { icon: AlertTriangle, color: 'text-ctp-yellow bg-ctp-yellow/20', label: 'Expire' },
    error: { icon: AlertTriangle, color: 'text-ctp-red bg-ctp-red/20', label: 'Erreur' },
    disconnected: { icon: Unlink, color: 'text-ctp-subtext0 bg-ctp-surface1', label: 'Deconnecte' },
    pending_auth: { icon: Clock, color: 'text-ctp-blue bg-ctp-blue/20', label: 'En attente' },
  };

  const { icon: Icon, color, label } = config[status] ?? config.error;

  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', color)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function BankAccountRow({
  account,
  onLink,
}: {
  account: BankAccount;
  onLink: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-ctp-surface0 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-ctp-surface1 rounded-full flex items-center justify-center">
          <Building2 className="w-5 h-5 text-ctp-subtext0" />
        </div>
        <div>
          <p className="font-medium text-ctp-text">{account.name}</p>
          <p className="text-xs text-ctp-subtext0">
            {account.iban ?? account.type}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-semibold text-ctp-text">
            {formatCurrency(account.balance, account.currency)}
          </p>
          <p className="text-xs text-ctp-subtext0">
            Sync: {formatDate(account.lastSyncAt)}
          </p>
        </div>
        {account.linkedAccountId ? (
          <span className="text-xs px-2 py-1 bg-ctp-green/20 text-ctp-green rounded-full">
            Lie
          </span>
        ) : (
          <button
            onClick={onLink}
            className="text-xs px-2 py-1 bg-ctp-blue/20 text-ctp-blue rounded-full hover:bg-ctp-blue/30"
          >
            <Link2 className="w-3 h-3 inline mr-1" />
            Lier
          </button>
        )}
      </div>
    </div>
  );
}

function BankConnectionCard({
  connection,
  workspaceId,
  onLinkAccount,
}: {
  connection: BankConnection;
  workspaceId: string;
  onLinkAccount: (account: BankAccount) => void;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const syncMutation = useMutation({
    mutationFn: () =>
      api.post(`/workspaces/${workspaceId}/banking/connections/${connection.id}/sync`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['banking', workspaceId] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      api.post(`/workspaces/${workspaceId}/banking/connections/${connection.id}/disconnect`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['banking', workspaceId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(`/workspaces/${workspaceId}/banking/connections/${connection.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['banking', workspaceId] });
    },
  });

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-ctp-surface0 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {connection.institutionLogo ? (
            <img
              src={connection.institutionLogo}
              alt={connection.institutionName}
              className="w-10 h-10 rounded-lg object-contain bg-white p-1"
            />
          ) : (
            <div className="w-10 h-10 bg-ctp-surface1 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-ctp-subtext0" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-ctp-text">{connection.institutionName}</h3>
            <p className="text-xs text-ctp-subtext0">
              {connection.accounts.length} compte(s) • Sync: {formatDate(connection.lastSyncAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={connection.status} />
          <div className="flex gap-1">
            {connection.status === 'active' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  syncMutation.mutate();
                }}
                disabled={syncMutation.isPending}
                className="p-2 rounded-lg hover:bg-ctp-surface1"
                title="Synchroniser"
              >
                {syncMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Deconnecter cette banque ?')) {
                  disconnectMutation.mutate();
                }
              }}
              disabled={disconnectMutation.isPending}
              className="p-2 rounded-lg hover:bg-ctp-surface1 text-ctp-subtext0"
              title="Deconnecter"
            >
              <Unlink className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Supprimer cette connexion ?')) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="p-2 rounded-lg hover:bg-ctp-surface1 text-ctp-red"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {connection.lastSyncError && (
        <div className="px-4 pb-2">
          <div className="bg-ctp-red/10 text-ctp-red text-sm p-2 rounded-lg">
            {connection.lastSyncError}
          </div>
        </div>
      )}

      {/* Accounts */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {connection.accounts.map((account) => (
            <BankAccountRow
              key={account.id}
              account={account}
              onLink={() => onLinkAccount(account)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BankConnectionsPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const [showAddModal, setShowAddModal] = useState(false);
  const [accountToLink, setAccountToLink] = useState<BankAccount | null>(null);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['banking', workspaceId, 'connections'],
    queryFn: () =>
      api.get<BankConnection[]>(
        `/workspaces/${workspaceId}/banking/connections`
      ),
    enabled: !!workspaceId,
  });

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Selectionnez un espace de travail
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-ctp-surface1 rounded w-1/4" />
          <div className="h-32 bg-ctp-surface1 rounded-xl" />
          <div className="h-32 bg-ctp-surface1 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-7 h-7" />
            Connexions Bancaires
          </h1>
          <p className="text-ctp-subtext0">
            Synchronisez vos comptes bancaires automatiquement
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4 mr-1" />
          Ajouter une banque
        </button>
      </div>

      {/* Connections List */}
      {connections.length > 0 ? (
        <div className="space-y-4">
          {connections.map((connection) => (
            <BankConnectionCard
              key={connection.id}
              connection={connection}
              workspaceId={workspaceId}
              onLinkAccount={setAccountToLink}
            />
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-ctp-overlay1" />
          <h2 className="text-xl font-bold mb-2">Aucune banque connectee</h2>
          <p className="text-ctp-subtext0 mb-6 max-w-md mx-auto">
            Connectez vos comptes bancaires pour synchroniser automatiquement
            vos transactions et soldes.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-1" />
            Connecter ma banque
          </button>
        </div>
      )}

      {/* Add Bank Modal */}
      {showAddModal && (
        <AddBankModal
          workspaceId={workspaceId}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Link Account Modal */}
      {accountToLink && (
        <LinkAccountModal
          workspaceId={workspaceId}
          bankAccount={accountToLink}
          onClose={() => setAccountToLink(null)}
          onLinked={() => setAccountToLink(null)}
        />
      )}
    </div>
  );
}

export default BankConnectionsPage;
