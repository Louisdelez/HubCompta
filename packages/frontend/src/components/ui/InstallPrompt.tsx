// ============================================================================
// INSTALL PROMPT - HubCompta
// Custom PWA install prompt component
// ============================================================================

import { clsx } from 'clsx';
import { X, Download, Smartphone, Zap, WifiOff, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSmartInstallPrompt } from '@/hooks/useInstallPrompt';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface InstallPromptProps {
  /** Additional CSS classes */
  className?: string;
}

// ----------------------------------------------------------------------------
// Install Prompt Banner (Non-intrusive)
// ----------------------------------------------------------------------------

export function InstallPromptBanner({ className }: InstallPromptProps) {
  const { t } = useTranslation();
  const { state, actions, shouldShowPrompt } = useSmartInstallPrompt();

  if (!shouldShowPrompt || state.isInstalled || state.isDismissed) {
    return null;
  }

  return (
    <div
      className={clsx(
        'fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-96',
        'bg-ctp-surface0 border border-ctp-surface1 rounded-xl shadow-lg',
        'p-4 z-50 animate-slide-up',
        className
      )}
      role="dialog"
      aria-labelledby="install-prompt-title"
      aria-describedby="install-prompt-description"
    >
      {/* Close button */}
      <button
        onClick={actions.dismissPrompt}
        className="absolute top-2 right-2 p-1.5 rounded-lg text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface1 transition-colors touch-target"
        aria-label={t('common.close')}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Content */}
      <div className="flex items-start gap-4 pr-6">
        {/* Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-ctp-blue/20 flex items-center justify-center">
          <Download className="w-6 h-6 text-ctp-blue" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h3
            id="install-prompt-title"
            className="text-base font-semibold text-ctp-text"
          >
            {t('pwa.installTitle')}
          </h3>
          <p
            id="install-prompt-description"
            className="text-sm text-ctp-subtext1 mt-1"
          >
            {t('pwa.installDescription')}
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="flex items-center gap-4 mt-3 text-xs text-ctp-subtext0">
        <span className="flex items-center gap-1">
          <Zap className="w-3.5 h-3.5" />
          {t('pwa.featureFast')}
        </span>
        <span className="flex items-center gap-1">
          <WifiOff className="w-3.5 h-3.5" />
          {t('pwa.featureOffline')}
        </span>
        <span className="flex items-center gap-1">
          <Bell className="w-3.5 h-3.5" />
          {t('pwa.featureNotifications')}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={async () => {
            await actions.showPrompt();
          }}
          className="flex-1 px-4 py-2.5 bg-ctp-blue text-ctp-crust rounded-lg font-medium text-sm hover:bg-ctp-blue/90 transition-colors touch-target"
        >
          {t('pwa.install')}
        </button>
        <button
          onClick={actions.dismissPrompt}
          className="px-4 py-2.5 text-ctp-subtext1 hover:text-ctp-text text-sm font-medium transition-colors touch-target"
        >
          {t('pwa.later')}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Install Prompt Modal (More detailed)
// ----------------------------------------------------------------------------

interface InstallPromptModalProps extends InstallPromptProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when modal should close */
  onClose: () => void;
}

export function InstallPromptModal({
  isOpen,
  onClose,
  className,
}: InstallPromptModalProps) {
  const { t } = useTranslation();
  const { state, actions } = useSmartInstallPrompt();

  if (!isOpen || state.isInstalled) {
    return null;
  }

  const handleInstall = async () => {
    const success = await actions.showPrompt();
    if (success) {
      onClose();
    }
  };

  const handleDismiss = () => {
    actions.dismissPrompt();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={clsx(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-[calc(100%-2rem)] max-w-md',
          'bg-ctp-surface0 rounded-2xl shadow-2xl z-50',
          'overflow-hidden',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-modal-title"
      >
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-ctp-blue to-ctp-mauve p-6 pb-12">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors touch-target"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>

          {/* App icon */}
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 -mt-6 bg-ctp-surface0 rounded-t-2xl relative">
          <h2
            id="install-modal-title"
            className="text-xl font-bold text-ctp-text text-center"
          >
            {t('pwa.installTitle')}
          </h2>
          <p className="text-ctp-subtext1 text-center mt-2">
            {t('pwa.installModalDescription')}
          </p>

          {/* Features list */}
          <div className="mt-6 space-y-3">
            <FeatureItem
              icon={<Zap className="w-5 h-5" />}
              title={t('pwa.fastAccess')}
              description={t('pwa.fastAccessDescription')}
            />
            <FeatureItem
              icon={<WifiOff className="w-5 h-5" />}
              title={t('pwa.offlineMode')}
              description={t('pwa.offlineModeDescription')}
            />
            <FeatureItem
              icon={<Bell className="w-5 h-5" />}
              title={t('pwa.notificationsTitle')}
              description={t('pwa.notificationsDescription')}
            />
          </div>

          {/* Actions */}
          <div className="mt-6 space-y-3">
            <button
              onClick={handleInstall}
              disabled={!state.canInstall}
              className={clsx(
                'w-full px-4 py-3 rounded-xl font-medium text-sm transition-colors touch-target',
                state.canInstall
                  ? 'bg-ctp-blue text-ctp-crust hover:bg-ctp-blue/90'
                  : 'bg-ctp-surface1 text-ctp-subtext0 cursor-not-allowed'
              )}
            >
              {state.canInstall ? t('pwa.installNow') : t('pwa.installNotAvailable')}
            </button>
            <button
              onClick={handleDismiss}
              className="w-full px-4 py-3 text-ctp-subtext1 hover:text-ctp-text text-sm font-medium transition-colors touch-target"
            >
              {t('pwa.remindLater')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------
// Feature Item
// ----------------------------------------------------------------------------

interface FeatureItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureItem({ icon, title, description }: FeatureItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-ctp-blue/10 flex items-center justify-center text-ctp-blue">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-ctp-text">{title}</h4>
        <p className="text-xs text-ctp-subtext0 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Compact Install Button (for header/settings)
// ----------------------------------------------------------------------------

export function InstallButton({ className }: InstallPromptProps) {
  const { t } = useTranslation();
  const { state, actions } = useSmartInstallPrompt();

  if (!state.canInstall || state.isInstalled || state.isStandalone) {
    return null;
  }

  return (
    <button
      onClick={async () => {
        await actions.showPrompt();
      }}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        'bg-ctp-blue/10 text-ctp-blue hover:bg-ctp-blue/20',
        'text-sm font-medium transition-colors touch-target',
        className
      )}
      aria-label={t('pwa.installApp')}
    >
      <Download className="w-4 h-4" />
      <span className="hidden sm:inline">{t('pwa.install')}</span>
    </button>
  );
}

export default InstallPromptBanner;
