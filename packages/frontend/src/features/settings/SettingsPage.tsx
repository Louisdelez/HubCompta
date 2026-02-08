// ============================================================================
// SETTINGS PAGE - Finance Hub
// Main settings page with navigation
// ============================================================================

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  User,
  Monitor,
  Bell,
  Shield,
  Database,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { ProfileSettings } from './ProfileSettings';
import { DisplaySettings } from './DisplaySettings';
import { NotificationSettings } from './NotificationSettings';
import { SecuritySettings } from './SecuritySettings';
import { DataManagement } from './DataManagement';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type SettingsSection = 'profile' | 'display' | 'notifications' | 'security' | 'data';

interface NavItem {
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof User;
}

// ----------------------------------------------------------------------------
// Navigation
// ----------------------------------------------------------------------------

const navItems: NavItem[] = [
  {
    id: 'profile',
    label: 'Profil',
    description: 'Informations personnelles et preferences',
    icon: User,
  },
  {
    id: 'display',
    label: 'Affichage',
    description: 'Theme, format et tableau de bord',
    icon: Monitor,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Email, push et alertes',
    icon: Bell,
  },
  {
    id: 'security',
    label: 'Securite',
    description: 'MFA, appareils et sessions',
    icon: Shield,
  },
  {
    id: 'data',
    label: 'Donnees',
    description: 'Export et suppression de compte',
    icon: Database,
  },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SettingsPage() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
    const hash = location.hash.replace('#', '') as SettingsSection;
    return navItems.find((item) => item.id === hash)?.id ?? 'profile';
  });

  const handleSectionChange = (section: SettingsSection) => {
    setActiveSection(section);
    window.history.replaceState(null, '', `#${section}`);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileSettings />;
      case 'display':
        return <DisplaySettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'data':
        return <DataManagement />;
      default:
        return <ProfileSettings />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parametres</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Gerez votre compte et vos preferences
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <nav className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSectionChange(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 flex-shrink-0 ${
                        isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isActive
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 flex-shrink-0 ${
                        isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                  </button>
                );
              })}
            </nav>

            {/* Workspace Settings Link */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Parametres workspace
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Configurez les parametres specifiques a chaque workspace
              </p>
              <Link
                to="/workspaces"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Gerer les workspaces
              </Link>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">{renderContent()}</main>
        </div>
      </div>
    </div>
  );
}
