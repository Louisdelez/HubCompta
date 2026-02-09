// ============================================================================
// ACTIVITY ITEM COMPONENT - Finance Hub
// Individual activity item in the activity feed
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Wallet,
  FolderOpen,
  FileText,
  Upload,
  Download,
  Users,
  Settings,
  Tag,
  PieChart,
  TrendingUp,
  Receipt,
  FileCheck,
  AlertCircle,
  Clock,
  Banknote,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Activity {
  id: string;
  action: string;
  actionType: string;
  actionLabel: string;
  entityType: string | null;
  entityId: string | null;
  changes: Record<string, unknown> | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  workspace?: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  severity: string;
}

interface ActivityItemProps {
  activity: Activity;
  workspaceId?: string;
  showWorkspace?: boolean;
}

// ----------------------------------------------------------------------------
// Helpers - Get icon and color based on action type
// ----------------------------------------------------------------------------

function getActivityIcon(actionType: string, action: string) {
  const iconClass = 'h-5 w-5';

  // Transaction actions
  if (actionType === 'transaction' || actionType === 'transfer') {
    return <CreditCard className={iconClass} />;
  }

  // Account actions
  if (actionType === 'account') {
    return <Wallet className={iconClass} />;
  }

  // Category actions
  if (actionType === 'category') {
    return <FolderOpen className={iconClass} />;
  }

  // Tag actions
  if (actionType === 'tag') {
    return <Tag className={iconClass} />;
  }

  // Budget actions
  if (actionType === 'budget') {
    return <PieChart className={iconClass} />;
  }

  // Document actions
  if (actionType === 'document') {
    return <FileText className={iconClass} />;
  }

  // Import/Export actions
  if (actionType === 'import') {
    return <Upload className={iconClass} />;
  }
  if (actionType === 'export') {
    return <Download className={iconClass} />;
  }

  // Workspace/Member actions
  if (actionType === 'workspace') {
    if (action.includes('member')) {
      return <Users className={iconClass} />;
    }
    return <Settings className={iconClass} />;
  }

  // Pro Mode actions
  if (actionType === 'pro') {
    if (action.includes('invoice')) {
      return <Receipt className={iconClass} />;
    }
    if (action.includes('quote')) {
      return <FileCheck className={iconClass} />;
    }
    if (action.includes('contact')) {
      return <User className={iconClass} />;
    }
  }

  // Investment actions
  if (actionType === 'invest') {
    return <TrendingUp className={iconClass} />;
  }

  // Loan actions
  if (actionType === 'loan') {
    return <Banknote className={iconClass} />;
  }

  // Alert actions
  if (actionType === 'notification') {
    return <AlertCircle className={iconClass} />;
  }

  // Auth actions
  if (actionType === 'auth') {
    return <User className={iconClass} />;
  }

  // Default
  return <Clock className={iconClass} />;
}

function getActivityColor(actionType: string, action: string): { bg: string; text: string; border: string } {
  // Transaction actions - different colors for create/update/delete
  if (actionType === 'transaction' || actionType === 'transfer') {
    if (action.includes('created')) {
      return { bg: 'bg-ctp-green/20', text: 'text-ctp-green', border: 'border-l-ctp-green' };
    }
    if (action.includes('deleted')) {
      return { bg: 'bg-ctp-red/20', text: 'text-ctp-red', border: 'border-l-ctp-red' };
    }
    return { bg: 'bg-ctp-blue/20', text: 'text-ctp-blue', border: 'border-l-ctp-blue' };
  }

  // Account actions
  if (actionType === 'account') {
    if (action.includes('created')) {
      return { bg: 'bg-ctp-teal/20', text: 'text-ctp-teal', border: 'border-l-ctp-teal' };
    }
    if (action.includes('deleted') || action.includes('archived')) {
      return { bg: 'bg-ctp-red/20', text: 'text-ctp-red', border: 'border-l-ctp-red' };
    }
    return { bg: 'bg-ctp-teal/20', text: 'text-ctp-teal', border: 'border-l-ctp-teal' };
  }

  // Budget actions
  if (actionType === 'budget') {
    return { bg: 'bg-ctp-mauve/20', text: 'text-ctp-mauve', border: 'border-l-ctp-mauve' };
  }

  // Document actions
  if (actionType === 'document') {
    return { bg: 'bg-ctp-peach/20', text: 'text-ctp-peach', border: 'border-l-ctp-peach' };
  }

  // Category/Tag actions
  if (actionType === 'category' || actionType === 'tag') {
    return { bg: 'bg-ctp-yellow/20', text: 'text-ctp-yellow', border: 'border-l-ctp-yellow' };
  }

  // Workspace/Member actions
  if (actionType === 'workspace') {
    if (action.includes('member')) {
      return { bg: 'bg-ctp-sapphire/20', text: 'text-ctp-sapphire', border: 'border-l-ctp-sapphire' };
    }
    return { bg: 'bg-ctp-lavender/20', text: 'text-ctp-lavender', border: 'border-l-ctp-lavender' };
  }

  // Import/Export actions
  if (actionType === 'import' || actionType === 'export') {
    return { bg: 'bg-ctp-sky/20', text: 'text-ctp-sky', border: 'border-l-ctp-sky' };
  }

  // Pro Mode actions
  if (actionType === 'pro') {
    return { bg: 'bg-ctp-pink/20', text: 'text-ctp-pink', border: 'border-l-ctp-pink' };
  }

  // Investment actions
  if (actionType === 'invest') {
    return { bg: 'bg-ctp-green/20', text: 'text-ctp-green', border: 'border-l-ctp-green' };
  }

  // Loan actions
  if (actionType === 'loan') {
    return { bg: 'bg-ctp-flamingo/20', text: 'text-ctp-flamingo', border: 'border-l-ctp-flamingo' };
  }

  // Default
  return { bg: 'bg-ctp-surface1', text: 'text-ctp-overlay1', border: 'border-l-ctp-surface2' };
}

