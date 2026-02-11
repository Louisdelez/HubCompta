// ============================================================================
// ONBOARDING SERVICE - Finance Hub
// Track onboarding progress and define tour steps
// ============================================================================

import type { Step, Placement } from 'react-joyride';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type TourId =
  | 'welcome'
  | 'first-transaction'
  | 'first-budget'
  | 'first-import';

export interface OnboardingState {
  completedTours: TourId[];
  welcomeCompleted: boolean;
  skippedAt: string | null;
  completedAt: string | null;
  currentStep: number;
  firstLoginAt: string | null;
}

export interface TourStep extends Omit<Step, 'target'> {
  target: string;
  title?: string;
  content: string;
  placement?: Placement;
  spotlightClicks?: boolean;
  disableBeacon?: boolean;
  hideCloseButton?: boolean;
  showSkipButton?: boolean;
  styles?: {
    options?: {
      width?: number;
      zIndex?: number;
    };
  };
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const STORAGE_KEY = 'finance-hub-onboarding';

const DEFAULT_STATE: OnboardingState = {
  completedTours: [],
  welcomeCompleted: false,
  skippedAt: null,
  completedAt: null,
  currentStep: 0,
  firstLoginAt: null,
};

// ----------------------------------------------------------------------------
// Tour Steps Definitions
// ----------------------------------------------------------------------------

export const WELCOME_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-onboarding="sidebar"]',
    title: 'Navigation',
    content: 'Voici votre menu principal. Accedez rapidement a toutes les fonctionnalites de Finance Hub : transactions, comptes, budgets et plus encore.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="accounts"]',
    title: 'Vos comptes',
    content: 'Gerez tous vos comptes bancaires, cartes de credit et portefeuilles. Cliquez ici pour ajouter votre premier compte.',
    placement: 'right',
  },
  {
    target: '[data-onboarding="transactions"]',
    title: 'Transactions',
    content: 'Consultez et categorisez toutes vos transactions. Vous pouvez les ajouter manuellement ou les importer depuis vos releves bancaires.',
    placement: 'right',
  },
  {
    target: '[data-onboarding="budgets"]',
    title: 'Budgets',
    content: 'Creez des budgets pour controler vos depenses par categorie. Recevez des alertes quand vous approchez de vos limites.',
    placement: 'right',
  },
  {
    target: '[data-onboarding="notifications"]',
    title: 'Notifications',
    content: 'Restez informe avec des alertes sur vos budgets, factures a venir et bien plus. Cliquez ici pour voir vos notifications.',
    placement: 'bottom',
  },
  {
    target: '[data-onboarding="settings"]',
    title: 'Parametres',
    content: 'Personnalisez votre experience : theme, devise, notifications et preferences de securite.',
    placement: 'right',
  },
  {
    target: '[data-onboarding="workspace-selector"]',
    title: 'Espaces de travail',
    content: 'Gerez plusieurs espaces : personnel, familial ou professionnel. Invitez des membres et partagez vos finances.',
    placement: 'bottom',
  },
];

export const FIRST_TRANSACTION_STEPS: TourStep[] = [
  {
    target: '[data-onboarding="add-transaction-button"]',
    title: 'Ajouter une transaction',
    content: 'Cliquez sur ce bouton pour enregistrer une nouvelle depense ou revenu.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="transaction-type"]',
    title: 'Type de transaction',
    content: 'Choisissez le type : depense, revenu ou virement entre comptes.',
    placement: 'right',
  },
  {
    target: '[data-onboarding="transaction-category"]',
    title: 'Categorie',
    content: 'Selectionnez une categorie pour mieux suivre vos depenses. Vous pouvez aussi creer vos propres categories.',
    placement: 'right',
  },
  {
    target: '[data-onboarding="transaction-save"]',
    title: 'Enregistrer',
    content: 'Une fois les details remplis, cliquez ici pour sauvegarder votre transaction.',
    placement: 'top',
  },
];

export const FIRST_BUDGET_STEPS: TourStep[] = [
  {
    target: '[data-onboarding="add-budget-button"]',
    title: 'Creer un budget',
    content: 'Cliquez ici pour definir un budget mensuel ou annuel pour une categorie.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="budget-category"]',
    title: 'Categorie du budget',
    content: 'Choisissez la categorie de depenses que vous souhaitez controler.',
    placement: 'right',
  },
  {
    target: '[data-onboarding="budget-amount"]',
    title: 'Montant',
    content: 'Definissez le montant maximum que vous souhaitez depenser.',
    placement: 'right',
  },
  {
    target: '[data-onboarding="budget-alert"]',
    title: 'Alertes',
    content: 'Configurez un seuil d\'alerte pour etre prevenu avant de depasser votre budget.',
    placement: 'right',
  },
];

