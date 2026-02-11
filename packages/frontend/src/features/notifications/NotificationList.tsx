// ============================================================================
// NOTIFICATION LIST COMPONENT - Finance Hub
// Display list of notifications with grouping by category
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Bell,
  AlertTriangle,
  TrendingUp,
  FileText,
  Download,
  Receipt,
  CheckCircle,
  Clock,
  X,
  Loader2,
  Wallet,
  Target,
  Calendar,
  BarChart3,
  Sparkles,
  RefreshCcw,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  workspace?: {
    id: string;
    name: string;
  };
}

interface NotificationListProps {
  onNotificationClick?: (notification: Notification) => void;
  grouped?: boolean;
}

type NotificationCategory = 'alerts' | 'savings' | 'summaries' | 'recurring' | 'other';

// ----------------------------------------------------------------------------
// Notification Configuration
// ----------------------------------------------------------------------------

interface NotificationTypeConfig {
  icon: typeof Bell;
  color: string;
  borderColor: string;
  category: NotificationCategory;
  actionUrl?: (data?: Record<string, unknown>) => string;
}

const notificationTypeConfig: Record<string, NotificationTypeConfig> = {
  // Alerts
  budget_alert: {
    icon: AlertTriangle,
    color: 'text-ctp-red',
    borderColor: 'border-l-ctp-red',
    category: 'alerts',
    actionUrl: (data) => data?.budgetId ? `/budgets/${String(data.budgetId)}` : '/budgets',
  },
  budget_warning: {
    icon: AlertTriangle,
    color: 'text-ctp-peach',
    borderColor: 'border-l-ctp-peach',
    category: 'alerts',
    actionUrl: (data) => data?.budgetId ? `/budgets/${String(data.budgetId)}` : '/budgets',
  },
  low_balance_warning: {
    icon: Wallet,
    color: 'text-ctp-maroon',
    borderColor: 'border-l-ctp-maroon',
    category: 'alerts',
    actionUrl: (data) => data?.accountId ? `/accounts/${String(data.accountId)}` : '/accounts',
  },
  unusual_spending: {
    icon: AlertTriangle,
    color: 'text-ctp-peach',
    borderColor: 'border-l-ctp-peach',
    category: 'alerts',
    actionUrl: (data) => data?.transactionId ? `/transactions/${String(data.transactionId)}` : '/transactions',
  },
  price_alert: {
    icon: TrendingUp,
    color: 'text-ctp-blue',
    borderColor: 'border-l-ctp-blue',
    category: 'alerts',
  },

  // Savings
  savings_milestone: {
    icon: Sparkles,
    color: 'text-ctp-green',
    borderColor: 'border-l-ctp-green',
    category: 'savings',
    actionUrl: (data) => data?.goalId ? `/savings/${String(data.goalId)}` : '/savings',
  },
  savings_off_track: {
    icon: Target,
    color: 'text-ctp-yellow',
    borderColor: 'border-l-ctp-yellow',
    category: 'savings',
    actionUrl: (data) => data?.goalId ? `/savings/${String(data.goalId)}` : '/savings',
  },
  goal_achieved: {
    icon: CheckCircle,
    color: 'text-ctp-green',
    borderColor: 'border-l-ctp-green',
    category: 'savings',
    actionUrl: (data) => data?.goalId ? `/savings/${String(data.goalId)}` : '/savings',
  },

  // Summaries
  weekly_summary: {
    icon: Calendar,
    color: 'text-ctp-teal',
    borderColor: 'border-l-ctp-teal',
    category: 'summaries',
    actionUrl: () => '/dashboard',
  },
  monthly_report: {
    icon: BarChart3,
    color: 'text-ctp-sapphire',
    borderColor: 'border-l-ctp-sapphire',
    category: 'summaries',
    actionUrl: () => '/reports',
  },

  // Recurring
  bill_upcoming: {
    icon: Receipt,
    color: 'text-ctp-flamingo',
    borderColor: 'border-l-ctp-flamingo',
    category: 'recurring',
    actionUrl: () => '/recurrences',
  },
  bill_reminder: {
    icon: Clock,
    color: 'text-ctp-sky',
    borderColor: 'border-l-ctp-sky',
    category: 'recurring',
  },
  recurring_processed: {
    icon: RefreshCcw,
    color: 'text-ctp-lavender',
    borderColor: 'border-l-ctp-lavender',
    category: 'recurring',
  },

  // Other
  import_complete: {
    icon: FileText,
    color: 'text-ctp-green',
    borderColor: 'border-l-ctp-green',
    category: 'other',
    actionUrl: () => '/transactions',
  },
  export_ready: {
    icon: Download,
    color: 'text-ctp-mauve',
    borderColor: 'border-l-ctp-mauve',
    category: 'other',
  },
  invoice_overdue: {
    icon: Receipt,
    color: 'text-ctp-red',
    borderColor: 'border-l-ctp-red',
    category: 'other',
    actionUrl: (data) => data?.invoiceId ? `/invoices/${String(data.invoiceId)}` : '/invoices',
  },
  invoice_paid: {
    icon: CheckCircle,
    color: 'text-ctp-green',
    borderColor: 'border-l-ctp-green',
    category: 'other',
  },
  quote_accepted: {
    icon: CheckCircle,
    color: 'text-ctp-green',
    borderColor: 'border-l-ctp-green',
    category: 'other',
  },
  quote_expiring: {
    icon: Clock,
    color: 'text-ctp-yellow',
    borderColor: 'border-l-ctp-yellow',
    category: 'other',
  },
  system: {
    icon: Bell,
    color: 'text-ctp-overlay1',
    borderColor: 'border-l-ctp-surface1',
    category: 'other',
  },
};

