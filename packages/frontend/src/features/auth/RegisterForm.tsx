// ============================================================================
// REGISTRATION FORM - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { Wallet, CheckCircle } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface RegisterFormData {
  email: string;
  displayName: string;
  password: string;
  confirmPassword: string;
}

// ----------------------------------------------------------------------------
// Password Validation
// ----------------------------------------------------------------------------

const PASSWORD_RULES = {
  minLength: 12,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecial: /[@$!%*?&]/,
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RegisterForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>();

  const password = watch('password');

  const validatePassword = (password: string): string | null => {
    if (password.length < PASSWORD_RULES.minLength) {
      return t('auth.passwordMinLength', { count: PASSWORD_RULES.minLength });
    }
    if (!PASSWORD_RULES.hasUppercase.test(password)) {
      return t('auth.passwordUppercase');
    }
    if (!PASSWORD_RULES.hasLowercase.test(password)) {
      return t('auth.passwordLowercase');
    }
    if (!PASSWORD_RULES.hasNumber.test(password)) {
      return t('auth.passwordNumber');
    }
    if (!PASSWORD_RULES.hasSpecial.test(password)) {
      return t('auth.passwordSpecial');
    }
    return null;
  };

  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      await api.post('/auth/register', {
        email: data.email,
        displayName: data.displayName,
        password: data.password,
      });

      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-2xl p-8 shadow-xl text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-ctp-green to-ctp-teal flex items-center justify-center mx-auto mb-6 shadow-lg shadow-ctp-green/25">
            <CheckCircle className="w-10 h-10 text-ctp-crust" />
          </div>
          <h1 className="text-2xl font-bold text-ctp-text">{t('auth.accountCreated')}</h1>
          <p className="text-ctp-subtext0 mt-3">
            {t('auth.redirectingToLogin')}
          </p>
          <div className="mt-6 flex justify-center">
            <div className="w-8 h-1 rounded-full bg-ctp-green animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      {/* Card container with Catppuccin styling */}
      <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-8">
          {/* Logo with gradient background */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ctp-mauve to-ctp-pink flex items-center justify-center mx-auto shadow-lg">
            <Wallet className="w-10 h-10 text-ctp-crust" />
          </div>
          <h1 className="text-2xl font-bold mt-6 text-ctp-text">{t('auth.createAccount')}</h1>
          <p className="text-ctp-subtext0 mt-2">
            {t('auth.startManagingFinances')}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {error && (
            <div className="p-4 rounded-xl bg-ctp-red/10 border border-ctp-red/20 text-ctp-red text-sm flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-ctp-red/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold">!</span>
              </div>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium mb-2 text-ctp-subtext1">
              {t('auth.displayName')}
            </label>
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              className="w-full px-4 py-3 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-mauve focus:ring-2 focus:ring-ctp-mauve/20 transition-all duration-200"
              placeholder="Jean Dupont"
              {...register('displayName', {
                required: t('auth.nameRequired'),
                minLength: {
                  value: 2,
                  message: t('auth.nameTooShort'),
                },
                maxLength: {
                  value: 100,
                  message: t('auth.nameTooLong'),
                },
              })}
            />
            {errors.displayName && (
              <p className="text-sm mt-2 text-ctp-red">{errors.displayName.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2 text-ctp-subtext1">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-mauve focus:ring-2 focus:ring-ctp-mauve/20 transition-all duration-200"
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
              <p className="text-sm mt-2 text-ctp-red">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2 text-ctp-subtext1">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-mauve focus:ring-2 focus:ring-ctp-mauve/20 transition-all duration-200"
              placeholder="************"
              {...register('password', {
                required: t('auth.passwordRequired'),
                validate: (value) => validatePassword(value) || true,
              })}
            />
            {errors.password && (
              <p className="text-sm mt-2 text-ctp-red">{errors.password.message}</p>
            )}
            <p className="text-xs text-ctp-overlay1 mt-2 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-ctp-overlay1" />
              {t('auth.passwordRequirements')}
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-ctp-subtext1">
              {t('auth.confirmPassword')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-mauve focus:ring-2 focus:ring-ctp-mauve/20 transition-all duration-200"
              placeholder="************"
              {...register('confirmPassword', {
                required: t('auth.confirmationRequired'),
                validate: (value) =>
                  value === password || t('auth.passwordsDoNotMatch'),
              })}
            />
            {errors.confirmPassword && (
              <p className="text-sm mt-2 text-ctp-red">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-ctp-mauve text-ctp-crust font-semibold hover:bg-ctp-pink focus:ring-2 focus:ring-ctp-mauve/50 focus:ring-offset-2 focus:ring-offset-ctp-surface0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-ctp-mauve/25"
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
                {t('auth.creating')}
              </span>
            ) : (
              t('auth.createMyAccount')
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-ctp-surface1">
          <p className="text-center text-sm text-ctp-subtext0">
            {t('auth.alreadyHaveAccountQuestion')}{' '}
            <a href="/login" className="text-ctp-mauve hover:text-ctp-pink font-medium transition-colors">
              {t('auth.signIn')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterForm;
