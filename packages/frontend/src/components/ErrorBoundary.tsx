// ============================================================================
// ERROR BOUNDARY - Finance Hub
// Catches unhandled errors and displays fallback UI
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    this.setState({ errorInfo });

    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }

    // TODO: Send error to monitoring service (e.g., Sentry)
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  override render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-ctp-base flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-ctp-mantle rounded-xl shadow-lg p-8 text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ctp-red/20 mb-6">
              <AlertTriangle className="w-8 h-8 text-ctp-red" />
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold text-ctp-text mb-2">
              Oops! Une erreur s'est produite
            </h1>

            {/* Description */}
            <p className="text-ctp-subtext0 mb-6">
              Quelque chose s'est mal passé. Veuillez réessayer ou retourner à l'accueil.
            </p>

            {/* Error details in development */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-ctp-surface0 rounded-lg text-left overflow-auto max-h-40">
                <p className="text-sm font-mono text-ctp-red break-all">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-xs font-mono text-ctp-subtext0 mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 500)}
                  </pre>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-ctp-blue text-ctp-crust font-medium rounded-lg hover:bg-ctp-sapphire transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Recharger la page
              </button>

              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-ctp-surface0 text-ctp-text font-medium rounded-lg hover:bg-ctp-surface1 transition-colors"
              >
                <Home className="w-4 h-4" />
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
