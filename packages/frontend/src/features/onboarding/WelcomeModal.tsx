// ============================================================================
// WELCOME MODAL - Finance Hub
// Initial welcome screen for new users
// ============================================================================

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Wallet,
  PiggyBank,
  LineChart,
  Shield,
  Sparkles,
  ArrowRight,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WelcomeModalProps {
  isOpen: boolean;
  onStartTour: () => void;
  onSkip: () => void;
  userName: string | undefined;
}

// ----------------------------------------------------------------------------
// Feature cards data
// ----------------------------------------------------------------------------

const features = [
  {
    icon: PiggyBank,
    title: 'Budgets intelligents',
    description: 'Controlez vos depenses avec des alertes personnalisees',
    color: 'text-ctp-green',
    bgColor: 'bg-ctp-green/10',
  },
  {
    icon: LineChart,
    title: 'Analyses detaillees',
    description: 'Visualisez vos finances avec des graphiques clairs',
    color: 'text-ctp-blue',
    bgColor: 'bg-ctp-blue/10',
  },
  {
    icon: Shield,
    title: 'Securite maximale',
    description: 'Vos donnees sont chiffrees et protegees',
    color: 'text-ctp-mauve',
    bgColor: 'bg-ctp-mauve/10',
  },
  {
    icon: Sparkles,
    title: 'Import automatique',
    description: 'Importez vos releves bancaires en un clic',
    color: 'text-ctp-peach',
    bgColor: 'bg-ctp-peach/10',
  },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function WelcomeModal({
  isOpen,
  onStartTour,
  onSkip,
  userName,
}: WelcomeModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onSkip();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSkip]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else {
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const displayName = userName?.split(' ')[0] || 'utilisateur';

  const modalContent = (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onSkip}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={clsx(
          'relative bg-ctp-mantle rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden',
          'animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300'
        )}
      >
        {/* Close button */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 p-2 rounded-lg text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0 transition-colors z-10"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-ctp-blue/20 via-ctp-sapphire/10 to-ctp-teal/20 px-8 pt-10 pb-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-ctp-blue flex items-center justify-center shadow-lg shadow-ctp-blue/30 animate-in zoom-in duration-500 delay-100">
              <Wallet className="w-10 h-10 text-ctp-crust" />
            </div>
          </div>

          {/* Welcome text */}
          <div className="text-center">
            <h2
              id="welcome-title"
              className="text-2xl font-bold text-ctp-text mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150"
            >
              Bienvenue, {displayName}!
            </h2>
            <p className="text-ctp-subtext1 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-200">
              Finance Hub est pret a vous aider a maitriser vos finances.
            </p>
          </div>
        </div>

        {/* Features grid */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-2 gap-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={clsx(
                    'p-3 rounded-xl bg-ctp-surface0 border border-ctp-surface1',
                    'animate-in fade-in slide-in-from-bottom-2 duration-300',
                  )}
                  style={{ animationDelay: `${250 + index * 50}ms` }}
                >
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-2', feature.bgColor)}>
                    <Icon className={clsx('w-4 h-4', feature.color)} />
                  </div>
                  <h3 className="text-sm font-medium text-ctp-text mb-0.5">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-ctp-subtext0 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={onStartTour}
            className={clsx(
              'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl',
              'bg-ctp-blue hover:bg-ctp-sapphire text-ctp-crust font-medium',
              'transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
              'animate-in fade-in slide-in-from-bottom-2 duration-300 delay-500'
            )}
          >
            Decouvrir Finance Hub
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onSkip}
            className={clsx(
              'w-full px-6 py-2.5 rounded-xl text-sm',
              'text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0',
              'transition-colors duration-200',
              'animate-in fade-in duration-300 delay-550'
            )}
          >
            Je connais deja, passer le tutoriel
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default WelcomeModal;
