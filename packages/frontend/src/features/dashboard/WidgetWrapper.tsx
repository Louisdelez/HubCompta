// ============================================================================
// WIDGET WRAPPER - Finance Hub Dashboard
// Common container for all dashboard widgets with controls
// ============================================================================

import { Suspense, useState, useCallback } from 'react';
import { X, RefreshCw, GripVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { WIDGET_REGISTRY, type WidgetConfig, type WidgetProps } from './widgets';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WidgetWrapperProps {
  widget: WidgetConfig;
  workspaceId: string;
  onRemove: (id: string) => void;
  isDragging?: boolean;
  isResizing?: boolean;
}

// ----------------------------------------------------------------------------
// Loading Fallback
// ----------------------------------------------------------------------------

function WidgetLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-ctp-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Error Fallback
// ----------------------------------------------------------------------------

function WidgetError({ message }: { message: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
      <div className="w-10 h-10 bg-ctp-red/20 rounded-full flex items-center justify-center mb-2">
        <X className="w-5 h-5 text-ctp-red" />
      </div>
      <p className="text-sm text-ctp-red font-medium">Erreur</p>
      <p className="text-xs text-ctp-subtext0 mt-1">{message}</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function WidgetWrapper({
  widget,
  workspaceId,
  onRemove,
  isDragging = false,
  isResizing = false,
}: WidgetWrapperProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const widgetDef = WIDGET_REGISTRY[widget.type];

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    // Simulate minimum refresh time for visual feedback
    setTimeout(() => setIsRefreshing(false), 500);
  }, []);

  const handleRemove = useCallback(() => {
    onRemove(widget.id);
  }, [onRemove, widget.id]);

  if (!widgetDef) {
    return (
      <div className="h-full bg-ctp-surface0 rounded-xl border border-ctp-surface1 p-4">
        <WidgetError message={`Widget type "${widget.type}" not found`} />
      </div>
    );
  }

  const WidgetComponent = widgetDef.Component;
  const widgetProps: WidgetProps = {
    workspaceId,
    config: widget.config,
    onRefresh: handleRefresh,
  };

  return (
    <div
      className={clsx(
        'h-full bg-ctp-surface0 rounded-xl border border-ctp-surface1 flex flex-col overflow-hidden transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-ctp-blue/50',
        isResizing && 'ring-2 ring-ctp-blue/30',
        isHovered && !isDragging && 'shadow-md'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-ctp-surface1 flex-shrink-0">
        {/* Drag Handle & Title */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="widget-drag-handle cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-ctp-mantle transition-colors"
            title="Deplacer"
          >
            <GripVertical className="w-4 h-4 text-ctp-overlay1" />
          </div>
          <h3 className="text-sm font-medium text-ctp-text truncate">
            {widgetDef.name}
          </h3>
        </div>

        {/* Controls */}
        <div className={clsx(
          'flex items-center gap-1 transition-opacity',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}>
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 rounded hover:bg-ctp-mantle transition-colors disabled:opacity-50"
            title="Actualiser"
            aria-label="Actualiser le widget"
          >
            <RefreshCw
              className={clsx(
                'w-3.5 h-3.5 text-ctp-overlay1',
                isRefreshing && 'animate-spin'
              )}
            />
          </button>

          {/* Remove Button */}
          <button
            onClick={handleRemove}
            className="p-1 rounded hover:bg-ctp-red/20 hover:text-ctp-red transition-colors"
            title="Supprimer"
            aria-label="Supprimer le widget"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 overflow-hidden">
        <Suspense fallback={<WidgetLoading />}>
          <WidgetComponent key={refreshKey} {...widgetProps} />
        </Suspense>
      </div>
    </div>
  );
}

export default WidgetWrapper;
