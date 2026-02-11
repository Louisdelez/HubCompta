// ============================================================================
// USE PUSH NOTIFICATIONS HOOK - HubCompta
// Hook for managing Web Push notification subscriptions
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
} from '@/lib/pwa/register';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface PushSubscription {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface PushStatus {
  isConfigured: boolean;
  isSubscribed: boolean;
  subscriptionCount: number;
  devices: Array<{
    id: string;
    deviceName: string;
    lastUsedAt: string | null;
  }>;
}

export interface UsePushNotificationsResult {
  // Status
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  subscriptions: PushSubscription[];
  status: PushStatus | null;
  isLoading: boolean;

  // Actions
  requestPermission: () => Promise<NotificationPermission>;
  subscribe: (deviceName?: string) => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  unsubscribeDevice: (subscriptionId: string) => Promise<boolean>;
  sendTest: () => Promise<boolean>;

  // Mutation states
  isSubscribing: boolean;
  isUnsubscribing: boolean;
  isSendingTest: boolean;
}

// ----------------------------------------------------------------------------
// API Functions
// ----------------------------------------------------------------------------

async function fetchVapidPublicKey(): Promise<string> {
  const response = await api.get<{ publicKey: string }>(
    '/notifications/push/vapid-public-key'
  );
  return response.publicKey;
}

async function fetchPushStatus(): Promise<PushStatus> {
  const response = await api.get<PushStatus>(
    '/notifications/push/status'
  );
  return response;
}

async function fetchSubscriptions(): Promise<PushSubscription[]> {
  const response = await api.get<PushSubscription[]>(
    '/notifications/push/subscriptions'
  );
  return response;
}

async function subscribeToPush(
  subscription: PushSubscriptionJSON,
  deviceName?: string
): Promise<{ id: string }> {
  const response = await api.post<{ id: string }>(
    '/notifications/push/subscribe',
    {
      subscription: {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      deviceName,
    }
  );
  return response;
}

async function unsubscribeFromPush(endpoint: string): Promise<void> {
  await api.post('/notifications/push/unsubscribe', { endpoint });
}

async function unsubscribeDevice(subscriptionId: string): Promise<void> {
  await api.delete(`/notifications/push/subscriptions/${subscriptionId}`);
}

async function sendTestNotification(): Promise<{ sentCount: number }> {
  const response = await api.post<{ sentCount: number }>(
    '/notifications/push/test'
  );
  return response;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

/**
 * Get device name based on user agent
 */
function getDeviceName(): string {
  const ua = navigator.userAgent;

  // Check for mobile devices
  if (/Android/i.test(ua)) {
    return 'Android Device';
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'iOS Device';
  }

  // Check for browsers
  if (/Chrome/i.test(ua)) {
    if (/Edg/i.test(ua)) return 'Microsoft Edge';
    return 'Chrome Browser';
  }
  if (/Firefox/i.test(ua)) {
    return 'Firefox Browser';
  }
  if (/Safari/i.test(ua)) {
    return 'Safari Browser';
  }

  return 'Web Browser';
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function usePushNotifications(): UsePushNotificationsResult {
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Check if push is supported
  const isSupported = isPushSupported();

  // Load permission status
  useEffect(() => {
    if (isSupported) {
      setPermission(getNotificationPermission());
    }
  }, [isSupported]);

  // Fetch VAPID public key
  const { data: vapidPublicKey } = useQuery({
    queryKey: ['push', 'vapid-key'],
    queryFn: fetchVapidPublicKey,
    enabled: isSupported,
    staleTime: Infinity, // Key doesn't change
    retry: 1,
  });

  // Fetch push status
  const { data: status, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['push', 'status'],
    queryFn: fetchPushStatus,
    enabled: isSupported && permission !== 'denied',
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch subscriptions
  const { data: subscriptions = [], isLoading: isLoadingSubscriptions } = useQuery({
    queryKey: ['push', 'subscriptions'],
    queryFn: fetchSubscriptions,
    enabled: isSupported && permission !== 'denied' && !!status?.isSubscribed,
    staleTime: 30 * 1000, // 30 seconds
  });


  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async (deviceName?: string) => {
      if (!vapidPublicKey) {
        throw new Error('VAPID key not available');
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Subscribe to push
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // Send subscription to server
      const result = await subscribeToPush(
        subscription.toJSON(),
        deviceName ?? getDeviceName()
      );

      return result;
    },
    onSuccess: () => {
      // Invalidate queries
      void queryClient.invalidateQueries({ queryKey: ['push'] });
    },
  });

  // Unsubscribe mutation
  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from server
        await unsubscribeFromPush(subscription.endpoint);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['push'] });
    },
  });

  // Unsubscribe device mutation
  const unsubscribeDeviceMutation = useMutation({
    mutationFn: unsubscribeDevice,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['push'] });
    },
  });

  // Send test mutation
  const sendTestMutation = useMutation({
    mutationFn: sendTestNotification,
  });

  // Request permission
  const handleRequestPermission = useCallback(async (): Promise<NotificationPermission> => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  // Subscribe
  const handleSubscribe = useCallback(async (deviceName?: string): Promise<boolean> => {
    try {
      // Check permission first
      if (permission === 'denied') {
        console.warn('[Push] Notification permission denied');
        return false;
      }

      // Request permission if not granted
      if (permission !== 'granted') {
        const newPermission = await handleRequestPermission();
        if (newPermission !== 'granted') {
          return false;
        }
      }

      await subscribeMutation.mutateAsync(deviceName);
      return true;
    } catch (error) {
      console.error('[Push] Subscribe error:', error);
      return false;
    }
  }, [permission, handleRequestPermission, subscribeMutation]);

  // Unsubscribe
  const handleUnsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      await unsubscribeMutation.mutateAsync();
      return true;
    } catch (error) {
      console.error('[Push] Unsubscribe error:', error);
      return false;
    }
  }, [unsubscribeMutation]);

  // Unsubscribe specific device
  const handleUnsubscribeDevice = useCallback(async (subscriptionId: string): Promise<boolean> => {
    try {
      await unsubscribeDeviceMutation.mutateAsync(subscriptionId);
      return true;
    } catch (error) {
      console.error('[Push] Unsubscribe device error:', error);
      return false;
    }
  }, [unsubscribeDeviceMutation]);

  // Send test
  const handleSendTest = useCallback(async (): Promise<boolean> => {
    try {
      const result = await sendTestMutation.mutateAsync();
      return result.sentCount > 0;
    } catch (error) {
      console.error('[Push] Send test error:', error);
      return false;
    }
  }, [sendTestMutation]);

  return {
    // Status
    isSupported,
    permission,
    isSubscribed: status?.isSubscribed ?? false,
    subscriptions,
    status: status ?? null,
    isLoading: isLoadingStatus || isLoadingSubscriptions,

    // Actions
    requestPermission: handleRequestPermission,
    subscribe: handleSubscribe,
    unsubscribe: handleUnsubscribe,
    unsubscribeDevice: handleUnsubscribeDevice,
    sendTest: handleSendTest,

    // Mutation states
    isSubscribing: subscribeMutation.isPending,
    isUnsubscribing: unsubscribeMutation.isPending || unsubscribeDeviceMutation.isPending,
    isSendingTest: sendTestMutation.isPending,
  };
}

export default usePushNotifications;
