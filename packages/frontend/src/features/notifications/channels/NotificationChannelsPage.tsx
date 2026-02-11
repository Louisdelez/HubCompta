// ============================================================================
// NOTIFICATION CHANNELS PAGE - Finance Hub
// Main page for managing multi-channel notifications
// ============================================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Plus,
  Loader2,
  ArrowLeft,
  Mail,
  MessageCircle,
  Hash,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import {
  useNotificationChannels,
  type NotificationChannel,
  type ChannelType,
} from '../hooks/useNotificationChannels';
import { ChannelCard } from './ChannelCard';
import { AddChannelModal } from './AddChannelModal';
import { VerificationModal } from './VerificationModal';
import { ChannelPreferences } from './ChannelPreferences';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function NotificationChannelsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [verifyingChannel, setVerifyingChannel] = useState<NotificationChannel | null>(null);
  const [editingPreferencesChannel, setEditingPreferencesChannel] = useState<NotificationChannel | null>(null);
  const [pendingVerificationChannelId, setPendingVerificationChannelId] = useState<string | null>(null);

  const { data: channels, isLoading, error } = useNotificationChannels();

  const existingTypes = channels?.map((c) => c.channelType) ?? [];

  // Watch for the new channel to appear after adding
  useEffect(() => {
    if (pendingVerificationChannelId && channels) {
      const newChannel = channels.find((c) => c.id === pendingVerificationChannelId);
      if (newChannel) {
        setVerifyingChannel(newChannel);
        setPendingVerificationChannelId(null);
      }
    }
  }, [pendingVerificationChannelId, channels]);

  const handleAddSuccess = (channelId: string) => {
    setShowAddModal(false);
    // Set pending verification - the effect will open the modal when data is refreshed
    setPendingVerificationChannelId(channelId);
  };

  const handleVerify = (channelId: string) => {
    const channel = channels?.find((c) => c.id === channelId);
    if (channel) {
      setVerifyingChannel(channel);
    }
  };

  const handleEditPreferences = (channelId: string) => {
    const channel = channels?.find((c) => c.id === channelId);
    if (channel) {
      setEditingPreferencesChannel(channel);
    }
  };

  const handleVerificationSuccess = () => {
    setVerifyingChannel(null);
  };

  // Stats
  const activeChannels = channels?.filter((c) => c.isActive).length ?? 0;
  const pendingVerification = channels?.filter((c) => !c.isActive).length ?? 0;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-sm text-ctp-subtext0 hover:text-ctp-text mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux parametres
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-ctp-blue/10 rounded-lg">
              <Bell className="h-6 w-6 text-ctp-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ctp-text">
                Canaux de notification
              </h1>
              <p className="text-ctp-subtext0">
                Configurez comment recevoir vos notifications
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-ctp-blue text-ctp-base font-medium rounded-lg hover:bg-ctp-sapphire transition-colors"
          >
            <Plus className="h-5 w-5" />
            Ajouter un canal
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-ctp-mantle rounded-lg p-4">
          <div className="flex items-center gap-2 text-ctp-subtext0 mb-1">
            <CheckCircle className="h-4 w-4 text-ctp-green" />
            <span className="text-sm">Actifs</span>
          </div>
          <p className="text-2xl font-bold text-ctp-text">{activeChannels}</p>
        </div>

        <div className="bg-ctp-mantle rounded-lg p-4">
          <div className="flex items-center gap-2 text-ctp-subtext0 mb-1">
            <AlertCircle className="h-4 w-4 text-ctp-peach" />
            <span className="text-sm">A verifier</span>
          </div>
          <p className="text-2xl font-bold text-ctp-text">{pendingVerification}</p>
        </div>

        <div className="bg-ctp-mantle rounded-lg p-4">
          <div className="flex items-center gap-2 text-ctp-subtext0 mb-1">
            <Mail className="h-4 w-4 text-ctp-yellow" />
            <span className="text-sm">Email</span>
          </div>
          <p className="text-lg font-medium text-ctp-text">
            {channels?.some((c) => c.channelType === 'email' && c.isActive)
              ? 'Configure'
              : 'Non configure'}
          </p>
        </div>

        <div className="bg-ctp-mantle rounded-lg p-4">
          <div className="flex items-center gap-2 text-ctp-subtext0 mb-1">
            <MessageCircle className="h-4 w-4 text-ctp-green" />
            <span className="text-sm">WhatsApp</span>
          </div>
          <p className="text-lg font-medium text-ctp-text">
            {channels?.some((c) => c.channelType === 'whatsapp' && c.isActive)
              ? 'Configure'
              : 'Non configure'}
          </p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
        </div>
      ) : error ? (
        <div className="bg-ctp-red/10 text-ctp-red rounded-lg p-4 text-center">
          Erreur lors du chargement des canaux
        </div>
      ) : channels && channels.length > 0 ? (
        <div className="space-y-4">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onVerify={handleVerify}
              onEditPreferences={handleEditPreferences}
            />
          ))}
        </div>
      ) : (
        <EmptyState onAdd={() => setShowAddModal(true)} />
      )}

      {/* Info Box */}
      <div className="mt-8 bg-ctp-surface0 rounded-lg p-4">
        <h3 className="font-medium text-ctp-text mb-2">
          A propos des canaux de notification
        </h3>
        <ul className="text-sm text-ctp-subtext0 space-y-2">
          <li className="flex items-start gap-2">
            <Mail className="h-4 w-4 mt-0.5 text-ctp-yellow shrink-0" />
            <span>
              <strong className="text-ctp-subtext1">Email</strong> - Recevez des notifications detaillees dans votre boite mail
            </span>
          </li>
          <li className="flex items-start gap-2">
            <MessageCircle className="h-4 w-4 mt-0.5 text-ctp-green shrink-0" />
            <span>
              <strong className="text-ctp-subtext1">WhatsApp</strong> - Alertes instantanees sur votre telephone
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Hash className="h-4 w-4 mt-0.5 text-ctp-lavender shrink-0" />
            <span>
              <strong className="text-ctp-subtext1">Discord</strong> - Integrez vos notifications dans un serveur Discord
            </span>
          </li>
        </ul>
      </div>

      {/* Modals */}
      <AddChannelModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
        existingTypes={existingTypes as ChannelType[]}
      />

      <VerificationModal
        open={!!verifyingChannel}
        channel={verifyingChannel}
        onClose={() => setVerifyingChannel(null)}
        onSuccess={handleVerificationSuccess}
      />

      <ChannelPreferences
        open={!!editingPreferencesChannel}
        channel={editingPreferencesChannel}
        onClose={() => setEditingPreferencesChannel(null)}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Empty State
