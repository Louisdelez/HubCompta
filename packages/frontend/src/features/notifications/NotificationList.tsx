// ============================================================================
// NOTIFICATION LIST COMPONENT - Finance Hub
// Display list of notifications
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
// Helpers
// ----------------------------------------------------------------------------

function getNotificationIcon(type: string) {
  switch (type) {
    case 'budget_alert':
    case 'budget_warning':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case 'price_alert':
      return <TrendingUp className="h-5 w-5 text-blue-500" />;
    case 'import_complete':
      return <FileText className="h-5 w-5 text-green-500" />;
    case 'export_ready':
      return <Download className="h-5 w-5 text-purple-500" />;
    case 'invoice_overdue':
      return <Receipt className="h-5 w-5 text-red-500" />;
    case 'invoice_paid':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'quote_accepted':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'quote_expiring':
      return <Clock className="h-5 w-5 text-amber-500" />;
    case 'bill_reminder':
      return <Clock className="h-5 w-5 text-blue-500" />;
    case 'system':
    default:
      return <Bell className="h-5 w-5 text-gray-500" />;
  }
}

function getNotificationColor(type: string): string {
  switch (type) {
    case 'budget_alert':
    case 'invoice_overdue':
      return 'border-l-red-500';
    case 'budget_warning':
    case 'quote_expiring':
      return 'border-l-amber-500';
    case 'import_complete':
    case 'invoice_paid':
    case 'quote_accepted':
      return 'border-l-green-500';
    case 'price_alert':
    case 'bill_reminder':
      return 'border-l-blue-500';
    case 'export_ready':
      return 'border-l-purple-500';
    default:
      return 'border-l-gray-300';
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
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <Bell className="h-10 w-10 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Aucune notification</p>
        <p className="text-xs text-gray-400 mt-1">
          Vous serez notifié des événements importants ici
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            'relative px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer',
            'border-l-4',
            getNotificationColor(notification.type),
            !notification.isRead && 'bg-blue-50/50'
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
                <p className={cn('text-sm', !notification.isRead && 'font-medium text-gray-900')}>
                  {notification.title}
                </p>
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(notification.id);
                  }}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notification.message}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(notification.createdAt), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </span>
                {notification.workspace && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{notification.workspace.name}</span>
                  </>
                )}
              </div>
            </div>

            {/* Unread indicator */}
            {!notification.isRead && (
              <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default NotificationList;
