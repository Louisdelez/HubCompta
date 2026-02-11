import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './features/auth/AuthProvider';
import { AppLayout } from './components/layout/AppLayout';
import { PageLoading, DashboardSkeleton, TableSkeleton } from './components/ui/Loading';

// Import auth components (not lazy - needed immediately)
import { LoginForm } from './features/auth/LoginForm';
import { RegisterForm } from './features/auth/RegisterForm';

// Admin route guard (not lazy - lightweight)
import { AdminRoute } from './features/admin';

// ----------------------------------------------------------------------------
// Route prefetching utilities
// ----------------------------------------------------------------------------

/**
 * Prefetch a route module. Call this on hover or after login to preload routes.
 */
export const prefetchRoute = {
  dashboard: () => import('./features/dashboard/DashboardPage'),
  transactions: () => import('./features/transactions'),
  accounts: () => import('./features/accounts'),
  budgets: () => import('./features/budgets'),
  documents: () => import('./features/documents'),
  import: () => import('./features/import'),
  rules: () => import('./features/rules'),
  reports: () => import('./features/reports'),
  pro: () => import('./features/pro'),
  invest: () => import('./features/invest'),
  recurrences: () => import('./features/recurrences'),
  currency: () => import('./features/currency'),
  search: () => import('./features/search'),
  export: () => import('./features/export'),
  settings: () => import('./features/settings'),
  admin: () => import('./features/admin'),
  loans: () => import('./features/loans'),
  networth: () => import('./features/networth'),
  scheduled: () => import('./features/scheduled'),
  forecast: () => import('./features/forecast'),
  tax: () => import('./features/tax'),
  savings: () => import('./features/savings'),
  bills: () => import('./features/bills'),
  activity: () => import('./features/activity'),
  datamanagement: () => import('./features/datamanagement'),
  banking: () => import('./features/banking'),
  workspaceMembers: () => import('./features/workspaces'),
  gamification: () => import('./features/gamification'),
};

/**
 * Prefetch common routes after authentication.
 * This improves perceived performance for the most used routes.
 */
export function prefetchCommonRoutes() {
  // Use requestIdleCallback if available, otherwise setTimeout
  const schedule = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 100));

  schedule(() => {
    void prefetchRoute.dashboard();
    void prefetchRoute.transactions();
  });

  // Prefetch secondary routes with a slight delay
  schedule(() => {
    void prefetchRoute.accounts();
    void prefetchRoute.budgets();
  });
}

// ----------------------------------------------------------------------------
// Lazy loaded pages for code splitting
// Using webpackChunkName comments for better debugging in production
// ----------------------------------------------------------------------------

