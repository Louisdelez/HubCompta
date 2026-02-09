// ============================================================================
// INVOICE FORM - Finance Hub
// Create/Edit invoice
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Contact {
  id: string;
  type: 'client' | 'supplier';
  name: string;
  email: string | null;
}

interface InvoiceLine {
  id?: string | undefined;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  total?: number | undefined;
}

interface Invoice {
  id: string;
  contactId: string;
  dueDate: string;
  notes: string | null;
  lines: InvoiceLine[];
  contact: Contact;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const VAT_RATES = [
  { value: 20, label: 'TVA 20% (normal)' },
  { value: 10, label: 'TVA 10% (intermédiaire)' },
  { value: 5.5, label: 'TVA 5,5% (réduit)' },
  { value: 2.1, label: 'TVA 2,1% (super-réduit)' },
  { value: 0, label: 'Exonéré' },
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

function calculateLineTotal(line: InvoiceLine): number {
  const subtotal = line.quantity * line.unitPrice;
  return subtotal * (1 + line.vatRate / 100);
}

function calculateTotals(lines: InvoiceLine[]) {
  let subtotal = 0;
  let vatAmount = 0;

  for (const line of lines) {
    const lineSubtotal = line.quantity * line.unitPrice;
    subtotal += lineSubtotal;
    vatAmount += lineSubtotal * (line.vatRate / 100);
  }

  return {
    subtotal,
    vatAmount,
    total: subtotal + vatAmount,
  };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function InvoiceForm() {
  const { invoiceId } = useParams();
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isEditing = !!invoiceId;

  const [contactId, setContactId] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0] ?? '';
  });
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([
    { description: '', quantity: 1, unitPrice: 0, vatRate: 20 },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch contacts
  const { data: contacts } = useQuery({
    queryKey: ['contacts', workspaceId, 'client'],
    queryFn: () =>
      api.get<{ data: Contact[] }>(`/workspaces/${workspaceId}/contacts?type=client`)
        .then((res) => res.data),
    enabled: !!workspaceId,
  });

  // Fetch invoice if editing
  const { data: invoice } = useQuery({
    queryKey: ['invoice', workspaceId, invoiceId],
    queryFn: () =>
      api.get<{ data: Invoice }>(`/workspaces/${workspaceId}/invoices/${invoiceId}`)
        .then((res) => res.data),
    enabled: !!workspaceId && isEditing,
  });

  // Populate form when editing
  useEffect(() => {
    if (invoice) {
      setContactId(invoice.contactId);
      setDueDate(invoice.dueDate.split('T')[0] ?? '');
      setNotes(invoice.notes || '');
      setLines(invoice.lines.map((line): InvoiceLine => ({
        ...(line.id ? { id: line.id } : {}),
        description: line.description,
        quantity: parseFloat(String(line.quantity)),
        unitPrice: parseFloat(String(line.unitPrice)),
        vatRate: parseFloat(String(line.vatRate)),
      })));
    }
  }, [invoice]);

  type CreateInvoicePayload = {
    contactId: string;
    dueDate: Date;
    lines: InvoiceLine[];
    notes?: string | undefined;
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateInvoicePayload) =>
      api.post<{ data: Invoice }>(`/workspaces/${workspaceId}/invoices`, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId] });
      navigate(`/workspaces/${workspaceId}/pro/invoices/${response.data.id}`);
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { lines: InvoiceLine[] }) =>
      api.patch<{ data: Invoice }>(`/workspaces/${workspaceId}/invoices/${invoiceId}/lines`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId] });
      navigate(`/workspaces/${workspaceId}/pro/invoices/${invoiceId}`);
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message });
    },
  });

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, unitPrice: 0, vatRate: 20 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof InvoiceLine, value: string | number) => {
    setLines((prevLines) => {
      const newLines = [...prevLines];
      const currentLine = newLines[index];
      if (!currentLine) return prevLines;
      const updatedLine: InvoiceLine = {
        description: field === 'description' ? (value as string) : currentLine.description,
        quantity: field === 'quantity' ? (value as number) : currentLine.quantity,
        unitPrice: field === 'unitPrice' ? (value as number) : currentLine.unitPrice,
        vatRate: field === 'vatRate' ? (value as number) : currentLine.vatRate,
      };
      if (currentLine.id !== undefined) {
        updatedLine.id = currentLine.id;
      }
      if (currentLine.total !== undefined) {
        updatedLine.total = currentLine.total;
      }
      newLines[index] = updatedLine;
      return newLines;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!contactId) {
      setErrors({ contactId: 'Sélectionnez un client' });
      return;
    }

    const validLines = lines.filter((l) => l.description.trim() && l.quantity > 0);
    if (validLines.length === 0) {
      setErrors({ lines: 'Ajoutez au moins une ligne' });
      return;
    }

    if (isEditing) {
      updateMutation.mutate({ lines: validLines });
    } else {
      const data: CreateInvoicePayload = {
        contactId,
        dueDate: new Date(dueDate),
        lines: validLines,
      };
      if (notes) {
        data.notes = notes;
      }
      createMutation.mutate(data);
    }
  };

  const totals = calculateTotals(lines);
  const isPending = createMutation.isPending || updateMutation.isPending;

  if (!workspaceId) {
    return null;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {isEditing ? 'Modifier la facture' : 'Nouvelle facture'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {isEditing ? 'Modifiez les lignes de la facture' : 'Créez une nouvelle facture'}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Selection */}
            {!isEditing && (
              <div className="card">
                <label className="block text-sm font-medium mb-2">
                  Client <span className="text-danger-500">*</span>
                </label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className={clsx('input w-full', errors.contactId && 'border-danger-500')}
                >
                  <option value="">Sélectionner un client...</option>
                  {contacts?.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                </select>
                {errors.contactId && (
                  <p className="text-sm text-danger-500 mt-1">{errors.contactId}</p>
                )}
              </div>
            )}

            {/* Lines */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Lignes de facture</h2>
                <button
                  type="button"
                  onClick={addLine}
                  className="btn btn-sm btn-secondary"
                >
                  + Ajouter une ligne
                </button>
              </div>

              {errors.lines && (
                <p className="text-sm text-danger-500 mb-4">{errors.lines}</p>
              )}

              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-50 dark:bg-gray-900 dark:bg-gray-700 rounded-lg space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(index, 'description', e.target.value)}
                          className="input w-full"
                          placeholder="Description du produit ou service"
                        />
                      </div>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="p-2 text-gray-400 hover:text-danger-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Quantité</label>
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="input w-full"
                          min="0"
                          step="0.001"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Prix unitaire HT</label>
                        <input
                          type="number"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="input w-full"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">TVA</label>
                        <select
                          value={line.vatRate}
                          onChange={(e) => updateLine(index, 'vatRate', parseFloat(e.target.value))}
                          className="input w-full"
                        >
                          {VAT_RATES.map((rate) => (
                            <option key={rate.value} value={rate.value}>
                              {rate.value}%
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Total TTC</label>
                        <div className="input w-full bg-gray-100 dark:bg-gray-700 dark:bg-gray-600 font-medium">
                          {formatCurrency(calculateLineTotal(line))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="card">
              <label className="block text-sm font-medium mb-2">Notes (optionnel)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input w-full h-24 resize-none"
                placeholder="Conditions de paiement, mentions légales..."
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Due Date */}
            {!isEditing && (
              <div className="card">
                <label className="block text-sm font-medium mb-2">Date d'échéance</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input w-full"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}

            {/* Totals */}
            <div className="card">
              <h3 className="font-semibold mb-4">Récapitulatif</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Sous-total HT</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">TVA</span>
                  <span>{formatCurrency(totals.vatAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="font-semibold">Total TTC</span>
                  <span className="text-xl font-bold text-primary-600">
                    {formatCurrency(totals.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Error */}
            {errors.submit && (
              <div className="p-3 bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 rounded-lg text-sm">
                {errors.submit}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isPending}
              >
                {isPending ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer la facture'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn btn-secondary w-full"
                disabled={isPending}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default InvoiceForm;
