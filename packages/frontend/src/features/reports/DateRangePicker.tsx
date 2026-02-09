// ============================================================================
// DATE RANGE PICKER COMPONENT - Finance Hub
// Select date ranges for reports
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

type PresetKey = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'last_year' | 'custom';

interface Preset {
  key: PresetKey;
  label: string;
  getRange: () => DateRange;
}

// ----------------------------------------------------------------------------
// Presets
// ----------------------------------------------------------------------------

const presets: Preset[] = [
  {
    key: 'this_month',
    label: 'Ce mois',
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    key: 'last_month',
    label: 'Mois dernier',
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    },
  },
  {
    key: 'last_3_months',
    label: '3 derniers mois',
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 2)),
      to: endOfMonth(new Date()),
    }),
  },
  {
    key: 'last_6_months',
    label: '6 derniers mois',
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 5)),
      to: endOfMonth(new Date()),
    }),
  },
  {
    key: 'this_year',
    label: 'Cette année',
    getRange: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    }),
  },
  {
    key: 'last_year',
    label: 'Année dernière',
    getRange: () => {
      const lastYear = subYears(new Date(), 1);
      return {
        from: startOfYear(lastYear),
        to: endOfYear(lastYear),
      };
    },
  },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(format(value.from, 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(value.to, 'yyyy-MM-dd'));

  // Detect current preset
  const currentPreset = useMemo(() => {
    for (const preset of presets) {
      const range = preset.getRange();
      if (
        format(range.from, 'yyyy-MM-dd') === format(value.from, 'yyyy-MM-dd') &&
        format(range.to, 'yyyy-MM-dd') === format(value.to, 'yyyy-MM-dd')
      ) {
        return preset.key;
      }
    }
    return 'custom';
  }, [value]);

  const handlePresetClick = (preset: Preset) => {
    const range = preset.getRange();
    onChange(range);
    setIsCustom(false);
    setIsOpen(false);
  };

  const handleCustomApply = () => {
    onChange({
      from: new Date(customFrom),
      to: new Date(customTo),
    });
    setIsOpen(false);
  };

  const displayLabel = useMemo(() => {
    const preset = presets.find((p) => p.key === currentPreset);
    if (preset) {
      return preset.label;
    }
    return `${format(value.from, 'dd MMM yyyy', { locale: fr })} - ${format(value.to, 'dd MMM yyyy', { locale: fr })}`;
  }, [currentPreset, value]);

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-lg hover:bg-ctp-surface1 text-sm"
      >
        <Calendar className="h-4 w-4 text-ctp-subtext0" />
        <span className="text-ctp-subtext1">{displayLabel}</span>
        <ChevronDown className="h-4 w-4 text-ctp-overlay1" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-lg z-20 p-4">
            {/* Presets */}
            <div className="space-y-1 mb-4">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm rounded-lg',
                    currentPreset === preset.key
                      ? 'bg-ctp-blue/20 text-ctp-blue'
                      : 'hover:bg-ctp-surface1 text-ctp-subtext1'
                  )}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => setIsCustom(!isCustom)}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm rounded-lg',
                  isCustom || currentPreset === 'custom'
                    ? 'bg-ctp-blue/20 text-ctp-blue'
                    : 'hover:bg-ctp-surface1 text-ctp-subtext1'
                )}
              >
                Personnalisé
              </button>
            </div>

            {/* Custom date inputs */}
            {(isCustom || currentPreset === 'custom') && (
              <div className="border-t border-ctp-surface1 pt-4 space-y-3">
                <div>
                  <label className="block text-xs text-ctp-subtext0 mb-1">Du</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ctp-blue bg-ctp-base"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ctp-subtext0 mb-1">Au</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ctp-blue bg-ctp-base"
                  />
                </div>
                <button
                  onClick={handleCustomApply}
                  className="w-full px-4 py-2 bg-ctp-blue text-ctp-base rounded-lg text-sm hover:bg-ctp-blue/90"
                >
                  Appliquer
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DateRangePicker;