// Dashboard
const DashboardPage = lazy(() =>
  import(/* webpackChunkName: "dashboard" */ './features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage }))
);

// Transactions
const TransactionsPage = lazy(() =>
  import(/* webpackChunkName: "transactions" */ './features/transactions').then(m => ({ default: m.TransactionsPage }))
);

// Accounts
const AccountsPage = lazy(() =>
  import(/* webpackChunkName: "accounts" */ './features/accounts').then(m => ({ default: m.AccountsPage }))
);

// Budgets
const BudgetsPage = lazy(() =>
  import(/* webpackChunkName: "budgets" */ './features/budgets').then(m => ({ default: m.BudgetsPage }))
);

// Documents
const DocumentsPage = lazy(() =>
  import(/* webpackChunkName: "documents" */ './features/documents').then(m => ({ default: m.DocumentsPage }))
);

// Import
const ImportPage = lazy(() =>
  import(/* webpackChunkName: "import" */ './features/import').then(m => ({ default: m.ImportPage }))
);

// Rules
const RulesPage = lazy(() =>
  import(/* webpackChunkName: "rules" */ './features/rules').then(m => ({ default: m.RulesPage }))
);

// Reports
const ReportsPage = lazy(() =>
  import(/* webpackChunkName: "reports" */ './features/reports').then(m => ({ default: m.ReportsPage }))
);

// Pro Mode - grouped in same chunk since they're used together
const ProDashboard = lazy(() =>
  import(/* webpackChunkName: "pro" */ './features/pro').then(m => ({ default: m.ProDashboard }))
);
const ContactsPage = lazy(() =>
  import(/* webpackChunkName: "pro" */ './features/pro').then(m => ({ default: m.ContactsPage }))
);
const QuotesPage = lazy(() =>
  import(/* webpackChunkName: "pro" */ './features/pro').then(m => ({ default: m.QuotesPage }))
);
const QuoteForm = lazy(() =>
  import(/* webpackChunkName: "pro" */ './features/pro').then(m => ({ default: m.QuoteForm }))
);
const InvoicesPage = lazy(() =>
  import(/* webpackChunkName: "pro" */ './features/pro').then(m => ({ default: m.InvoicesPage }))
);
const InvoiceForm = lazy(() =>
  import(/* webpackChunkName: "pro" */ './features/pro').then(m => ({ default: m.InvoiceForm }))
);

// Investments
const PortfolioPage = lazy(() =>
  import(/* webpackChunkName: "invest" */ './features/invest').then(m => ({ default: m.PortfolioPage }))
);

// Loans
const LoansPage = lazy(() =>
  import(/* webpackChunkName: "loans" */ './features/loans').then(m => ({ default: m.LoansPage }))
);

// Net Worth
const NetWorthPage = lazy(() =>
  import(/* webpackChunkName: "networth" */ './features/networth').then(m => ({ default: m.NetWorthPage }))
);

// Recurrences
const RecurrencesPage = lazy(() =>
  import(/* webpackChunkName: "recurrences" */ './features/recurrences').then(m => ({ default: m.RecurrencesPage }))
);

// Scheduled Transactions
const ScheduledPage = lazy(() =>
  import(/* webpackChunkName: "scheduled" */ './features/scheduled').then(m => ({ default: m.ScheduledPage }))
);

// Forecast
const ForecastPage = lazy(() =>
  import(/* webpackChunkName: "forecast" */ './features/forecast').then(m => ({ default: m.ForecastPage }))
);

// Tax
const TaxPage = lazy(() =>
  import(/* webpackChunkName: "tax" */ './features/tax').then(m => ({ default: m.TaxPage }))
);

// Savings
const SavingsPage = lazy(() =>
  import(/* webpackChunkName: "savings" */ './features/savings').then(m => ({ default: m.SavingsPage }))
);

// Bills
const BillsPage = lazy(() =>
  import(/* webpackChunkName: "bills" */ './features/bills').then(m => ({ default: m.BillsPage }))
);

// Currency
const ExchangeRatesPage = lazy(() =>
  import(/* webpackChunkName: "currency" */ './features/currency').then(m => ({ default: m.ExchangeRatesPage }))
);

// Search
const SearchPage = lazy(() =>
  import(/* webpackChunkName: "search" */ './features/search').then(m => ({ default: m.SearchPage }))
);

// Export
const ExportPage = lazy(() =>
  import(/* webpackChunkName: "export" */ './features/export').then(m => ({ default: m.ExportPage }))
);

// Settings
const SettingsPage = lazy(() =>
  import(/* webpackChunkName: "settings" */ './features/settings').then(m => ({ default: m.SettingsPage }))
);
const WorkspaceSettingsPage = lazy(() =>
  import(/* webpackChunkName: "settings" */ './features/settings').then(m => ({ default: m.WorkspaceSettingsPage }))
);

// Workspaces
const SettlementPage = lazy(() =>
  import(/* webpackChunkName: "workspaces" */ './features/workspaces/SettlementPage').then(m => ({ default: m.SettlementPage }))
);

// Notifications
const AlertSettings = lazy(() =>
  import(/* webpackChunkName: "notifications" */ './features/notifications').then(m => ({ default: m.AlertSettings }))
);
const NotificationChannelsPage = lazy(() =>
  import(/* webpackChunkName: "notifications" */ './features/notifications/channels').then(m => ({ default: m.NotificationChannelsPage }))
);

// Activity
const ActivityPage = lazy(() =>
  import(/* webpackChunkName: "activity" */ './features/activity').then(m => ({ default: m.ActivityPage }))
);

// Data Management
const DataManagementPage = lazy(() =>
  import(/* webpackChunkName: "datamanagement" */ './features/datamanagement').then(m => ({ default: m.DataManagementPage }))
);

// Banking
const BankConnectionsPage = lazy(() =>
  import(/* webpackChunkName: "banking" */ './features/banking').then(m => ({ default: m.BankConnectionsPage }))
);
const BankingCallbackPage = lazy(() =>
  import(/* webpackChunkName: "banking" */ './features/banking').then(m => ({ default: m.BankingCallbackPage }))
);

// Workspace Members
const MembersPage = lazy(() =>
  import(/* webpackChunkName: "workspaces" */ './features/workspaces').then(m => ({ default: m.MembersPage }))
);

// Gamification
const GamificationPage = lazy(() =>
  import(/* webpackChunkName: "gamification" */ './features/gamification').then(m => ({ default: m.GamificationPage }))
);

// Categorization (AI)
const CategorizationPage = lazy(() => import('@/features/categorization/CategorizationPage'));

// Admin - grouped in same chunk since they're admin-only
const AdminLayout = lazy(() =>
  import(/* webpackChunkName: "admin" */ './features/admin').then(m => ({ default: m.AdminLayout }))
);
const AdminDashboard = lazy(() =>
  import(/* webpackChunkName: "admin" */ './features/admin').then(m => ({ default: m.AdminDashboard }))
);
const AdminUsers = lazy(() =>
  import(/* webpackChunkName: "admin" */ './features/admin').then(m => ({ default: m.AdminUsers }))
);
const AdminAuditLogs = lazy(() =>
  import(/* webpackChunkName: "admin" */ './features/admin').then(m => ({ default: m.AdminAuditLogs }))
);
const AdminBackups = lazy(() =>
  import(/* webpackChunkName: "admin" */ './features/admin').then(m => ({ default: m.AdminBackups }))
);
const AdminSystem = lazy(() =>
  import(/* webpackChunkName: "admin" */ './features/admin').then(m => ({ default: m.AdminSystem }))
);

// ----------------------------------------------------------------------------
// Skeleton fallback components for different page types
// ----------------------------------------------------------------------------

function DashboardLoading() {
  return <DashboardSkeleton />;
}

function TablePageLoading() {
  return (
    <div className="p-6">
      <TableSkeleton rows={8} columns={5} />
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
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-ctp-base">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-ctp-text">{t('404.title')}</h1>
        <p className="text-ctp-subtext0 mt-2">{t('404.message')}</p>
      </div>
    </div>
  );
}

// Protected route wrapper with route prefetching
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

  // Prefetch common routes after authentication
  useEffect(() => {
    if (isAuthenticated) {
      prefetchCommonRoutes();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ctp-base">
        <PageLoading text={t('auth.authenticating')} />
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
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<DashboardLoading />}>
                <DashboardPage />
              </Suspense>
            }
          />

          {/* Transactions Routes */}
          <Route
            path="transactions"
            element={
              <Suspense fallback={<TablePageLoading />}>
                <TransactionsPage />
              </Suspense>
            }
          />
          <Route
            path="workspaces/:workspaceId/transactions"
            element={
              <Suspense fallback={<TablePageLoading />}>
                <TransactionsPage />
              </Suspense>
            }
          />

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

          {/* Loans Routes */}
          <Route path="loans" element={<LoansPage />} />
          <Route path="workspaces/:workspaceId/loans" element={<LoansPage />} />

          {/* Net Worth Routes */}
          <Route path="networth" element={<NetWorthPage />} />
          <Route path="workspaces/:workspaceId/networth" element={<NetWorthPage />} />

          {/* Recurrences Routes */}
          <Route path="recurrences" element={<RecurrencesPage />} />
          <Route path="workspaces/:workspaceId/recurrences" element={<RecurrencesPage />} />

          {/* Scheduled Transactions Routes */}
          <Route path="scheduled" element={<ScheduledPage />} />
          <Route path="workspaces/:workspaceId/scheduled" element={<ScheduledPage />} />

          {/* Forecast Routes */}
          <Route path="forecast" element={<ForecastPage />} />
          <Route path="workspaces/:workspaceId/forecast" element={<ForecastPage />} />

          {/* Tax Routes */}
          <Route path="tax" element={<TaxPage />} />
          <Route path="workspaces/:workspaceId/tax" element={<TaxPage />} />

          {/* Savings Routes */}
          <Route path="savings" element={<SavingsPage />} />
          <Route path="workspaces/:workspaceId/savings" element={<SavingsPage />} />

          {/* Bills Routes */}
          <Route path="bills" element={<BillsPage />} />
          <Route path="workspaces/:workspaceId/bills" element={<BillsPage />} />

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
          <Route path="settings/notification-channels" element={<NotificationChannelsPage />} />
          <Route path="workspaces/:workspaceId/settings" element={<WorkspaceSettingsPage />} />
          <Route path="notifications/alerts" element={<AlertSettings />} />

          {/* Settlement Routes */}
          <Route path="settlement" element={<SettlementPage />} />
          <Route path="workspaces/:workspaceId/settlement" element={<SettlementPage />} />

          {/* Activity Routes */}
          <Route path="activity" element={<ActivityPage />} />
          <Route path="workspaces/:workspaceId/activity" element={<ActivityPage />} />

          {/* Data Management Routes */}
          <Route path="data" element={<DataManagementPage />} />
          <Route path="workspaces/:workspaceId/data" element={<DataManagementPage />} />

          {/* Banking Routes */}
          <Route path="banking" element={<BankConnectionsPage />} />
          <Route path="banking/callback" element={<BankingCallbackPage />} />
          <Route path="workspaces/:workspaceId/banking" element={<BankConnectionsPage />} />

          {/* Workspace Members Routes */}
          <Route path="workspaces/:workspaceId/members" element={<MembersPage />} />

          {/* Gamification Routes */}
          <Route path="achievements" element={<GamificationPage />} />

          {/* Categorization (AI) Routes */}
          <Route path="categorization" element={<CategorizationPage />} />

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