const categoryLabels: Record<NotificationCategory, string> = {
  alerts: 'Alertes',
  savings: 'Epargne',
  summaries: 'Resumes',
  recurring: 'Recurrences',
  other: 'Autres',
};

const categoryOrder: NotificationCategory[] = ['alerts', 'savings', 'recurring', 'summaries', 'other'];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function getNotificationConfig(type: string): NotificationTypeConfig {
  return notificationTypeConfig[type] ?? {
    icon: Bell,
    color: 'text-ctp-overlay1',
    borderColor: 'border-l-ctp-surface1',
    category: 'other',
  };
}

// ----------------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------------

interface NotificationItemProps {
  notification: Notification;
  onRead: () => void;
  onDelete: () => void;
  onClick?: () => void;
}

function NotificationItem({ notification, onRead, onDelete, onClick }: NotificationItemProps) {
  const config = getNotificationConfig(notification.type);
  const Icon = config.icon;
  const actionUrl = config.actionUrl?.(notification.data);

  const handleClick = () => {
    if (!notification.isRead) {
      onRead();
    }
    onClick?.();
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.isRead) {
      onRead();
    }
    if (actionUrl) {
      window.location.href = actionUrl;
    }
  };

  return (
    <div
      className={cn(
        'relative px-4 py-3 transition-colors cursor-pointer',
        'border-l-4',
        config.borderColor,
        notification.isRead
          ? 'bg-ctp-surface0 hover:bg-ctp-surface1'
          : 'bg-ctp-blue/10 hover:bg-ctp-blue/15'
      )}
      onClick={handleClick}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <Icon className={cn('h-5 w-5', config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-sm text-ctp-subtext1', !notification.isRead && 'font-medium text-ctp-text')}>
              {notification.title}
            </p>
            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex-shrink-0 p-1 text-ctp-overlay1 hover:text-ctp-text rounded"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-ctp-subtext0 mt-0.5 line-clamp-2">{notification.message}</p>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-ctp-overlay1">
              {formatDistanceToNow(new Date(notification.createdAt), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
            {notification.workspace && (
              <>
                <span className="text-ctp-overlay0">.</span>
                <span className="text-xs text-ctp-overlay1">{notification.workspace.name}</span>
              </>
            )}
            {actionUrl && (
              <button
                onClick={handleActionClick}
                className="ml-auto flex items-center gap-1 text-xs text-ctp-blue hover:text-ctp-sapphire transition-colors"
              >
                Voir
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Unread indicator */}
        {!notification.isRead && (
          <div className="flex-shrink-0 w-2 h-2 mt-2 bg-ctp-blue rounded-full" />
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------

export function NotificationList({ onNotificationClick, grouped = false }: NotificationListProps) {
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get<{ data: Notification[] } | Notification[]>('/notifications');
      // Handle both wrapped and unwrapped responses
      if (Array.isArray(response)) {
        return response;
      }
      return response.data ?? [];
    },
  });

  const notifications = notificationsData ?? [];

  // Group notifications by category if grouped is true
  const groupedNotifications = useMemo(() => {
    if (!grouped) return null;

    const groups: Record<NotificationCategory, Notification[]> = {
      alerts: [],
      savings: [],
      summaries: [],
      recurring: [],
      other: [],
    };

    for (const notification of notifications) {
      const config = getNotificationConfig(notification.type);
      groups[config.category].push(notification);
    }

    return groups;
  }, [notifications, grouped]);

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => {
      return api.post(`/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (notificationId: string) => {
      return api.delete(`/notifications/${notificationId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-ctp-overlay1" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <Bell className="h-10 w-10 mx-auto text-ctp-surface2 mb-3" />
        <p className="text-sm text-ctp-subtext0">Aucune notification</p>
        <p className="text-xs text-ctp-overlay0 mt-1">
          Vous serez notifie des evenements importants ici
        </p>
      </div>
    );
  }

  // Render grouped notifications
  if (grouped && groupedNotifications) {
    return (
      <div className="space-y-4">
        {categoryOrder.map((category) => {
          const categoryNotifications = groupedNotifications[category];
          if (categoryNotifications.length === 0) return null;

          return (
            <div key={category}>
              <h3 className="px-4 py-2 text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider bg-ctp-surface0">
                {categoryLabels[category]} ({categoryNotifications.length})
              </h3>
              <div className="divide-y divide-ctp-surface1">
                {categoryNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={() => markReadMutation.mutate(notification.id)}
                    onDelete={() => deleteMutation.mutate(notification.id)}
                    onClick={() => onNotificationClick?.(notification)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Render flat list
  return (
    <div className="divide-y divide-ctp-surface1">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRead={() => markReadMutation.mutate(notification.id)}
          onDelete={() => deleteMutation.mutate(notification.id)}
          onClick={() => onNotificationClick?.(notification)}
        />
      ))}
    </div>
  );
}

export default NotificationList;
