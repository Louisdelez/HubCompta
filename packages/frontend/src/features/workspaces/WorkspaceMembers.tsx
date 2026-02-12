// ============================================================================
// WORKSPACE MEMBERS - Finance Hub
// Reusable component for displaying and managing workspace members
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { X, Users, Loader2, Wallet, Shield, Eye, UserPlus } from 'lucide-react';
import { api } from '@/lib/api/client';
import { SpendingLimitForm } from './SpendingLimitForm';
import { FamilyInviteModal } from './FamilyInviteModal';
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

interface WorkspaceMembersProps {
  workspaceId: string;
  workspaceType: 'personal' | 'family' | 'flatshare' | 'company';
  currentUserRole: 'owner' | 'admin' | 'accountant' | 'member' | 'readonly';
  compact?: boolean;
  showInviteButton?: boolean;
  onInviteClick?: () => void;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const ROLE_LABEL_KEYS: Record<Member['role'], string> = {
  owner: 'workspaces.members.roles.owner',
  admin: 'workspaces.members.roles.admin',
  accountant: 'workspaces.members.roles.accountant',
  member: 'workspaces.members.roles.member',
  family_member: 'workspaces.members.roles.family_member',
  readonly: 'workspaces.members.roles.readonly',
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
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function WorkspaceMembers({
  workspaceId,
  workspaceType,
  currentUserRole,
  compact = false,
  showInviteButton = true,
  onInviteClick,
}: WorkspaceMembersProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingSpendingLimit, setEditingSpendingLimit] = useState<Member | null>(null);
  const [showFamilyInvite, setShowFamilyInvite] = useState(false);

  const canManage = ['owner', 'admin'].includes(currentUserRole);
  const isOwner = currentUserRole === 'owner';
  const isFamilyWorkspace = workspaceType === 'family';

  // Fetch members
  const { data: members, isLoading } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => api.get<Member[]>(`/workspaces/${workspaceId}/members`),
    enabled: !!workspaceId,
  });

  // Update family settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: ({ memberId, settings }: { memberId: string; settings: { approvalRequired?: boolean } }) =>
      api.patch(`/workspaces/${workspaceId}/members/${memberId}/settings`, settings),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-ctp-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-ctp-blue" />
            <h3 className="font-semibold text-ctp-text">
              {t('workspaces.members.title')} ({members?.length ?? 0})
            </h3>
          </div>
          {showInviteButton && canManage && (
            <button
              onClick={() => {
                if (isFamilyWorkspace) {
                  setShowFamilyInvite(true);
                } else if (onInviteClick) {
                  onInviteClick();
                }
              }}
              className="btn-sm btn-primary"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              {t('workspaces.members.invite')}
            </button>
          )}
        </div>
      )}

      {/* Members list */}
      <div className="space-y-2">
        {members?.map((member) => (
          <div
            key={member.id}
            className={clsx(
              'rounded-lg border border-ctp-surface0 bg-ctp-surface0/50',
              compact ? 'p-2' : 'p-3'
            )}
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div
                className={clsx(
                  'rounded-full bg-ctp-blue/20 flex items-center justify-center flex-shrink-0',
                  compact ? 'w-8 h-8' : 'w-10 h-10'
                )}
              >
                <span
                  className={clsx(
                    'font-medium text-ctp-blue',
                    compact ? 'text-xs' : 'text-sm'
                  )}
                >
                  {member.displayName.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p
                  className={clsx(
                    'font-medium truncate text-ctp-text',
                    compact && 'text-sm'
                  )}
                >
                  {member.displayName}
                </p>
                {!compact && (
                  <p className="text-xs text-ctp-subtext0 truncate">
                    {member.email}
                  </p>
                )}
              </div>

              {/* Role badge */}
              <span
                className={clsx(
                  'badge text-xs',
                  ROLE_COLORS[member.role]
                )}
              >
                {t(ROLE_LABEL_KEYS[member.role])}
              </span>

              {/* Remove button */}
              {isOwner && member.role !== 'owner' && !compact && (
                <button
                  onClick={() => {
                    if (confirm(t('workspaces.members.removeConfirm', { name: member.displayName }))) {
                      void removeMutation.mutateAsync(member.id);
                    }
                  }}
                  className="btn-ghost text-ctp-red hover:bg-ctp-red/10 p-1"
                  title={t('workspaces.members.remove')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Family sharing controls */}
            {isFamilyWorkspace && member.role !== 'owner' && canManage && !compact && (
              <div className="mt-2 pt-2 border-t border-ctp-surface1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Spending Limit */}
                  <button
                    onClick={() => setEditingSpendingLimit(member)}
                    className={clsx(
                      'flex items-center gap-1 px-2 py-1 rounded transition-colors',
                      member.spendingLimit !== null
                        ? 'bg-ctp-blue/10 text-ctp-blue'
                        : 'bg-ctp-surface1 text-ctp-subtext0 hover:bg-ctp-surface2'
                    )}
                  >
                    <Wallet className="w-3 h-3" />
                    {member.spendingLimit !== null
                      ? formatCurrency(member.spendingLimit)
                      : t('workspaces.members.unlimited')}
                  </button>

                  {/* Spending Progress */}
                  {member.spendingLimit !== null && member.currentMonthSpent !== undefined && (
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1 bg-ctp-surface1 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full',
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
                      <span className="text-ctp-subtext0">
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
                      'flex items-center gap-1 px-2 py-1 rounded transition-colors',
                      member.approvalRequired
                        ? 'bg-ctp-mauve/10 text-ctp-mauve'
                        : 'bg-ctp-surface1 text-ctp-subtext0 hover:bg-ctp-surface2'
                    )}
                  >
                    <Shield className="w-3 h-3" />
                    {member.approvalRequired ? t('workspaces.members.approval') : t('workspaces.members.auto')}
                  </button>

                  {/* Category count */}
                  {member.visibleCategories.length > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded bg-ctp-surface1 text-ctp-subtext0">
                      <Eye className="w-3 h-3" />
                      {member.visibleCategories.length}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Spending limit modal */}
      {editingSpendingLimit && (
        <SpendingLimitForm
          workspaceId={workspaceId}
          memberId={editingSpendingLimit.id}
          memberName={editingSpendingLimit.displayName}
          currentLimit={editingSpendingLimit.spendingLimit}
          currentSpent={editingSpendingLimit.currentMonthSpent ?? 0}
          approvalRequired={editingSpendingLimit.approvalRequired}
          visibleCategories={editingSpendingLimit.visibleCategories}
          onClose={() => setEditingSpendingLimit(null)}
        />
      )}

      {/* Family invite modal */}
      {showFamilyInvite && (
        <FamilyInviteModal
          workspaceId={workspaceId}
          onClose={() => setShowFamilyInvite(false)}
        />
      )}
    </div>
  );
}

export default WorkspaceMembers;