// ----------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-ctp-mantle rounded-lg p-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-ctp-surface0 rounded-full flex items-center justify-center">
        <Bell className="h-8 w-8 text-ctp-subtext0" />
      </div>

      <h3 className="text-lg font-medium text-ctp-text mb-2">
        Aucun canal configure
      </h3>
      <p className="text-ctp-subtext0 mb-6 max-w-sm mx-auto">
        Ajoutez des canaux pour recevoir vos alertes et rapports financiers par email, WhatsApp ou Discord.
      </p>

      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-6 py-3 bg-ctp-blue text-ctp-base font-medium rounded-lg hover:bg-ctp-sapphire transition-colors"
      >
        <Plus className="h-5 w-5" />
        Ajouter votre premier canal
      </button>

      {/* Channel icons */}
      <div className="flex items-center justify-center gap-6 mt-8 pt-6 border-t border-ctp-surface0">
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 bg-ctp-yellow/10 rounded-lg">
            <Mail className="h-6 w-6 text-ctp-yellow" />
          </div>
          <span className="text-xs text-ctp-subtext0">Email</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="p-3 bg-ctp-green/10 rounded-lg">
            <MessageCircle className="h-6 w-6 text-ctp-green" />
          </div>
          <span className="text-xs text-ctp-subtext0">WhatsApp</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="p-3 bg-ctp-lavender/10 rounded-lg">
            <Hash className="h-6 w-6 text-ctp-lavender" />
          </div>
          <span className="text-xs text-ctp-subtext0">Discord</span>
        </div>
      </div>
    </div>
  );
}
