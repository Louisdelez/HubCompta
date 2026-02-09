// ============================================================================
// QUICK ACTIONS WIDGET - Finance Hub Dashboard
// Quick action buttons for common tasks
// ============================================================================

import { Plus, Upload, PiggyBank, Receipt, ArrowLeftRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import type { WidgetProps } from './index';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Plus;
  href: string;
  color: string;
  bgColor: string;
}

// ----------------------------------------------------------------------------
// Actions Configuration
// ----------------------------------------------------------------------------

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'add-transaction',
    label: 'Transaction',
    icon: Plus,
    href: '/transactions/new',
    color: 'text-ctp-green',
    bgColor: 'bg-ctp-green/20 hover:bg-ctp-green/30',
  },
  {
    id: 'import',
    label: 'Importer',
    icon: Upload,
    href: '/import',
    color: 'text-ctp-blue',
    bgColor: 'bg-ctp-blue/20 hover:bg-ctp-blue/30',
  },
  {
    id: 'transfer',
    label: 'Virement',
    icon: ArrowLeftRight,
    href: '/transactions/new?type=transfer',
    color: 'text-ctp-sapphire',
    bgColor: 'bg-ctp-sapphire/20 hover:bg-ctp-sapphire/30',
  },
  {
    id: 'budget',
    label: 'Budget',
    icon: PiggyBank,
    href: '/budgets/new',
    color: 'text-ctp-peach',
    bgColor: 'bg-ctp-peach/20 hover:bg-ctp-peach/30',
  },
  {
    id: 'bill',
    label: 'Facture',
    icon: Receipt,
    href: '/bills/new',
    color: 'text-ctp-mauve',
    bgColor: 'bg-ctp-mauve/20 hover:bg-ctp-mauve/30',
  },
  {
    id: 'document',
    label: 'Document',
    icon: FileText,
    href: '/documents',
    color: 'text-ctp-teal',
    bgColor: 'bg-ctp-teal/20 hover:bg-ctp-teal/30',
  },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function QuickActionsWidget(_props: WidgetProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.slice(0, 6).map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.id}
              to={action.href}
              className={clsx(
                'flex flex-col items-center justify-center p-2 rounded-lg transition-all',
                action.bgColor
              )}
            >
              <Icon className={clsx('w-5 h-5 mb-1', action.color)} />
              <span className="text-xs font-medium text-ctp-text text-center">
                {action.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default QuickActionsWidget;
