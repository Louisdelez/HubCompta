// ============================================================================
// LOCK SCREEN - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from './AuthProvider';
import { Lock } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface UnlockFormData {
  password: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LockScreen() {
  const { user, unlock, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UnlockFormData>();

  const onSubmit = async (data: UnlockFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      await unlock(data.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="text-xl font-bold">Session verrouillée</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {user?.displayName ?? user?.email}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="password" className="label">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                className="input"
                placeholder="••••••••••••"
                {...register('password', {
                  required: 'Mot de passe requis',
                })}
              />
              {errors.password && (
                <p className="error-text">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Déverrouillage...
                </span>
              ) : (
                'Déverrouiller'
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-danger-600 dark:hover:text-danger-400"
            >
              Se déconnecter
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-4">
          Session verrouillée après inactivité pour votre sécurité
        </p>
      </div>
    </div>
  );
}

export default LockScreen;
