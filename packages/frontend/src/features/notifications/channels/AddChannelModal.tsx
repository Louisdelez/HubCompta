// ============================================================================
// ADD CHANNEL MODAL - Finance Hub
// Modal for adding a new notification channel
// ============================================================================

import { useState } from 'react';
import {
  X,
  Mail,
  MessageCircle,
  Hash,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import {
  useAddChannel,
  type ChannelType,
  type CreateChannelInput,
} from '../hooks/useNotificationChannels';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AddChannelModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (channelId: string) => void;
  existingTypes: ChannelType[];
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AddChannelModal({ open, onClose, onSuccess, existingTypes }: AddChannelModalProps) {
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedType, setSelectedType] = useState<ChannelType | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addChannel = useAddChannel();

  const channelOptions: { type: ChannelType; label: string; description: string; icon: React.ReactNode }[] = [
    {
      type: 'email',
      label: 'Email',
      description: 'Recevez vos notifications par email',
      icon: <Mail className="h-6 w-6" />,
    },
    {
      type: 'whatsapp',
      label: 'WhatsApp',
      description: 'Recevez vos notifications sur WhatsApp',
      icon: <MessageCircle className="h-6 w-6" />,
    },
    {
      type: 'discord',
      label: 'Discord',
      description: 'Envoyez vos notifications dans un canal Discord',
      icon: <Hash className="h-6 w-6" />,
    },
  ];

  const availableOptions = channelOptions.filter((opt) => !existingTypes.includes(opt.type));

  const handleSelectType = (type: ChannelType) => {
    setSelectedType(type);
    setStep('configure');
    setError(null);
  };

  const handleBack = () => {
    setStep('select');
    setSelectedType(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedType) return;

    const input: CreateChannelInput = {
      channelType: selectedType,
    };

    switch (selectedType) {
      case 'email':
        if (!email) {
          setError('Veuillez entrer une adresse email');
          return;
        }
        input.email = email;
        break;

      case 'whatsapp':
        if (!phone) {
          setError('Veuillez entrer un numero de telephone');
          return;
        }
        input.whatsappPhone = phone;
        break;

      case 'discord':
        if (!webhookUrl) {
          setError('Veuillez entrer l\'URL du webhook');
          return;
        }
        if (!webhookUrl.includes('discord.com/api/webhooks/')) {
          setError('L\'URL doit etre un webhook Discord valide');
          return;
        }
        input.discordWebhookUrl = webhookUrl;
        break;
    }

    try {
      const result = await addChannel.mutateAsync(input);
      onSuccess(result.id);
      resetForm();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message :
        (err && typeof err === 'object' && 'message' in err) ? String(err.message) : 'Une erreur est survenue';
      setError(errorMessage);
    }
  };

  const resetForm = () => {
    setStep('select');
    setSelectedType(null);
    setEmail('');
    setPhone('');
    setWebhookUrl('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface0">
          <h2 className="text-lg font-semibold text-ctp-text">
            {step === 'select' ? 'Ajouter un canal' : `Configurer ${selectedType}`}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-ctp-surface0 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-ctp-subtext0" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'select' ? (
            <>
              {availableOptions.length === 0 ? (
                <p className="text-center text-ctp-subtext0 py-8">
                  Tous les canaux sont deja configures.
                </p>
              ) : (
                <div className="space-y-3">
                  {availableOptions.map((option) => (
                    <button
                      key={option.type}
                      onClick={() => handleSelectType(option.type)}
                      className="w-full flex items-center gap-4 p-4 bg-ctp-surface0 hover:bg-ctp-surface1 rounded-lg transition-colors text-left"
                    >
                      <div className={`p-3 rounded-lg ${
                        option.type === 'email'
                          ? 'bg-ctp-yellow/10 text-ctp-yellow'
                          : option.type === 'whatsapp'
                          ? 'bg-ctp-green/10 text-ctp-green'
                          : 'bg-ctp-lavender/10 text-ctp-lavender'
                      }`}>
                        {option.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-ctp-text">{option.label}</h3>
                        <p className="text-sm text-ctp-subtext0">{option.description}</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-ctp-subtext0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Back button */}
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-ctp-subtext0 hover:text-ctp-text transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>

              {/* Email Form */}
              {selectedType === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-ctp-subtext1 mb-2">
                    Adresse email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-4 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-lg text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-blue"
                    autoFocus
                  />
                </div>
              )}

              {/* WhatsApp Form */}
              {selectedType === 'whatsapp' && (
                <div>
                  <label className="block text-sm font-medium text-ctp-subtext1 mb-2">
                    Numero de telephone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                    className="w-full px-4 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-lg text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-green"
                    autoFocus
                  />
                  <p className="mt-2 text-xs text-ctp-subtext0">
                    Incluez l'indicatif pays (ex: +33 pour la France)
                  </p>
                </div>
              )}

              {/* Discord Form */}
              {selectedType === 'discord' && (
                <div>
                  <label className="block text-sm font-medium text-ctp-subtext1 mb-2">
                    URL du Webhook Discord
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full px-4 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-lg text-ctp-text placeholder:text-ctp-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-lavender"
                    autoFocus
                  />
                  <div className="mt-3 p-3 bg-ctp-surface0 rounded-lg">
                    <p className="text-xs text-ctp-subtext1 font-medium mb-2">
                      Comment creer un webhook Discord :
                    </p>
                    <ol className="text-xs text-ctp-subtext0 space-y-1 list-decimal list-inside">
                      <li>Ouvrez les parametres du serveur Discord</li>
                      <li>Allez dans "Integrations" puis "Webhooks"</li>
                      <li>Cliquez sur "Nouveau webhook"</li>
                      <li>Choisissez le canal et copiez l'URL</li>
                    </ol>
                    <a
                      href="https://support.discord.com/hc/fr/articles/228383668"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-ctp-blue hover:underline"
                    >
                      En savoir plus
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-sm text-ctp-red">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={addChannel.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-ctp-blue text-ctp-base font-medium rounded-lg hover:bg-ctp-sapphire disabled:opacity-50 transition-colors"
              >
                {addChannel.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ajout en cours...
                  </>
                ) : (
                  <>
                    Ajouter
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
