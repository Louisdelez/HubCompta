// ============================================================================
// VIRTUAL LIST - Finance Hub
// Efficiently render large lists with virtualization using @tanstack/react-virtual
// ============================================================================

import { useRef, useCallback, useEffect } from 'react';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Fixed height for each item (use estimateSize for variable heights) */
  itemHeight?: number;
  /** Estimate size function for variable row heights */
  estimateSize?: (index: number) => number;
  /** Number of items to render outside visible area */
  overscan?: number;
  /** Render function for each item */
  renderItem: (item: T, index: number, virtualItem: VirtualItem) => React.ReactNode;
  /** Class name for the item wrapper */
  className?: string;
  /** Class name for the outer scrollable container */
  containerClassName?: string;
  /** Key extractor function */
  getItemKey?: (item: T, index: number) => string | number;
  /** Called when user scrolls near the end (for infinite loading) */
  onLoadMore?: () => void;
  /** Threshold in pixels from bottom to trigger onLoadMore */
  loadMoreThreshold?: number;
  /** Whether more items are currently loading */
  isLoadingMore?: boolean;
  /** Whether there are more items to load */
  hasMore?: boolean;
  /** Optional max height for the container */
  maxHeight?: string | number;
  /** Optional height for the container */
  height?: string | number;
  /** Render loading indicator */
  renderLoadingMore?: () => React.ReactNode;
  /** ARIA label for the list */
  ariaLabel?: string;
  /** ID prefix for items (for ARIA) */
  itemIdPrefix?: string;
  /** Role for the list */
  role?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function VirtualList<T>({
  items,
  itemHeight,
  estimateSize,
  overscan = 5,
  renderItem,
  className,
  containerClassName,
  getItemKey,
  onLoadMore,
  loadMoreThreshold = 200,
  isLoadingMore = false,
  hasMore = false,
  maxHeight,
  height,
  renderLoadingMore,
  ariaLabel,
  itemIdPrefix = 'virtual-item',
  role = 'list',
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggeredRef = useRef(false);

  // Use provided estimateSize or fall back to itemHeight
  const getEstimateSize = useCallback(
    (index: number) => {
      if (estimateSize) return estimateSize(index);
      return itemHeight ?? 60;
    },
    [estimateSize, itemHeight]
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getEstimateSize,
    overscan,
    ...(getItemKey && {
      getItemKey: (index: number) => getItemKey(items[index] as T, index),
    }),
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Handle infinite scroll
  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;

    const container = parentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < loadMoreThreshold && !loadMoreTriggeredRef.current) {
        loadMoreTriggeredRef.current = true;
        onLoadMore();
      } else if (distanceFromBottom >= loadMoreThreshold) {
        loadMoreTriggeredRef.current = false;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onLoadMore, hasMore, isLoadingMore, loadMoreThreshold]);

  // Reset load more trigger when loading state changes
  useEffect(() => {
    if (!isLoadingMore) {
      loadMoreTriggeredRef.current = false;
    }
  }, [isLoadingMore]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const container = parentRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    const scrollStep = 40; // Pixels to scroll per arrow key press

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

  const containerStyle: React.CSSProperties = {};
  if (maxHeight) containerStyle.maxHeight = maxHeight;
  if (height) containerStyle.height = height;

  return (
    <div
      ref={parentRef}
      className={clsx('overflow-auto', containerClassName)}
      style={containerStyle}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role={role}
      aria-label={ariaLabel}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index] as T;
          return (
            <div
              key={virtualItem.key}
              id={`${itemIdPrefix}-${virtualItem.index}`}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              role="listitem"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className={className}
            >
              {renderItem(item, virtualItem.index, virtualItem)}
            </div>
          );
        })}
      </div>

      {/* Loading more indicator */}
      {isLoadingMore && renderLoadingMore && (
        <div className="py-4 text-center">
          {renderLoadingMore()}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Variable Height Virtual List - for lists with dynamic item heights
// ----------------------------------------------------------------------------

interface VirtualGroupedListProps<T, G> {
  /** Grouped items */
  groups: G[];
  /** Get items from a group */
  getGroupItems: (group: G) => T[];
  /** Get group key */
  getGroupKey: (group: G) => string;
  /** Render group header */
  renderGroupHeader: (group: G) => React.ReactNode;
  /** Height of group header */
  groupHeaderHeight: number;
  /** Render item */
  renderItem: (item: T, group: G, indexInGroup: number) => React.ReactNode;
  /** Height of each item */
  itemHeight: number;
  /** Get item key */
  getItemKey: (item: T, indexInGroup: number) => string | number;
  /** Container class */
  containerClassName?: string;
  /** Overscan count */
  overscan?: number;
  /** Max height */
  maxHeight?: string | number;
  /** Height */
  height?: string | number;
  /** ARIA label */
  ariaLabel?: string;
}

interface FlattenedItem<T, G> {
  type: 'header' | 'item';
  group: G;
  item?: T;
  indexInGroup?: number;
}

export function VirtualGroupedList<T, G>({
  groups,
  getGroupItems,
  getGroupKey,
  renderGroupHeader,
  groupHeaderHeight,
  renderItem,
  itemHeight,
  getItemKey,
  containerClassName,
  overscan = 5,
  maxHeight,
  height,
  ariaLabel,
}: VirtualGroupedListProps<T, G>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Flatten groups and items into a single array for virtualization
  const flattenedItems: FlattenedItem<T, G>[] = [];
  groups.forEach((group) => {
    flattenedItems.push({ type: 'header', group });
    const items = getGroupItems(group);
    items.forEach((item, indexInGroup) => {
      flattenedItems.push({ type: 'item', group, item, indexInGroup });
    });
  });

  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index: number) => {
      const flatItem = flattenedItems[index] as FlattenedItem<T, G>;
      return flatItem.type === 'header' ? groupHeaderHeight : itemHeight;
    },
    overscan,
    getItemKey: (index: number) => {
      const flatItem = flattenedItems[index] as FlattenedItem<T, G>;
      if (flatItem.type === 'header') {
        return `header-${getGroupKey(flatItem.group)}`;
      }
      return `item-${getGroupKey(flatItem.group)}-${getItemKey(flatItem.item as T, flatItem.indexInGroup as number)}`;
    },
  });

  const virtualItems = virtualizer.getVirtualItems();

  const containerStyle: React.CSSProperties = {};
  if (maxHeight) containerStyle.maxHeight = maxHeight;
  if (height) containerStyle.height = height;

  return (
    <div
      ref={parentRef}
      className={clsx('overflow-auto', containerClassName)}
      style={containerStyle}
      tabIndex={0}
      role="list"
      aria-label={ariaLabel}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const flatItem = flattenedItems[virtualItem.index] as FlattenedItem<T, G>;
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
              {flatItem.type === 'header' ? (
                <div role="heading" aria-level={3}>
                  {renderGroupHeader(flatItem.group)}
                </div>
              ) : (
                <div role="listitem">
                  {renderItem(flatItem.item as T, flatItem.group, flatItem.indexInGroup as number)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualList;
