import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from './features/auth/AuthProvider';
import { AppLayout } from './components/layout/AppLayout';
import { Loader2 } from 'lucide-react';

// Import auth components (not lazy - needed immediately)
import { LoginForm } from './features/auth/LoginForm';
import { RegisterForm } from './features/auth/RegisterForm';

// Admin route guard (not lazy - lightweight)
import { AdminRoute } from './features/admin';

// ----------------------------------------------------------------------------
// Lazy loaded pages for code splitting
// ----------------------------------------------------------------------------

// Dashboard
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));

// Transactions
const TransactionsPage = lazy(() => import('./features/transactions').then(m => ({ default: m.TransactionsPage })));

// Accounts
const AccountsPage = lazy(() => import('./features/accounts').then(m => ({ default: m.AccountsPage })));

// Budgets
const BudgetsPage = lazy(() => import('./features/budgets').then(m => ({ default: m.BudgetsPage })));

// Documents
const DocumentsPage = lazy(() => import('./features/documents').then(m => ({ default: m.DocumentsPage })));

// Import
const ImportPage = lazy(() => import('./features/import').then(m => ({ default: m.ImportPage })));

// Rules
const RulesPage = lazy(() => import('./features/rules').then(m => ({ default: m.RulesPage })));

// Reports
const ReportsPage = lazy(() => import('./features/reports').then(m => ({ default: m.ReportsPage })));

// Pro Mode
const ProDashboard = lazy(() => import('./features/pro').then(m => ({ default: m.ProDashboard })));
const ContactsPage = lazy(() => import('./features/pro').then(m => ({ default: m.ContactsPage })));
const QuotesPage = lazy(() => import('./features/pro').then(m => ({ default: m.QuotesPage })));
const QuoteForm = lazy(() => import('./features/pro').then(m => ({ default: m.QuoteForm })));
const InvoicesPage = lazy(() => import('./features/pro').then(m => ({ default: m.InvoicesPage })));
const InvoiceForm = lazy(() => import('./features/pro').then(m => ({ default: m.InvoiceForm })));

// Investments
const PortfolioPage = lazy(() => import('./features/invest').then(m => ({ default: m.PortfolioPage })));

// Recurrences
const RecurrencesPage = lazy(() => import('./features/recurrences').then(m => ({ default: m.RecurrencesPage })));

// Currency
const ExchangeRatesPage = lazy(() => import('./features/currency').then(m => ({ default: m.ExchangeRatesPage })));

// Search
const SearchPage = lazy(() => import('./features/search').then(m => ({ default: m.SearchPage })));

// Export
const ExportPage = lazy(() => import('./features/export').then(m => ({ default: m.ExportPage })));

// Settings
const SettingsPage = lazy(() => import('./features/settings').then(m => ({ default: m.SettingsPage })));
const WorkspaceSettingsPage = lazy(() => import('./features/settings').then(m => ({ default: m.WorkspaceSettingsPage })));

// Workspaces
const SettlementPage = lazy(() => import('./features/workspaces/SettlementPage').then(m => ({ default: m.SettlementPage })));

// Notifications
const AlertSettings = lazy(() => import('./features/notifications').then(m => ({ default: m.AlertSettings })));

// Admin
const AdminLayout = lazy(() => import('./features/admin').then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import('./features/admin').then(m => ({ default: m.AdminDashboard })));
const AdminUsers = lazy(() => import('./features/admin').then(m => ({ default: m.AdminUsers })));
const AdminAuditLogs = lazy(() => import('./features/admin').then(m => ({ default: m.AdminAuditLogs })));
const AdminBackups = lazy(() => import('./features/admin').then(m => ({ default: m.AdminBackups })));
const AdminSystem = lazy(() => import('./features/admin').then(m => ({ default: m.AdminSystem })));

// ----------------------------------------------------------------------------
// Loading fallback
// ----------------------------------------------------------------------------

function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 animate-spin text-ctp-blue" />
    </div>
  );
}

// Login page with proper form
function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ctp-mantle p-4">
      <div className="card max-w-md w-full p-8">
        <LoginForm />
      </div>
    </div>
  );
}

// Register page
function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ctp-mantle p-4">
      <div className="card max-w-md w-full p-8">
        <RegisterForm />
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ctp-base">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-ctp-text">404</h1>
        <p className="text-ctp-subtext0 mt-2">Page not found</p>
      </div>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ctp-base">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ctp-blue" />
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
    <Suspense fallback={<PageLoading />}>
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

          {/* Settlement Routes */}
          <Route path="settlement" element={<SettlementPage />} />
          <Route path="workspaces/:workspaceId/settlement" element={<SettlementPage />} />

          {/* Admin Routes */}
          <Route
            path="admin"
            element={
              <AdminRoute>
                <Suspense fallback={<PageLoading />}>
                  <AdminLayout />
                </Suspense>
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="backups" element={<AdminBackups />} />
            <Route path="system" element={<AdminSystem />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
