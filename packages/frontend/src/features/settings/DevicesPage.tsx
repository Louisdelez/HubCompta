// ============================================================================
// DEVICES PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Smartphone, Laptop, Monitor, X, Pencil, Lock, Unlock, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import type { LucideIcon } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Device {
  id: string;
  name: string;
  fingerprint: string;
  isTrusted: boolean;
  lastUsedAt: string;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DevicesPage() {
  const queryClient = useQueryClient();
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Fetch devices
  const { data: devices, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get<Device[]>('/user/devices'),
  });

  // Revoke device mutation
  const revokeMutation = useMutation({
    mutationFn: (deviceId: string) => api.delete(`/user/devices/${deviceId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  // Trust/untrust device mutation
  const trustMutation = useMutation({
    mutationFn: ({ deviceId, trust }: { deviceId: string; trust: boolean }) =>
      api.patch(`/user/devices/${deviceId}/${trust ? 'trust' : 'untrust'}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  // Rename device mutation
  const renameMutation = useMutation({
    mutationFn: ({ deviceId, name }: { deviceId: string; name: string }) =>
      api.patch(`/user/devices/${deviceId}/rename`, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      setSelectedDevice(null);
      setRenameValue('');
    },
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeviceIcon = (name: string): LucideIcon => {
    const lower = name.toLowerCase();
    if (lower.includes('iphone') || lower.includes('android')) return Smartphone;
    if (lower.includes('ipad') || lower.includes('tablet')) return Smartphone;
    if (lower.includes('mac')) return Laptop;
    if (lower.includes('windows')) return Monitor;
    if (lower.includes('linux')) return Monitor;
    return Monitor;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-ctp-surface1 rounded w-1/3" />
          <div className="h-24 bg-ctp-surface1 rounded" />
          <div className="h-24 bg-ctp-surface1 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-ctp-text">Appareils connectés</h1>
      <p className="text-ctp-subtext0 mb-6">
        Gérez les appareils ayant accès à votre compte
      </p>

      <div className="space-y-3">
        {devices?.map((device) => (
          <div
            key={device.id}
            className="card flex items-start gap-4"
          >
            {(() => { const Icon = getDeviceIcon(device.name); return <Icon className="w-6 h-6 text-ctp-subtext0" />; })()}

            <div className="flex-1 min-w-0">
              {selectedDevice === device.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="input flex-1"
                    placeholder="Nouveau nom"
                    autoFocus
                  />
                  <button
                    onClick={() =>
                      renameMutation.mutate({ deviceId: device.id, name: renameValue })
                    }
                    className="btn-primary"
                    disabled={!renameValue.trim()}
                  >
                    OK
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDevice(null);
                      setRenameValue('');
                    }}
                    className="btn-secondary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-ctp-text">{device.name}</h3>
                    {device.isTrusted && (
                      <span className="badge-success">Fiable</span>
                    )}
                  </div>
                  <p className="text-sm text-ctp-subtext0">
                    Dernière utilisation: {formatDate(device.lastUsedAt)}
                  </p>
                </>
              )}
            </div>

            {selectedDevice !== device.id && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedDevice(device.id);
                    setRenameValue(device.name);
                  }}
                  className="btn-ghost text-sm"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                <button
                  onClick={() =>
                    trustMutation.mutate({
                      deviceId: device.id,
                      trust: !device.isTrusted,
                    })
                  }
                  className="btn-ghost text-sm"
                  title={device.isTrusted ? 'Retirer la confiance' : 'Marquer comme fiable'}
                >
                  {device.isTrusted ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => {
                    if (confirm('Voulez-vous vraiment révoquer cet appareil ?')) {
                      revokeMutation.mutate(device.id);
                    }
                  }}
                  className="btn-ghost text-sm text-ctp-red hover:bg-ctp-red/10"
                  title="Révoquer l'accès"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}

        {(!devices || devices.length === 0) && (
          <div className="text-center py-8 text-ctp-subtext0">
            Aucun appareil connecté
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-ctp-surface0 rounded-lg">
        <h3 className="font-medium mb-2 text-ctp-text">À propos des appareils</h3>
        <ul className="text-sm text-ctp-subtext0 space-y-1">
          <li>• Les appareils fiables bénéficient de vérifications de sécurité réduites</li>
          <li>• La révocation d'un appareil déconnecte toutes ses sessions</li>
          <li>• Un maximum de 10 appareils peut être connecté simultanément</li>
        </ul>
      </div>
    </div>
  );
}

export default DevicesPage;
