// ============================================================================
// NOTIFICATION BELL COMPONENT - Finance Hub
// Bell icon with unread count badge
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { NotificationList } from './NotificationList';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const response = await api.get<{ count: number }>('/notifications/unread-count');
      return response;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const unreadCount = unreadData?.count ?? 0;

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => {
      return api.post('/notifications/read-all');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const bellLabel = unreadCount > 0
    ? `Notifications (${unreadCount} non lue${unreadCount > 1 ? 's' : ''})`
    : 'Notifications';

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          'text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-offset-2 focus-visible:ring-offset-ctp-base',
          isOpen && 'bg-ctp-surface0 text-ctp-text'
        )}
        aria-label={bellLabel}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] text-xs font-medium text-ctp-crust bg-ctp-red rounded-full px-1"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-96 bg-ctp-base border border-ctp-surface1 rounded-lg shadow-lg z-50"
          role="dialog"
          aria-label="Notifications"
          aria-modal="false"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ctp-surface1">
            <h3 className="font-medium text-ctp-text" id="notification-panel-title">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                aria-disabled={markAllReadMutation.isPending}
                aria-busy={markAllReadMutation.isPending}
                className="text-xs text-ctp-blue hover:text-ctp-sapphire flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue rounded"
              >
                {markAllReadMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-3 w-3" aria-hidden="true" />
                )}
                <span>Tout marquer comme lu</span>
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            <NotificationList onNotificationClick={() => setIsOpen(false)} />
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-ctp-surface1 bg-ctp-mantle">
            <a
              href="/settings/notifications"
              className="text-xs text-ctp-subtext0 hover:text-ctp-text"
            >
              Gérer les paramètres de notification
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
