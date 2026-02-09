// ============================================================================
// INVITE MEMBER - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface InviteFormData {
  email: string;
  role: 'admin' | 'accountant' | 'member' | 'readonly';
}

interface InviteMemberProps {
  workspaceId: string;
  onClose: () => void;
}

interface InviteResponse {
  invitation: {
    id: string;
    email: string;
    role: string;
    expiresAt: string;
  };
  inviteLink: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function InviteMember({ workspaceId, onClose }: InviteMemberProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteFormData>({
    defaultValues: {
      role: 'member',
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteFormData) =>
      api.post<InviteResponse>(`/workspaces/${workspaceId}/invite`, data),
    onSuccess: (data) => {
      setInviteLink(window.location.origin + data.inviteLink);
      void queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'invitation');
    },
  });

  const onSubmit = (data: InviteFormData) => {
    setError(null);
    inviteMutation.mutate(data);
  };

  const copyLink = () => {
    if (inviteLink) {
      void navigator.clipboard.writeText(inviteLink);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-md w-full animate-scale-in">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Inviter un membre</h2>

          {inviteLink ? (
            // Success state
            <div className="space-y-4">
              <div className="p-4 bg-ctp-green/10 rounded-lg">
                <p className="text-ctp-green font-medium">
                  Invitation créée !
                </p>
                <p className="text-sm text-ctp-green/80 mt-1">
                  Partagez ce lien avec la personne à inviter.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="input flex-1 text-sm"
                />
                <button onClick={copyLink} className="btn-primary">
                  Copier
                </button>
              </div>

              <p className="text-xs text-ctp-subtext0">
                Ce lien expire dans 7 jours.
              </p>

              <button onClick={onClose} className="btn-secondary w-full">
                Fermer
              </button>
            </div>
          ) : (
            // Form state
            <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)(e); }} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  placeholder="exemple@email.com"
                  {...register('email', {
                    required: 'Email requis',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Email invalide',
                    },
                  })}
                />
                {errors.email && (
                  <p className="error-text">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="role" className="label">
                  Rôle
                </label>
                <select id="role" className="input" {...register('role')}>
                  <option value="admin">Administrateur</option>
                  <option value="accountant">Comptable</option>
                  <option value="member">Membre</option>
                  <option value="readonly">Lecture seule</option>
                </select>
                <p className="text-xs text-ctp-subtext0 mt-1">
                  {getRoleDescription(register('role').name)}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {inviteMutation.isPending ? 'Envoi...' : 'Inviter'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function getRoleDescription(role: string): string {
  switch (role) {
    case 'admin':
      return 'Peut gérer les membres et les paramètres';
    case 'accountant':
      return 'Peut gérer les transactions, budgets et imports';
    case 'member':
      return 'Peut ajouter des transactions et documents';
    case 'readonly':
      return 'Consultation uniquement';
    default:
      return '';
  }
}

export default InviteMember;
