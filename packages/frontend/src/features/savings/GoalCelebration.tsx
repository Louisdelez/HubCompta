// ============================================================================
// GOAL CELEBRATION - Finance Hub
// Confetti animation when savings goal is reached
// ============================================================================

import { useEffect, useCallback } from 'react';
import { Trophy, PartyPopper, Sparkles } from 'lucide-react';

interface GoalCelebrationProps {
  goalName: string;
  amount: number;
  currency: string;
  onClose: () => void;
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Confetti particle component
function ConfettiParticle({
  delay,
  left,
  color,
}: {
  delay: number;
  left: number;
  color: string;
}) {
  return (
    <div
      className="absolute w-3 h-3 rounded-sm animate-confetti"
      style={{
        left: `${left}%`,
        backgroundColor: color,
        animationDelay: `${delay}ms`,
        animationDuration: `${2000 + Math.random() * 1000}ms`,
      }}
    />
  );
}

export function GoalCelebration({
  goalName,
  amount,
  currency,
  onClose,
}: GoalCelebrationProps) {
  const colors = [
    '#89b4fa', // blue
    '#a6e3a1', // green
    '#f9e2af', // yellow
    '#f38ba8', // red
    '#cba6f7', // mauve
    '#fab387', // peach
    '#94e2d5', // teal
  ];

  const confettiParticles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 500,
    left: Math.random() * 100,
    color: colors[Math.floor(Math.random() * colors.length)]!,
  }));

  // Auto-close after 5 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Celebration"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confettiParticles.map((particle) => (
          <ConfettiParticle key={particle.id} {...particle} />
        ))}
      </div>

      {/* Celebration Card */}
      <div className="relative bg-gradient-to-br from-ctp-green/20 to-ctp-teal/20 border-2 border-ctp-green rounded-2xl p-8 max-w-md w-full text-center animate-bounce-in shadow-2xl">
        {/* Trophy Icon */}
        <div className="relative inline-block mb-4">
          <div className="absolute inset-0 animate-ping bg-ctp-yellow/30 rounded-full" />
          <div className="relative w-24 h-24 mx-auto bg-gradient-to-br from-ctp-yellow to-ctp-peach rounded-full flex items-center justify-center">
            <Trophy className="w-12 h-12 text-ctp-base" />
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <PartyPopper className="w-6 h-6 text-ctp-yellow animate-bounce" />
          <h2 className="text-2xl font-bold text-ctp-text">Objectif Atteint !</h2>
          <PartyPopper className="w-6 h-6 text-ctp-yellow animate-bounce" style={{ transform: 'scaleX(-1)' }} />
        </div>

        {/* Goal Name */}
        <p className="text-xl font-semibold text-ctp-green mb-4">
          {goalName}
        </p>

        {/* Amount */}
        <div className="bg-ctp-surface0 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-ctp-yellow" />
            <span className="text-3xl font-bold text-ctp-green">
              {formatCurrency(amount, currency)}
            </span>
            <Sparkles className="w-5 h-5 text-ctp-yellow" />
          </div>
          <p className="text-sm text-ctp-subtext0 mt-1">
            Vous avez atteint votre objectif !
          </p>
        </div>

        {/* Message */}
        <p className="text-ctp-subtext1 mb-6">
          Felicitations pour votre discipline et votre perseverance.
          Continuez sur cette lancee !
        </p>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="btn-primary w-full"
        >
          Continuer
        </button>
      </div>

      {/* CSS for confetti animation */}
      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes bounce-in {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-confetti {
          animation: confetti linear forwards;
        }

        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default GoalCelebration;
