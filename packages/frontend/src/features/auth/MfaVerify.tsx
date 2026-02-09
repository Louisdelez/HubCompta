// ============================================================================
// MFA VERIFICATION - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ShieldCheck, Smartphone, Key } from 'lucide-react';
import type { MFAType } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface MfaVerifyProps {
  methods: MFAType[];
  onVerify: (code: string, type: MFAType) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

interface VerifyFormData {
  code: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function MfaVerify({
  methods,
  onVerify,
  onCancel,
  isLoading,
  error,
}: MfaVerifyProps) {
  const [selectedMethod, setSelectedMethod] = useState<MFAType>(methods[0] ?? 'totp');
  const [showBackupInput, setShowBackupInput] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyFormData>();

  const onSubmit = async (data: VerifyFormData) => {
    await onVerify(data.code, selectedMethod);
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ctp-sapphire to-ctp-blue flex items-center justify-center mx-auto shadow-lg">
            <ShieldCheck className="w-10 h-10 text-ctp-crust" />
          </div>
          <h1 className="text-2xl font-bold mt-6 text-ctp-text">Verification MFA</h1>
          <p className="text-ctp-subtext0 mt-2">
            Entrez le code de votre application d'authentification
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

        {/* Method selector if multiple methods */}
        {methods.length > 1 && (
          <div className="flex gap-3 mb-6">
            {methods.map((method) => (
              <button
                key={method}
                onClick={() => setSelectedMethod(method)}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedMethod === method
                    ? 'bg-ctp-blue/20 text-ctp-blue border-2 border-ctp-blue/50 shadow-lg shadow-ctp-blue/10'
                    : 'bg-ctp-mantle text-ctp-subtext1 border-2 border-ctp-surface1 hover:border-ctp-overlay0'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  {method === 'totp' ? <><Smartphone className="w-4 h-4" /> Authenticator</> : <><Key className="w-4 h-4" /> Security Key</>}
                </span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-2 text-ctp-subtext1">
              {showBackupInput ? 'Code de recuperation' : 'Code a 6 chiffres'}
            </label>
            <input
              id="code"
              type="text"
              inputMode={showBackupInput ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              autoFocus
              className="w-full px-4 py-4 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text text-center text-2xl tracking-[0.5em] font-mono placeholder:text-ctp-overlay0 placeholder:tracking-normal focus:border-ctp-blue focus:ring-2 focus:ring-ctp-blue/20 transition-all duration-200"
              placeholder={showBackupInput ? 'XXXX-XXXX' : '000000'}
              maxLength={showBackupInput ? 9 : 6}
              {...register('code', {
                required: 'Code requis',
                pattern: showBackupInput
                  ? {
                      value: /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i,
                      message: 'Format invalide',
                    }
                  : {
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
            className="w-full py-3 px-4 rounded-xl bg-ctp-blue text-ctp-crust font-semibold hover:bg-ctp-sapphire focus:ring-2 focus:ring-ctp-blue/50 focus:ring-offset-2 focus:ring-offset-ctp-surface0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-ctp-blue/25"
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
                Verification...
              </span>
            ) : (
              'Verifier'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-ctp-surface1 text-center space-y-3">
          <button
            onClick={() => setShowBackupInput(!showBackupInput)}
            className="text-sm text-ctp-subtext0 hover:text-ctp-blue transition-colors"
          >
            {showBackupInput
              ? 'Utiliser le code authenticator'
              : 'Utiliser un code de recuperation'}
          </button>

          <div>
            <button
              onClick={onCancel}
              className="text-sm text-ctp-overlay1 hover:text-ctp-text transition-colors flex items-center justify-center gap-1 mx-auto"
            >
              <span className="text-lg leading-none">&larr;</span> Retour
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MfaVerify;
