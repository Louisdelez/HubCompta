// ============================================================================
// CHANNEL CARD - Finance Hub
// Display a notification channel with status and actions
// ============================================================================

import { useState } from 'react';
import {
  Mail,
  MessageCircle,
  Hash,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  Trash2,
  Settings,
  Send,
  Power,
} from 'lucide-react';
import type { NotificationChannel } from '../hooks/useNotificationChannels';
import {
  useDeleteChannel,
  useTestChannel,
  useUpdateChannel,
  isChannelVerified,
  getChannelLabel,
} from '../hooks/useNotificationChannels';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ChannelCardProps {
  channel: NotificationChannel;
  onVerify: (channelId: string) => void;
  onEditPreferences: (channelId: string) => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ChannelCard({ channel, onVerify, onEditPreferences }: ChannelCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const deleteChannel = useDeleteChannel();
  const testChannel = useTestChannel();
  const updateChannel = useUpdateChannel(channel.id);

  const verified = isChannelVerified(channel);
  const label = getChannelLabel(channel.channelType);

  // Get the target display value
  const getTargetDisplay = () => {
    switch (channel.channelType) {
      case 'email':
        return channel.email;
      case 'whatsapp':
        return channel.whatsappPhone;
      case 'discord':
        return channel.discordWebhookUrl ? 'Webhook configure' : null;
      default:
        return null;
    }
  };

  // Get channel icon
  const ChannelIcon = () => {
    switch (channel.channelType) {
      case 'email':
        return <Mail className="h-6 w-6" />;
      case 'whatsapp':
        return <MessageCircle className="h-6 w-6" />;
      case 'discord':
        return <Hash className="h-6 w-6" />;
      default:
        return <Mail className="h-6 w-6" />;
    }
  };

  // Get channel color class
  const getColorClass = () => {
    switch (channel.channelType) {
      case 'email':
        return 'text-ctp-yellow bg-ctp-yellow/10';
      case 'whatsapp':
        return 'text-ctp-green bg-ctp-green/10';
      case 'discord':
        return 'text-ctp-lavender bg-ctp-lavender/10';
      default:
        return 'text-ctp-blue bg-ctp-blue/10';
    }
  };

  const handleDelete = async () => {
    if (confirm(`Voulez-vous vraiment supprimer ce canal ${label} ?`)) {
      try {
        await deleteChannel.mutateAsync(channel.id);
      } catch {
        // Error handled by mutation
      }
    }
    setShowMenu(false);
  };

  const handleTest = async () => {
    try {
      await testChannel.mutateAsync(channel.id);
      alert('Message de test envoye !');
    } catch {
      alert('Erreur lors de l\'envoi du message de test');
    }
    setShowMenu(false);
  };

  const handleToggleActive = async () => {
    try {
      await updateChannel.mutateAsync({ isActive: !channel.isActive });
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="bg-ctp-mantle rounded-lg shadow p-4">
      <div className="flex items-start justify-between">
        {/* Channel Info */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${getColorClass()}`}>
            <ChannelIcon />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-ctp-text">{label}</h3>
              {verified ? (
                <span className="flex items-center gap-1 text-xs text-ctp-green">
                  <CheckCircle className="h-3 w-3" />
                  Verifie
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-ctp-peach">
                  <AlertCircle className="h-3 w-3" />
                  Non verifie
                </span>
              )}
            </div>

            <p className="text-sm text-ctp-subtext0 mt-1">{getTargetDisplay()}</p>

            {/* Status */}
            <div className="flex items-center gap-4 mt-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  channel.isActive
                    ? 'bg-ctp-green/10 text-ctp-green'
                    : 'bg-ctp-surface0 text-ctp-subtext0'
                }`}
              >
                {channel.isActive ? 'Actif' : 'Inactif'}
              </span>
              <span className="text-xs text-ctp-subtext0">
                {channel.enabledTypes.length} type(s) actif(s)
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-ctp-surface0 rounded-lg transition-colors"
          >
            <MoreVertical className="h-5 w-5 text-ctp-subtext0" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-ctp-surface0 rounded-lg shadow-lg border border-ctp-surface1 z-20">
                {!verified && (
                  <button
                    onClick={() => {
                      onVerify(channel.id);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-ctp-text hover:bg-ctp-surface1 transition-colors"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Verifier
                  </button>
                )}

                <button
                  onClick={() => {
                    onEditPreferences(channel.id);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-ctp-text hover:bg-ctp-surface1 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Preferences
                </button>

                {verified && channel.isActive && (
                  <button
                    onClick={handleTest}
                    disabled={testChannel.isPending}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-ctp-text hover:bg-ctp-surface1 transition-colors disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Tester
                  </button>
                )}

                {verified && (
                  <button
                    onClick={handleToggleActive}
                    disabled={updateChannel.isPending}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-ctp-text hover:bg-ctp-surface1 transition-colors disabled:opacity-50"
                  >
                    <Power className="h-4 w-4" />
                    {channel.isActive ? 'Desactiver' : 'Activer'}
                  </button>
                )}

                <div className="border-t border-ctp-surface1" />

                <button
                  onClick={handleDelete}
                  disabled={deleteChannel.isPending}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-ctp-red hover:bg-ctp-surface1 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
