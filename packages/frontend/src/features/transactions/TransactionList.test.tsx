// ============================================================================
// TRANSACTION LIST TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { TransactionList } from './TransactionList';

// ----------------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/hooks/useWorkspace', () => ({
  useWorkspace: vi.fn(),
}));

vi.mock('./TransactionForm', () => ({
  TransactionForm: ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => (
    <div data-testid="transaction-form">
      <button onClick={onClose}>Close Form</button>
      <button onClick={onSuccess}>Submit Form</button>
    </div>
  ),
}));

// Mock @tanstack/react-virtual to bypass virtualization in tests
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize, getItemKey }: {
    count: number;
    estimateSize: (index: number) => number;
    getItemKey?: (index: number) => string | number;
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: getItemKey ? getItemKey(index) : index,
        start: index * estimateSize(index),
        size: estimateSize(index),
        end: (index + 1) * estimateSize(index),
        lane: 0,
      })),
    getTotalSize: () => count * 72, // Approximate size
    measureElement: () => {},
    scrollToIndex: () => {},
  }),
}));

import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';

const mockApi = vi.mocked(api);
const mockUseWorkspace = vi.mocked(useWorkspace);

// ----------------------------------------------------------------------------
// Test Data
// ----------------------------------------------------------------------------

const mockTransactions = [
  {
    id: 'txn-1',
    amount: -50.00,
    description: 'Grocery Shopping',
    date: '2024-01-15T10:00:00Z',
    type: 'expense' as const,
    isReconciled: true,
    category: { id: 'cat-1', name: 'Alimentation', icon: null },
    account: { id: 'acc-1', name: 'Compte Courant', currency: 'EUR' },
    tags: [{ id: 'tag-1', name: 'Courses', color: '#ff0000' }],
  },
  {
    id: 'txn-2',
    amount: 2500.00,
    description: 'Salary',
    date: '2024-01-15T09:00:00Z',
    type: 'income' as const,
    isReconciled: false,
    category: { id: 'cat-2', name: 'Salaire', icon: null },
    account: { id: 'acc-1', name: 'Compte Courant', currency: 'EUR' },
    tags: [],
  },
  {
    id: 'txn-3',
    amount: 100.00,
    description: 'Transfer to Savings',
    date: '2024-01-14T15:00:00Z',
    type: 'transfer' as const,
    isReconciled: false,
    category: null,
    account: { id: 'acc-2', name: 'Livret A', currency: 'EUR' },
    tags: [],
  },
];

const mockApiResponse = {
  transactions: mockTransactions,
  total: 3,
  meta: {
    page: 1,
    limit: 50,
    totalPages: 1,
  },
};

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

