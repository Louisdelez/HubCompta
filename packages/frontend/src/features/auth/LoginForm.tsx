// ============================================================================
// LOGIN FORM - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      {/* Card container with Catppuccin styling */}
      <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-8">
          {/* Logo with gradient background */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ctp-blue to-ctp-sapphire flex items-center justify-center mx-auto shadow-lg">
            <Wallet className="w-10 h-10 text-ctp-crust" />
          </div>
          <h1 className="text-2xl font-bold mt-6 text-ctp-text">Finance Hub</h1>
          <p className="text-ctp-subtext0 mt-2">
            {t('auth.connectToAccount')}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" aria-label={t('auth.loginForm')}>
          {error && (
            <div
              className="p-4 rounded-xl bg-ctp-red/10 border border-ctp-red/20 text-ctp-red text-sm flex items-center gap-3"
              role="alert"
              aria-live="assertive"
            >
              <div className="w-5 h-5 rounded-full bg-ctp-red/20 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <span className="text-xs font-bold">!</span>
              </div>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2 text-ctp-subtext1">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className="w-full px-4 py-3 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-blue focus:ring-2 focus:ring-ctp-blue/20 transition-all duration-200"
              placeholder={t('auth.emailPlaceholder')}
              {...register('email', {
                required: t('auth.emailRequired'),
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: t('auth.invalidEmail'),
                },
              })}
            />
            {errors.email && (
              <p id="email-error" className="text-sm mt-2 text-ctp-red" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2 text-ctp-subtext1">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              className="w-full px-4 py-3 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-blue focus:ring-2 focus:ring-ctp-blue/20 transition-all duration-200"
              placeholder="************"
              {...register('password', {
                required: t('auth.passwordRequired'),
              })}
            />
            {errors.password && (
              <p id="password-error" className="text-sm mt-2 text-ctp-red" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            aria-disabled={isLoading}
            aria-busy={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-ctp-blue text-ctp-crust font-semibold hover:bg-ctp-sapphire focus:ring-2 focus:ring-ctp-blue/50 focus:ring-offset-2 focus:ring-offset-ctp-surface0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-ctp-blue/25 focus:outline-none"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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
                <span>{t('auth.connecting')}</span>
                <span className="sr-only">en cours</span>
              </span>
            ) : (
              t('auth.signIn')
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-ctp-surface1">
          <p className="text-center text-sm text-ctp-subtext0">
            {t('auth.noAccountYet')}{' '}
            <a href="/register" className="text-ctp-blue hover:text-ctp-sapphire font-medium transition-colors">
              {t('auth.createAccount')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
