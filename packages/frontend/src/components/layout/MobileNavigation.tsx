// ============================================================================
// MOBILE NAVIGATION - HubCompta
// Bottom navigation bar for mobile devices
// ============================================================================

import { NavLink, useLocation } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  CreditCard,
  Landmark,
  TrendingUp,
  Menu,
  Plus,
  X,
  FileText,
  Settings,
  LineChart,
  Target,
  Search,
  type LucideIcon,
} from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface NavItem {
  nameKey: string;
  href: string;
  icon: LucideIcon;
}

interface MobileNavigationProps {
  /** Callback when FAB is clicked */
  onFabClick?: (() => void) | undefined;
  /** Additional CSS classes */
  className?: string | undefined;
}

// ----------------------------------------------------------------------------
// Navigation Items
// ----------------------------------------------------------------------------

const mainNavItems: NavItem[] = [
  { nameKey: 'mobile.home', href: '/dashboard', icon: LayoutDashboard },
  { nameKey: 'navigation.transactions', href: '/transactions', icon: CreditCard },
  { nameKey: 'navigation.accounts', href: '/accounts', icon: Landmark },
  { nameKey: 'navigation.budgets', href: '/budgets', icon: TrendingUp },
];

const moreNavItems: NavItem[] = [
  { nameKey: 'navigation.savings', href: '/savings', icon: Target },
  { nameKey: 'navigation.investments', href: '/portfolio', icon: LineChart },
  { nameKey: 'navigation.documents', href: '/documents', icon: FileText },
  { nameKey: 'navigation.search', href: '/search', icon: Search },
  { nameKey: 'navigation.settings', href: '/settings', icon: Settings },
];

// ----------------------------------------------------------------------------
// Mobile Bottom Navigation
// ----------------------------------------------------------------------------

export function MobileNavigation({ onFabClick, className }: MobileNavigationProps) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);
  const location = useLocation();

  const handleMoreToggle = useCallback(() => {
    setShowMore((prev) => !prev);
  }, []);

  const handleCloseMore = useCallback(() => {
    setShowMore(false);
  }, []);

  // Check if current path matches any of the "more" items
  const isMoreActive = moreNavItems.some((item) =>
    location.pathname.startsWith(item.href)
  );

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={handleCloseMore}
          />

          {/* More menu */}
          <div className="fixed bottom-20 left-4 right-4 bg-ctp-surface0 border border-ctp-surface1 rounded-2xl shadow-lg z-50 lg:hidden safe-area-inset-bottom">
            <div className="p-2">
              <div className="flex items-center justify-between px-3 py-2 mb-1">
                <span className="text-sm font-medium text-ctp-text">{t('mobile.more')}</span>
                <button
                  onClick={handleCloseMore}
                  className="p-1.5 rounded-lg text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface1 transition-colors"
                  aria-label={t('common.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {moreNavItems.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={handleCloseMore}
                    className={({ isActive }) =>
                      clsx(
                        'flex flex-col items-center gap-1 p-3 rounded-xl transition-colors touch-target',
                        isActive
                          ? 'bg-ctp-blue/20 text-ctp-blue'
                          : 'text-ctp-subtext1 hover:bg-ctp-surface1 hover:text-ctp-text'
                      )
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-xs font-medium truncate max-w-full">
                      {t(item.nameKey)}
                    </span>
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom navigation bar */}
      <nav
        className={clsx(
          'fixed bottom-0 left-0 right-0 z-30 lg:hidden',
          'bg-ctp-mantle border-t border-ctp-surface0',
          'safe-area-inset-bottom',
          className
        )}
        role="navigation"
        aria-label={t('mobile.mainNavigation')}
      >
        <div className="flex items-center justify-around px-2 py-1">
          {/* Main nav items */}
          {mainNavItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-lg transition-colors touch-target min-w-[64px]',
                  isActive
                    ? 'text-ctp-blue'
                    : 'text-ctp-subtext0 hover:text-ctp-subtext1'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={clsx(
                      'p-1.5 rounded-lg transition-colors',
                      isActive && 'bg-ctp-blue/20'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium">{t(item.nameKey)}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* FAB placeholder - creates space in the middle */}
          <div className="w-14" />

          {/* More button */}
          <button
            onClick={handleMoreToggle}
            className={clsx(
              'flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-lg transition-colors touch-target min-w-[64px]',
              isMoreActive || showMore
                ? 'text-ctp-blue'
                : 'text-ctp-subtext0 hover:text-ctp-subtext1'
            )}
            aria-expanded={showMore}
            aria-label={t('mobile.moreOptions')}
          >
            <div
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                (isMoreActive || showMore) && 'bg-ctp-blue/20'
              )}
            >
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">{t('mobile.more')}</span>
          </button>
        </div>
      </nav>

      {/* Floating Action Button */}
      <MobileFAB onClick={onFabClick} />
    </>
  );
}

// ----------------------------------------------------------------------------
// Floating Action Button
// ----------------------------------------------------------------------------

interface MobileFABProps {
  onClick?: (() => void) | undefined;
}

function MobileFAB({ onClick }: MobileFABProps) {
  const { t } = useTranslation();
  const location = useLocation();

  // Determine action based on current page
  const getAction = () => {
    if (location.pathname.includes('/transactions')) {
      return { labelKey: 'mobile.newTransaction', href: '/transactions?action=new' };
    }
    if (location.pathname.includes('/accounts')) {
      return { labelKey: 'mobile.newAccount', href: '/accounts?action=new' };
    }
    if (location.pathname.includes('/budgets')) {
      return { labelKey: 'mobile.newBudget', href: '/budgets?action=new' };
    }
    if (location.pathname.includes('/documents')) {
      return { labelKey: 'mobile.newDocument', href: '/documents?action=new' };
    }
    // Default action
    return { labelKey: 'mobile.newTransaction', href: '/transactions?action=new' };
  };

  const action = getAction();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Navigate to the action URL
      window.location.href = action.href;
    }
  };

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'fixed z-40 lg:hidden',
        'bottom-8 left-1/2 -translate-x-1/2',
        'w-14 h-14 rounded-full',
        'bg-ctp-blue text-ctp-crust shadow-lg',
        'flex items-center justify-center',
        'hover:bg-ctp-blue/90 active:scale-95',
        'transition-all duration-200',
        'touch-target'
      )}
      aria-label={t(action.labelKey)}
    >
      <Plus className="w-6 h-6" />
    </button>
  );
}

