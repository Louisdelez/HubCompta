// ============================================================================
// LANGUAGE SETTINGS - Finance Hub
// Language selection component with i18n support
// ============================================================================

import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { getAvailableLanguages, changeLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;
  const languages = getAvailableLanguages();

  const handleLanguageChange = async (languageCode: string) => {
    await changeLanguage(languageCode);
  };

  return (
    <div className="bg-ctp-mantle rounded-lg shadow">
      <div className="px-6 py-4 border-b border-ctp-surface1">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-ctp-green" />
          <h2 className="text-lg font-semibold text-ctp-text">
            {t('settings.language.title')}
          </h2>
        </div>
        <p className="mt-1 text-sm text-ctp-subtext0">
          {t('settings.language.description')}
        </p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {languages.map((lang) => {
            const isSelected = currentLanguage.startsWith(lang.code);

            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => void handleLanguageChange(lang.code)}
                className={cn(
                  'relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:scale-[1.02]',
                  isSelected
                    ? 'border-ctp-green ring-2 ring-ctp-green/20 bg-ctp-green/5'
                    : 'border-ctp-surface1 hover:border-ctp-surface2 bg-ctp-base'
                )}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute -top-2 -right-2 bg-ctp-green text-ctp-base rounded-full p-1">
                    <Check className="h-3 w-3" />
                  </div>
                )}

                {/* Flag/Icon placeholder */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold',
                    isSelected
                      ? 'bg-ctp-green/20 text-ctp-green'
                      : 'bg-ctp-surface0 text-ctp-subtext1'
                  )}
                >
                  {lang.code.toUpperCase()}
                </div>

                {/* Language info */}
                <div className="flex-1 text-left">
                  <p
                    className={cn(
                      'font-medium',
                      isSelected ? 'text-ctp-green' : 'text-ctp-text'
                    )}
                  >
                    {lang.nativeName}
                  </p>
                  <p className="text-sm text-ctp-subtext0">{lang.name}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Current language info */}
        <div className="mt-4 p-3 bg-ctp-surface0 rounded-lg">
          <p className="text-sm text-ctp-subtext1">
            {t('settings.language.current')}:{' '}
            <span className="font-medium text-ctp-text">
              {languages.find((l) => currentLanguage.startsWith(l.code))?.nativeName ??
                currentLanguage}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
