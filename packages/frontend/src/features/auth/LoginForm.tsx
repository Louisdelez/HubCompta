// ============================================================================
// LOGIN FORM - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { MfaVerify } from './MfaVerify';
import { Wallet } from 'lucide-react';
import type { MFAType } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface LoginFormData {
  email: string;
  password: string;
}

interface MfaState {
  required: boolean;
  methods: MFAType[];
  tempToken: string;
}

// ----------------------------------------------------------------------------
// Device Fingerprint
// ----------------------------------------------------------------------------

function generateDeviceFingerprint(): string {
  // Simple fingerprint based on browser properties
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx?.fillText('fingerprint', 10, 10);
  const canvasData = canvas.toDataURL();

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    canvasData.slice(-50),
  ].join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Mac')) return 'Mac';
  if (ua.includes('Windows')) return 'Windows PC';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown Device';
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LoginForm() {
  const navigate = useNavigate();
  const { login, verifyMfa } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mfaState, setMfaState] = useState<MfaState | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const fingerprint = generateDeviceFingerprint();
      const deviceName = getDeviceName();

      const result = await login(data.email, data.password, fingerprint, deviceName);

      if (result.requiresMfa && result.tempToken && result.mfaMethods) {
        setMfaState({
          required: true,
          methods: result.mfaMethods,
          tempToken: result.tempToken,
        });
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const onMfaVerify = async (code: string, type: MFAType) => {
    if (!mfaState) return;

    setError(null);
    setIsLoading(true);

    try {
      await verifyMfa(mfaState.tempToken, code, type);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Show MFA verification if required
  if (mfaState?.required) {
    return (
      <MfaVerify
        methods={mfaState.methods}
        onVerify={onMfaVerify}
        onCancel={() => setMfaState(null)}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto">
          <Wallet className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold mt-4">Finance Hub</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Connectez-vous à votre compte
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            placeholder="vous@exemple.com"
            {...register('email', {
              required: 'Email requis',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Email invalide',
              },
            })}
          />
          {errors.email && (
            <p className="error-text">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="label">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
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
            <span className="flex items-center gap-2">
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
              Connexion...
            </span>
          ) : (
            'Se connecter'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
        Pas encore de compte ?{' '}
        <a href="/register" className="link">
          Créer un compte
        </a>
      </p>
    </div>
  );
}

export default LoginForm;
