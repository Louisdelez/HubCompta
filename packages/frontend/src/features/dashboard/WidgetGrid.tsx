// ============================================================================
// WIDGET GRID - Finance Hub Dashboard
// react-grid-layout wrapper for drag-and-drop widget management
// ============================================================================

import { useState, useCallback, useMemo } from 'react';
import GridLayout, { type Layout, type LayoutItem, verticalCompactor } from 'react-grid-layout';
import { WidgetWrapper } from './WidgetWrapper';
import { WIDGET_REGISTRY, type WidgetConfig } from './widgets';
import 'react-grid-layout/css/styles.css';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WidgetGridProps {
  widgets: WidgetConfig[];
  workspaceId: string;
  onLayoutChange: (widgets: WidgetConfig[]) => void;
  onRemoveWidget: (widgetId: string) => void;
  isEditing?: boolean;
  containerWidth?: number;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const GRID_COLS = 6;
const ROW_HEIGHT = 100;
const MARGIN: [number, number] = [16, 16];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function WidgetGrid({
  widgets,
  workspaceId,
  onLayoutChange,
  onRemoveWidget,
  isEditing = true,
  containerWidth = 1200,
}: WidgetGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);

  // Convert widgets to react-grid-layout format
  const layout: Layout = useMemo(() => {
    return widgets.map((widget) => {
      const widgetDef = WIDGET_REGISTRY[widget.type];
      const defaultSize = widgetDef?.defaultSize ?? { w: 2, h: 2, minW: 1, minH: 1, maxW: 6, maxH: 6 };

      return {
        i: widget.id,
        x: widget.position.x,
        y: widget.position.y,
        w: widget.position.w,
        h: widget.position.h,
        minW: defaultSize.minW ?? 1,
        minH: defaultSize.minH ?? 1,
        maxW: defaultSize.maxW ?? 6,
        maxH: defaultSize.maxH ?? 6,
      };
    });
  }, [widgets]);

  // Handle layout changes from react-grid-layout
  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      const updatedWidgets = widgets.map((widget) => {
        const layoutItem = newLayout.find((item: LayoutItem) => item.i === widget.id);
        if (!layoutItem) return widget;

        return {
          ...widget,
          position: {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          },
        };
      });

      onLayoutChange(updatedWidgets);
    },
    [widgets, onLayoutChange]
  );

  const handleDragStart = useCallback(
    (_layout: Layout, oldItem: LayoutItem | null) => {
      if (oldItem) setDraggingId(oldItem.i);
    },
    []
  );

  const handleDragStop = useCallback(() => {
    setDraggingId(null);
  }, []);

  const handleResizeStart = useCallback(
    (_layout: Layout, oldItem: LayoutItem | null) => {
      if (oldItem) setResizingId(oldItem.i);
    },
    []
  );

  const handleResizeStop = useCallback(() => {
    setResizingId(null);
  }, []);

  // Grid configuration
  const gridConfig = useMemo(() => ({
    cols: GRID_COLS,
    rowHeight: ROW_HEIGHT,
    margin: MARGIN,
    containerPadding: [0, 0] as [number, number],
  }), []);

  // Drag configuration
  const dragConfig = useMemo(() => ({
    enabled: isEditing,
    handle: '.widget-drag-handle',
  }), [isEditing]);

  // Resize configuration
  const resizeConfig = useMemo(() => ({
    enabled: isEditing,
  }), [isEditing]);

  return (
    <GridLayout
      className="widget-grid"
      layout={layout}
      width={containerWidth}
      gridConfig={gridConfig}
      dragConfig={dragConfig}
      resizeConfig={resizeConfig}
      compactor={verticalCompactor}
      onLayoutChange={handleLayoutChange}
      onDragStart={handleDragStart}
      onDragStop={handleDragStop}
      onResizeStart={handleResizeStart}
      onResizeStop={handleResizeStop}
    >
      {widgets.map((widget) => (
        <div key={widget.id}>
          <WidgetWrapper
            widget={widget}
            workspaceId={workspaceId}
            onRemove={onRemoveWidget}
            isDragging={draggingId === widget.id}
            isResizing={resizingId === widget.id}
          />
        </div>
      ))}
    </GridLayout>
  );
}

export default WidgetGrid;
