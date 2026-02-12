// ============================================================================
// OFFLINE INDICATOR - HubCompta
// Shows offline status and pending sync count
// ============================================================================

import { useState } from 'react';
import { clsx } from 'clsx';
import { WifiOff, CloudOff, RefreshCw, Check, AlertCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOfflineStatus } from '@/hooks/useOnlineStatus';

// ----------------------------------------------------------------------------
// Helper
// ----------------------------------------------------------------------------

type TranslateFn = ReturnType<typeof useTranslation>['t'];

function formatTimestamp(timestamp: number | null, now: number, t: TranslateFn): string {
  if (!timestamp) return t('offline.never');

  const diff = now - timestamp;

  if (diff < 60000) return t('offline.fewSecondsAgo');
  if (diff < 3600000) return t('offline.minutesAgo', { count: Math.floor(diff / 60000) });
  if (diff < 86400000) return t('offline.hoursAgo', { count: Math.floor(diff / 3600000) });
  return new Date(timestamp).toLocaleDateString();
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface OfflineIndicatorProps {
  /** Additional CSS classes */
  className?: string;
  /** Show compact version (icon only) */
  compact?: boolean;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function OfflineIndicator({ className, compact = false }: OfflineIndicatorProps) {
  const { t } = useTranslation();
  const { isOnline, isSyncing, pendingCount, lastSyncAt, lastError, sync } = useOfflineStatus();
  const [showDetails, setShowDetails] = useState(false);
  // Store current time snapshot to avoid impure Date.now() during render
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const handleSync = async () => {
    if (isOnline && !isSyncing) {
      await sync();
      setCurrentTime(Date.now());
    }
  };

  // Compute formatted time with stored current time snapshot
  const formatLastSync = (timestamp: number | null): string => {
    return formatTimestamp(timestamp, currentTime, t);
  };

  // Don't render anything if online and no pending mutations
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  // Compact version (icon only)
  if (compact) {
    return (
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={clsx(
          'relative p-2 rounded-lg transition-colors',
          !isOnline
            ? 'bg-ctp-yellow/20 text-ctp-yellow'
            : pendingCount > 0
            ? 'bg-ctp-peach/20 text-ctp-peach'
            : 'bg-ctp-surface0 text-ctp-subtext1',
          className
        )}
        aria-label={
          !isOnline
            ? t('offline.offline')
            : t('offline.pendingSyncLabel', { count: pendingCount })
        }
      >
        {!isOnline ? (
          <WifiOff className="w-5 h-5" />
        ) : isSyncing ? (
          <RefreshCw className="w-5 h-5 animate-spin" />
        ) : (
          <CloudOff className="w-5 h-5" />
        )}

        {/* Pending count badge */}
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-ctp-yellow text-ctp-crust text-xs font-bold rounded-full flex items-center justify-center">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}

        {/* Details popup */}
        {showDetails && (
          <OfflineDetailsPopup
            isOnline={isOnline}
            isSyncing={isSyncing}
            pendingCount={pendingCount}
            lastSyncAt={lastSyncAt}
            lastError={lastError}
            onSync={handleSync}
            onClose={() => setShowDetails(false)}
            formatLastSync={formatLastSync}
          />
        )}
      </button>
    );
  }

  // Full version
  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-2 rounded-lg',
        !isOnline
          ? 'bg-ctp-yellow/20 border border-ctp-yellow/30'
          : 'bg-ctp-peach/20 border border-ctp-peach/30',
        className
      )}
    >
      {/* Status icon */}
      <div
        className={clsx(
          'flex-shrink-0',
          !isOnline ? 'text-ctp-yellow' : 'text-ctp-peach'
        )}
      >
        {!isOnline ? (
          <WifiOff className="w-5 h-5" />
        ) : isSyncing ? (
          <RefreshCw className="w-5 h-5 animate-spin" />
        ) : (
          <CloudOff className="w-5 h-5" />
        )}
      </div>

      {/* Status text */}
      <div className="flex-1 min-w-0">
        <p
          className={clsx(
            'text-sm font-medium',
            !isOnline ? 'text-ctp-yellow' : 'text-ctp-peach'
          )}
        >
          {!isOnline ? t('offline.offline') : isSyncing ? t('offline.syncing') : t('offline.pending')}
        </p>
        <p className="text-xs text-ctp-subtext0 truncate">
          {pendingCount > 0
            ? t('offline.pendingChanges', { count: pendingCount })
            : t('offline.lastSync') + ': ' + formatLastSync(lastSyncAt)}
        </p>
      </div>

      {/* Sync button */}
      {isOnline && pendingCount > 0 && !isSyncing && (
        <button
          onClick={handleSync}
          className="flex-shrink-0 p-2 rounded-lg bg-ctp-peach/20 text-ctp-peach hover:bg-ctp-peach/30 transition-colors"
          aria-label={t('offline.syncNow')}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Details Popup
// ----------------------------------------------------------------------------

interface OfflineDetailsPopupProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
  onSync: () => void;
  onClose: () => void;
  formatLastSync: (timestamp: number | null) => string;
}

function OfflineDetailsPopup({
  isOnline,
  isSyncing,
  pendingCount,
  lastSyncAt,
  lastError,
  onSync,
  onClose,
  formatLastSync,
}: OfflineDetailsPopupProps) {
  const { t } = useTranslation();
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Popup */}
      <div
        className="absolute top-full right-0 mt-2 w-72 bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-lg z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-ctp-surface1">
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <>
                <WifiOff className="w-4 h-4 text-ctp-yellow" />
                <span className="text-sm font-medium text-ctp-yellow">{t('offline.offline')}</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-ctp-green" />
                <span className="text-sm font-medium text-ctp-green">{t('offline.online')}</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-ctp-surface1 text-ctp-subtext0 hover:text-ctp-text transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3">
          {/* Pending count */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-ctp-subtext1">{t('offline.pending')}</span>
            <span
              className={clsx(
                'text-sm font-medium',
                pendingCount > 0 ? 'text-ctp-yellow' : 'text-ctp-subtext0'
              )}
            >
              {t('offline.pendingChanges', { count: pendingCount })}
            </span>
          </div>

          {/* Last sync */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-ctp-subtext1">{t('offline.lastSync')}</span>
            <span className="text-sm text-ctp-subtext0">{formatLastSync(lastSyncAt)}</span>
          </div>

          {/* Error message */}
          {lastError && (
            <div className="flex items-start gap-2 p-2 bg-ctp-red/10 rounded-lg">
              <AlertCircle className="w-4 h-4 text-ctp-red flex-shrink-0 mt-0.5" />
              <p className="text-xs text-ctp-red">{lastError}</p>
            </div>
          )}

          {/* Sync button */}
          {isOnline && pendingCount > 0 && (
            <button
              onClick={onSync}
              disabled={isSyncing}
              className={clsx(
                'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                isSyncing
                  ? 'bg-ctp-surface1 text-ctp-subtext0 cursor-not-allowed'
                  : 'bg-ctp-blue text-ctp-crust hover:bg-ctp-blue/90'
              )}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t('offline.syncingNow')}
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {t('offline.syncNow')}
                </>
              )}
            </button>
          )}

          {/* Offline message */}
          {!isOnline && (
            <p className="text-xs text-ctp-subtext0 text-center">
              {t('offline.autoSyncMessage')}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------
// Offline Banner (for full-width display)
// ----------------------------------------------------------------------------

export function OfflineBanner() {
  const { t } = useTranslation();
  const { isOnline, pendingCount } = useOfflineStatus();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={clsx(
        'px-4 py-2 text-center text-sm font-medium',
        !isOnline
          ? 'bg-ctp-yellow/20 text-ctp-yellow'
          : 'bg-ctp-peach/20 text-ctp-peach'
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4 inline-block mr-2" />
          {t('offline.autoSyncMessage')}
        </>
      ) : (
        <>
          <CloudOff className="w-4 h-4 inline-block mr-2" />
          {t('offline.pendingSyncLabel', { count: pendingCount })}
        </>
      )}
    </div>
  );
}

export default OfflineIndicator;
