// ============================================================================
// ACHIEVEMENT UNLOCKED MODAL - Finance Hub
// Celebration modal when achievement is unlocked
// ============================================================================

import { useEffect, useCallback } from 'react';
import { Trophy, Star, X } from 'lucide-react';

interface AchievementUnlockedModalProps {
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  onClose: () => void;
}

export function AchievementUnlockedModal({
  name,
  description,
  icon,
  xpReward,
  onClose,
}: AchievementUnlockedModalProps) {
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
      aria-label="Achievement Unlocked"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <Star
            key={i}
            className="absolute text-ctp-yellow animate-ping"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 1000}ms`,
              animationDuration: `${1500 + Math.random() * 1000}ms`,
              width: `${12 + Math.random() * 12}px`,
              height: `${12 + Math.random() * 12}px`,
            }}
          />
        ))}
      </div>

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-ctp-yellow/20 to-ctp-peach/20 border-2 border-ctp-yellow rounded-2xl p-6 max-w-sm w-full text-center animate-bounce-in shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-ctp-surface0"
        >
          <X className="w-5 h-5 text-ctp-subtext0" />
        </button>

        {/* Trophy */}
        <div className="relative inline-block mb-4">
          <div className="absolute inset-0 animate-ping bg-ctp-yellow/30 rounded-full" />
          <div className="relative w-20 h-20 mx-auto bg-gradient-to-br from-ctp-yellow to-ctp-peach rounded-full flex items-center justify-center">
            <Trophy className="w-10 h-10 text-ctp-base" />
          </div>
        </div>

        {/* Title */}
        <p className="text-sm text-ctp-yellow font-medium mb-1">
          Succes Debloque !
        </p>
        <h2 className="text-xl font-bold text-ctp-text mb-2">{name}</h2>

        {/* Icon */}
        <div className="text-5xl mb-3">{icon}</div>

        {/* Description */}
        <p className="text-sm text-ctp-subtext0 mb-4">{description}</p>

        {/* XP Reward */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-ctp-yellow/20 rounded-full">
          <Star className="w-5 h-5 text-ctp-yellow" />
          <span className="text-lg font-bold text-ctp-yellow">+{xpReward} XP</span>
        </div>

        {/* Continue Button */}
        <button onClick={onClose} className="btn-primary w-full mt-6">
          Continuer
        </button>
      </div>

      {/* CSS for animation */}
      <style>{`
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

        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default AchievementUnlockedModal;
