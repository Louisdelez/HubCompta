// ============================================================================
// AMORTIZATION TABLE - Finance Hub
// Interactive loan amortization schedule
// ============================================================================

import { useState, useMemo } from 'react';
import { format, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Table,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';

interface AmortizationRow {
  month: number;
  date: Date;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
}

interface AmortizationTableProps {
  principalAmount: number;
  annualInterestRate: number;
  termMonths: number;
  startDate: Date;
  monthlyPayment: number;
  currency?: string;
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  startDate: Date,
  monthlyPayment: number
): AmortizationRow[] {
  const monthlyRate = annualRate / 12 / 100;
  const schedule: AmortizationRow[] = [];

  let balance = principal;
  let cumulativeInterest = 0;
  let cumulativePrincipal = 0;

  for (let month = 1; month <= termMonths && balance > 0; month++) {
    const interest = balance * monthlyRate;
    const principalPaid = Math.min(monthlyPayment - interest, balance);
    const actualPayment = principalPaid + interest;

    balance = Math.max(0, balance - principalPaid);
    cumulativeInterest += interest;
    cumulativePrincipal += principalPaid;

    schedule.push({
      month,
      date: addMonths(startDate, month - 1),
      payment: actualPayment,
      principal: principalPaid,
      interest,
      balance,
      cumulativeInterest,
      cumulativePrincipal,
    });
  }

  return schedule;
}

export function AmortizationTable({
  principalAmount,
  annualInterestRate,
  termMonths,
  startDate,
  monthlyPayment,
  currency = 'EUR',
}: AmortizationTableProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [showCumulative, setShowCumulative] = useState(false);
  const rowsPerPage = 12;

  const schedule = useMemo(
    () =>
      generateAmortizationSchedule(
        principalAmount,
        annualInterestRate,
        termMonths,
        startDate,
        monthlyPayment
      ),
    [principalAmount, annualInterestRate, termMonths, startDate, monthlyPayment]
  );

  const totalPages = Math.ceil(schedule.length / rowsPerPage);
  const paginatedSchedule = schedule.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage
  );

  const totals = schedule.reduce(
    (acc, row) => ({
      totalPayment: acc.totalPayment + row.payment,
      totalPrincipal: acc.totalPrincipal + row.principal,
      totalInterest: acc.totalInterest + row.interest,
    }),
    { totalPayment: 0, totalPrincipal: 0, totalInterest: 0 }
  );

  const handleExportCSV = () => {
    const headers = [
      'Mois',
      'Date',
      'Mensualite',
      'Principal',
      'Interets',
      'Solde restant',
    ];
    const rows = schedule.map((row) => [
      row.month,
      format(row.date, 'MM/yyyy'),
      row.payment.toFixed(2),
      row.principal.toFixed(2),
      row.interest.toFixed(2),
      row.balance.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tableau-amortissement.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Table className="w-5 h-5 text-ctp-blue" />
          <h3 className="font-semibold">Tableau d'amortissement</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCumulative(!showCumulative)}
            className={clsx(
              'px-3 py-1 text-sm rounded-lg transition-colors',
              showCumulative
                ? 'bg-ctp-blue text-ctp-base'
                : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
            )}
          >
            Cumulatif
          </button>
          <button
            onClick={handleExportCSV}
            className="p-2 rounded-lg bg-ctp-surface0 hover:bg-ctp-surface1 transition-colors"
            title="Exporter CSV"
          >
            <Download className="w-4 h-4 text-ctp-subtext0" />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-ctp-surface0 rounded-lg p-3 text-center">
          <p className="text-xs text-ctp-subtext0">Total rembourse</p>
          <p className="text-lg font-semibold text-ctp-text">
            {formatCurrency(totals.totalPayment, currency)}
          </p>
        </div>
        <div className="bg-ctp-surface0 rounded-lg p-3 text-center">
          <p className="text-xs text-ctp-subtext0">Principal</p>
          <p className="text-lg font-semibold text-ctp-blue">
            {formatCurrency(totals.totalPrincipal, currency)}
          </p>
        </div>
        <div className="bg-ctp-surface0 rounded-lg p-3 text-center">
          <p className="text-xs text-ctp-subtext0">Interets</p>
          <p className="text-lg font-semibold text-ctp-red">
            {formatCurrency(totals.totalInterest, currency)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ctp-surface1">
              <th className="text-left py-2 px-3 text-xs font-medium text-ctp-subtext0">
                #
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-ctp-subtext0">
                Date
              </th>
              <th className="text-right py-2 px-3 text-xs font-medium text-ctp-subtext0">
                Mensualite
              </th>
              <th className="text-right py-2 px-3 text-xs font-medium text-ctp-subtext0">
                Principal
              </th>
              <th className="text-right py-2 px-3 text-xs font-medium text-ctp-subtext0">
                Interets
              </th>
              <th className="text-right py-2 px-3 text-xs font-medium text-ctp-subtext0">
                {showCumulative ? 'Cumul Interets' : 'Solde'}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedSchedule.map((row) => (
              <tr
                key={row.month}
                className="border-b border-ctp-surface0 last:border-0 hover:bg-ctp-surface0"
              >
                <td className="py-2 px-3 text-ctp-subtext0">{row.month}</td>
                <td className="py-2 px-3 text-ctp-text">
                  {format(row.date, 'MMM yyyy', { locale: fr })}
                </td>
                <td className="py-2 px-3 text-right text-ctp-text font-medium">
                  {formatCurrency(row.payment, currency)}
                </td>
                <td className="py-2 px-3 text-right text-ctp-blue">
                  {formatCurrency(row.principal, currency)}
                </td>
                <td className="py-2 px-3 text-right text-ctp-red">
                  {formatCurrency(row.interest, currency)}
                </td>
                <td className="py-2 px-3 text-right text-ctp-text">
                  {showCumulative
                    ? formatCurrency(row.cumulativeInterest, currency)
                    : formatCurrency(row.balance, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-ctp-surface1">
          <p className="text-sm text-ctp-subtext0">
            Page {currentPage + 1} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="p-2 rounded-lg bg-ctp-surface0 hover:bg-ctp-surface1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
              }
              disabled={currentPage === totalPages - 1}
              className="p-2 rounded-lg bg-ctp-surface0 hover:bg-ctp-surface1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AmortizationTable;
