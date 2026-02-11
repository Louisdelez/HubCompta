// ============================================================================
// ONBOARDING PROVIDER - Finance Hub
// Context provider for onboarding state and tour management
// ============================================================================

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import Joyride, {
  type CallBackProps,
  type Step,
  ACTIONS,
  EVENTS,
  STATUS,
} from 'react-joyride';
import {
  onboardingService,
  type TourId,
  type OnboardingState,
  type TourStep,
} from '@/lib/onboarding';
import { OnboardingTooltip } from './OnboardingTooltip';
import { WelcomeModal } from './WelcomeModal';
import { useAuth } from '@/features/auth/AuthProvider';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface OnboardingContextValue {
  state: OnboardingState;
  isRunning: boolean;
  currentTour: TourId | null;
  currentStep: number;
  totalSteps: number;
  startTour: (tourId: TourId) => void;
  stopTour: () => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;
  completeTour: (tourId: TourId) => void;
  isTourCompleted: (tourId: TourId) => boolean;
  shouldShowWelcome: boolean;
  showWelcomeModal: boolean;
  setShowWelcomeModal: (show: boolean) => void;
  triggerFeatureTour: (section: 'transaction' | 'budget' | 'import') => void;
}

// ----------------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------------

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// ----------------------------------------------------------------------------
// Joyride Styles
// ----------------------------------------------------------------------------

const joyrideStyles = {
  options: {
    arrowColor: 'rgb(var(--ctp-surface0))',
    backgroundColor: 'rgb(var(--ctp-surface0))',
    overlayColor: 'rgba(0, 0, 0, 0.6)',
    primaryColor: 'rgb(var(--ctp-blue))',
    textColor: 'rgb(var(--ctp-text))',
    zIndex: 10000,
  },
  spotlight: {
    borderRadius: '8px',
  },
};

