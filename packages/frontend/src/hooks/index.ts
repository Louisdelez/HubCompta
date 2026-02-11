// ============================================================================
// HOOKS EXPORTS - HubCompta
// ============================================================================

export { useDebounce } from './useDebounce';
export { useWorkspace } from './useWorkspace';
export { useInactivityLock } from './useInactivityLock';
export { usePrefetch } from './usePrefetch';
export { useOnlineStatus, useSyncStatus, useOfflineStatus, useNetworkQuality } from './useOnlineStatus';
export { useListNavigation } from './useListNavigation';
export type { UseListNavigationOptions, UseListNavigationResult, ListItemProps } from './useListNavigation';
export { usePWA } from './usePWA';
export type { PWAStatus, PWAActions, UsePWAResult } from './usePWA';
export { usePushNotifications } from './usePushNotifications';
export type { PushSubscription, PushStatus, UsePushNotificationsResult } from './usePushNotifications';
export { useUserSettings } from './useUserSettings';
export type { UserProfile, VatRate, CountryCode } from './useUserSettings';
export { useRateLimit } from './useRateLimit';
export type { RateLimitState, UseRateLimitResult } from './useRateLimit';

// Theme hooks - main useTheme is exported from @/providers/ThemeProvider
export { useAutoTheme, AUTO_THEME_DEFAULT_CONFIG, saveAutoConfig } from './useAutoTheme';
export type { ThemeMode, TimeRange, AutoThemeConfig as AutoThemeHookConfig } from './useAutoTheme';

// PWA Mobile Hooks
export { useInstallPrompt, useSmartInstallPrompt } from './useInstallPrompt';
export type { UseInstallPromptResult, UseSmartInstallPromptOptions } from './useInstallPrompt';
export { usePullToRefresh } from './usePullToRefresh';
export type { PullToRefreshState, PullToRefreshOptions, UsePullToRefreshResult } from './usePullToRefresh';
export { useSwipeGesture, useNavigationSwipe, useSwipeToDismiss } from './useSwipeGesture';
export type { SwipeDirection, SwipeState, SwipeGestureOptions, UseSwipeGestureResult, UseNavigationSwipeOptions, UseSwipeToDismissOptions, UseSwipeToDismissResult } from './useSwipeGesture';
