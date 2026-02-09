// ============================================================================
// USE LIST NAVIGATION HOOK - Finance Hub
// Provides j/k navigation, Enter to select, e to edit, d to delete
// ============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { useShortcut } from '@/lib/shortcuts';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface UseListNavigationOptions<T> {
  /** The list of items to navigate */
  items: T[];
  /** Whether navigation is enabled */
  enabled?: boolean;
  /** Called when Enter is pressed on selected item */
  onSelect?: (item: T, index: number) => void;
  /** Called when 'e' is pressed on selected item */
  onEdit?: (item: T, index: number) => void;
  /** Called when 'd' is pressed on selected item (should show confirmation) */
  onDelete?: (item: T, index: number) => void;
  /** Whether to wrap around at list boundaries */
  wrap?: boolean;
  /** Initial selected index */
  initialIndex?: number;
  /** Unique key extractor for items (for stable item identification) */
  getItemKey?: (item: T, index: number) => string | number;
}

export interface UseListNavigationResult<T> {
  /** Currently selected index (-1 if none) */
  selectedIndex: number;
  /** Currently selected item (null if none) */
  selectedItem: T | null;
  /** Set the selected index manually */
  setSelectedIndex: (index: number) => void;
  /** Select next item */
  selectNext: () => void;
  /** Select previous item */
  selectPrevious: () => void;
  /** Clear selection */
  clearSelection: () => void;
  /** Check if an item is selected */
  isSelected: (index: number) => boolean;
  /** Get props to spread on list items for keyboard navigation */
  getItemProps: (index: number) => ListItemProps;
  /** Ref for the list container */
  containerRef: React.RefObject<HTMLDivElement>;
}

export interface ListItemProps {
  'data-selected': boolean;
  'aria-selected': boolean;
  tabIndex: number;
  onMouseEnter: () => void;
  onClick: () => void;
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useListNavigation<T>({
  items,
  enabled = true,
  onSelect,
  onEdit,
  onDelete,
  wrap = true,
  initialIndex = -1,
  getItemKey: _getItemKey,
}: UseListNavigationOptions<T>): UseListNavigationResult<T> {
  // getItemKey is available for future use in stable item identification
  void _getItemKey;
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clamp selected index when items change
  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(items.length > 0 ? items.length - 1 : -1);
    }
  }, [items.length, selectedIndex]);

  // Select next item
  const selectNext = useCallback(() => {
    if (items.length === 0) return;

    setSelectedIndex((current) => {
      if (current === -1) return 0;
      if (current >= items.length - 1) {
        return wrap ? 0 : current;
      }
      return current + 1;
    });
  }, [items.length, wrap]);

  // Select previous item
  const selectPrevious = useCallback(() => {
    if (items.length === 0) return;

    setSelectedIndex((current) => {
      if (current === -1) return items.length - 1;
      if (current <= 0) {
        return wrap ? items.length - 1 : current;
      }
      return current - 1;
    });
  }, [items.length, wrap]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIndex(-1);
  }, []);

  // Check if an item is selected
  const isSelected = useCallback(
    (index: number) => selectedIndex === index,
    [selectedIndex]
  );

  // Get selected item
  const selectedItem = selectedIndex >= 0 && selectedIndex < items.length
    ? items[selectedIndex] ?? null
    : null;

  // Handle select
  const handleSelect = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      const item = items[selectedIndex];
      if (item && onSelect) {
        onSelect(item, selectedIndex);
      }
    }
  }, [items, selectedIndex, onSelect]);

  // Handle edit
  const handleEdit = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      const item = items[selectedIndex];
      if (item && onEdit) {
        onEdit(item, selectedIndex);
      }
    }
  }, [items, selectedIndex, onEdit]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      const item = items[selectedIndex];
      if (item && onDelete) {
        onDelete(item, selectedIndex);
      }
    }
  }, [items, selectedIndex, onDelete]);

  // Register shortcuts
  useShortcut('list-down', selectNext, { enabled });
  useShortcut('list-up', selectPrevious, { enabled });
  useShortcut('list-select', handleSelect, { enabled: enabled && !!onSelect });
  useShortcut('list-edit', handleEdit, { enabled: enabled && !!onEdit });
  useShortcut('list-delete', handleDelete, { enabled: enabled && !!onDelete });

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex < 0 || !containerRef.current) return;

    const container = containerRef.current;
    const selectedElement = container.querySelector(`[data-selected="true"]`) as HTMLElement;

    if (selectedElement) {
      selectedElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // Get props to spread on list items
  const getItemProps = useCallback(
    (index: number): ListItemProps => ({
      'data-selected': selectedIndex === index,
      'aria-selected': selectedIndex === index,
      tabIndex: selectedIndex === index ? 0 : -1,
      onMouseEnter: () => setSelectedIndex(index),
      onClick: () => {
        setSelectedIndex(index);
        const item = items[index];
        if (item && onSelect) {
          onSelect(item, index);
        }
      },
    }),
    [selectedIndex, items, onSelect]
  );

  return {
    selectedIndex,
    selectedItem,
    setSelectedIndex,
    selectNext,
    selectPrevious,
    clearSelection,
    isSelected,
    getItemProps,
    containerRef,
  };
}

export default useListNavigation;