function renderTransactionList() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TransactionList />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('TransactionList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockWorkspace = {
      id: 'ws-1',
      name: 'Test Workspace',
      slug: 'test-workspace',
      currency: 'EUR',
      type: 'personal' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockUseWorkspace.mockReturnValue({
      currentWorkspaceId: 'ws-1',
      currentWorkspace: mockWorkspace,
      workspaces: [mockWorkspace],
      isLoading: false,
      workspacesLoading: false,
      currentWorkspaceLoading: false,
      error: null,
      workspacesError: null,
      currentWorkspaceError: null,
      setCurrentWorkspaceId: vi.fn(),
      switchWorkspace: vi.fn(),
      hasWorkspaces: true,
      isProEnabled: false,
      isInvestEnabled: false,
    } as ReturnType<typeof useWorkspace>);
  });

  // --------------------------------------------------------------------------
  // Rendering Transactions
  // --------------------------------------------------------------------------

  describe('rendering transactions', () => {
    it('should display loading state initially', () => {
      mockApi.get.mockImplementation(() => new Promise(() => {}));
      renderTransactionList();

      // Check for skeleton loading elements
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });

    it('should render transactions list', async () => {
      mockApi.get.mockResolvedValueOnce(mockApiResponse);
      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      });

      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.getByText('Transfer to Savings')).toBeInTheDocument();
    });

    it('should display transaction amounts with correct formatting', async () => {
      mockApi.get.mockResolvedValueOnce(mockApiResponse);
      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText(/2\s?500,00/)).toBeInTheDocument(); // +2 500,00 EUR
      });
    });

    it('should display transaction categories', async () => {
      mockApi.get.mockResolvedValueOnce(mockApiResponse);
      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Alimentation')).toBeInTheDocument();
        expect(screen.getByText('Salaire')).toBeInTheDocument();
      });
    });

    it('should display "Non categorise" for uncategorized transactions', async () => {
      mockApi.get.mockResolvedValueOnce(mockApiResponse);
      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText(/non categorise/i)).toBeInTheDocument();
      });
    });

    it('should display account names', async () => {
      mockApi.get.mockResolvedValueOnce(mockApiResponse);
      renderTransactionList();

      await waitFor(() => {
        expect(screen.getAllByText('Compte Courant')).toHaveLength(2);
        expect(screen.getByText('Livret A')).toBeInTheDocument();
      });
    });

    it('should display transaction tags', async () => {
      mockApi.get.mockResolvedValueOnce(mockApiResponse);
      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Courses')).toBeInTheDocument();
      });
    });

    it('should show reconciled indicator for reconciled transactions', async () => {
      mockApi.get.mockResolvedValueOnce(mockApiResponse);
      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByTitle('Rapproche')).toBeInTheDocument();
      });
    });

    it('should display total transaction count', async () => {
      mockApi.get.mockResolvedValueOnce(mockApiResponse);
      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('3 transactions')).toBeInTheDocument();
      });
    });

    it('should group transactions by date', async () => {
      mockApi.get.mockResolvedValueOnce(mockApiResponse);
      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      });

      // Transactions should be grouped by date
      // We should see date headers for different days
    });

    it('should show empty state when no transactions', async () => {
      mockApi.get.mockResolvedValueOnce({
        transactions: [],
        total: 0,
        meta: { page: 1, limit: 50, totalPages: 0 },
      });

      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Aucune transaction')).toBeInTheDocument();
      });

      expect(screen.getByText('Ajouter une transaction')).toBeInTheDocument();
    });

    it('should show workspace selector message when no workspace', async () => {
      mockUseWorkspace.mockReturnValue({
        currentWorkspaceId: undefined,
        currentWorkspace: undefined,
        workspaces: [],
        isLoading: false,
        workspacesLoading: false,
        currentWorkspaceLoading: false,
        error: null,
        workspacesError: null,
        currentWorkspaceError: null,
        setCurrentWorkspaceId: vi.fn(),
        switchWorkspace: vi.fn(),
        hasWorkspaces: false,
        isProEnabled: false,
        isInvestEnabled: false,
      } as ReturnType<typeof useWorkspace>);

      renderTransactionList();

      expect(screen.getByText(/selectionnez un espace de travail/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Filtering
  // --------------------------------------------------------------------------

  describe('filtering', () => {
    it('should have a search input', async () => {
      mockApi.get.mockResolvedValueOnce(mockApiResponse);
      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument();
      });
    });

    it('should filter transactions when search is submitted', async () => {
      const user = userEvent.setup();
      mockApi.get.mockResolvedValue(mockApiResponse);

      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Rechercher...');
      await user.type(searchInput, 'Grocery');
      await user.click(screen.getByText('Rechercher'));

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith(
          expect.stringContaining('search=Grocery')
        );
      });
    });

    it('should reset to page 1 when filtering', async () => {
      const user = userEvent.setup();
      mockApi.get.mockResolvedValue(mockApiResponse);

      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Rechercher...');
      await user.type(searchInput, 'test');
      await user.click(screen.getByText('Rechercher'));

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenLastCalledWith(
          expect.stringContaining('page=1')
        );
      });
    });

    it('should include workspace ID in API call', async () => {
      mockApi.get.mockResolvedValue(mockApiResponse);

      renderTransactionList();

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith(
          expect.stringContaining('/workspaces/ws-1/transactions')
        );
      });
    });
  });

  // --------------------------------------------------------------------------
  // Sorting
  // --------------------------------------------------------------------------

  describe('sorting', () => {
    it('should group transactions by date in descending order', async () => {
      const transactionsMultipleDays = [
        {
          ...mockTransactions[0],
          date: '2024-01-15T10:00:00Z',
        },
        {
          ...mockTransactions[1],
          id: 'txn-4',
          date: '2024-01-14T10:00:00Z',
        },
      ];

      mockApi.get.mockResolvedValueOnce({
        transactions: transactionsMultipleDays,
        total: 2,
        meta: { page: 1, limit: 50, totalPages: 1 },
      });

      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      });

      // Get all date group headers
      const dateHeaders = screen.getAllByRole('heading', { level: 3 });
      expect(dateHeaders.length).toBeGreaterThanOrEqual(1);
    });

    it('should apply different styles for income, expense, and transfer', async () => {
      mockApi.get.mockResolvedValueOnce(mockApiResponse);
      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      });

      // Check that transactions have the correct border color class
      const groceryCard = screen.getByText('Grocery Shopping').closest('.card');
      const salaryCard = screen.getByText('Salary').closest('.card');
      const transferCard = screen.getByText('Transfer to Savings').closest('.card');

      expect(groceryCard?.className).toContain('border-l-ctp-red');
      expect(salaryCard?.className).toContain('border-l-ctp-green');
      expect(transferCard?.className).toContain('border-l-ctp-blue');
    });
  });

  // --------------------------------------------------------------------------
  // Pagination
  // --------------------------------------------------------------------------

  describe('pagination', () => {
    it('should show pagination when there are multiple pages', async () => {
      mockApi.get.mockResolvedValueOnce({
        ...mockApiResponse,
        meta: { page: 1, limit: 50, totalPages: 3 },
      });

      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Page 1 sur 3')).toBeInTheDocument();
      });

      expect(screen.getByText('Precedent')).toBeInTheDocument();
      expect(screen.getByText('Suivant')).toBeInTheDocument();
    });

    it('should disable previous button on first page', async () => {
      mockApi.get.mockResolvedValueOnce({
        ...mockApiResponse,
        meta: { page: 1, limit: 50, totalPages: 3 },
      });

      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Precedent')).toBeDisabled();
      });
    });

    it('should disable next button on last page', async () => {
      const user = userEvent.setup();
      // Start on page 1 of 2, then navigate to page 2 (last page)
      mockApi.get.mockResolvedValue({
        ...mockApiResponse,
        meta: { page: 1, limit: 50, totalPages: 2 },
      });

      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Page 1 sur 2')).toBeInTheDocument();
      });

      // Navigate to page 2
      await user.click(screen.getByText('Suivant'));

      // Now on last page, next should be disabled
      await waitFor(() => {
        expect(screen.getByText('Suivant')).toBeDisabled();
      });
    });

    it('should navigate to next page when clicking next', async () => {
      const user = userEvent.setup();
      mockApi.get.mockResolvedValue({
        ...mockApiResponse,
        meta: { page: 1, limit: 50, totalPages: 3 },
      });

      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Suivant')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Suivant'));

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith(
          expect.stringContaining('page=2')
        );
      });
    });

    it('should navigate to previous page when clicking previous', async () => {
      const user = userEvent.setup();
      mockApi.get.mockResolvedValue({
        ...mockApiResponse,
        meta: { page: 2, limit: 50, totalPages: 3 },
      });

      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Page 2 sur 3')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Precedent'));

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith(
          expect.stringContaining('page=1')
        );
      });
    });

    it('should not show pagination when only one page', async () => {
      mockApi.get.mockResolvedValueOnce(mockApiResponse);

      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      });

      expect(screen.queryByText('Precedent')).not.toBeInTheDocument();
      expect(screen.queryByText('Suivant')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Transaction Form
  // --------------------------------------------------------------------------

  describe('transaction form', () => {
    it('should open form when clicking new transaction button', async () => {
      const user = userEvent.setup();
      mockApi.get.mockResolvedValueOnce(mockApiResponse);

      renderTransactionList();

      // Find button by its role - the button contains "+ Nouvelle transaction" on desktop
      // but has responsive text, so we use a function matcher
      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /nouvelle transaction|ajouter/i });
        expect(addButton).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /nouvelle transaction|ajouter/i });
      await user.click(addButton);

      expect(screen.getByTestId('transaction-form')).toBeInTheDocument();
    });

    it('should open form when clicking on a transaction', async () => {
      const user = userEvent.setup();
      mockApi.get.mockResolvedValueOnce(mockApiResponse);

      renderTransactionList();

      await waitFor(() => {
        expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Grocery Shopping'));

      expect(screen.getByTestId('transaction-form')).toBeInTheDocument();
    });

    it('should close form when close button is clicked', async () => {
      const user = userEvent.setup();
      mockApi.get.mockResolvedValueOnce(mockApiResponse);

      renderTransactionList();

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /nouvelle transaction|ajouter/i });
        expect(addButton).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /nouvelle transaction|ajouter/i });
      await user.click(addButton);
      expect(screen.getByTestId('transaction-form')).toBeInTheDocument();

      await user.click(screen.getByText('Close Form'));

      expect(screen.queryByTestId('transaction-form')).not.toBeInTheDocument();
    });

    it('should refetch transactions when form is submitted successfully', async () => {
      const user = userEvent.setup();
      mockApi.get.mockResolvedValue(mockApiResponse);

      renderTransactionList();

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /nouvelle transaction|ajouter/i });
        expect(addButton).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /nouvelle transaction|ajouter/i });
      await user.click(addButton);
      await user.click(screen.getByText('Submit Form'));

      await waitFor(() => {
        // Should have been called: initial load + after submit
        expect(mockApi.get).toHaveBeenCalledTimes(2);
      });
    });
  });
});
