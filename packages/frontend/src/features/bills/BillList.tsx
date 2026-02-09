// ============================================================================
// BILL LIST - Finance Hub
// List of bills with filtering
// Uses Catppuccin colors: red for overdue, yellow for due soon, green for paid
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { BillCard } from './BillCard';
import type { Bill } from './BillsPage';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BillListProps {
  workspaceId: string;
  filter: 'all' | 'unpaid' | 'paid' | 'overdue' | 'upcoming';
  onEdit: (bill: Bill) => void;
}

interface BillListResponse {
  data: Bill[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BillList({ workspaceId, filter, onEdit }: BillListProps) {
  const queryClient = useQueryClient();

  // Fetch bills
  const { data, isLoading } = useQuery({
    queryKey: ['bills', workspaceId, 'list', filter],
    queryFn: () =>
      api.get<BillListResponse>(`/workspaces/${workspaceId}/bills?filter=${filter}`),
    enabled: !!workspaceId,
  });

  // Mark as paid mutation
  const payMutation = useMutation({
    mutationFn: (billId: string) =>
      api.post(`/workspaces/${workspaceId}/bills/${billId}/pay`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bills', workspaceId] });
    },
  });

  // Mark as unpaid mutation
  const unpayMutation = useMutation({
    mutationFn: (billId: string) =>
      api.post(`/workspaces/${workspaceId}/bills/${billId}/unpay`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bills', workspaceId] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (billId: string) =>
      api.delete(`/workspaces/${workspaceId}/bills/${billId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bills', workspaceId] });
    },
  });

  const handlePay = (billId: string) => {
    payMutation.mutate(billId);
  };

  const handleUnpay = (billId: string) => {
    unpayMutation.mutate(billId);
  };

  const handleDelete = (billId: string) => {
    if (confirm('Etes-vous sur de vouloir supprimer cette facture ?')) {
      deleteMutation.mutate(billId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-ctp-blue" />
      </div>
    );
  }

  const bills = data?.data ?? [];

  if (bills.length === 0) {
    return (
      <div className="text-center py-12 text-ctp-subtext0">
        {filter === 'overdue'
          ? 'Aucune facture en retard'
          : filter === 'paid'
          ? 'Aucune facture payee'
          : filter === 'upcoming'
          ? 'Aucune facture a venir'
          : 'Aucune facture'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {bills.map((bill) => (
        <BillCard
          key={bill.id}
          bill={bill}
          onEdit={() => onEdit(bill)}
          onPay={() => handlePay(bill.id)}
          onUnpay={() => handleUnpay(bill.id)}
          onDelete={() => handleDelete(bill.id)}
          isPayLoading={payMutation.isPending}
        />
      ))}
    </div>
  );
}

export default BillList;
