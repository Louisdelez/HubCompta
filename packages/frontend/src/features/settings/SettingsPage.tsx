// ============================================================================
// SETTINGS PAGE - Finance Hub
// Main settings page with navigation
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User,
  Monitor,
  Bell,
  Shield,
  Database,
  FileText,
  Globe,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { ProfileSettings } from './ProfileSettings';
import { DisplaySettings } from './DisplaySettings';
import { NotificationSettings } from './NotificationSettings';
import { SecuritySettings } from './SecuritySettings';
import { DataManagement } from './DataManagement';
import { AuditLogPage } from './AuditLogPage';
import { LanguageSettings } from './LanguageSettings';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type SettingsSection = 'profile' | 'display' | 'language' | 'notifications' | 'security' | 'audit' | 'data';

interface NavItem {
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof User;
}

// ----------------------------------------------------------------------------
// Navigation
// ----------------------------------------------------------------------------

// Section colors for Catppuccin theme - complete class names for Tailwind JIT
const sectionColors: Record<SettingsSection, string> = {
  profile: 'text-ctp-blue',
  display: 'text-ctp-mauve',
  language: 'text-ctp-green',
  notifications: 'text-ctp-yellow',
  security: 'text-ctp-red',
  audit: 'text-ctp-teal',
  data: 'text-ctp-peach',
};

// Background colors for active state - complete class names for Tailwind JIT
const sectionBgColors: Record<SettingsSection, string> = {
  profile: 'bg-ctp-blue/20',
  display: 'bg-ctp-mauve/20',
  language: 'bg-ctp-green/20',
  notifications: 'bg-ctp-yellow/20',
  security: 'bg-ctp-red/20',
  audit: 'bg-ctp-teal/20',
  data: 'bg-ctp-peach/20',
};

// Navigation items are now dynamic based on translations
const getNavItems = (t: (key: string) => string): NavItem[] => [
  {
    id: 'profile',
    label: t('settings.profile.title'),
    description: t('settings.profile.description'),
    icon: User,
  },
  {
    id: 'display',
    label: t('settings.display.title'),
    description: t('settings.display.description'),
    icon: Monitor,
  },
  {
    id: 'language',
    label: t('settings.language.title'),
    description: t('settings.language.description'),
    icon: Globe,
  },
  {
    id: 'notifications',
    label: t('settings.notifications.title'),
    description: t('settings.notifications.description'),
    icon: Bell,
  },
  {
    id: 'security',
    label: t('settings.security.title'),
    description: t('settings.security.description'),
    icon: Shield,
  },
  {
    id: 'audit',
    label: t('settings.audit.title'),
    description: t('settings.audit.description'),
    icon: FileText,
  },
  {
    id: 'data',
    label: t('settings.data.title'),
    description: t('settings.data.description'),
    icon: Database,
  },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SettingsPage() {
  const location = useLocation();
  const { t } = useTranslation();
  const navItems = getNavItems(t);
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
      case 'language':
        return <LanguageSettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'audit':
        return <AuditLogPage />;
      case 'data':
        return <DataManagement />;
      default:
        return <ProfileSettings />;
    }
  };

  return (
    <div className="min-h-screen bg-ctp-base">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-ctp-subtext0 hover:text-ctp-text mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('settings.backToDashboard')}
          </Link>
          <h1 className="text-2xl font-bold text-ctp-text">{t('settings.title')}</h1>
          <p className="text-ctp-subtext0">
            {t('settings.manageAccount')}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <nav className="bg-ctp-mantle rounded-lg shadow divide-y divide-ctp-surface1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSectionChange(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      isActive
                        ? sectionBgColors[item.id]
                        : 'hover:bg-ctp-surface0'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 flex-shrink-0 ${
                        isActive
                          ? sectionColors[item.id]
                          : 'text-ctp-overlay1'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isActive
                            ? sectionColors[item.id]
                            : 'text-ctp-text'
                        }`}
                      >
                        {item.label}
                      </p>
                      <p className="text-xs text-ctp-subtext0 truncate">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 flex-shrink-0 ${
                        isActive
                          ? sectionColors[item.id]
                          : 'text-ctp-overlay0'
                      }`}
                    />
                  </button>
                );
              })}
            </nav>

            {/* Workspace Settings Link */}
            <div className="mt-6 bg-ctp-mantle rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-ctp-text mb-2">
                {t('settings.workspace.title')}
              </h3>
              <p className="text-xs text-ctp-subtext0 mb-3">
                {t('settings.workspace.description')}
              </p>
              <Link
                to="/workspaces"
                className="text-sm text-ctp-blue hover:text-ctp-sapphire font-medium"
              >
                {t('settings.workspace.manage')}
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
