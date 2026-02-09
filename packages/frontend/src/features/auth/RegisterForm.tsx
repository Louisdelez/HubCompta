// ============================================================================
// REGISTRATION FORM - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
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

function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_RULES.minLength} caractères`;
  }
  if (!PASSWORD_RULES.hasUppercase.test(password)) {
    return 'Le mot de passe doit contenir au moins une majuscule';
  }
  if (!PASSWORD_RULES.hasLowercase.test(password)) {
    return 'Le mot de passe doit contenir au moins une minuscule';
  }
  if (!PASSWORD_RULES.hasNumber.test(password)) {
    return 'Le mot de passe doit contenir au moins un chiffre';
  }
  if (!PASSWORD_RULES.hasSpecial.test(password)) {
    return 'Le mot de passe doit contenir au moins un caractère spécial (@$!%*?&)';
  }
  return null;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RegisterForm() {
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
          <h1 className="text-2xl font-bold text-ctp-text">Compte cree !</h1>
          <p className="text-ctp-subtext0 mt-3">
            Redirection vers la page de connexion...
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
          <h1 className="text-2xl font-bold mt-6 text-ctp-text">Creer un compte</h1>
          <p className="text-ctp-subtext0 mt-2">
            Commencez a gerer vos finances
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
              Nom d'affichage
            </label>
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              className="w-full px-4 py-3 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-mauve focus:ring-2 focus:ring-ctp-mauve/20 transition-all duration-200"
              placeholder="Jean Dupont"
              {...register('displayName', {
                required: 'Nom requis',
                minLength: {
                  value: 2,
                  message: 'Le nom doit contenir au moins 2 caracteres',
                },
                maxLength: {
                  value: 100,
                  message: 'Le nom ne peut pas depasser 100 caracteres',
                },
              })}
            />
            {errors.displayName && (
              <p className="text-sm mt-2 text-ctp-red">{errors.displayName.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2 text-ctp-subtext1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-mauve focus:ring-2 focus:ring-ctp-mauve/20 transition-all duration-200"
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
              <p className="text-sm mt-2 text-ctp-red">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2 text-ctp-subtext1">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-mauve focus:ring-2 focus:ring-ctp-mauve/20 transition-all duration-200"
              placeholder="************"
              {...register('password', {
                required: 'Mot de passe requis',
                validate: (value) => validatePassword(value) || true,
              })}
            />
            {errors.password && (
              <p className="text-sm mt-2 text-ctp-red">{errors.password.message}</p>
            )}
            <p className="text-xs text-ctp-overlay1 mt-2 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-ctp-overlay1" />
              Min. 12 caracteres avec majuscule, minuscule, chiffre et caractere special
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-ctp-subtext1">
              Confirmer le mot de passe
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl bg-ctp-mantle border border-ctp-surface1 text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-mauve focus:ring-2 focus:ring-ctp-mauve/20 transition-all duration-200"
              placeholder="************"
              {...register('confirmPassword', {
                required: 'Confirmation requise',
                validate: (value) =>
                  value === password || 'Les mots de passe ne correspondent pas',
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
                Creation...
              </span>
            ) : (
              'Creer mon compte'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-ctp-surface1">
          <p className="text-center text-sm text-ctp-subtext0">
            Deja un compte ?{' '}
            <a href="/login" className="text-ctp-mauve hover:text-ctp-pink font-medium transition-colors">
              Se connecter
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterForm;
