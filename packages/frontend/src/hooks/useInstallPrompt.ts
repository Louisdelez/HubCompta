// ============================================================================
// USE INSTALL PROMPT HOOK - HubCompta
// Hook to manage PWA install prompt with smart timing
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPromptState {
  /** Whether the install prompt can be shown */
  canInstall: boolean;
  /** Whether the app is already installed */
  isInstalled: boolean;
  /** Whether the prompt was dismissed by the user */
  isDismissed: boolean;
  /** Whether the prompt is currently visible */
  isPromptVisible: boolean;
  /** Whether the app is running in standalone mode */
  isStandalone: boolean;
}

interface InstallPromptActions {
  /** Show the install prompt */
  showPrompt: () => Promise<boolean>;
  /** Dismiss the install prompt (stores in localStorage) */
  dismissPrompt: () => void;
  /** Reset the dismissal (allows showing again) */
  resetDismissal: () => void;
  /** Show the custom prompt UI */
  showCustomPrompt: () => void;
  /** Hide the custom prompt UI */
  hideCustomPrompt: () => void;
}

export interface UseInstallPromptResult {
  state: InstallPromptState;
  actions: InstallPromptActions;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const STORAGE_KEY = 'hubcompta-install-prompt-dismissed';
const DISMISSAL_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_VISITS_BEFORE_PROMPT = 3;
const MIN_TIME_BEFORE_PROMPT = 60 * 1000; // 1 minute on page
const VISITS_STORAGE_KEY = 'hubcompta-visit-count';
const FIRST_VISIT_KEY = 'hubcompta-first-visit';

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

function isDismissed(): boolean {
  const dismissedAt = localStorage.getItem(STORAGE_KEY);
  if (!dismissedAt) return false;

  const dismissedTime = parseInt(dismissedAt, 10);
  const now = Date.now();

  // Check if dismissal has expired
  if (now - dismissedTime > DISMISSAL_DURATION) {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }

  return true;
}

function getVisitCount(): number {
  const count = localStorage.getItem(VISITS_STORAGE_KEY);
  return count ? parseInt(count, 10) : 0;
}

function incrementVisitCount(): void {
  const count = getVisitCount() + 1;
  localStorage.setItem(VISITS_STORAGE_KEY, count.toString());
}

function getFirstVisitTime(): number | null {
  const time = localStorage.getItem(FIRST_VISIT_KEY);
  return time ? parseInt(time, 10) : null;
}

function setFirstVisitTime(): void {
  if (!getFirstVisitTime()) {
    localStorage.setItem(FIRST_VISIT_KEY, Date.now().toString());
  }
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useInstallPrompt(): UseInstallPromptResult {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(isDismissed);
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [standalone] = useState(isStandalone);

  // Track visits and first visit time
  useEffect(() => {
    setFirstVisitTime();
    incrementVisitCount();
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
      console.info('[PWA] App was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already installed
    if (standalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [standalone]);

  // Show prompt
  const showPrompt = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.warn('[PWA] No deferred prompt available');
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.info('[PWA] User accepted the install prompt');
        setIsInstalled(true);
        return true;
      } else {
        console.info('[PWA] User dismissed the install prompt');
        return false;
      }
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error);
      return false;
    } finally {
      setDeferredPrompt(null);
      setCanInstall(false);
      setIsPromptVisible(false);
    }
  }, [deferredPrompt]);

  // Dismiss prompt
  const dismissPrompt = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setPromptDismissed(true);
    setIsPromptVisible(false);
  }, []);

  // Reset dismissal
  const resetDismissal = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPromptDismissed(false);
  }, []);

  // Show custom prompt UI
  const showCustomPrompt = useCallback(() => {
    setIsPromptVisible(true);
  }, []);

  // Hide custom prompt UI
  const hideCustomPrompt = useCallback(() => {
    setIsPromptVisible(false);
  }, []);

  return {
    state: {
      canInstall,
      isInstalled,
      isDismissed: promptDismissed,
      isPromptVisible,
      isStandalone: standalone,
    },
    actions: {
      showPrompt,
      dismissPrompt,
      resetDismissal,
      showCustomPrompt,
      hideCustomPrompt,
    },
  };
}

// ----------------------------------------------------------------------------
// Smart Install Prompt Hook
// Shows prompt at appropriate time based on user engagement
// ----------------------------------------------------------------------------

export interface UseSmartInstallPromptOptions {
  /** Minimum visits before showing prompt (default: 3) */
  minVisits?: number;
  /** Minimum time on page before showing prompt in ms (default: 60000) */
  minTimeOnPage?: number;
  /** Delay before showing prompt in ms (default: 5000) */
  promptDelay?: number;
}

export function useSmartInstallPrompt(
  options: UseSmartInstallPromptOptions = {}
): UseInstallPromptResult & { shouldShowPrompt: boolean } {
  const {
    minVisits = MIN_VISITS_BEFORE_PROMPT,
    minTimeOnPage = MIN_TIME_BEFORE_PROMPT,
    promptDelay = 5000,
  } = options;

  const installPrompt = useInstallPrompt();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Don't show if any of these conditions are met
    if (
      installPrompt.state.isInstalled ||
      installPrompt.state.isDismissed ||
      installPrompt.state.isStandalone ||
      !installPrompt.state.canInstall
    ) {
      setShouldShow(false);
      return;
    }

    const visitCount = getVisitCount();
    const firstVisit = getFirstVisitTime();
    const timeOnSite = firstVisit ? Date.now() - firstVisit : 0;

    // Check engagement criteria
    if (visitCount < minVisits || timeOnSite < minTimeOnPage) {
      return;
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      setShouldShow(true);
      installPrompt.actions.showCustomPrompt();
    }, promptDelay);

    return () => clearTimeout(timer);
  }, [
    installPrompt.state.canInstall,
    installPrompt.state.isInstalled,
    installPrompt.state.isDismissed,
    installPrompt.state.isStandalone,
    minVisits,
    minTimeOnPage,
    promptDelay,
    installPrompt.actions,
  ]);

  return {
    ...installPrompt,
    shouldShowPrompt: shouldShow,
  };
}

export default useInstallPrompt;