// ----------------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------------

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { isAuthenticated, user } = useAuth();
  const [state, setState] = useState<OnboardingState>(() =>
    onboardingService.getState()
  );
  const [isRunning, setIsRunning] = useState(false);
  const [currentTour, setCurrentTour] = useState<TourId | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Calculate if welcome should be shown
  const shouldShowWelcome = useMemo(() => {
    return isAuthenticated && onboardingService.shouldShowWelcome();
  }, [isAuthenticated, state.welcomeCompleted, state.skippedAt]);

  // Show welcome modal on first authenticated load
  useEffect(() => {
    if (shouldShowWelcome && !showWelcomeModal && isAuthenticated) {
      // Small delay to let the app render first
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
        onboardingService.markFirstLogin();
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [shouldShowWelcome, showWelcomeModal, isAuthenticated]);

  // Sync state from localStorage
  const syncState = useCallback(() => {
    setState(onboardingService.getState());
  }, []);

  // Start a tour
  const startTour = useCallback((tourId: TourId) => {
    const tourSteps = onboardingService.getTourSteps(tourId);
    if (tourSteps.length > 0) {
      // Convert TourStep to Joyride Step format
      const joyrideSteps: Step[] = tourSteps.map((step: TourStep) => {
        const joyrideStep: Step = {
          target: step.target,
          content: step.content,
          disableBeacon: step.disableBeacon ?? true,
          spotlightClicks: step.spotlightClicks ?? false,
          hideCloseButton: step.hideCloseButton ?? false,
          showSkipButton: step.showSkipButton ?? true,
        };
        if (step.title) {
          joyrideStep.title = step.title;
        }
        if (step.placement) {
          joyrideStep.placement = step.placement;
        }
        if (step.styles) {
          joyrideStep.styles = step.styles;
        }
        return joyrideStep;
      });
      setSteps(joyrideSteps);
      setCurrentTour(tourId);
      setCurrentStep(0);
      setIsRunning(true);
    }
  }, []);

  // Stop current tour
  const stopTour = useCallback(() => {
    setIsRunning(false);
    setCurrentTour(null);
    setCurrentStep(0);
    setSteps([]);
  }, []);

  // Skip entire onboarding
  const skipOnboarding = useCallback(() => {
    onboardingService.skip();
    syncState();
    stopTour();
    setShowWelcomeModal(false);
  }, [syncState, stopTour]);

  // Reset onboarding
  const resetOnboarding = useCallback(() => {
    onboardingService.reset();
    syncState();
    stopTour();
  }, [syncState, stopTour]);

  // Complete a tour
  const completeTour = useCallback((tourId: TourId) => {
    onboardingService.completeTour(tourId);
    syncState();
  }, [syncState]);

  // Check if tour is completed
  const isTourCompleted = useCallback((tourId: TourId) => {
    return onboardingService.isTourCompleted(tourId);
  }, []);

  // Trigger feature-specific tour on first visit
  const triggerFeatureTour = useCallback((section: 'transaction' | 'budget' | 'import') => {
    if (onboardingService.isFirstVisit(section)) {
      const tourMap: Record<'transaction' | 'budget' | 'import', TourId> = {
        'transaction': 'first-transaction',
        'budget': 'first-budget',
        'import': 'first-import',
      };
      // Small delay to ensure the page is rendered
      setTimeout(() => {
        startTour(tourMap[section]);
      }, 300);
    }
  }, [startTour]);

  // Handle Joyride callbacks
  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { action, index, status, type } = data;

    // Update current step
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setCurrentStep(index + (action === ACTIONS.PREV ? -1 : 1));
      onboardingService.setCurrentStep(index + (action === ACTIONS.PREV ? -1 : 1));
    }

    // Handle tour completion
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      if (currentTour) {
        if (status === STATUS.FINISHED) {
          completeTour(currentTour);
        }
      }
      stopTour();
    }

    // Handle close action
    if (action === ACTIONS.CLOSE) {
      stopTour();
    }
  }, [currentTour, completeTour, stopTour]);

  // Handle welcome modal start tour
  const handleStartWelcomeTour = useCallback(() => {
    setShowWelcomeModal(false);
    // Small delay to ensure modal is closed
    setTimeout(() => {
      startTour('welcome');
    }, 200);
  }, [startTour]);

  // Handle welcome modal skip
  const handleSkipWelcome = useCallback(() => {
    skipOnboarding();
  }, [skipOnboarding]);

  // Context value
  const value = useMemo<OnboardingContextValue>(() => ({
    state,
    isRunning,
    currentTour,
    currentStep,
    totalSteps: steps.length,
    startTour,
    stopTour,
    skipOnboarding,
    resetOnboarding,
    completeTour,
    isTourCompleted,
    shouldShowWelcome,
    showWelcomeModal,
    setShowWelcomeModal,
    triggerFeatureTour,
  }), [
    state,
    isRunning,
    currentTour,
    currentStep,
    steps.length,
    startTour,
    stopTour,
    skipOnboarding,
    resetOnboarding,
    completeTour,
    isTourCompleted,
    shouldShowWelcome,
    showWelcomeModal,
    setShowWelcomeModal,
    triggerFeatureTour,
  ]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}

      {/* Joyride Tour */}
      <Joyride
        steps={steps}
        run={isRunning}
        stepIndex={currentStep}
        continuous
        showProgress
        showSkipButton
        hideCloseButton={false}
        disableScrolling={false}
        disableOverlayClose={false}
        spotlightClicks
        callback={handleJoyrideCallback}
        tooltipComponent={OnboardingTooltip}
        styles={joyrideStyles}
        locale={{
          back: 'Precedent',
          close: 'Fermer',
          last: 'Terminer',
          next: 'Suivant',
          skip: 'Passer',
          open: 'Ouvrir',
        }}
        floaterProps={{
          disableAnimation: false,
        }}
      />

      {/* Welcome Modal */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onStartTour={handleStartWelcomeTour}
        onSkip={handleSkipWelcome}
        userName={user?.displayName ?? undefined}
      />
    </OnboardingContext.Provider>
  );
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

export default OnboardingProvider;
