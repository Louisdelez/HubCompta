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
  Sun,
  Moon,
  Monitor,
  type LucideIcon,
} from 'lucide-react';
import { useTheme, THEME_META, type CatppuccinFlavor, type Theme } from '@/providers/ThemeProvider';

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
                >
                  <Shield className="w-5 h-5" />
                  <span>Administration</span>
                </NavLink>
              )}
              <NavLink
                to="/settings"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-ctp-subtext1 hover:bg-ctp-surface1 hover:text-ctp-text"
                onClick={() => onClose()}
              >
                <Settings className="w-5 h-5" />
                <span>Paramètres</span>
              </NavLink>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-ctp-red hover:bg-ctp-red/10 w-full"
              >
                <LogOut className="w-5 h-5" />
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
// Theme Selector Component
// ----------------------------------------------------------------------------

const THEME_OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Système', icon: Monitor },
  { value: 'latte', label: 'Latte', icon: Sun },
  { value: 'frappe', label: 'Frappé', icon: Moon },
  { value: 'macchiato', label: 'Macchiato', icon: Moon },
  { value: 'mocha', label: 'Mocha', icon: Moon },
];

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = THEME_OPTIONS.find((opt) => opt.value === theme) ?? THEME_OPTIONS[0]!;
  const CurrentIcon = currentOption.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text transition-colors"
        aria-label={`Thème: ${currentOption.label}`}
        title={`Thème: ${currentOption.label}`}
      >
        <CurrentIcon className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-56 bg-ctp-base border border-ctp-surface1 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="p-2">
              <p className="px-3 py-1.5 text-xs font-medium text-ctp-subtext0 uppercase tracking-wide">
                Thème Catppuccin
              </p>
              {THEME_OPTIONS.map((option) => {
                const isSelected = theme === option.value;
                const meta = option.value !== 'system' ? THEME_META[option.value as CatppuccinFlavor] : null;
                const OptionIcon = option.icon;

                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      setTheme(option.value);
                      setIsOpen(false);
                    }}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      isSelected
                        ? 'bg-ctp-blue/20 text-ctp-blue'
                        : 'text-ctp-text hover:bg-ctp-surface0'
                    )}
                  >
                    <OptionIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left font-medium">{option.label}</span>

                    {/* Color preview dots */}
                    {meta && (
                      <div className="flex gap-1">
                        <span
                          className="w-3 h-3 rounded-full border border-ctp-surface1"
                          style={{ backgroundColor: meta.colors.base }}
                          title="Base"
                        />
                        <span
                          className="w-3 h-3 rounded-full border border-ctp-surface1"
                          style={{ backgroundColor: meta.colors.blue }}
                          title="Blue"
                        />
                        <span
                          className="w-3 h-3 rounded-full border border-ctp-surface1"
                          style={{ backgroundColor: meta.colors.green }}
                          title="Green"
                        />
                        <span
                          className="w-3 h-3 rounded-full border border-ctp-surface1"
                          style={{ backgroundColor: meta.colors.red }}
                          title="Red"
                        />
                      </div>
                    )}

                    {option.value === 'system' && (
                      <span className="text-xs text-ctp-subtext0">Auto</span>
                    )}

                    {isSelected && (
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
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
          {/* Theme Selector */}
          <ThemeSelector />

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
    <div className="min-h-screen bg-ctp-base">
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
