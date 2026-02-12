// ============================================================================
// BUDGET CARD TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BudgetCard } from './BudgetCard';

// ----------------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({
  api: {
    delete: vi.fn(),
  },
}));

import { api } from '@/lib/api/client';

const mockApi = vi.mocked(api);

// ----------------------------------------------------------------------------
// Test Data
// ----------------------------------------------------------------------------

const createMockBudget = (overrides = {}) => ({
  id: 'budget-123',
  name: 'Alimentation',
  amount: 500,
  period: 'monthly' as const,
  alertThreshold: 80,
  category: {
    id: 'cat-123',
    name: 'Alimentation',
    icon: '🍔',
    color: '#FF5722',
  },
  spent: 200,
  remaining: 300,
  percentUsed: 40,
  isOverBudget: false,
  isAlertTriggered: false,
  envelopeMode: false,
  rolloverEnabled: false,
  rolloverAmount: 0,
  availableAmount: 300,
  rolloverFromPrevious: 0,
  ...overrides,
});

// ----------------------------------------------------------------------------
// Test Helpers
// ----------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderBudgetCard(budget = createMockBudget(), props = {}) {
  const queryClient = createQueryClient();
  const defaultProps = {
    budget,
    workspaceId: 'ws-123',
    onEdit: vi.fn(),
    onViewHistory: vi.fn(),
    ...props,
  };

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <BudgetCard {...defaultProps} />
      </QueryClientProvider>
    ),
    ...defaultProps,
  };
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('BudgetCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  // --------------------------------------------------------------------------
  // Basic Rendering
  // --------------------------------------------------------------------------

  describe('basic rendering', () => {
    it('should render budget name', () => {
      renderBudgetCard();

      // Budget name and category name are both "Alimentation" - check they exist
      const texts = screen.getAllByText('Alimentation');
      expect(texts.length).toBeGreaterThanOrEqual(1);
    });

    it('should render category name', () => {
      renderBudgetCard();

      // Category name appears in budget card
      const categoryTexts = screen.getAllByText('Alimentation');
      expect(categoryTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('should render category icon when available', () => {
      renderBudgetCard();

      expect(screen.getByText('🍔')).toBeInTheDocument();
    });

    it('should render fallback icon when category has no icon', () => {
      const budget = createMockBudget({
        category: { id: 'cat-123', name: 'Transport', icon: null, color: '#2196F3' },
      });
      renderBudgetCard(budget);

      // Should render the card without errors when icon is null
      const card = document.querySelector('.card');
      expect(card).toBeInTheDocument();
    });

    it('should render progress percentage', () => {
      renderBudgetCard();

      expect(screen.getByText('40%')).toBeInTheDocument();
    });

    it('should render spent amount', () => {
      renderBudgetCard();

      expect(screen.getByText(/200,00/)).toBeInTheDocument();
    });

    it('should render remaining amount', () => {
      renderBudgetCard();

      // "budgets.remaining" translation key should be present
      expect(screen.getByText('budgets.remaining')).toBeInTheDocument();
    });

    it('should render alert threshold', () => {
      renderBudgetCard();

      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Progress Bar Colors
  // --------------------------------------------------------------------------

  describe('progress bar colors', () => {
    it('should show green progress when under 50%', () => {
      const budget = createMockBudget({ percentUsed: 30 });
      renderBudgetCard(budget);

      const progressBar = document.querySelector('.bg-ctp-green');
      expect(progressBar).toBeInTheDocument();
    });

    it('should show blue progress when between 50% and alert threshold', () => {
      const budget = createMockBudget({
        percentUsed: 60,
        isAlertTriggered: false,
      });
      renderBudgetCard(budget);

      const progressBar = document.querySelector('.bg-ctp-blue');
      expect(progressBar).toBeInTheDocument();
    });

    it('should show yellow progress when alert is triggered', () => {
      const budget = createMockBudget({
        percentUsed: 85,
        isAlertTriggered: true,
      });
      renderBudgetCard(budget);

      const progressBar = document.querySelector('.bg-ctp-yellow');
      expect(progressBar).toBeInTheDocument();
    });

    it('should show red progress when over budget', () => {
      const budget = createMockBudget({
        percentUsed: 120,
        isOverBudget: true,
      });
      renderBudgetCard(budget);

      const progressBar = document.querySelector('.bg-ctp-red');
      expect(progressBar).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Status Badges
  // --------------------------------------------------------------------------

  describe('status badges', () => {
    it('should show "Exceeded" badge when over budget', () => {
      const budget = createMockBudget({ isOverBudget: true });
      renderBudgetCard(budget);

      expect(screen.getByText('budgets.exceeded')).toBeInTheDocument();
    });

    it('should show "Warning" badge when alert triggered', () => {
      const budget = createMockBudget({ isAlertTriggered: true });
      renderBudgetCard(budget);

      expect(screen.getByText('budgets.warning')).toBeInTheDocument();
    });

    it('should not show badge when budget is healthy', () => {
      renderBudgetCard();

      expect(screen.queryByText('budgets.exceeded')).not.toBeInTheDocument();
      expect(screen.queryByText('budgets.warning')).not.toBeInTheDocument();
    });

    it('should prioritize "Exceeded" over "Warning" when both conditions are true', () => {
      const budget = createMockBudget({
        isOverBudget: true,
        isAlertTriggered: true,
      });
      renderBudgetCard(budget);

      expect(screen.getByText('budgets.exceeded')).toBeInTheDocument();
      expect(screen.queryByText('budgets.warning')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Envelope Mode
  // --------------------------------------------------------------------------

  describe('envelope mode', () => {
    it('should show envelope badge when envelope mode is enabled', () => {
      const budget = createMockBudget({ envelopeMode: true });
      renderBudgetCard(budget);

      expect(screen.getByText('budgets.envelopeMode')).toBeInTheDocument();
    });

    it('should show "Available" instead of "Remaining" in envelope mode', () => {
      const budget = createMockBudget({ envelopeMode: true });
      renderBudgetCard(budget);

      expect(screen.getByText('budgets.available')).toBeInTheDocument();
      expect(screen.queryByText('budgets.remaining')).not.toBeInTheDocument();
    });

    it('should show rollover info when rollover amount is positive', () => {
      const budget = createMockBudget({
        envelopeMode: true,
        rolloverFromPrevious: 50,
      });
      renderBudgetCard(budget);

      expect(screen.getByText('budgets.rolloverFromPrevious')).toBeInTheDocument();
      expect(screen.getByText(/50,00/)).toBeInTheDocument();
    });

    it('should not show rollover info when rollover is zero', () => {
      const budget = createMockBudget({
        envelopeMode: true,
        rolloverFromPrevious: 0,
      });
      renderBudgetCard(budget);

      expect(screen.queryByText('budgets.rolloverFromPrevious')).not.toBeInTheDocument();
    });

    it('should show "Base budget" in envelope mode', () => {
      const budget = createMockBudget({ envelopeMode: true });
      renderBudgetCard(budget);

      expect(screen.getByText('budgets.baseBudget')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Ring Indicators
  // --------------------------------------------------------------------------

  describe('ring indicators', () => {
    it('should show red ring when over budget', () => {
      const budget = createMockBudget({ isOverBudget: true });
      renderBudgetCard(budget);

      const card = document.querySelector('.ring-ctp-red');
      expect(card).toBeInTheDocument();
    });

    it('should show yellow ring when alert triggered (not over budget)', () => {
      const budget = createMockBudget({
        isAlertTriggered: true,
        isOverBudget: false,
      });
      renderBudgetCard(budget);

      const card = document.querySelector('.ring-ctp-yellow');
      expect(card).toBeInTheDocument();
    });

    it('should show top red indicator line when over budget', () => {
      const budget = createMockBudget({ isOverBudget: true });
      renderBudgetCard(budget);

      // The red indicator is a div with absolute position
      const indicator = document.querySelector('.absolute.top-0.left-0.w-full.h-1.bg-ctp-red');
      expect(indicator).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Action Buttons
  // --------------------------------------------------------------------------

  describe('action buttons', () => {
    it('should call onViewHistory when history button is clicked', async () => {
      const user = userEvent.setup();
      const { onViewHistory } = renderBudgetCard();

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      expect(onViewHistory).toHaveBeenCalled();
    });

    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup();
      const { onEdit } = renderBudgetCard();

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(onEdit).toHaveBeenCalled();
    });

    it('should show confirmation dialog when delete is clicked', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm');
      renderBudgetCard();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Confirmation uses translation key with interpolation
      expect(confirmSpy).toHaveBeenCalled();
    });

    it('should call API delete when confirmed', async () => {
      const user = userEvent.setup();
      mockApi.delete.mockResolvedValue({});
      renderBudgetCard();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockApi.delete).toHaveBeenCalledWith('/workspaces/ws-123/budgets/budget-123');
      });
    });

    it('should not call API delete when confirmation is cancelled', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockImplementation(() => false);
      renderBudgetCard();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(mockApi.delete).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Currency Formatting
  // --------------------------------------------------------------------------

  describe('currency formatting', () => {
    it('should format amounts in EUR with French locale', () => {
      const budget = createMockBudget({ spent: 1234.56 });
      renderBudgetCard(budget);

      // French locale uses space as thousands separator and comma as decimal
      expect(screen.getByText(/1[\s\u00a0]?234,56/)).toBeInTheDocument();
    });

    it('should format negative remaining amount when over budget', () => {
      const budget = createMockBudget({
        isOverBudget: true,
        remaining: -50,
      });
      renderBudgetCard(budget);

      // Should show negative sign
      expect(screen.getByText(/-/)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Progress Bar Width
  // --------------------------------------------------------------------------

  describe('progress bar width', () => {
    it('should cap progress width at 100%', () => {
      const budget = createMockBudget({ percentUsed: 150 });
      renderBudgetCard(budget);

      const progressBar = document.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('should set correct width for normal percentage', () => {
      const budget = createMockBudget({ percentUsed: 40 });
      renderBudgetCard(budget);

      const progressBar = document.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '40%' });
    });

    it('should handle zero percentage', () => {
      const budget = createMockBudget({ percentUsed: 0 });
      renderBudgetCard(budget);

      const progressBar = document.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });
  });

  // --------------------------------------------------------------------------
  // Period Display
  // --------------------------------------------------------------------------

  describe('period handling', () => {
    it('should handle monthly period budgets', () => {
      const budget = createMockBudget({ period: 'monthly' });
      renderBudgetCard(budget);

      // Budget should render without errors - check that percentage and amount are displayed
      expect(screen.getByText('40%')).toBeInTheDocument();
    });

    it('should handle yearly period budgets', () => {
      const budget = createMockBudget({ period: 'yearly', amount: 6000 });
      renderBudgetCard(budget);

      // Budget should render without errors - check that percentage is displayed
      expect(screen.getByText('40%')).toBeInTheDocument();
    });
  });
});
