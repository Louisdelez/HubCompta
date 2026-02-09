// ============================================================================
// LOCK SCREEN - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
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
    <div className="min-h-screen flex items-center justify-center bg-ctp-base p-4">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-ctp-mantle via-ctp-base to-ctp-crust" />

      <div className="relative w-full max-w-md">
        <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            {/* Animated lock icon */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-ctp-peach to-ctp-maroon flex items-center justify-center mx-auto mb-6 shadow-lg shadow-ctp-peach/25">
              <Lock className="w-10 h-10 text-ctp-crust" />
            </div>
            <h1 className="text-2xl font-bold text-ctp-text">Session verrouillee</h1>
            <p className="text-ctp-subtext0 mt-2 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ctp-green animate-pulse" />
              {user?.displayName ?? user?.email}
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-ctp-red/10 border border-ctp-red/20 text-ctp-red text-sm flex items-center gap-3 mb-6">
              <div className="w-5 h-5 rounded-full bg-ctp-red/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold">!</span>
              </div>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2 text-ctp-subtext1">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-peach focus:ring-2 focus:ring-ctp-peach/20 transition-all duration-200"
                placeholder="************"
                {...register('password', {
                  required: 'Mot de passe requis',
                })}
              />
              {errors.password && (
                <p className="text-sm mt-2 text-ctp-red">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-ctp-peach text-ctp-crust font-semibold hover:bg-ctp-maroon focus:ring-2 focus:ring-ctp-peach/50 focus:ring-offset-2 focus:ring-offset-ctp-surface0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-ctp-peach/25"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
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
                  Deverrouillage...
                </span>
              ) : (
                'Deverrouiller'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-ctp-surface1 text-center">
            <button
              onClick={handleLogout}
              className="text-sm text-ctp-subtext0 hover:text-ctp-red transition-colors"
            >
              Se deconnecter
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-ctp-overlay0 mt-6 flex items-center justify-center gap-2">
          <Lock className="w-3 h-3" />
          Session verrouillee apres inactivite pour votre securite
        </p>
      </div>
    </div>
  );
}

export default LockScreen;
