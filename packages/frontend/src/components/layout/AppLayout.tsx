// ============================================================================
// APP LAYOUT - Finance Hub
// ============================================================================

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { clsx } from 'clsx';
import { GlobalSearchBar } from '@/features/search';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePrefetch } from '@/hooks/usePrefetch';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { WorkspaceSelector } from '@/features/workspaces/WorkspaceSelector';
import { CreateWorkspaceModal } from '@/features/workspaces/CreateWorkspaceModal';
import {
  ShortcutProvider,
  ShortcutHelp,
  useShortcut,
  useShortcuts,
} from '@/lib/shortcuts';
import { ShortcutHelpButton } from '@/components/ui/ShortcutHelpButton';
import {
  LayoutDashboard,
  CreditCard,
  Landmark,
  TrendingUp,
  LineChart,
  FileText,
  RefreshCw,
  Download,
  Upload,
  SlidersHorizontal,
  ClipboardList,
  BadgeDollarSign,
  Search,
  Shield,
  Settings,
  LogOut,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { CurrencyToggle } from '@/components/ui/CurrencyToggle';

// ----------------------------------------------------------------------------
// Navigation Items
// ----------------------------------------------------------------------------

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const mainNavItems: NavItem[] = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: CreditCard },
  { name: 'Comptes', href: '/accounts', icon: Landmark },
  { name: 'Budgets', href: '/budgets', icon: TrendingUp },
  { name: 'Investissements', href: '/portfolio', icon: LineChart },
  { name: 'Documents', href: '/documents', icon: FileText },
];

const secondaryNavItems: NavItem[] = [
  { name: 'Recurrences', href: '/recurrences', icon: RefreshCw },
  { name: 'Import', href: '/import', icon: Download },
  { name: 'Export', href: '/export', icon: Upload },
  { name: 'Regles', href: '/rules', icon: SlidersHorizontal },
  { name: 'Rapports', href: '/reports', icon: ClipboardList },
  { name: 'Devises', href: '/currencies', icon: BadgeDollarSign },
  { name: 'Recherche', href: '/search', icon: Search },
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
  const { prefetchOnHover } = usePrefetch();

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
          'fixed inset-y-0 left-0 z-50 w-64 bg-ctp-mantle border-r border-ctp-surface0 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-ctp-surface0">
            <div className="w-8 h-8 rounded-lg bg-ctp-blue flex items-center justify-center">
              <Wallet className="w-5 h-5 text-ctp-crust" />
            </div>
            <span className="font-bold text-lg text-ctp-text">Finance Hub</span>
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
                        ? 'bg-ctp-blue/20 text-ctp-blue'
                        : 'text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text'
                    )
                  }
                  onClick={() => onClose()}
                  onMouseEnter={() => prefetchOnHover(item.href)}
                  onFocus={() => prefetchOnHover(item.href)}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>

            <div className="my-4 border-t border-ctp-surface0" />

            <div className="space-y-1">
              {secondaryNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-ctp-blue/20 text-ctp-blue'
                        : 'text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text'
                    )
                  }
                  onClick={() => onClose()}
                  onMouseEnter={() => prefetchOnHover(item.href)}
                  onFocus={() => prefetchOnHover(item.href)}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>
          </nav>

          {/* User menu */}
          <div className="p-3 border-t border-ctp-surface0">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-ctp-blue/20 flex items-center justify-center">
                <span className="text-sm font-medium text-ctp-blue">
                  {user?.displayName?.charAt(0).toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ctp-text truncate">
                  {user?.displayName ?? 'User'}
                </p>
                <p className="text-xs text-ctp-subtext0 truncate">
                  {user?.email ?? ''}
                </p>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {user?.isInstanceAdmin && (
                <NavLink
                  to="/admin"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-ctp-mauve hover:bg-ctp-mauve/10"
                  onClick={() => onClose()}
                  onMouseEnter={() => prefetchOnHover('/admin')}
                  onFocus={() => prefetchOnHover('/admin')}
                >
                  <Shield className="w-5 h-5" />
                  <span>Administration</span>
                </NavLink>
              )}
              <NavLink
                to="/settings"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-ctp-subtext1 hover:bg-ctp-surface1 hover:text-ctp-text"
                onClick={() => onClose()}
                onMouseEnter={() => prefetchOnHover('/settings')}
                onFocus={() => prefetchOnHover('/settings')}
              >
                <Settings className="w-5 h-5" />
                <span>Parametres</span>
              </NavLink>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-ctp-red hover:bg-ctp-red/10 w-full"
              >
                <LogOut className="w-5 h-5" />
                <span>Deconnexion</span>
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
    <header className="sticky top-0 z-30 bg-ctp-base border-b border-ctp-surface1 safe-area-inset-top">
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-lg text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text"
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
          {/* Offline Indicator */}
          <OfflineIndicator compact />

          {/* Currency Toggle */}
          {currentWorkspace?.id && <CurrencyToggle workspaceId={currentWorkspace.id} />}

          {/* Keyboard Shortcuts Help */}
          <ShortcutHelpButton />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}

