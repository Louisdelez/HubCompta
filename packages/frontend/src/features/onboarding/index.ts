// ============================================================================
// ONBOARDING FEATURE - Finance Hub
// Re-exports all onboarding components and utilities
// ============================================================================

export { OnboardingProvider, useOnboarding } from './OnboardingProvider';
export { OnboardingTooltip } from './OnboardingTooltip';
export { OnboardingProgress } from './OnboardingProgress';
export { WelcomeModal } from './WelcomeModal';
export { RestartTutorialButton } from './RestartTutorialButton';

// Re-export types and service from lib
export {
  onboardingService,
  type TourId,
  type OnboardingState,
  type TourStep,
  WELCOME_TOUR_STEPS,
  FIRST_TRANSACTION_STEPS,
  FIRST_BUDGET_STEPS,
  FIRST_IMPORT_STEPS,
  TOUR_STEPS,
} from '@/lib/onboarding';
