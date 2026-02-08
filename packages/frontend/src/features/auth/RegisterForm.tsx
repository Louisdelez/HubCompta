// ============================================================================
// REGISTRATION FORM - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api/client';

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
      <div className="w-full max-w-md text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold">Compte créé !</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Redirection vers la page de connexion...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <span className="text-4xl">💰</span>
        <h1 className="text-2xl font-bold mt-4">Créer un compte</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Commencez à gérer vos finances
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="displayName" className="label">
            Nom d'affichage
          </label>
          <input
            id="displayName"
            type="text"
            autoComplete="name"
            className="input"
            placeholder="Jean Dupont"
            {...register('displayName', {
              required: 'Nom requis',
              minLength: {
                value: 2,
                message: 'Le nom doit contenir au moins 2 caractères',
              },
              maxLength: {
                value: 100,
                message: 'Le nom ne peut pas dépasser 100 caractères',
              },
            })}
          />
          {errors.displayName && (
            <p className="error-text">{errors.displayName.message}</p>
          )}
        </div>

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
            autoComplete="new-password"
            className="input"
            placeholder="••••••••••••"
            {...register('password', {
              required: 'Mot de passe requis',
              validate: (value) => validatePassword(value) || true,
            })}
          />
          {errors.password && (
            <p className="error-text">{errors.password.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Min. 12 caractères avec majuscule, minuscule, chiffre et caractère spécial
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label">
            Confirmer le mot de passe
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="input"
            placeholder="••••••••••••"
            {...register('confirmPassword', {
              required: 'Confirmation requise',
              validate: (value) =>
                value === password || 'Les mots de passe ne correspondent pas',
            })}
          />
          {errors.confirmPassword && (
            <p className="error-text">{errors.confirmPassword.message}</p>
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
              Création...
            </span>
          ) : (
            'Créer mon compte'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
        Déjà un compte ?{' '}
        <a href="/login" className="link">
          Se connecter
        </a>
      </p>
    </div>
  );
}

export default RegisterForm;
