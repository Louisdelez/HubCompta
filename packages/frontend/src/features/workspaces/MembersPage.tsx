// ============================================================================
// MEMBERS PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { X, Users, Loader2, Wallet, Shield, Eye } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { InviteMember } from './InviteMember';
import { FamilyInviteModal } from './FamilyInviteModal';
import { SpendingLimitForm } from './SpendingLimitForm';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Member {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'accountant' | 'member' | 'family_member' | 'readonly';
  joinedAt: string;
  // Family sharing fields
  spendingLimit: number | null;
  approvalRequired: boolean;
  visibleCategories: string[];
  currentMonthSpent?: number;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const ROLE_LABELS: Record<Member['role'], string> = {
  owner: 'Proprietaire',
  admin: 'Administrateur',
  accountant: 'Comptable',
  member: 'Membre',
  family_member: 'Membre famille',
  readonly: 'Lecture seule',
};

const ROLE_COLORS: Record<Member['role'], string> = {
  owner: 'bg-ctp-yellow/20 text-ctp-yellow',
  admin: 'bg-ctp-mauve/20 text-ctp-mauve',
  accountant: 'bg-ctp-green/20 text-ctp-green',
  member: 'bg-ctp-surface1 text-ctp-subtext0',
  family_member: 'bg-ctp-blue/20 text-ctp-blue',
  readonly: 'bg-ctp-surface0 text-ctp-overlay1',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function MembersPage() {
  const { workspaceId: paramWorkspaceId } = useParams<{ workspaceId: string }>();
  const { currentWorkspaceId, currentWorkspace } = useWorkspace();
  const workspaceId = paramWorkspaceId || currentWorkspaceId;
  const currentUserRole = currentWorkspace?.role || 'readonly';
  const isFamilyWorkspace = currentWorkspace?.type === 'family';

  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [showFamilyInvite, setShowFamilyInvite] = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editingSpendingLimit, setEditingSpendingLimit] = useState<Member | null>(null);

  const canInvite = ['owner', 'admin'].includes(currentUserRole);
  const canManage = ['owner', 'admin'].includes(currentUserRole);
  const isOwner = currentUserRole === 'owner';

  // Fetch members
  const { data: members, isLoading } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => api.get<Member[]>(`/workspaces/${workspaceId}/members`),
    enabled: !!workspaceId,
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      api.patch(`/workspaces/${workspaceId}/members/${memberId}`, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      setEditingMember(null);
    },
  });

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/workspaces/${workspaceId}/members/${memberId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
  });

  // Update family settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: ({ memberId, settings }: { memberId: string; settings: { approvalRequired?: boolean } }) =>
      api.patch(`/workspaces/${workspaceId}/members/${memberId}/settings`, settings),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Selectionnez un espace de travail
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ctp-blue" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-ctp-blue/20">
            <Users className="w-6 h-6 text-ctp-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ctp-text">Membres</h1>
            <p className="text-ctp-subtext0">
              {members?.length ?? 0} membre{(members?.length ?? 0) > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {canInvite && (
          <div className="flex gap-2">
            {isFamilyWorkspace && (
              <button
                onClick={() => setShowFamilyInvite(true)}
                className="btn-primary"
              >
                Inviter famille
              </button>
            )}
            <button
              onClick={() => setShowInvite(true)}
              className={isFamilyWorkspace ? 'btn-secondary' : 'btn-primary'}
            >
              Inviter
            </button>
          </div>
        )}
      </div>

      {/* Members list */}
      <div className="space-y-3">
        {members?.map((member) => (
          <div key={member.id} className="card">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-ctp-blue/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-ctp-blue">
                  {member.displayName.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-ctp-text">{member.displayName}</p>
                <p className="text-sm text-ctp-subtext0 truncate">
                  {member.email}
                </p>
              </div>

              {/* Role */}
              {editingMember === member.id && canManage && member.role !== 'owner' ? (
                <select
                  value={member.role}
                  onChange={(e) => {
                    updateRoleMutation.mutate({
                      memberId: member.id,
                      role: e.target.value,
                    });
                  }}
                  className="input w-auto"
                  autoFocus
                  onBlur={() => setEditingMember(null)}
                >
                  <option value="admin">Administrateur</option>
                  <option value="accountant">Comptable</option>
                  <option value="member">Membre</option>
                  <option value="family_member">Membre famille</option>
                  <option value="readonly">Lecture seule</option>
                </select>
              ) : (
                <button
                  onClick={() => canManage && member.role !== 'owner' && setEditingMember(member.id)}
                  className={clsx(
                    'badge',
                    ROLE_COLORS[member.role],
                    canManage && member.role !== 'owner' && 'cursor-pointer'
                  )}
                >
                  {ROLE_LABELS[member.role]}
                </button>
              )}

              {/* Joined date */}
              <span className="text-sm text-ctp-subtext0 hidden sm:block">
                {formatDate(member.joinedAt)}
              </span>

              {/* Actions */}
              {isOwner && member.role !== 'owner' && (
                <button
                  onClick={() => {
                    if (confirm(`Retirer ${member.displayName} de l'espace ?`)) {
                      void removeMutation.mutateAsync(member.id);
                    }
                  }}
                  className="btn-ghost text-ctp-red hover:bg-ctp-red/10"
                  title="Retirer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Family sharing controls - only show for family workspaces */}
            {isFamilyWorkspace && member.role !== 'owner' && canManage && (
              <div className="mt-3 pt-3 border-t border-ctp-surface0">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {/* Spending Limit */}
                  <button
                    onClick={() => setEditingSpendingLimit(member)}
                    className={clsx(
                      'flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors',
                      member.spendingLimit !== null
                        ? 'bg-ctp-blue/10 text-ctp-blue'
                        : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
                    )}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    {member.spendingLimit !== null ? (
                      <span>{formatCurrency(member.spendingLimit)}/mois</span>
                    ) : (
                      <span>Pas de limite</span>
                    )}
                  </button>

                  {/* Spending Progress */}
                  {member.spendingLimit !== null && member.currentMonthSpent !== undefined && (
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-ctp-surface1 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full transition-all',
                            member.currentMonthSpent > member.spendingLimit
                              ? 'bg-ctp-red'
                              : member.currentMonthSpent / member.spendingLimit >= 0.8
                              ? 'bg-ctp-yellow'
                              : 'bg-ctp-green'
                          )}
                          style={{
                            width: `${Math.min(100, (member.currentMonthSpent / member.spendingLimit) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-ctp-subtext0">
                        {formatCurrency(member.currentMonthSpent)}
                      </span>
                    </div>
                  )}

                  {/* Approval Required */}
                  <button
                    onClick={() => {
                      updateSettingsMutation.mutate({
                        memberId: member.id,
                        settings: { approvalRequired: !member.approvalRequired },
                      });
                    }}
                    className={clsx(
                      'flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors',
                      member.approvalRequired
                        ? 'bg-ctp-mauve/10 text-ctp-mauve'
                        : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
                    )}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>{member.approvalRequired ? 'Approbation' : 'Auto'}</span>
                  </button>

                  {/* Visible Categories */}
                  {member.visibleCategories.length > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-ctp-surface0 text-ctp-subtext0">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{member.visibleCategories.length} categories</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Invite modal */}
      {showInvite && workspaceId && (
        <InviteMember
          workspaceId={workspaceId}
          onClose={() => setShowInvite(false)}
        />
      )}

      {/* Family invite modal */}
      {showFamilyInvite && workspaceId && (
        <FamilyInviteModal
          workspaceId={workspaceId}
          onClose={() => setShowFamilyInvite(false)}
        />
      )}

      {/* Spending limit form */}
      {editingSpendingLimit && workspaceId && (
        <SpendingLimitForm
          workspaceId={workspaceId}
          memberId={editingSpendingLimit.id}
          memberName={editingSpendingLimit.displayName}
          currentLimit={editingSpendingLimit.spendingLimit}
          currentSpent={editingSpendingLimit.currentMonthSpent ?? 0}
          onClose={() => setEditingSpendingLimit(null)}
        />
      )}
    </div>
  );
}

export default MembersPage;
