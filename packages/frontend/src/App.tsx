import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './features/auth/AuthProvider';
import { AppLayout } from './components/layout/AppLayout';

// Pro Mode imports
import {
  ProDashboard,
  ContactsPage,
  QuotesPage,
  QuoteForm,
  InvoicesPage,
  InvoiceForm,
} from './features/pro';

// Investment imports
import { PortfolioPage } from './features/invest';

// Reports imports
import { ReportsPage } from './features/reports';

// Recurrences imports
import { RecurrencesPage } from './features/recurrences';

// Currency imports
import { ExchangeRatesPage } from './features/currency';

// Search imports
import { SearchPage } from './features/search';

// Export imports
import { ExportPage } from './features/export';

// Transactions imports
import { TransactionsPage } from './features/transactions';

// Accounts imports
import { AccountsPage } from './features/accounts';

// Budgets imports
import { BudgetsPage } from './features/budgets';

// Documents imports
import { DocumentsPage } from './features/documents';

// Import imports
import { ImportPage } from './features/import';

// Rules imports
import { RulesPage } from './features/rules';

// Settings imports
import { SettingsPage, WorkspaceSettingsPage } from './features/settings';

// Notifications imports
import { AlertSettings } from './features/notifications';

// Dashboard imports
import { DashboardPage } from './features/dashboard/DashboardPage';

// Lazy load pages for better code splitting
// import { lazy, Suspense } from 'react';
// const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
// const LoginPage = lazy(() => import('./features/auth/LoginPage'));
// etc.

// Import auth components
import { LoginForm } from './features/auth/LoginForm';
import { RegisterForm } from './features/auth/RegisterForm';

// Login page with proper form
function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="card max-w-md w-full p-8">
        <LoginForm />
      </div>
    </div>
  );
}

// Register page
function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="card max-w-md w-full p-8">
        <RegisterForm />
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">404</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Page not found</p>
      </div>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Transactions Routes */}
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="workspaces/:workspaceId/transactions" element={<TransactionsPage />} />

        {/* Accounts Routes */}
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="workspaces/:workspaceId/accounts" element={<AccountsPage />} />

        {/* Budgets Routes */}
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="workspaces/:workspaceId/budgets" element={<BudgetsPage />} />

        {/* Documents Routes */}
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="workspaces/:workspaceId/documents" element={<DocumentsPage />} />

        {/* Import Routes */}
        <Route path="import" element={<ImportPage />} />
        <Route path="workspaces/:workspaceId/import" element={<ImportPage />} />

        {/* Rules Routes */}
        <Route path="rules" element={<RulesPage />} />
        <Route path="workspaces/:workspaceId/rules" element={<RulesPage />} />

        {/* Reports Routes */}
        <Route path="reports" element={<ReportsPage />} />

        {/* Pro Mode Routes */}
        <Route path="workspaces/:workspaceId/pro">
          <Route index element={<ProDashboard />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="quotes" element={<QuotesPage />} />
          <Route path="quotes/new" element={<QuoteForm />} />
          <Route path="quotes/:quoteId" element={<QuoteForm />} />
          <Route path="quotes/:quoteId/edit" element={<QuoteForm />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="invoices/new" element={<InvoiceForm />} />
          <Route path="invoices/:invoiceId" element={<InvoiceForm />} />
          <Route path="invoices/:invoiceId/edit" element={<InvoiceForm />} />
        </Route>

        {/* Investment Routes */}
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="workspaces/:workspaceId/portfolio" element={<PortfolioPage />} />

        {/* Recurrences Routes */}
        <Route path="recurrences" element={<RecurrencesPage />} />
        <Route path="workspaces/:workspaceId/recurrences" element={<RecurrencesPage />} />

        {/* Currency Routes */}
        <Route path="currencies" element={<ExchangeRatesPage />} />

        {/* Search Routes */}
        <Route path="search" element={<SearchPage />} />
        <Route path="workspaces/:workspaceId/search" element={<SearchPage />} />

        {/* Export Routes */}
        <Route path="export" element={<ExportPage />} />
        <Route path="workspaces/:workspaceId/export" element={<ExportPage />} />

        {/* Settings Routes */}
        <Route path="settings" element={<SettingsPage />} />
        <Route path="workspaces/:workspaceId/settings" element={<WorkspaceSettingsPage />} />
        <Route path="notifications/alerts" element={<AlertSettings />} />

        {/* More routes will be added as features are implemented */}
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
