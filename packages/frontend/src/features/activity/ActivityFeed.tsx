// ============================================================================
// ACTIVITY FEED COMPONENT - Finance Hub
// Main activity feed with date grouping and infinite scroll
// Uses Catppuccin colors that adapt to the current theme
// Virtualized for performance with large activity logs
// ============================================================================

import { useState, useMemo, useRef, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2, Activity as ActivityIcon, RefreshCw } from 'lucide-react';
import {
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  format,
  startOfDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';
import { ActivityItem, type Activity } from './ActivityItem';
import { ActivityFilters, type ActivityFiltersValue } from './ActivityFilters';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ActivityFeedResponse {
  data: Activity[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

interface ActivityFeedProps {
  workspaceId: string;
  showFilters?: boolean;
  pageSize?: number;
  maxHeight?: string;
}

interface GroupedActivities {
  label: string;
  date: Date;
  activities: Activity[];
}

// Flattened item for virtualization
interface FlatItem {
  type: 'header' | 'activity' | 'loadMore';
  group?: GroupedActivities;
  activity?: Activity;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const HEADER_HEIGHT = 40;
const ACTIVITY_HEIGHT = 80;
const LOAD_MORE_HEIGHT = 56;

// ----------------------------------------------------------------------------
// Helpers - Group activities by date
// ----------------------------------------------------------------------------

function groupActivitiesByDate(activities: Activity[]): GroupedActivities[] {
  const groups = new Map<string, GroupedActivities>();

  activities.forEach((activity) => {
    const activityDate = new Date(activity.createdAt);
    const dayStart = startOfDay(activityDate);
    const dayKey = dayStart.toISOString();

    let label: string;
    if (isToday(activityDate)) {
      label = "Aujourd'hui";
    } else if (isYesterday(activityDate)) {
      label = 'Hier';
    } else if (isThisWeek(activityDate, { weekStartsOn: 1 })) {
      label = format(activityDate, 'EEEE', { locale: fr });
      // Capitalize first letter
      label = label.charAt(0).toUpperCase() + label.slice(1);
    } else if (isThisMonth(activityDate)) {
      label = 'Ce mois-ci';
    } else {
      label = format(activityDate, 'MMMM yyyy', { locale: fr });
      // Capitalize first letter
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }

    if (!groups.has(dayKey)) {
      groups.set(dayKey, {
        label,
        date: dayStart,
        activities: [],
      });
    }

    groups.get(dayKey)!.activities.push(activity);
  });

  // Sort groups by date (newest first)
  return Array.from(groups.values()).sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
}

// Flatten groups into a single array for virtualization
function flattenGroups(groups: GroupedActivities[], hasNextPage: boolean): FlatItem[] {
  const items: FlatItem[] = [];

  groups.forEach((group) => {
    items.push({ type: 'header', group });
    group.activities.forEach((activity) => {
      items.push({ type: 'activity', activity });
    });
  });

  if (hasNextPage) {
    items.push({ type: 'loadMore' });
  }

  return items;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ActivityFeed({
  workspaceId,
  showFilters = true,
  pageSize = 50,
  maxHeight,
}: ActivityFeedProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<ActivityFiltersValue>({
    types: [],
    userId: null,
    dateRange: { from: null, to: null },
  });

  // Build query parameters
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (filters.types.length > 0) {
      params.types = filters.types.join(',');
    }
    if (filters.userId) {
      params.userId = filters.userId;
    }
    if (filters.dateRange.from) {
      params.from = filters.dateRange.from.toISOString();
    }
    if (filters.dateRange.to) {
      params.to = filters.dateRange.to.toISOString();
    }
    return params;
  }, [filters]);

  // Fetch activities with infinite scroll
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['activity-feed', workspaceId, queryParams],
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams({
        page: String(pageParam),
        pageSize: String(pageSize),
        ...queryParams,
      });
      const response = await api.get<ActivityFeedResponse>(
        `/workspaces/${workspaceId}/activity?${searchParams.toString()}`
      );
      return response;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.page < lastPage.meta.totalPages) {
        return lastPage.meta.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  // Flatten all pages into single array
  const allActivities = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  // Group activities by date
  const groupedActivities = useMemo(
    () => groupActivitiesByDate(allActivities),
    [allActivities]
  );

  // Flatten for virtualization
  const flattenedItems = useMemo(
    () => flattenGroups(groupedActivities, hasNextPage ?? false),
    [groupedActivities, hasNextPage]
  );

  const totalCount = data?.pages[0]?.meta.total ?? 0;

  // Estimate size for each item
  const estimateSize = useCallback((index: number): number => {
    const item = flattenedItems[index] as FlatItem;
    if (item.type === 'header') return HEADER_HEIGHT;
    if (item.type === 'loadMore') return LOAD_MORE_HEIGHT;
    return ACTIVITY_HEIGHT;
  }, [flattenedItems]);

  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5,
    getItemKey: (index: number) => {
      const item = flattenedItems[index] as FlatItem;
      if (item.type === 'header') return `header-${item.group?.date.toISOString()}`;
      if (item.type === 'loadMore') return 'load-more';
      return `activity-${item.activity?.id}`;
    },
  });

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const container = parentRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    const scrollStep = ACTIVITY_HEIGHT;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        container.scrollTop = currentScrollTop + scrollStep;
        break;
      case 'ArrowUp':
        e.preventDefault();
        container.scrollTop = currentScrollTop - scrollStep;
        break;
      case 'PageDown':
        e.preventDefault();
        container.scrollTop = currentScrollTop + clientHeight;
        break;
      case 'PageUp':
        e.preventDefault();
        container.scrollTop = currentScrollTop - clientHeight;
        break;
      case 'Home':
        e.preventDefault();
        container.scrollTop = 0;
        break;
      case 'End':
        e.preventDefault();
        container.scrollTop = container.scrollHeight;
        break;
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      {showFilters && (
        <ActivityFilters
          workspaceId={workspaceId}
          value={filters}
          onChange={setFilters}
        />
      )}

      {/* Activity List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
        </div>
      ) : allActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <ActivityIcon className="h-12 w-12 text-ctp-surface2 mb-4" />
          <p className="text-lg font-medium text-ctp-text">Aucune activite</p>
          <p className="text-sm text-ctp-subtext0 mt-1 text-center">
            Les actions effectuees dans ce workspace apparaitront ici
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          {/* Header with count and refresh */}
          <div className="flex items-center justify-between px-4 py-3 bg-ctp-mantle border-b border-ctp-surface1">
            <span className="text-sm text-ctp-subtext0">
              {totalCount} activite{totalCount > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => void refetch()}
              disabled={isRefetching}
              className="flex items-center gap-1.5 text-sm text-ctp-blue hover:text-ctp-sapphire transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`}
              />
              Actualiser
            </button>
          </div>

          {/* Virtualized Activity List */}
          <div
            ref={parentRef}
            className="overflow-auto"
            style={maxHeight ? { maxHeight } : { height: 'calc(100% - 48px)' }}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="feed"
            aria-label="Fil d'activite"
            aria-busy={isFetchingNextPage}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = flattenedItems[virtualItem.index] as FlatItem;

                if (item.type === 'header') {
                  return (
                    <div
                      key={virtualItem.key}
                      data-index={virtualItem.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <div className="sticky top-0 z-10 px-4 py-2 bg-ctp-mantle border-b border-ctp-surface1">
                        <span
                          className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wide"
                          role="heading"
                          aria-level={3}
                        >
                          {item.group?.label}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (item.type === 'loadMore') {
                  return (
                    <div
                      key={virtualItem.key}
                      data-index={virtualItem.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <div className="p-4 text-center">
                        <button
                          onClick={() => void fetchNextPage()}
                          disabled={isFetchingNextPage}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-ctp-surface1 hover:bg-ctp-surface2 text-ctp-text rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isFetchingNextPage ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Chargement...
                            </>
                          ) : (
                            'Charger plus'
                          )}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    role="article"
                    aria-labelledby={`activity-${item.activity?.id}-label`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <ActivityItem
                      activity={item.activity as Activity}
                      workspaceId={workspaceId}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityFeed;
