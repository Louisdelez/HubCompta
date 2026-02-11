// ============================================================================
// VERIFICATION MODAL - Finance Hub
// Modal for verifying a notification channel with OTP
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import {
  useSendVerification,
  useVerifyChannel,
  type NotificationChannel,
  getChannelLabel,
} from '../hooks/useNotificationChannels';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface VerificationModalProps {
  open: boolean;
  channel: NotificationChannel | null;
  onClose: () => void;
  onSuccess: () => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function VerificationModal({ open, channel, onClose, onSuccess }: VerificationModalProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const sendVerification = useSendVerification();
  const verifyChannel = useVerifyChannel();

  // Reset state when modal opens
  useEffect(() => {
    if (open && channel) {
      setCode(['', '', '', '', '', '']);
      setError(null);
      setCodeSent(false);
      setResendCountdown(0);
    }
  }, [open, channel]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown <= 0) return;

    const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleSendCode = async () => {
    if (!channel) return;

    setError(null);
    try {
      await sendVerification.mutateAsync(channel.id);
      setCodeSent(true);
      setResendCountdown(60); // 60 seconds before can resend
      // Focus first input
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi du code');
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (digit && index === 5 && newCode.every((d) => d)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (codeString: string) => {
    if (!channel) return;

    setError(null);
    try {
      await verifyChannel.mutateAsync({ channelId: channel.id, code: codeString });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide ou expire');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  if (!open || !channel) return null;

  const label = getChannelLabel(channel.channelType);
  const target =
    channel.channelType === 'email'
      ? channel.email
      : channel.channelType === 'whatsapp'
      ? channel.whatsappPhone
      : 'votre canal Discord';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface0">
          <h2 className="text-lg font-semibold text-ctp-text">
            Verifier {label}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-ctp-surface0 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-ctp-subtext0" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!codeSent ? (
            // Step 1: Send verification code
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-ctp-blue/10 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-ctp-blue" />
              </div>

              <h3 className="text-lg font-medium text-ctp-text mb-2">
                Verifier votre canal
              </h3>
              <p className="text-sm text-ctp-subtext0 mb-6">
                Nous allons envoyer un code de verification a {target}
              </p>

              {error && (
                <p className="text-sm text-ctp-red mb-4">{error}</p>
              )}

              <button
                onClick={handleSendCode}
                disabled={sendVerification.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-ctp-blue text-ctp-base font-medium rounded-lg hover:bg-ctp-sapphire disabled:opacity-50 transition-colors"
              >
                {sendVerification.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  'Envoyer le code'
                )}
              </button>
            </div>
          ) : (
            // Step 2: Enter verification code
            <div className="text-center">
              <h3 className="text-lg font-medium text-ctp-text mb-2">
                Entrez le code
              </h3>
              <p className="text-sm text-ctp-subtext0 mb-6">
                Un code a 6 chiffres a ete envoye a {target}
              </p>

              {/* Code inputs */}
              <div
                className="flex justify-center gap-2 mb-6"
                onPaste={handlePaste}
              >
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold bg-ctp-surface0 border-2 border-ctp-surface1 rounded-lg text-ctp-text focus:outline-none focus:border-ctp-blue transition-colors"
                    disabled={verifyChannel.isPending}
                  />
                ))}
              </div>

              {error && (
                <p className="text-sm text-ctp-red mb-4">{error}</p>
              )}

              {/* Resend button */}
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-ctp-subtext0">Pas recu de code ?</span>
                {resendCountdown > 0 ? (
                  <span className="text-ctp-subtext0">
                    Renvoyer dans {resendCountdown}s
                  </span>
                ) : (
                  <button
                    onClick={handleSendCode}
                    disabled={sendVerification.isPending}
                    className="flex items-center gap-1 text-ctp-blue hover:text-ctp-sapphire transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Renvoyer
                  </button>
                )}
              </div>

              {verifyChannel.isPending && (
                <div className="flex items-center justify-center gap-2 mt-4 text-ctp-subtext0">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verification...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
