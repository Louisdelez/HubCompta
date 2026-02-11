// ============================================================================
// NOTIFICATION CHANNELS HOOKS - Finance Hub
// React Query hooks for notification channel management
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ChannelType = 'email' | 'whatsapp' | 'discord';

export interface NotificationChannel {
  id: string;
  channelType: ChannelType;
  email?: string | null;
  emailVerified: boolean;
  whatsappPhone?: string | null;
  whatsappVerified: boolean;
  discordWebhookUrl?: string | null;
  discordVerified: boolean;
  enabledTypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelInput {
  channelType: ChannelType;
  email?: string;
  whatsappPhone?: string;
  discordWebhookUrl?: string;
  enabledTypes?: string[];
}

export interface UpdateChannelInput {
  email?: string;
  whatsappPhone?: string;
  discordWebhookUrl?: string;
  enabledTypes?: string[];
  isActive?: boolean;
}

export interface NotificationTypeCategory {
  type: string;
  label: string;
  description: string;
}

export interface NotificationTypesResponse {
  alerts: NotificationTypeCategory[];
  reminders: NotificationTypeCategory[];
  reports: NotificationTypeCategory[];
  savings: NotificationTypeCategory[];
  activity: NotificationTypeCategory[];
  system: NotificationTypeCategory[];
}

// ----------------------------------------------------------------------------
// Query Keys
// ----------------------------------------------------------------------------

export const channelKeys = {
  all: ['notification-channels'] as const,
  types: ['notification-channels', 'types'] as const,
  detail: (id: string) => ['notification-channels', id] as const,
  preferences: (id: string) => ['notification-channels', id, 'preferences'] as const,
};

// ----------------------------------------------------------------------------
// Hooks
// ----------------------------------------------------------------------------

/**
 * Fetch all notification channels for the current user
 */
export function useNotificationChannels() {
  return useQuery({
    queryKey: channelKeys.all,
    queryFn: async () => {
      const response = await api.get<{ data: NotificationChannel[] }>(
        '/users/me/notification-channels'
      );
      return response.data;
    },
  });
}

/**
 * Fetch available notification types
 */
export function useNotificationTypes() {
  return useQuery({
    queryKey: channelKeys.types,
    queryFn: async () => {
      const response = await api.get<{ data: NotificationTypesResponse }>(
        '/users/me/notification-channels/types'
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Add a new notification channel
 */
export function useAddChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateChannelInput) => {
      const response = await api.post<{ data: { id: string; channelType: ChannelType; isActive: boolean } }>(
        '/users/me/notification-channels',
        input
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}

/**
 * Update a notification channel
 */
export function useUpdateChannel(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateChannelInput) => {
      const response = await api.patch<{ data: NotificationChannel }>(
        `/users/me/notification-channels/${channelId}`,
        input
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}

/**
 * Delete a notification channel
 */
export function useDeleteChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      await api.delete(`/users/me/notification-channels/${channelId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}

/**
 * Send verification code to channel
 */
export function useSendVerification() {
  return useMutation({
    mutationFn: async (channelId: string) => {
      const response = await api.post<{ message: string; expiresIn: string }>(
        `/users/me/notification-channels/${channelId}/send-verification`
      );
      return response;
    },
  });
}

/**
 * Verify channel with code
 */
export function useVerifyChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, code }: { channelId: string; code: string }) => {
      const response = await api.post<{ message: string }>(
        `/users/me/notification-channels/${channelId}/verify`,
        { code }
      );
      return response;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}

/**
 * Update channel preferences (enabled notification types)
 */
export function useUpdateChannelPreferences(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enabledTypes: string[]) => {
      const response = await api.put<{ data: { enabledTypes: string[] } }>(
        `/users/me/notification-channels/${channelId}/preferences`,
        { enabledTypes }
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}

/**
 * Send test notification to channel
 */
export function useTestChannel() {
  return useMutation({
    mutationFn: async (channelId: string) => {
      const response = await api.post<{ message: string }>(
        `/users/me/notification-channels/${channelId}/test`
      );
      return response;
    },
  });
}

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

export function getChannelIcon(type: ChannelType): string {
  switch (type) {
    case 'email':
      return 'Mail';
    case 'whatsapp':
      return 'MessageCircle';
    case 'discord':
      return 'Hash';
    default:
      return 'Bell';
  }
}

export function getChannelLabel(type: ChannelType): string {
  switch (type) {
    case 'email':
      return 'Email';
    case 'whatsapp':
      return 'WhatsApp';
    case 'discord':
      return 'Discord';
    default:
      return type;
  }
}

export function getChannelColor(type: ChannelType): string {
  switch (type) {
    case 'email':
      return 'ctp-yellow';
    case 'whatsapp':
      return 'ctp-green';
    case 'discord':
      return 'ctp-lavender';
    default:
      return 'ctp-blue';
  }
}

export function isChannelVerified(channel: NotificationChannel): boolean {
  switch (channel.channelType) {
    case 'email':
      return channel.emailVerified;
    case 'whatsapp':
      return channel.whatsappVerified;
    case 'discord':
      return channel.discordVerified;
    default:
      return false;
  }
}
