// ============================================================================
// MFA VERIFICATION - Finance Hub
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
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold mt-4">Vérification MFA</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Entrez le code de votre application d'authentification
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Method selector if multiple methods */}
      {methods.length > 1 && (
        <div className="flex gap-2 mb-6">
          {methods.map((method) => (
            <button
              key={method}
              onClick={() => setSelectedMethod(method)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                selectedMethod === method
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                {method === 'totp' ? <><Smartphone className="w-4 h-4" /> Authenticator</> : <><Key className="w-4 h-4" /> Security Key</>}
              </span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="code" className="label">
            {showBackupInput ? 'Code de récupération' : 'Code à 6 chiffres'}
          </label>
          <input
            id="code"
            type="text"
            inputMode={showBackupInput ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            autoFocus
            className="input text-center text-2xl tracking-widest"
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
            <p className="error-text">{errors.code.message}</p>
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
              Vérification...
            </span>
          ) : (
            'Vérifier'
          )}
        </button>
      </form>

      <div className="mt-6 text-center space-y-2">
        <button
          onClick={() => setShowBackupInput(!showBackupInput)}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          {showBackupInput
            ? 'Utiliser le code authenticator'
            : 'Utiliser un code de récupération'}
        </button>

        <div>
          <button
            onClick={onCancel}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            ← Retour
          </button>
        </div>
      </div>
    </div>
  );
}

export default MfaVerify;