// ----------------------------------------------------------------------------
// Mobile Navigation with expanded FAB
// ----------------------------------------------------------------------------

interface MobileNavigationWithFABProps {
  onFabClick?: () => void;
  className?: string;
}

export function MobileNavigationWithExpandedFAB({
  onFabClick,
  className,
}: MobileNavigationWithFABProps) {
  const { t } = useTranslation();
  const [fabExpanded, setFabExpanded] = useState(false);

  const quickActions = [
    { nameKey: 'mobile.transaction', href: '/transactions?action=new', icon: CreditCard },
    { nameKey: 'mobile.account', href: '/accounts?action=new', icon: Landmark },
    { nameKey: 'mobile.document', href: '/documents?action=new', icon: FileText },
  ];

  return (
    <>
      {/* Backdrop for expanded FAB */}
      {fabExpanded && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setFabExpanded(false)}
        />
      )}

      {/* Quick actions */}
      {fabExpanded && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 lg:hidden flex flex-col items-center gap-3">
          {quickActions.map((action, index) => (
            <NavLink
              key={action.href}
              to={action.href}
              onClick={() => setFabExpanded(false)}
              className="flex items-center gap-2 px-4 py-2 bg-ctp-surface0 rounded-full shadow-lg animate-slide-up touch-target"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <action.icon className="w-4 h-4 text-ctp-blue" />
              <span className="text-sm font-medium text-ctp-text">
                {t(action.nameKey)}
              </span>
            </NavLink>
          ))}
        </div>
      )}

      {/* Main navigation */}
      <MobileNavigation
        onFabClick={() => {
          if (onFabClick) {
            onFabClick();
          } else {
            setFabExpanded(!fabExpanded);
          }
        }}
        className={className}
      />
    </>
  );
}

export default MobileNavigation;
