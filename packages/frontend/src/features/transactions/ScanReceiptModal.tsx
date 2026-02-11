// ============================================================================
// SCAN RECEIPT MODAL - Finance Hub
// OCR receipt scanning with camera/file upload support
// ============================================================================

import { useState, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Camera,
  Upload,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Calendar,
  DollarSign,
  Store,
  FileText,
  Sparkles,
} from 'lucide-react';
import { api, getAccessToken } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ScanResult {
  merchant?: string;
  amount?: number;
  date?: string;
  items?: Array<{ name: string; price: number }>;
  confidence: number;
  ocrConfidence: number;
  rawText: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: 'expense' | 'income' | 'both';
}

interface ScanReceiptModalProps {
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ----------------------------------------------------------------------------
// API Functions
// ----------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

async function scanReceipt(workspaceId: string, file: File): Promise<ScanResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/ocr/scan`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erreur lors du scan');
  }

  const result = await response.json();
  return result.data;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ScanReceiptModal({
  workspaceId,
  onClose,
  onSuccess,
}: ScanReceiptModalProps) {
  const queryClient = useQueryClient();

  // State
  const [step, setStep] = useState<'upload' | 'scanning' | 'review' | 'creating'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable form data
  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0] ?? '',
    accountId: '',
    categoryId: '',
    type: 'expense' as 'expense' | 'income',
  });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories', workspaceId],
    queryFn: () => api.get<Category[]>(`/workspaces/${workspaceId}/categories`),
  });

  // Scan mutation
  const scanMutation = useMutation({
    mutationFn: (file: File) => scanReceipt(workspaceId, file),
    onSuccess: (result) => {
      setScanResult(result);
      setFormData((prev) => ({
        ...prev,
        description: result.merchant || '',
        amount: result.amount || 0,
        date: result.date
          ? new Date(result.date).toISOString().split('T')[0] ?? prev.date
          : prev.date,
      }));
      setStep('review');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors du scan');
      setStep('upload');
    },
  });

  // Create transaction mutation
  const createMutation = useMutation({
    mutationFn: () =>
      api.post(`/workspaces/${workspaceId}/transactions`, {
        accountId: formData.accountId,
        type: formData.type,
        amount: Math.abs(formData.amount),
        currency: accounts?.find((a) => a.id === formData.accountId)?.currency ?? 'EUR',
        description: formData.description,
        date: formData.date,
        categoryId: formData.categoryId || null,
        notes: scanResult
          ? `Scanne depuis un ticket de caisse (confiance: ${Math.round(scanResult.confidence * 100)}%)`
          : null,
        tags: [],
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['accounts', workspaceId] });
      onSuccess();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la creation');
    },
  });

  // Handlers
  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type)) {
      setError('Type de fichier non supporte. Utilisez JPEG, PNG ou WebP.');
      return;
    }

    // Validate file size (15MB max)
    if (file.size > 15 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 15MB)');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const startScan = useCallback(() => {
    if (!selectedFile) return;
    setStep('scanning');
    setError(null);
    scanMutation.mutate(selectedFile);
  }, [selectedFile, scanMutation]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setScanResult(null);
    setError(null);
    setStep('upload');
    setFormData({
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0] ?? '',
      accountId: '',
      categoryId: '',
      type: 'expense',
    });
  }, []);

  const handleCreate = useCallback(() => {
    if (!formData.accountId) {
      setError('Veuillez selectionner un compte');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      setError('Veuillez entrer un montant valide');
      return;
    }
    if (!formData.description) {
      setError('Veuillez entrer une description');
      return;
    }

    setStep('creating');
    setError(null);
    createMutation.mutate();
  }, [formData, createMutation]);

  // Confidence indicator
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-ctp-green';
    if (confidence >= 0.5) return 'text-ctp-yellow';
    return 'text-ctp-red';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'Haute';
    if (confidence >= 0.5) return 'Moyenne';
    return 'Faible';
  };

  // Filter expense categories
  const expenseCategories = categories?.filter(
    (c) => c.type === 'expense' || c.type === 'both'
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-ctp-mantle rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-auto animate-slide-up sm:animate-scale-in">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-ctp-mauve/10 flex items-center justify-center">
                <Camera className="w-5 h-5 text-ctp-mauve" />
              </div>
              <div>
                <h2 id="scan-modal-title" className="text-xl font-bold text-ctp-text">
                  Scanner un ticket
                </h2>
                <p className="text-sm text-ctp-subtext0">
                  {step === 'upload' && 'Prenez ou importez une photo'}
                  {step === 'scanning' && 'Analyse en cours...'}
                  {step === 'review' && 'Verifiez les informations'}
                  {step === 'creating' && 'Creation en cours...'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-ctp-surface0 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-ctp-subtext0" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red text-sm mb-4 flex items-center gap-2"
              role="alert"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Preview */}
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Apercu du ticket"
                    className="w-full h-64 object-contain rounded-lg bg-ctp-surface0"
                    loading="lazy"
                    decoding="async"
                  />
                  <button
                    onClick={handleReset}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-ctp-mantle/80 hover:bg-ctp-mantle transition-colors"
                    aria-label="Supprimer l'image"
                  >
                    <RotateCcw className="w-4 h-4 text-ctp-text" />
                  </button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-ctp-surface1 rounded-lg p-8 text-center hover:border-ctp-mauve/50 transition-colors cursor-pointer"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-12 h-12 text-ctp-subtext0 mx-auto mb-4" />
                  <p className="text-ctp-text font-medium mb-1">
                    Deposez une image ici
                  </p>
                  <p className="text-ctp-subtext0 text-sm">
                    ou cliquez pour parcourir
                  </p>
                </div>
              )}

              {/* Hidden inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 btn-secondary flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline">Appareil photo</span>
                  <span className="sm:hidden">Photo</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 btn-secondary flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importer</span>
                </button>
              </div>

              {/* Scan button */}
              {selectedFile && (
                <button
                  onClick={startScan}
                  disabled={scanMutation.isPending}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Scanner le ticket
                </button>
              )}
            </div>
          )}

          {/* Scanning Step */}
          {step === 'scanning' && (
            <div className="py-12 text-center">
              <Loader2 className="w-16 h-16 text-ctp-mauve mx-auto mb-4 animate-spin" />
              <p className="text-ctp-text font-medium mb-2">Analyse du ticket...</p>
              <p className="text-ctp-subtext0 text-sm">
                Extraction des informations en cours
              </p>
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && scanResult && (
            <div className="space-y-4">
              {/* Confidence indicator */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-ctp-surface0">
                <CheckCircle className={clsx('w-5 h-5', getConfidenceColor(scanResult.confidence))} />
                <div className="flex-1">
                  <p className="text-sm text-ctp-text">
                    Confiance:{' '}
                    <span className={getConfidenceColor(scanResult.confidence)}>
                      {getConfidenceLabel(scanResult.confidence)} ({Math.round(scanResult.confidence * 100)}%)
                    </span>
                  </p>
                  {scanResult.confidence < 0.5 && (
                    <p className="text-xs text-ctp-subtext0 mt-1">
                      Verifiez attentivement les informations extraites
                    </p>
                  )}
                </div>
              </div>

              {/* Form */}
              <div className="space-y-3">
                {/* Description/Merchant */}
                <div>
                  <label className="label flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    Commercant / Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    placeholder="Ex: Carrefour"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="label flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Montant
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                    }
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="label flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="input"
                  />
                </div>

                {/* Account */}
                <div>
                  <label className="label">Compte</label>
                  <select
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="input"
                  >
                    <option value="">Selectionner un compte</option>
                    {accounts?.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.currency})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="label">Categorie (optionnel)</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="input"
                  >
                    <option value="">Selectionner une categorie</option>
                    {expenseCategories?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Items preview */}
                {scanResult.items && scanResult.items.length > 0 && (
                  <div>
                    <label className="label flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Articles detectes ({scanResult.items.length})
                    </label>
                    <div className="max-h-32 overflow-auto rounded-lg bg-ctp-surface0 p-2 space-y-1">
                      {scanResult.items.slice(0, 10).map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-ctp-text truncate">{item.name}</span>
                          <span className="text-ctp-subtext0 flex-shrink-0 ml-2">
                            {item.price.toFixed(2)} EUR
                          </span>
                        </div>
                      ))}
                      {scanResult.items.length > 10 && (
                        <p className="text-xs text-ctp-subtext0 text-center pt-1">
                          +{scanResult.items.length - 10} autres articles
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button onClick={handleReset} className="btn-secondary flex-1">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Recommencer
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Creer la transaction
                </button>
              </div>
            </div>
          )}

          {/* Creating Step */}
          {step === 'creating' && (
            <div className="py-12 text-center">
              <Loader2 className="w-16 h-16 text-ctp-green mx-auto mb-4 animate-spin" />
              <p className="text-ctp-text font-medium mb-2">Creation en cours...</p>
              <p className="text-ctp-subtext0 text-sm">
                La transaction est en cours de creation
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScanReceiptModal;
