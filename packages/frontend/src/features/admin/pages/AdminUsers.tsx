// ============================================================================
// ADMIN USERS - Finance Hub
// User management for administrators
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Shield,
  ShieldOff,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface User {
  id: string;
  email: string;
  displayName: string | null;
  isInstanceAdmin: boolean;
  createdAt: string;
  _count: {
    memberships: number;
  };
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AdminUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () =>
      api.get<UsersResponse>(
        `/admin/users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`
      ),
  });

  const toggleAdminMutation = useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) =>
      api.patch(`/admin/users/${userId}`, { isInstanceAdmin: isAdmin }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const users = data?.users ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Utilisateurs</h2>
        <span className="text-sm text-ctp-subtext0">
          {pagination?.total ?? 0} utilisateurs
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ctp-overlay1" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Rechercher par email ou nom..."
          className="input pl-10 w-full"
        />
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
        </div>
      ) : users.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ctp-surface1 bg-ctp-surface0">
                <th className="text-left py-3 px-4 text-sm font-medium text-ctp-subtext1">
                  Utilisateur
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-ctp-subtext1">
                  Espaces
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-ctp-subtext1">
                  Admin
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-ctp-subtext1">
                  Inscription
                </th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-ctp-surface1 hover:bg-ctp-surface0"
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-ctp-text">
                        {user.displayName || user.email.split('@')[0]}
                      </p>
                      <p className="text-sm text-ctp-subtext0">{user.email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-ctp-surface1 rounded-full text-sm">
                      {user._count.memberships}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {user.isInstanceAdmin ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-ctp-mauve/20 text-ctp-mauve rounded-full text-xs font-medium">
                        <Shield className="h-3 w-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="text-ctp-overlay1">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-ctp-subtext0">
                    {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() =>
                        toggleAdminMutation.mutate({
                          userId: user.id,
                          isAdmin: !user.isInstanceAdmin,
                        })
                      }
                      disabled={toggleAdminMutation.isPending}
                      className={`p-2 rounded-lg transition-colors ${
                        user.isInstanceAdmin
                          ? 'text-ctp-red hover:bg-ctp-red/10'
                          : 'text-ctp-overlay1 hover:bg-ctp-surface1'
                      }`}
                      title={user.isInstanceAdmin ? 'Retirer les droits admin' : 'Promouvoir admin'}
                    >
                      {user.isInstanceAdmin ? (
                        <ShieldOff className="h-4 w-4" />
                      ) : (
                        <Shield className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-ctp-subtext0">
          Aucun utilisateur trouve
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ctp-subtext0">
            Page {pagination.page} sur {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary p-2 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="btn-secondary p-2 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsers;
