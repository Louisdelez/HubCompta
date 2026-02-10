// ============================================================================
// ADD BANK MODAL - Finance Hub
// Search and connect to a bank via Open Banking
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, Building2, X, ArrowRight, Loader2, Shield } from 'lucide-react';
import { api } from '@/lib/api/client';

interface Institution {
  id: string;
  name: string;
  bic: string | null;
  logo: string | null;
  countries: string[];
}

interface AddBankModalProps {
  workspaceId: string;
  onClose: () => void;
}

export function AddBankModal({ workspaceId, onClose }: AddBankModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('FR');
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);

  // Fetch institutions
  const { data: institutions = [], isLoading } = useQuery({
    queryKey: ['banking', 'institutions', selectedCountry],
    queryFn: () =>
      api.get<Institution[]>(
        `/workspaces/${workspaceId}/banking/institutions?country=${selectedCountry}`
      ),
  });

  // Filter institutions by search query
  const filteredInstitutions = searchQuery.length >= 2
    ? institutions.filter((inst) =>
        inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inst.bic && inst.bic.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : institutions.slice(0, 20);

  // Initiate connection mutation
  const initiateConnection = useMutation({
    mutationFn: (institution: Institution) =>
      api.post<{ authUrl: string; connectionId: string }>(
        `/workspaces/${workspaceId}/banking/connections/initiate`,
        {
          institutionId: institution.id,
          institutionName: institution.name,
          institutionLogo: institution.logo,
        }
      ),
    onSuccess: (response) => {
      // Redirect to bank's auth page
      window.location.href = response.authUrl;
    },
  });

  const handleSelectInstitution = (institution: Institution) => {
    setSelectedInstitution(institution);
  };

  const handleConnect = () => {
    if (selectedInstitution) {
      initiateConnection.mutate(selectedInstitution);
    }
  };

  // Close on escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const countries = [
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Allemagne' },
    { code: 'ES', name: 'Espagne' },
    { code: 'IT', name: 'Italie' },
    { code: 'BE', name: 'Belgique' },
    { code: 'NL', name: 'Pays-Bas' },
    { code: 'AT', name: 'Autriche' },
    { code: 'PT', name: 'Portugal' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ctp-surface1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Ajouter une banque
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-ctp-surface0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {!selectedInstitution ? (
            <>
              {/* Country & Search */}
              <div className="flex gap-3 mb-4">
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="input-select w-32"
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ctp-subtext0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher votre banque..."
                    className="input-text pl-10 w-full"
                    autoFocus
                  />
                </div>
              </div>

              {/* Institutions List */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {isLoading ? (
                  <div className="py-8 text-center">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-ctp-blue mb-2" />
                    <p className="text-ctp-subtext0">Chargement des banques...</p>
                  </div>
                ) : filteredInstitutions.length > 0 ? (
                  filteredInstitutions.map((institution) => (
                    <button
                      key={institution.id}
                      onClick={() => handleSelectInstitution(institution)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-ctp-surface0 transition-colors text-left"
                    >
                      {institution.logo ? (
                        <img
                          src={institution.logo}
                          alt={institution.name}
                          className="w-10 h-10 rounded-lg object-contain bg-white p-1"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-ctp-surface1 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-ctp-subtext0" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ctp-text truncate">
                          {institution.name}
                        </p>
                        {institution.bic && (
                          <p className="text-xs text-ctp-subtext0">{institution.bic}</p>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-ctp-subtext0" />
                    </button>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <Building2 className="w-12 h-12 mx-auto text-ctp-overlay1 mb-2" />
                    <p className="text-ctp-subtext0">
                      {searchQuery.length >= 2
                        ? 'Aucune banque trouvee'
                        : 'Recherchez votre banque'}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Selected Institution - Confirm */
            <div className="space-y-4">
              {/* Selected Bank */}
              <div className="flex items-center gap-3 p-4 bg-ctp-surface0 rounded-lg">
                {selectedInstitution.logo ? (
                  <img
                    src={selectedInstitution.logo}
                    alt={selectedInstitution.name}
                    className="w-12 h-12 rounded-lg object-contain bg-white p-1"
                  />
                ) : (
                  <div className="w-12 h-12 bg-ctp-surface1 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-ctp-subtext0" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-ctp-text">{selectedInstitution.name}</p>
                  <button
                    onClick={() => setSelectedInstitution(null)}
                    className="text-sm text-ctp-blue hover:underline"
                  >
                    Changer de banque
                  </button>
                </div>
              </div>

              {/* Security Notice */}
              <div className="bg-ctp-blue/10 border border-ctp-blue/30 rounded-lg p-4">
                <div className="flex gap-3">
                  <Shield className="w-5 h-5 text-ctp-blue flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-ctp-text mb-1">Connexion securisee</h3>
                    <p className="text-sm text-ctp-subtext0">
                      Vous allez etre redirige vers le site de votre banque pour autoriser
                      la connexion. Nous n'avons jamais acces a vos identifiants bancaires.
                    </p>
                  </div>
                </div>
              </div>

              {/* What we access */}
              <div>
                <h4 className="font-medium mb-2">Nous accederons a :</h4>
                <ul className="text-sm text-ctp-subtext0 space-y-1">
                  <li>• Soldes de vos comptes</li>
                  <li>• Historique des transactions (90 jours)</li>
                  <li>• Informations sur vos comptes</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedInstitution && (
          <div className="p-4 border-t border-ctp-surface1 flex gap-3">
            <button onClick={() => setSelectedInstitution(null)} className="btn-secondary flex-1">
              Retour
            </button>
            <button
              onClick={handleConnect}
              disabled={initiateConnection.isPending}
              className="btn-primary flex-1"
            >
              {initiateConnection.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Connecter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddBankModal;
