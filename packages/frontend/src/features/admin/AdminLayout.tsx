// ============================================================================
// ADMIN LAYOUT - Finance Hub
// Layout with sidebar navigation for admin pages
// ============================================================================

import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Database,
  Settings,
  ChevronRight,
} from 'lucide-react';

// ----------------------------------------------------------------------------
// Navigation Items
// ----------------------------------------------------------------------------

const navItems = [
  {
    to: '/admin',
    icon: LayoutDashboard,
    label: 'Tableau de bord',
    description: 'Statistiques systeme',
    end: true,
  },
  {
    to: '/admin/users',
    icon: Users,
    label: 'Utilisateurs',
    description: 'Gestion des utilisateurs',
    end: false,
  },
  {
    to: '/admin/audit-logs',
    icon: FileText,
    label: 'Logs d\'audit',
    description: 'Historique des actions',
    end: false,
  },
  {
    to: '/admin/backups',
    icon: Database,
    label: 'Sauvegardes',
    description: 'Gestion des backups',
    end: false,
  },
  {
    to: '/admin/system',
    icon: Settings,
    label: 'Systeme',
    description: 'Cache et infos systeme',
    end: false,
  },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AdminLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Administration
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestion de l'instance HubCompta
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1">
            <nav className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/20 overflow-hidden">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    } ${index === 0 ? 'rounded-t-xl' : ''} ${index === navItems.length - 1 ? 'rounded-b-xl' : ''}`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {item.description}
                      </p>
                    </div>
                    {isActive && (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/20 p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
