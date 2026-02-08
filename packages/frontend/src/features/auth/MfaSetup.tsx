// ============================================================================
// MFA SETUP FLOW - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface MfaSetupData {
  mfaId: string;
  qrCodeUrl: string;
  secret: string;
  backupCodes: string[];
}

interface VerifyFormData {
  code: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function MfaSetup() {
  const [step, setStep] = useState<'init' | 'verify' | 'backup' | 'complete'>('init');
  const [setupData, setSetupData] = useState<MfaSetupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyFormData>();

  const initSetup = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const data = await api.post<MfaSetupData>('/auth/mfa/setup', {
        name: 'Authenticator',
        type: 'totp',
      });
      setSetupData(data);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (data: VerifyFormData) => {
    if (!setupData) return;

    setError(null);
    setIsLoading(true);

    try {
      await api.post('/auth/mfa/setup/verify', {
        mfaId: setupData.mfaId,
        code: data.code,
        secret: setupData.secret,
      });
      setStep('backup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCodes = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
    setBackupCodesCopied(true);
  };

  const finishSetup = () => {
    setStep('complete');
    // Redirect or callback
    window.location.href = '/dashboard';
  };

  // Step: Initialize
  if (step === 'init') {
    return (
      <div className="w-full max-w-md text-center">
        <div className="text-6xl mb-4">🔐</div>
        <h1 className="text-2xl font-bold">Configurer l'authentification MFA</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 mb-6">
          L'authentification à deux facteurs est obligatoire pour sécuriser votre compte.
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm mb-4">
            {error}
          </div>
        )}

        <button
          onClick={initSetup}
          disabled={isLoading}
          className="btn-primary w-full"
        >
          {isLoading ? 'Configuration...' : 'Commencer la configuration'}
        </button>
      </div>
    );
  }

  // Step: Verify QR code
  if (step === 'verify' && setupData) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Scanner le QR code</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Utilisez une application comme Google Authenticator ou Authy
          </p>
        </div>

        {/* QR Code */}
        <div className="bg-white p-4 rounded-xl mb-6 flex justify-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qrCodeUrl)}`}
            alt="QR Code MFA"
            className="w-48 h-48"
          />
        </div>

        {/* Manual entry */}
        <details className="mb-6">
          <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400">
            Entrer le code manuellement
          </summary>
          <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg font-mono text-sm break-all">
            {setupData.secret}
          </div>
        </details>

        {error && (
          <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(verifyCode)} className="space-y-4">
          <div>
            <label htmlFor="code" className="label">
              Code de vérification
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="input text-center text-2xl tracking-widest"
              placeholder="000000"
              maxLength={6}
              {...register('code', {
                required: 'Code requis',
                pattern: {
                  value: /^\d{6}$/,
                  message: 'Le code doit contenir 6 chiffres',
                },
              })}
            />
            {errors.code && (
              <p className="error-text">{errors.code.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? 'Vérification...' : 'Vérifier'}
          </button>
        </form>
      </div>
    );
  }

  // Step: Backup codes
  if (step === 'backup' && setupData) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">✅</div>
          <h1 className="text-2xl font-bold">MFA activé !</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Sauvegardez vos codes de récupération
          </p>
        </div>

        <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4 mb-6">
          <p className="text-warning-700 dark:text-warning-300 text-sm">
            ⚠️ Ces codes ne seront plus affichés. Conservez-les en lieu sûr.
          </p>
        </div>

        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {setupData.backupCodes.map((code, i) => (
              <div key={i} className="text-center py-1">
                {code}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={copyBackupCodes}
          className="btn-secondary w-full mb-4"
        >
          {backupCodesCopied ? '✓ Copié !' : 'Copier les codes'}
        </button>

        <button
          onClick={finishSetup}
          className="btn-primary w-full"
        >
          J'ai sauvegardé mes codes
        </button>
      </div>
    );
  }

  return null;
}

export default MfaSetup;
