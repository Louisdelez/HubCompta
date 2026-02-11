// ============================================================================
// BANKING CALLBACK PAGE - Finance Hub
// Handle OAuth callback from bank authorization
// ============================================================================

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Loader2, Building2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';

type CallbackStatus = 'processing' | 'success' | 'error';

interface CallbackState {
  status: CallbackStatus;
  message: string;
  connectionId?: string;
}

export function BankingCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { currentWorkspaceId: workspaceId } = useWorkspace();

  const [state, setState] = useState<CallbackState>({
    status: 'processing',
    message: 'Finalisation de la connexion bancaire...',
  });

  // Extract ref (our connectionId) from URL params
  const connectionRef = searchParams.get('ref');

  const completeConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID manquant');
      }
      return api.post(
        `/workspaces/${workspaceId}/banking/connections/${connectionId}/complete`,
        {}
      );
    },
    onSuccess: () => {
      const newState: CallbackState = {
        status: 'success',
        message: 'Connexion bancaire etablie avec succes !',
      };
      if (connectionRef) {
        newState.connectionId = connectionRef;
      }
      setState(newState);
      void queryClient.invalidateQueries({ queryKey: ['banking'] });

      // Redirect after a short delay
      setTimeout(() => {
        navigate('/banking');
      }, 2000);
    },
    onError: (error) => {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors de la finalisation de la connexion",
      });
    },
  });

  useEffect(() => {
    // Get the connection ID from URL params
    // Nordigen sends back the reference we provided as "ref"
    if (!connectionRef) {
      setState({
        status: 'error',
        message: 'Parametres de callback invalides',
      });
      return;
    }

    if (!workspaceId) {
      // Wait for workspace to be loaded
      return;
    }

    // Complete the connection
    completeConnection.mutate(connectionRef);
  }, [connectionRef, workspaceId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ctp-mantle p-4">
      <div className="card max-w-md w-full p-8 text-center">
        {/* Icon */}
        <div className="mb-6">
          {state.status === 'processing' && (
            <div className="w-20 h-20 mx-auto bg-ctp-blue/20 rounded-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-ctp-blue animate-spin" />
            </div>
          )}
          {state.status === 'success' && (
            <div className="w-20 h-20 mx-auto bg-ctp-green/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-ctp-green" />
            </div>
          )}
          {state.status === 'error' && (
            <div className="w-20 h-20 mx-auto bg-ctp-red/20 rounded-full flex items-center justify-center">
              <XCircle className="w-10 h-10 text-ctp-red" />
            </div>
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold mb-2 flex items-center justify-center gap-2">
          <Building2 className="w-6 h-6" />
          Connexion Bancaire
        </h1>

        {/* Message */}
        <p
          className={`text-sm ${
            state.status === 'error' ? 'text-ctp-red' : 'text-ctp-subtext0'
          }`}
        >
          {state.message}
        </p>

        {/* Actions */}
        <div className="mt-6">
          {state.status === 'processing' && (
            <p className="text-xs text-ctp-subtext1">
              Veuillez patienter pendant que nous configurons votre connexion...
            </p>
          )}
          {state.status === 'success' && (
            <p className="text-xs text-ctp-subtext1">
              Redirection automatique vers vos connexions bancaires...
            </p>
          )}
          {state.status === 'error' && (
            <div className="space-y-3">
              <p className="text-xs text-ctp-subtext1">
                Un probleme est survenu lors de la connexion a votre banque.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => navigate('/banking')}
                  className="btn-secondary"
                >
                  Retour
                </button>
                <button
                  onClick={() => {
                    setState({
                      status: 'processing',
                      message: 'Nouvelle tentative...',
                    });
                    if (connectionRef && workspaceId) {
                      completeConnection.mutate(connectionRef);
                    }
                  }}
                  className="btn-primary"
                >
                  Reessayer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BankingCallbackPage;
