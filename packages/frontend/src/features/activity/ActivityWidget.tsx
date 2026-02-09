// ============================================================================
// ACTIVITY WIDGET COMPONENT - Finance Hub
// Compact activity feed widget for dashboard
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity as ActivityIcon, ArrowRight, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';
import { type Activity } from './ActivityItem';
import {
  CreditCard,
  Wallet,
  FolderOpen,
  FileText,
  Upload,
  PieChart,
  TrendingUp,
  Users,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ActivityWidgetProps {
  workspaceId: string;
  limit?: number;
}

interface ActivityFeedResponse {
  data: Activity[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function getCompactIcon(actionType: string) {
  const iconClass = 'h-4 w-4';
  switch (actionType) {
    case 'transaction':
    case 'transfer':
      return <CreditCard className={iconClass} />;
    case 'account':
      return <Wallet className={iconClass} />;
    case 'category':
      return <FolderOpen className={iconClass} />;
    case 'budget':
      return <PieChart className={iconClass} />;
    case 'document':
      return <FileText className={iconClass} />;
    case 'import':
      return <Upload className={iconClass} />;
    case 'invest':
      return <TrendingUp className={iconClass} />;
    case 'workspace':
      return actionType.includes('member') ? <Users className={iconClass} /> : <Settings className={iconClass} />;
    default:
      return <ActivityIcon className={iconClass} />;
  }
}

function getCompactColor(actionType: string): string {
  switch (actionType) {
    case 'transaction':
    case 'transfer':
      return 'text-ctp-blue';
    case 'account':
      return 'text-ctp-teal';
    case 'budget':
      return 'text-ctp-mauve';
    case 'document':
      return 'text-ctp-peach';
    case 'category':
      return 'text-ctp-yellow';
    case 'invest':
      return 'text-ctp-green';
    case 'workspace':
      return 'text-ctp-sapphire';
    default:
      return 'text-ctp-overlay1';
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ActivityWidget({ workspaceId, limit = 5 }: ActivityWidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['activity-widget', workspaceId, limit],
    queryFn: async () => {
      const response = await api.get<ActivityFeedResponse>(
        `/workspaces/${workspaceId}/activity?pageSize=${limit}`
      );
      return response;
    },
  });

  const activities = data?.data ?? [];

  return (
    <div className="bg-ctp-surface0 rounded-xl border border-ctp-surface1">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-ctp-surface1">
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-5 w-5 text-ctp-blue" />
          <h3 className="font-semibold text-ctp-text">Activite recente</h3>
        </div>
        <Link
          to={`/workspaces/${workspaceId}/activity`}
          className="flex items-center gap-1 text-sm text-ctp-blue hover:text-ctp-sapphire transition-colors"
        >
          Voir tout
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Content */}
      <div className="p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-ctp-overlay1" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 px-4">
            <ActivityIcon className="h-10 w-10 mx-auto text-ctp-surface2 mb-2" />
            <p className="text-sm text-ctp-subtext0">Aucune activite recente</p>
          </div>
        ) : (
          <div className="space-y-1">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-ctp-mantle transition-colors"
              >
                {/* Icon */}
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full bg-ctp-surface1 flex items-center justify-center',
                    getCompactColor(activity.actionType)
                  )}
                >
                  {getCompactIcon(activity.actionType)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ctp-text truncate">
                    <span className="font-medium">{activity.user?.name ?? 'Systeme'}</span>
                    <span className="text-ctp-subtext0"> {activity.actionLabel.toLowerCase()}</span>
                  </p>
                  <p className="text-xs text-ctp-overlay1">
                    {formatDistanceToNow(new Date(activity.createdAt), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityWidget;
