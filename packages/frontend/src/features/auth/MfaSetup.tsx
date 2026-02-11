// ============================================================================
// MFA SETUP FLOW - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api/client';
import { ShieldCheck, CheckCircle, AlertTriangle } from 'lucide-react';

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
      <div className="w-full max-w-md">
        <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-2xl p-8 shadow-xl text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ctp-teal to-ctp-sky flex items-center justify-center mx-auto mb-6 shadow-lg">
            <ShieldCheck className="w-10 h-10 text-ctp-crust" />
          </div>
          <h1 className="text-2xl font-bold text-ctp-text">Configurer l'authentification MFA</h1>
          <p className="text-ctp-subtext0 mt-3 mb-8">
            L'authentification a deux facteurs est obligatoire pour securiser votre compte.
          </p>

          {error && (
            <div className="p-4 rounded-xl bg-ctp-red/10 border border-ctp-red/20 text-ctp-red text-sm flex items-center gap-3 mb-6">
              <div className="w-5 h-5 rounded-full bg-ctp-red/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold">!</span>
              </div>
              {error}
            </div>
          )}

          <button
            onClick={initSetup}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-ctp-teal text-ctp-crust font-semibold hover:bg-ctp-sky focus:ring-2 focus:ring-ctp-teal/50 focus:ring-offset-2 focus:ring-offset-ctp-surface0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-ctp-teal/25"
          >
            {isLoading ? 'Configuration...' : 'Commencer la configuration'}
          </button>
        </div>
      </div>
    );
  }

  // Step: Verify QR code
  if (step === 'verify' && setupData) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-ctp-text">Scanner le QR code</h1>
            <p className="text-ctp-subtext0 mt-2">
              Utilisez une application comme Google Authenticator ou Authy
            </p>
          </div>

          {/* QR Code */}
          <div className="bg-ctp-mantle p-6 rounded-xl mb-6 flex justify-center border border-ctp-surface1">
            <div className="bg-white p-3 rounded-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qrCodeUrl)}`}
                alt="QR Code MFA"
                className="w-48 h-48"
                loading="eager"
                decoding="async"
                width={192}
                height={192}
              />
            </div>
          </div>

          {/* Manual entry */}
          <details className="mb-6 group">
            <summary className="cursor-pointer text-sm text-ctp-subtext0 hover:text-ctp-text transition-colors flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ctp-overlay0 group-open:bg-ctp-teal transition-colors" />
              Entrer le code manuellement
            </summary>
            <div className="mt-3 p-4 bg-ctp-mantle border border-ctp-surface1 rounded-xl font-mono text-sm break-all text-ctp-text">
              {setupData.secret}
            </div>
          </details>

          {error && (
            <div className="p-4 rounded-xl bg-ctp-red/10 border border-ctp-red/20 text-ctp-red text-sm flex items-center gap-3 mb-6">
              <div className="w-5 h-5 rounded-full bg-ctp-red/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold">!</span>
              </div>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(verifyCode)} className="space-y-5">
            <div>
              <label htmlFor="code" className="block text-sm font-medium mb-2 text-ctp-subtext1">
                Code de verification
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="w-full px-4 py-4 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text text-center text-2xl tracking-[0.5em] font-mono placeholder:text-ctp-overlay0 placeholder:tracking-normal focus:border-ctp-teal focus:ring-2 focus:ring-ctp-teal/20 transition-all duration-200"
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
                <p className="text-sm mt-2 text-ctp-red">{errors.code.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-ctp-teal text-ctp-crust font-semibold hover:bg-ctp-sky focus:ring-2 focus:ring-ctp-teal/50 focus:ring-offset-2 focus:ring-offset-ctp-surface0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-ctp-teal/25"
            >
              {isLoading ? 'Verification...' : 'Verifier'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Step: Backup codes
  if (step === 'backup' && setupData) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-ctp-green to-ctp-teal flex items-center justify-center mx-auto mb-4 shadow-lg shadow-ctp-green/25">
              <CheckCircle className="w-8 h-8 text-ctp-crust" />
            </div>
            <h1 className="text-2xl font-bold text-ctp-text">MFA active !</h1>
            <p className="text-ctp-subtext0 mt-2">
              Sauvegardez vos codes de recuperation
            </p>
          </div>

          <div className="bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-xl p-4 mb-6">
            <p className="text-ctp-yellow text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              Ces codes ne seront plus affiches. Conservez-les en lieu sur.
            </p>
          </div>

          <div className="bg-ctp-mantle border border-ctp-surface1 rounded-xl p-5 mb-6">
            <div className="grid grid-cols-2 gap-3 font-mono text-sm text-ctp-text">
              {setupData.backupCodes.map((code, i) => (
                <div key={i} className="text-center py-2 px-3 bg-ctp-surface0 rounded-lg border border-ctp-surface1">
                  {code}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={copyBackupCodes}
            className="w-full py-3 px-4 rounded-xl bg-ctp-surface1 text-ctp-text font-medium hover:bg-ctp-overlay0 border border-ctp-surface2 focus:ring-2 focus:ring-ctp-surface2/50 focus:ring-offset-2 focus:ring-offset-ctp-surface0 transition-all duration-200 mb-4"
          >
            {backupCodesCopied ? (
              <span className="text-ctp-green flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" /> Copie !
              </span>
            ) : (
              'Copier les codes'
            )}
          </button>

          <button
            onClick={finishSetup}
            className="w-full py-3 px-4 rounded-xl bg-ctp-green text-ctp-crust font-semibold hover:bg-ctp-teal focus:ring-2 focus:ring-ctp-green/50 focus:ring-offset-2 focus:ring-offset-ctp-surface0 transition-all duration-200 shadow-lg shadow-ctp-green/25"
          >
            J'ai sauvegarde mes codes
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default MfaSetup;
