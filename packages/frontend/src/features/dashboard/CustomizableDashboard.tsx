// ============================================================================
// CUSTOMIZABLE DASHBOARD - Finance Hub
// Main dashboard with drag-and-drop widget system
// ============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings, RotateCcw, Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { WidgetGrid } from './WidgetGrid';
import { WidgetPicker } from './WidgetPicker';
import { clsx } from 'clsx';
import type { WidgetConfig } from './widgets';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface DashboardLayoutResponse {
  id?: string;
  widgets: WidgetConfig[];
  isDefault?: boolean;
  updatedAt?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CustomizableDashboard() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

  // Track local edits separately from server data
  const [localWidgets, setLocalWidgets] = useState<WidgetConfig[] | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  // Measure container width for grid using ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    });

    resizeObserver.observe(container);

    // Initial measurement
    if (container.offsetWidth > 0) {
      setContainerWidth(container.offsetWidth);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Fetch layout
  const { data: layoutData, isLoading } = useQuery({
    queryKey: ['dashboard-layout', workspaceId],
    queryFn: () =>
      api.get<DashboardLayoutResponse>(
        `/dashboard/layout${workspaceId ? `?workspaceId=${workspaceId}` : ''}`
      ),
    enabled: true,
  });

  // Derive widgets: use local edits if present, otherwise use server data
  const serverWidgets = layoutData?.widgets ?? [];
  const widgets = localWidgets ?? serverWidgets;
  const hasUnsavedChanges = localWidgets !== null;

  // Save layout mutation
  const saveMutation = useMutation({
    mutationFn: (newWidgets: WidgetConfig[]) =>
      api.put<DashboardLayoutResponse>(
        `/dashboard/layout${workspaceId ? `?workspaceId=${workspaceId}` : ''}`,
        { widgets: newWidgets }
      ),
    onSuccess: () => {
      setLocalWidgets(null);
      void queryClient.invalidateQueries({ queryKey: ['dashboard-layout'] });
    },
  });

  // Reset layout mutation
  const resetMutation = useMutation({
    mutationFn: () =>
      api.delete<DashboardLayoutResponse>(
        `/dashboard/layout${workspaceId ? `?workspaceId=${workspaceId}` : ''}`
      ),
    onSuccess: () => {
      setLocalWidgets(null);
      void queryClient.invalidateQueries({ queryKey: ['dashboard-layout'] });
    },
  });

  // Handle layout changes - use setLocalWidgets directly for stability
  const handleLayoutChange = useCallback((newWidgets: WidgetConfig[]) => {
    setLocalWidgets(newWidgets);
  }, []);

  // Handle adding widget
  const handleAddWidget = useCallback((widget: WidgetConfig) => {
    setLocalWidgets((prev) => [...(prev ?? serverWidgets), widget]);
    setIsPickerOpen(false);
  }, [serverWidgets]);

  // Handle removing widget
  const handleRemoveWidget = useCallback((widgetId: string) => {
    setLocalWidgets((prev) => (prev ?? serverWidgets).filter((w) => w.id !== widgetId));
  }, [serverWidgets]);

  // Handle save
  const handleSave = useCallback(() => {
    saveMutation.mutate(widgets);
  }, [saveMutation, widgets]);

  // Handle reset
  const handleReset = useCallback(() => {
    if (confirm('Reinitialiser le tableau de bord a la disposition par defaut ?')) {
      resetMutation.mutate();
    }
  }, [resetMutation]);

  // Auto-save on edit mode exit
  const handleToggleEdit = useCallback(() => {
    if (isEditing && hasUnsavedChanges) {
      handleSave();
    }
    setIsEditing((prev) => !prev);
  }, [isEditing, hasUnsavedChanges, handleSave]);

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-ctp-subtext0">Selectionnez un espace de travail</p>
        </div>
      </div>
    );
  }

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="animate-pulse">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="h-32 bg-ctp-surface0 rounded-xl" />
        <div className="h-32 bg-ctp-surface0 rounded-xl" />
        <div className="h-32 bg-ctp-surface0 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 bg-ctp-surface0 rounded-xl" />
        <div className="h-64 bg-ctp-surface0 rounded-xl" />
      </div>
    </div>
  );

  const showLoading = isLoading || containerWidth === null;

  return (
    <div className="p-6 bg-ctp-base min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ctp-text">Tableau de bord</h1>
          <p className="text-ctp-subtext1">
            {isEditing
              ? 'Mode edition - Glissez et redimensionnez les widgets'
              : 'Vue d\'ensemble de vos finances'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Unsaved Changes Indicator */}
          {hasUnsavedChanges && (
            <span className="text-sm text-ctp-yellow flex items-center gap-1">
              <span className="w-2 h-2 bg-ctp-yellow rounded-full animate-pulse" />
              Modifications non enregistrees
            </span>
          )}

          {/* Add Widget Button */}
          {isEditing && (
            <button
              onClick={() => setIsPickerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-ctp-green text-ctp-crust rounded-lg hover:bg-ctp-green/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </button>
          )}

          {/* Reset Button */}
          {isEditing && (
            <button
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-ctp-surface0 text-ctp-text rounded-lg hover:bg-ctp-surface1 transition-colors disabled:opacity-50"
            >
              {resetMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Reinitialiser
            </button>
          )}

          {/* Save Button */}
          {isEditing && hasUnsavedChanges && (
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-ctp-blue text-ctp-crust rounded-lg hover:bg-ctp-sapphire transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Enregistrer
            </button>
          )}

          {/* Edit Toggle Button */}
          <button
            onClick={handleToggleEdit}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              isEditing
                ? 'bg-ctp-blue text-ctp-crust hover:bg-ctp-sapphire'
                : 'bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface1'
            )}
          >
            <Settings className={clsx('w-4 h-4', isEditing && 'animate-spin-slow')} />
            {isEditing ? 'Terminer' : 'Personnaliser'}
          </button>
        </div>
      </div>

      {/* Widget Grid */}
      <div ref={containerRef}>
        {showLoading ? (
          <LoadingSkeleton />
        ) : widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-ctp-surface0 rounded-xl border border-ctp-surface1">
            <div className="w-16 h-16 bg-ctp-mantle rounded-full flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-ctp-overlay1" />
            </div>
            <h3 className="text-lg font-medium text-ctp-text mb-2">
              Aucun widget
            </h3>
            <p className="text-ctp-subtext0 mb-4 text-center max-w-md">
              Votre tableau de bord est vide. Ajoutez des widgets pour suivre vos finances.
            </p>
            <button
              onClick={() => {
                setIsEditing(true);
                setIsPickerOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-ctp-blue text-ctp-crust rounded-lg hover:bg-ctp-sapphire transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ajouter un widget
            </button>
          </div>
        ) : (
          <WidgetGrid
            widgets={widgets}
            workspaceId={workspaceId}
            onLayoutChange={handleLayoutChange}
            onRemoveWidget={handleRemoveWidget}
            isEditing={isEditing}
            containerWidth={containerWidth}
          />
        )}
      </div>

      {/* Widget Picker Modal */}
      <WidgetPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onAddWidget={handleAddWidget}
        existingWidgets={widgets}
      />
    </div>
  );
}

export default CustomizableDashboard;
