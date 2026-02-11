// ============================================================================
// PROFILE SETTINGS - Finance Hub
// User profile management with country selection
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Save, Loader2, Globe, Info } from 'lucide-react';
import { api } from '@/lib/api';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  country: string;
  locale: string;
  timezone: string;
  theme: string;
  createdAt: string;
}

// Country options with localized names and flags
const COUNTRY_OPTIONS = [
  { code: 'FR', name: 'France', flag: '\u{1F1EB}\u{1F1F7}', currency: 'EUR', timezone: 'Europe/Paris', locale: 'fr-FR' },
  { code: 'CH', name: 'Suisse', flag: '\u{1F1E8}\u{1F1ED}', currency: 'CHF', timezone: 'Europe/Zurich', locale: 'de-CH' },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ProfileSettings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    displayName: '',
    country: 'FR',
    locale: 'fr-FR',
    timezone: 'Europe/Paris',
    theme: 'system',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showCountryInfo, setShowCountryInfo] = useState(false);

  // Fetch profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => api.get<UserProfile>('/settings/profile'),
  });

  // Update form data when profile loads
  useEffect(() => {
    if (profile && !isEditing) {
      setFormData({
        displayName: profile.displayName || '',
        country: profile.country || 'FR',
        locale: profile.locale || 'fr-FR',
        timezone: profile.timezone || 'Europe/Paris',
        theme: profile.theme || 'system',
      });
    }
  }, [profile, isEditing]);

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => api.patch<UserProfile>('/settings/profile', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['tax'] });
      setIsEditing(false);
      setShowCountryInfo(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleCountryChange = (countryCode: string) => {
    const country = COUNTRY_OPTIONS.find(c => c.code === countryCode);
    if (country) {
      setFormData({
        ...formData,
        country: country.code,
        locale: country.locale,
        timezone: country.timezone,
      });
      setIsEditing(true);
      setShowCountryInfo(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
      </div>
    );
  }

  const selectedCountry = COUNTRY_OPTIONS.find(c => c.code === formData.country);

  return (
    <div className="bg-ctp-mantle rounded-lg shadow">
      <div className="px-6 py-4 border-b border-ctp-surface1">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-ctp-blue" />
          <h2 className="text-lg font-semibold text-ctp-text">Profil</h2>
        </div>
        <p className="mt-1 text-sm text-ctp-subtext0">
          Gerez vos informations personnelles
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
            Email
          </label>
          <input
            type="email"
            value={profile?.email || ''}
            disabled
            className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-surface0 text-ctp-subtext0 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-ctp-subtext0">L'email ne peut pas etre modifie</p>
        </div>

        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
            Nom d'affichage
          </label>
          <input
            type="text"
            value={formData.displayName}
            onChange={(e) => {
              setFormData({ ...formData, displayName: e.target.value });
              setIsEditing(true);
            }}
            placeholder="Votre nom"
            className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
          />
        </div>

        {/* Country Selection - Important! */}
        <div className="border-2 border-ctp-blue/30 rounded-lg p-4 bg-ctp-blue/5">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-5 w-5 text-ctp-blue" />
            <label className="text-sm font-medium text-ctp-text">
              Pays de residence fiscale
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {COUNTRY_OPTIONS.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => handleCountryChange(country.code)}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  formData.country === country.code
                    ? 'border-ctp-blue bg-ctp-blue/10 shadow-md'
                    : 'border-ctp-surface1 hover:border-ctp-blue/50 bg-ctp-base'
                }`}
              >
                <span className="text-2xl">{country.flag}</span>
                <div className="text-left">
                  <span className="font-medium text-ctp-text block">{country.name}</span>
                  <span className="text-xs text-ctp-subtext0">{country.currency}</span>
                </div>
                {formData.country === country.code && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-ctp-blue" />
                )}
              </button>
            ))}
          </div>

          {/* Country change info */}
          {showCountryInfo && (
            <div className="mt-4 p-3 rounded-lg bg-ctp-yellow/10 border border-ctp-yellow/30">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-ctp-yellow mt-0.5 flex-shrink-0" />
                <div className="text-sm text-ctp-yellow">
                  <p className="font-medium mb-1">Changement de pays</p>
                  <p className="text-ctp-subtext0">
                    Cela affectera les calculs fiscaux, les taux de TVA et les categories de deductions.
                    {selectedCountry?.code === 'CH' && (
                      <span className="block mt-1">
                        <strong>Suisse:</strong> TVA 8.1%, Pilier 3a, QR-facture
                      </span>
                    )}
                    {selectedCountry?.code === 'FR' && (
                      <span className="block mt-1">
                        <strong>France:</strong> TVA 20%, Bareme progressif, SEPA
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Locale */}
        <div>
          <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
            Langue
          </label>
          <select
            value={formData.locale}
            onChange={(e) => {
              setFormData({ ...formData, locale: e.target.value });
              setIsEditing(true);
            }}
            className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
          >
            <option value="fr-FR">Francais (France)</option>
            <option value="fr-CH">Francais (Suisse)</option>
            <option value="de-CH">Deutsch (Schweiz)</option>
            <option value="it-CH">Italiano (Svizzera)</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="de-DE">Deutsch</option>
            <option value="es-ES">Espanol</option>
          </select>
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
            Fuseau horaire
          </label>
          <select
            value={formData.timezone}
            onChange={(e) => {
              setFormData({ ...formData, timezone: e.target.value });
              setIsEditing(true);
            }}
            className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
          >
            <option value="Europe/Paris">Europe/Paris (CET)</option>
            <option value="Europe/Zurich">Europe/Zurich (CET)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="Europe/Berlin">Europe/Berlin (CET)</option>
            <option value="America/New_York">America/New_York (EST)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
          </select>
        </div>

        {/* Theme */}
        <div>
          <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
            Theme
          </label>
          <select
            value={formData.theme}
            onChange={(e) => {
              setFormData({ ...formData, theme: e.target.value });
              setIsEditing(true);
            }}
            className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
          >
            <option value="system">Systeme</option>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </div>

        {/* Account created */}
        <div className="pt-4 border-t border-ctp-surface1">
          <p className="text-sm text-ctp-subtext0">
            Compte cree le{' '}
            {profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : '-'}
          </p>
        </div>

        {/* Submit */}
        {isEditing && (
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setFormData({
                  displayName: profile?.displayName || '',
                  country: profile?.country || 'FR',
                  locale: profile?.locale || 'fr-FR',
                  timezone: profile?.timezone || 'Europe/Paris',
                  theme: profile?.theme || 'system',
                });
                setIsEditing(false);
                setShowCountryInfo(false);
              }}
              className="px-4 py-2 text-sm font-medium text-ctp-subtext1 hover:bg-ctp-surface0 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-ctp-blue text-ctp-base text-sm font-medium rounded-lg hover:bg-ctp-sapphire disabled:opacity-50 transition-colors"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
