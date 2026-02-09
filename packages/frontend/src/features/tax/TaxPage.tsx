// ============================================================================
// TAX PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, ChevronLeft, ChevronRight, FileCheck2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { TaxSummary } from './TaxSummary';
import { TaxDeductions } from './TaxDeductions';
import { TaxBrackets } from './TaxBrackets';
import { TaxExport } from './TaxExport';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface TaxSummaryData {
  year: number;
  status: string;
  totalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  estimatedTax: number;
  actualTax: number | null;
  effectiveRate: number;
  marginalRate: number;
  deductionsByCategory: Record<string, number>;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TaxPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState<'summary' | 'deductions' | 'brackets'>('summary');

  // Fetch tax summary
  const { data: summary, isLoading } = useQuery({
    queryKey: ['tax', workspaceId, selectedYear],
    queryFn: () => api.get<TaxSummaryData>(`/workspaces/${workspaceId}/tax/${selectedYear}`),
    enabled: !!workspaceId,
  });

  const handleYearChange = (delta: number) => {
    setSelectedYear((prev) => prev + delta);
  };

  const handleRecalculate = async () => {
    await api.post(`/workspaces/${workspaceId}/tax/${selectedYear}/calculate`);
    void queryClient.invalidateQueries({ queryKey: ['tax', workspaceId, selectedYear] });
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Selectionnez un espace de travail
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-ctp-surface1 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-ctp-surface1 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-ctp-surface1 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="w-7 h-7 text-ctp-mauve" />
            Planification Fiscale
          </h1>
          <p className="text-ctp-subtext0">
            Estimez vos impots et gerez vos deductions
          </p>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleYearChange(-1)}
            className="btn-ghost p-2"
            title="Annee precedente"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 py-2 bg-ctp-surface0 rounded-lg font-bold text-lg min-w-[100px] text-center">
            {selectedYear}
          </div>
          <button
            onClick={() => handleYearChange(1)}
            className="btn-ghost p-2"
            disabled={selectedYear >= currentYear}
            title="Annee suivante"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Status Badge */}
      {summary && (
        <div className="mb-4 flex items-center gap-3">
          <StatusBadge status={summary.status} />
          {summary.status === 'open' && (
            <button
              onClick={handleRecalculate}
              className="btn-ghost text-sm flex items-center gap-1"
            >
              <Calculator className="w-4 h-4" />
              Recalculer
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-ctp-surface1">
        <TabButton
          active={activeTab === 'summary'}
          onClick={() => setActiveTab('summary')}
        >
          Resume
        </TabButton>
        <TabButton
          active={activeTab === 'deductions'}
          onClick={() => setActiveTab('deductions')}
        >
          Deductions
        </TabButton>
        <TabButton
          active={activeTab === 'brackets'}
          onClick={() => setActiveTab('brackets')}
        >
          Baremes
        </TabButton>
      </div>

      {/* Content */}
      {activeTab === 'summary' && summary && (
        <div className="space-y-6">
          <TaxSummary summary={summary} />
          <TaxExport
            workspaceId={workspaceId}
            year={selectedYear}
            summary={summary}
          />
        </div>
      )}

      {activeTab === 'deductions' && (
        <TaxDeductions workspaceId={workspaceId} year={selectedYear} />
      )}

      {activeTab === 'brackets' && (
        <TaxBrackets
          taxableIncome={summary?.taxableIncome ?? 0}
          estimatedTax={summary?.estimatedTax ?? 0}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { text: string; className: string; icon: React.ReactNode }> = {
    open: {
      text: 'En cours',
      className: 'bg-ctp-blue/20 text-ctp-blue',
      icon: <Calculator className="w-4 h-4" />,
    },
    filed: {
      text: 'Declare',
      className: 'bg-ctp-green/20 text-ctp-green',
      icon: <FileCheck2 className="w-4 h-4" />,
    },
    closed: {
      text: 'Cloture',
      className: 'bg-ctp-overlay1/20 text-ctp-overlay1',
      icon: <FileCheck2 className="w-4 h-4" />,
    },
  };

  const configEntry = statusConfig[status];
  const config = configEntry ?? statusConfig.open;
  if (!config) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
      {config.icon}
      {config.text}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
        active
          ? 'border-ctp-mauve text-ctp-mauve'
          : 'border-transparent text-ctp-subtext0 hover:text-ctp-text'
      }`}
    >
      {children}
    </button>
  );
}

export default TaxPage;