export const FIRST_IMPORT_STEPS: TourStep[] = [
  {
    target: '[data-onboarding="import-upload"]',
    title: 'Importer un fichier',
    content: 'Deposez votre releve bancaire ici (CSV, OFX, QIF). Finance Hub analysera automatiquement le format.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="import-mapping"]',
    title: 'Correspondance des colonnes',
    content: 'Verifiez que les colonnes sont correctement associees aux champs de Finance Hub.',
    placement: 'right',
  },
  {
    target: '[data-onboarding="import-preview"]',
    title: 'Apercu',
    content: 'Visualisez les transactions avant de les importer. Vous pouvez exclure certaines lignes si necessaire.',
    placement: 'top',
  },
  {
    target: '[data-onboarding="import-confirm"]',
    title: 'Confirmer l\'import',
    content: 'Une fois satisfait, confirmez pour ajouter les transactions a votre compte.',
    placement: 'top',
  },
];

// Map tour IDs to their steps
export const TOUR_STEPS: Record<TourId, TourStep[]> = {
  'welcome': WELCOME_TOUR_STEPS,
  'first-transaction': FIRST_TRANSACTION_STEPS,
  'first-budget': FIRST_BUDGET_STEPS,
  'first-import': FIRST_IMPORT_STEPS,
};

// ----------------------------------------------------------------------------
// Onboarding Service
// ----------------------------------------------------------------------------

export const onboardingService = {
  /**
   * Get current onboarding state from localStorage
   */
  getState(): OnboardingState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_STATE, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore parse errors
    }
    return { ...DEFAULT_STATE };
  },

  /**
   * Save onboarding state to localStorage
   */
  saveState(state: Partial<OnboardingState>): OnboardingState {
    const currentState = this.getState();
    const newState = { ...currentState, ...state };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch {
      // Ignore storage errors
    }
    return newState;
  },

  /**
   * Check if a tour has been completed
   */
  isTourCompleted(tourId: TourId): boolean {
    const state = this.getState();
    return state.completedTours.includes(tourId);
  },

  /**
   * Check if user has skipped the onboarding
   */
  isSkipped(): boolean {
    const state = this.getState();
    return state.skippedAt !== null;
  },

  /**
   * Check if welcome tour should be shown (first login, not completed, not skipped)
   */
  shouldShowWelcome(): boolean {
    const state = this.getState();
    return !state.welcomeCompleted && !state.skippedAt;
  },

  /**
   * Mark a tour as completed
   */
  completeTour(tourId: TourId): OnboardingState {
    const state = this.getState();
    const completedTours = state.completedTours.includes(tourId)
      ? state.completedTours
      : [...state.completedTours, tourId];

    const updates: Partial<OnboardingState> = { completedTours };

    if (tourId === 'welcome') {
      updates.welcomeCompleted = true;
    }

    // Check if all tours are completed
    const allTours: TourId[] = ['welcome', 'first-transaction', 'first-budget', 'first-import'];
    if (allTours.every(t => completedTours.includes(t))) {
      updates.completedAt = new Date().toISOString();
    }

    return this.saveState(updates);
  },

  /**
   * Skip the entire onboarding
   */
  skip(): OnboardingState {
    return this.saveState({
      skippedAt: new Date().toISOString(),
      welcomeCompleted: true,
    });
  },

  /**
   * Reset onboarding to start fresh
   */
  reset(): OnboardingState {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    return { ...DEFAULT_STATE };
  },

  /**
   * Mark first login
   */
  markFirstLogin(): OnboardingState {
    const state = this.getState();
    if (!state.firstLoginAt) {
      return this.saveState({
        firstLoginAt: new Date().toISOString(),
      });
    }
    return state;
  },

  /**
   * Update current step index
   */
  setCurrentStep(step: number): OnboardingState {
    return this.saveState({ currentStep: step });
  },

  /**
   * Get tour steps for a specific tour
   */
  getTourSteps(tourId: TourId): TourStep[] {
    return TOUR_STEPS[tourId] ?? [];
  },

  /**
   * Check if this is the user's first visit to a section
   */
  isFirstVisit(section: 'transaction' | 'budget' | 'import'): boolean {
    const tourMap: Record<'transaction' | 'budget' | 'import', TourId> = {
      'transaction': 'first-transaction',
      'budget': 'first-budget',
      'import': 'first-import',
    };
    return !this.isTourCompleted(tourMap[section]);
  },
};

export default onboardingService;
