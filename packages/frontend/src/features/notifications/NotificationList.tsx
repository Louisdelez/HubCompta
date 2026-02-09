// ============================================================================
// NOTIFICATION LIST COMPONENT - Finance Hub
// Display list of notifications
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

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
}

// ----------------------------------------------------------------------------
// Helpers - Catppuccin Colors
// ----------------------------------------------------------------------------

function getNotificationIcon(type: string) {
  switch (type) {
    case 'budget_alert':
    case 'budget_warning':
      return <AlertTriangle className="h-5 w-5 text-ctp-peach" />;
    case 'price_alert':
      return <TrendingUp className="h-5 w-5 text-ctp-blue" />;
    case 'import_complete':
      return <FileText className="h-5 w-5 text-ctp-green" />;
    case 'export_ready':
      return <Download className="h-5 w-5 text-ctp-mauve" />;
    case 'invoice_overdue':
      return <Receipt className="h-5 w-5 text-ctp-red" />;
    case 'invoice_paid':
      return <CheckCircle className="h-5 w-5 text-ctp-green" />;
    case 'quote_accepted':
      return <CheckCircle className="h-5 w-5 text-ctp-green" />;
    case 'quote_expiring':
      return <Clock className="h-5 w-5 text-ctp-yellow" />;
    case 'bill_reminder':
      return <Clock className="h-5 w-5 text-ctp-sky" />;
    case 'system':
    default:
      return <Bell className="h-5 w-5 text-ctp-overlay1" />;
  }
}

function getNotificationColor(type: string): string {
  switch (type) {
    case 'budget_alert':
    case 'invoice_overdue':
      return 'border-l-ctp-red';
    case 'budget_warning':
    case 'quote_expiring':
      return 'border-l-ctp-peach';
    case 'import_complete':
    case 'invoice_paid':
    case 'quote_accepted':
      return 'border-l-ctp-green';
    case 'price_alert':
    case 'bill_reminder':
      return 'border-l-ctp-blue';
    case 'export_ready':
      return 'border-l-ctp-mauve';
    default:
      return 'border-l-ctp-surface1';
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function NotificationList({ onNotificationClick }: NotificationListProps) {
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get<Notification[]>('/notifications');
      return response;
    },
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return api.post(`/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return api.delete(`/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    onNotificationClick?.(notification);
  };

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
          Vous serez notifié des événements importants ici
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-ctp-surface1">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            'relative px-4 py-3 transition-colors cursor-pointer',
            'border-l-4',
            getNotificationColor(notification.type),
            notification.isRead
              ? 'bg-ctp-surface0 hover:bg-ctp-surface1'
              : 'bg-ctp-blue/10 hover:bg-ctp-blue/15'
          )}
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="flex gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {getNotificationIcon(notification.type)}
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
                    deleteMutation.mutate(notification.id);
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
                    <span className="text-ctp-overlay0">·</span>
                    <span className="text-xs text-ctp-overlay1">{notification.workspace.name}</span>
                  </>
                )}
              </div>
            </div>

            {/* Unread indicator */}
            {!notification.isRead && (
              <div className="flex-shrink-0 w-2 h-2 mt-2 bg-ctp-blue rounded-full" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default NotificationList;
