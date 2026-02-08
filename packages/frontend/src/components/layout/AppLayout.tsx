// ============================================================================
// APP LAYOUT - Finance Hub
// ============================================================================

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { clsx } from 'clsx';
import { GlobalSearchBar } from '@/features/search';
import { useWorkspace } from '@/hooks/useWorkspace';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { WorkspaceSelector } from '@/features/workspaces/WorkspaceSelector';
import { CreateWorkspaceModal } from '@/features/workspaces/CreateWorkspaceModal';

// ----------------------------------------------------------------------------
// Navigation Items
// ----------------------------------------------------------------------------

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

const mainNavItems: NavItem[] = [
  { name: 'Tableau de bord', href: '/dashboard', icon: '📊' },
  { name: 'Transactions', href: '/transactions', icon: '💳' },
  { name: 'Comptes', href: '/accounts', icon: '🏦' },
  { name: 'Budgets', href: '/budgets', icon: '📈' },
  { name: 'Documents', href: '/documents', icon: '📄' },
];

const secondaryNavItems: NavItem[] = [
  { name: 'Recurrences', href: '/recurrences', icon: '🔄' },
  { name: 'Import', href: '/import', icon: '📥' },
  { name: 'Export', href: '/export', icon: '📤' },
  { name: 'Regles', href: '/rules', icon: '⚙️' },
  { name: 'Rapports', href: '/reports', icon: '📋' },
  { name: 'Devises', href: '/currencies', icon: '💱' },
  { name: 'Recherche', href: '/search', icon: '🔍' },
];

// ----------------------------------------------------------------------------
// Sidebar Component
// ----------------------------------------------------------------------------

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <span className="text-2xl">💰</span>
            <span className="font-bold text-lg">Finance Hub</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            <div className="space-y-1">
              {mainNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    )
                  }
                  onClick={() => onClose()}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>

            <div className="my-4 border-t border-gray-200 dark:border-gray-700" />

            <div className="space-y-1">
              {secondaryNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    )
                  }
                  onClick={() => onClose()}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>
          </nav>

          {/* User menu */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                  {user?.displayName?.charAt(0).toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user?.displayName ?? 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email ?? ''}
                </p>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              <NavLink
                to="/settings"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => onClose()}
              >
                <span>⚙️</span>
                <span>Paramètres</span>
              </NavLink>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/20 w-full"
              >
                <span>🚪</span>
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ----------------------------------------------------------------------------
// Header Component
// ----------------------------------------------------------------------------

interface HeaderProps {
  onMenuClick: () => void;
  onCreateWorkspace: () => void;
}

function Header({ onMenuClick, onCreateWorkspace }: HeaderProps) {
  const { currentWorkspace, switchWorkspace } = useWorkspace();

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 safe-area-inset-top">
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Workspace selector */}
        <div className="hidden sm:block min-w-[200px]">
          <WorkspaceSelector
            currentWorkspaceId={currentWorkspace?.id}
            onSelect={(workspace) => switchWorkspace(workspace.id)}
            onCreateNew={onCreateWorkspace}
          />
        </div>

        {/* Global Search */}
        <div className="flex-1 max-w-md mx-auto">
          {currentWorkspace?.id && <GlobalSearchBar workspaceId={currentWorkspace.id} />}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}

// ----------------------------------------------------------------------------
// Main Layout
// ----------------------------------------------------------------------------

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const { switchWorkspace } = useWorkspace();

  const handleWorkspaceCreated = (workspaceId: string) => {
    switchWorkspace(workspaceId);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0">
          <Header
            onMenuClick={() => setSidebarOpen(true)}
            onCreateWorkspace={() => setShowCreateWorkspace(true)}
          />

          <main className="flex-1 safe-area-inset-bottom">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={showCreateWorkspace}
        onClose={() => setShowCreateWorkspace(false)}
        onCreated={handleWorkspaceCreated}
      />
    </div>
  );
}