function getEntityLink(activity: Activity, workspaceId?: string): string | null {
  if (!activity.entityId || !activity.entityType) return null;

  const wsId = workspaceId ?? activity.workspace?.id;
  if (!wsId) return null;

  switch (activity.entityType) {
    case 'transaction':
      return `/workspaces/${wsId}/transactions/${activity.entityId}`;
    case 'account':
      return `/workspaces/${wsId}/accounts`;
    case 'budget':
      return `/workspaces/${wsId}/budgets`;
    case 'document':
      return `/workspaces/${wsId}/documents`;
    case 'category':
      return `/workspaces/${wsId}/categories`;
    case 'invoice':
      return `/workspaces/${wsId}/pro/invoices/${activity.entityId}`;
    case 'quote':
      return `/workspaces/${wsId}/pro/quotes/${activity.entityId}`;
    case 'position':
      return `/workspaces/${wsId}/portfolio`;
    default:
      return null;
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ActivityItem({ activity, workspaceId, showWorkspace = false }: ActivityItemProps) {
  const colors = getActivityColor(activity.actionType, activity.action);
  const icon = getActivityIcon(activity.actionType, activity.action);
  const entityLink = getEntityLink(activity, workspaceId);

  // Extract entity name from changes if available
  const entityName =
    (activity.changes?.name as string) ??
    (activity.changes?.description as string) ??
    (activity.changes?.email as string) ??
    null;

  const content = (
    <div
      className={cn(
        'relative px-4 py-3 transition-colors border-l-4',
        colors.border,
        entityLink ? 'cursor-pointer hover:bg-ctp-surface1' : '',
        'bg-ctp-surface0'
      )}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            colors.bg,
            colors.text
          )}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* User Avatar */}
            {activity.user && (
              <div className="flex-shrink-0">
                {activity.user.avatarUrl ? (
                  <img
                    src={activity.user.avatarUrl}
                    alt={activity.user.name}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-ctp-surface2 flex items-center justify-center">
                    <span className="text-xs text-ctp-subtext0 font-medium">
                      {activity.user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* User Name */}
            <span className="text-sm font-medium text-ctp-text truncate">
              {activity.user?.name ?? 'Systeme'}
            </span>
          </div>

          {/* Action Description */}
          <p className="text-sm text-ctp-subtext0 mt-0.5">
            {activity.actionLabel}
            {entityName && (
              <span className="text-ctp-text font-medium"> - {entityName}</span>
            )}
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-ctp-overlay1">
              {formatDistanceToNow(new Date(activity.createdAt), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
            {showWorkspace && activity.workspace && (
              <>
                <span className="text-ctp-overlay0">-</span>
                <span className="text-xs text-ctp-overlay1">{activity.workspace.name}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (entityLink) {
    return <Link to={entityLink}>{content}</Link>;
  }

  return content;
}

export default ActivityItem;
