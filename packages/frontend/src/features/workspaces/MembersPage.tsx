// ============================================================================
// MEMBERS PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/lib/api/client';
import { InviteMember } from './InviteMember';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Member {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'accountant' | 'member' | 'readonly';
  joinedAt: string;
}

interface MembersPageProps {
  workspaceId: string;
  currentUserRole: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const ROLE_LABELS: Record<Member['role'], string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  accountant: 'Comptable',
  member: 'Membre',
  readonly: 'Lecture seule',
};

const ROLE_COLORS: Record<Member['role'], string> = {
  owner: 'bg-ctp-yellow/20 text-ctp-yellow',
  admin: 'bg-ctp-mauve/20 text-ctp-mauve',
  accountant: 'bg-ctp-green/20 text-ctp-green',
  member: 'bg-ctp-surface1 text-ctp-subtext0',
  readonly: 'bg-ctp-surface0 text-ctp-overlay1',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function MembersPage({ workspaceId, currentUserRole }: MembersPageProps) {
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);

  const canInvite = ['owner', 'admin'].includes(currentUserRole);
  const canManage = ['owner', 'admin'].includes(currentUserRole);
  const isOwner = currentUserRole === 'owner';

  // Fetch members
  const { data: members, isLoading } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => api.get<Member[]>(`/workspaces/${workspaceId}/members`),
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      api.patch(`/workspaces/${workspaceId}/members/${memberId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      setEditingMember(null);
    },
  });

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/workspaces/${workspaceId}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-ctp-surface1 rounded w-1/3" />
          <div className="h-16 bg-ctp-surface1 rounded" />
          <div className="h-16 bg-ctp-surface1 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Membres</h1>
          <p className="text-ctp-subtext0">
            {members?.length ?? 0} membre{(members?.length ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="btn-primary"
          >
            Inviter
          </button>
        )}
      </div>

      {/* Members list */}
      <div className="space-y-3">
        {members?.map((member) => (
          <div key={member.id} className="card flex items-center gap-4">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-ctp-blue/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-ctp-blue">
                {member.displayName.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{member.displayName}</p>
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
                    removeMutation.mutate(member.id);
                  }
                }}
                className="btn-ghost text-ctp-red hover:bg-ctp-red/10"
                title="Retirer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <InviteMember
          workspaceId={workspaceId}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}

export default MembersPage;
