// ============================================================================
// LANGUAGE SETTINGS - Finance Hub
// Language selection component with i18n support for 10 languages
// ============================================================================

import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { getAvailableLanguages, getLanguagesByRegion, changeLanguage, type LanguageCode } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Region Labels
// ----------------------------------------------------------------------------

const regionLabels: Record<string, { en: string; native: string }> = {
  western: { en: 'Western Europe', native: 'Western Europe' },
  southern: { en: 'Southern Europe', native: 'Southern Europe' },
  eastern: { en: 'Eastern Europe', native: 'Eastern Europe' },
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language?.split('-')[0] as LanguageCode;
  const languagesByRegion = getLanguagesByRegion();
  const allLanguages = getAvailableLanguages();

  const handleLanguageChange = async (languageCode: LanguageCode) => {
    await changeLanguage(languageCode);
  };

  const currentLangInfo = allLanguages.find((l) => l.code === currentLanguage);

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

      <div className="p-6 space-y-6">
        {/* Languages grouped by region */}
        {Object.entries(languagesByRegion).map(([region, languages]) => (
          languages.length > 0 && (
            <div key={region}>
              <h3 className="text-sm font-medium text-ctp-subtext1 mb-3">
                {regionLabels[region]?.en ?? region}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {languages.map((lang) => {
                  const isSelected = currentLanguage === lang.code;

                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => void handleLanguageChange(lang.code)}
                      className={cn(
                        'relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all hover:scale-[1.02]',
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

                      {/* Flag */}
                      <span className="text-2xl" role="img" aria-label={lang.name}>
                        {lang.flag}
                      </span>

                      {/* Language info */}
                      <div className="flex-1 text-left min-w-0">
                        <p
                          className={cn(
                            'font-medium truncate',
                            isSelected ? 'text-ctp-green' : 'text-ctp-text'
                          )}
                        >
                          {lang.nativeName}
                        </p>
                        <p className="text-xs text-ctp-subtext0 truncate">{lang.name}</p>
                      </div>

                      {/* Language code badge */}
                      <div
                        className={cn(
                          'px-2 py-0.5 text-xs font-mono rounded',
                          isSelected
                            ? 'bg-ctp-green/20 text-ctp-green'
                            : 'bg-ctp-surface0 text-ctp-subtext1'
                        )}
                      >
                        {lang.code.toUpperCase()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ))}

        {/* Current language info */}
        <div className="mt-4 p-3 bg-ctp-surface0 rounded-lg">
          <p className="text-sm text-ctp-subtext1">
            {t('settings.language.current')}:{' '}
            <span className="font-medium text-ctp-text">
              {currentLangInfo?.flag} {currentLangInfo?.nativeName ?? currentLanguage}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