// ----------------------------------------------------------------------------
// Global Shortcuts Handler
// ----------------------------------------------------------------------------

interface GlobalShortcutsProps {
  onToggleSidebar: () => void;
  onNewTransaction?: () => void;
  onNewAccount?: () => void;
}

function GlobalShortcuts({ onToggleSidebar, onNewTransaction, onNewAccount }: GlobalShortcutsProps) {
  const navigate = useNavigate();
  const { setHelpOpen } = useShortcuts();

  // Help shortcut
  useShortcut('help', useCallback(() => {
    setHelpOpen(true);
  }, [setHelpOpen]));

  // Toggle sidebar
  useShortcut('toggle-sidebar', onToggleSidebar);

  // Navigation shortcuts
  useShortcut('go-home', useCallback(() => navigate('/dashboard'), [navigate]));
  useShortcut('go-transactions', useCallback(() => navigate('/transactions'), [navigate]));
  useShortcut('go-accounts', useCallback(() => navigate('/accounts'), [navigate]));
  useShortcut('go-budgets', useCallback(() => navigate('/budgets'), [navigate]));
  useShortcut('go-settings', useCallback(() => navigate('/settings'), [navigate]));
  useShortcut('go-documents', useCallback(() => navigate('/documents'), [navigate]));

  // Action shortcuts (these should be connected to actual modals in real usage)
  useShortcut('new-transaction', useCallback(() => {
    if (onNewTransaction) {
      onNewTransaction();
    } else {
      navigate('/transactions?action=new');
    }
  }, [navigate, onNewTransaction]));

  useShortcut('new-account', useCallback(() => {
    if (onNewAccount) {
      onNewAccount();
    } else {
      navigate('/accounts?action=new');
    }
  }, [navigate, onNewAccount]));

  return null;
}

// ----------------------------------------------------------------------------
// Main Layout Content
// ----------------------------------------------------------------------------

function AppLayoutContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const { switchWorkspace } = useWorkspace();

  const handleWorkspaceCreated = (workspaceId: string) => {
    switchWorkspace(workspaceId);
  };

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  return (
    <>
      {/* Global shortcuts handler */}
      <GlobalShortcuts onToggleSidebar={toggleSidebar} />

      {/* Shortcuts help modal */}
      <ShortcutHelp />

      <div className="min-h-screen bg-ctp-base">
        {/* Skip Navigation Link - visible only on focus for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-ctp-blue focus:text-ctp-crust focus:rounded-lg focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ctp-sapphire focus:ring-offset-2 focus:ring-offset-ctp-base"
        >
          Aller au contenu principal
        </a>

        <div className="flex">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="flex-1 flex flex-col min-w-0">
            <Header
              onMenuClick={() => setSidebarOpen(true)}
              onCreateWorkspace={() => setShowCreateWorkspace(true)}
            />

            <main id="main-content" className="flex-1 safe-area-inset-bottom" tabIndex={-1}>
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
    </>
  );
}

// ----------------------------------------------------------------------------
// Main Layout (with Provider)
// ----------------------------------------------------------------------------

export function AppLayout() {
  return (
    <ShortcutProvider>
      <AppLayoutContent />
    </ShortcutProvider>
  );
}
