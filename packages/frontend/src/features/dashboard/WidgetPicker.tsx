// ============================================================================
// WIDGET PICKER - Finance Hub Dashboard
// Modal to add widgets to the dashboard
// ============================================================================

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Plus,
  Wallet,
  CreditCard,
  PieChart,
  TrendingUp,
  Target,
  Calendar,
  BarChart3,
  Zap,
  BarChart,
  Briefcase,
  Search,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  WIDGET_REGISTRY,
  type WidgetDefinition,
  type WidgetType,
  type WidgetConfig,
  generateWidgetId,
} from './widgets';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WidgetPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (widget: WidgetConfig) => void;
  existingWidgets: WidgetConfig[];
}

type WidgetCategory = 'all' | WidgetDefinition['category'];

// ----------------------------------------------------------------------------
// Icon Mapping
// ----------------------------------------------------------------------------

const ICON_MAP: Record<string, typeof Wallet> = {
  wallet: Wallet,
  'credit-card': CreditCard,
  'pie-chart': PieChart,
  'trending-up': TrendingUp,
  target: Target,
  calendar: Calendar,
  'bar-chart-3': BarChart3,
  zap: Zap,
  'bar-chart': BarChart,
  briefcase: Briefcase,
};

// Category label keys for i18n
const CATEGORY_LABEL_KEYS: Record<WidgetCategory, string> = {
  all: 'widgets.categories.all',
  finance: 'widgets.categories.finance',
  planning: 'widgets.categories.planning',
  analytics: 'widgets.categories.analytics',
  utilities: 'widgets.categories.utilities',
  invest: 'widgets.categories.invest',
};

const CATEGORY_COLORS: Record<WidgetCategory, string> = {
  all: 'bg-ctp-overlay1',
  finance: 'bg-ctp-green',
  planning: 'bg-ctp-peach',
  analytics: 'bg-ctp-blue',
  utilities: 'bg-ctp-mauve',
  invest: 'bg-ctp-teal',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function WidgetPicker({
  isOpen,
  onClose,
  onAddWidget,
  existingWidgets,
}: WidgetPickerProps) {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<WidgetCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get all widget definitions
  const allWidgets = useMemo(() => Object.values(WIDGET_REGISTRY), []);

  // Filter widgets by category and search
  const filteredWidgets = useMemo(() => {
    return allWidgets.filter((widget) => {
      // Filter by category
      if (selectedCategory !== 'all' && widget.category !== selectedCategory) {
        return false;
      }

      // Filter by search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          widget.name.toLowerCase().includes(query) ||
          widget.description.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [allWidgets, selectedCategory, searchQuery]);

  // Check if widget is already added
  const isWidgetAdded = (type: WidgetType) => {
    return existingWidgets.some((w) => w.type === type);
  };

  // Calculate next available position
  const getNextPosition = () => {
    if (existingWidgets.length === 0) {
      return { x: 0, y: 0 };
    }

    // Find the lowest available y position
    const maxY = Math.max(...existingWidgets.map((w) => w.position.y + w.position.h));
    return { x: 0, y: maxY };
  };

  // Handle adding a widget
  const handleAddWidget = (widgetDef: WidgetDefinition) => {
    const nextPos = getNextPosition();
    const newWidget: WidgetConfig = {
      id: generateWidgetId(widgetDef.type),
      type: widgetDef.type,
      position: {
        x: nextPos.x,
        y: nextPos.y,
        w: widgetDef.defaultSize.w,
        h: widgetDef.defaultSize.h,
      },
      config: {},
    };

    onAddWidget(newWidget);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ctp-crust/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl border border-ctp-surface1 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface1">
          <div>
            <h2 className="text-lg font-semibold text-ctp-text">{t('widgets.addWidget')}</h2>
            <p className="text-sm text-ctp-subtext0">
              {t('widgets.chooseWidget')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ctp-surface0 transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5 text-ctp-text" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-ctp-surface1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ctp-overlay1" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('widgets.searchWidget')}
              className="w-full pl-10 pr-4 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-lg text-sm text-ctp-text placeholder:text-ctp-overlay1 focus:outline-none focus:ring-2 focus:ring-ctp-blue/50"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="px-6 py-3 border-b border-ctp-surface1 flex gap-2 flex-wrap">
          {(Object.keys(CATEGORY_LABEL_KEYS) as WidgetCategory[]).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                selectedCategory === category
                  ? 'bg-ctp-blue text-ctp-crust'
                  : 'bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface1'
              )}
            >
              {t(CATEGORY_LABEL_KEYS[category])}
            </button>
          ))}
        </div>

        {/* Widget List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {filteredWidgets.map((widget) => {
              const Icon = ICON_MAP[widget.icon] || Wallet;
              const isAdded = isWidgetAdded(widget.type);

              return (
                <div
                  key={widget.type}
                  className={clsx(
                    'relative p-4 rounded-xl border transition-all',
                    isAdded
                      ? 'bg-ctp-surface0/50 border-ctp-surface1 opacity-60'
                      : 'bg-ctp-surface0 border-ctp-surface1 hover:border-ctp-blue/50 hover:shadow-md cursor-pointer'
                  )}
                  onClick={() => !isAdded && handleAddWidget(widget)}
                >
                  {/* Category Badge */}
                  <div
                    className={clsx(
                      'absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium text-ctp-crust',
                      CATEGORY_COLORS[widget.category]
                    )}
                  >
                    {t(CATEGORY_LABEL_KEYS[widget.category])}
                  </div>

                  {/* Icon */}
                  <div className="w-10 h-10 bg-ctp-mantle rounded-lg flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-ctp-blue" />
                  </div>

                  {/* Info */}
                  <h3 className="font-medium text-ctp-text mb-1">{widget.name}</h3>
                  <p className="text-sm text-ctp-subtext0 line-clamp-2">
                    {widget.description}
                  </p>

                  {/* Size Info */}
                  <p className="text-xs text-ctp-overlay1 mt-2">
                    {t('widgets.size')}: {widget.defaultSize.w}x{widget.defaultSize.h}
                  </p>

                  {/* Add/Added Indicator */}
                  {isAdded ? (
                    <div className="absolute bottom-3 right-3 text-xs text-ctp-overlay1">
                      {t('widgets.alreadyAdded')}
                    </div>
                  ) : (
                    <div className="absolute bottom-3 right-3 p-1 rounded-full bg-ctp-blue/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-4 h-4 text-ctp-blue" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredWidgets.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-10 h-10 mx-auto text-ctp-overlay1 mb-3" />
              <p className="text-ctp-subtext0">{t('widgets.noWidgetFound')}</p>
              <p className="text-sm text-ctp-overlay1 mt-1">
                {t('widgets.tryAnotherSearch')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ctp-surface1 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-ctp-surface0 text-ctp-text rounded-lg hover:bg-ctp-surface1 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WidgetPicker;
