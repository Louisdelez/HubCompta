// ============================================================================
// DEVICE SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError } from '@/core/middleware/errorHandler.js';
import { sessionService } from './session.service.js';
import { AUTH } from '@finance-hub/shared';
import type { Device } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface DeviceInfo {
  id: string;
  name: string;
  fingerprint: string;
  isTrusted: boolean;
  lastUsedAt: Date;
  createdAt: Date;
}

// ----------------------------------------------------------------------------
// Device Service
// ----------------------------------------------------------------------------

export const deviceService = {
  /**
   * Find or create a device for a user
   */
  async findOrCreate(
    userId: string,
    fingerprint: string,
    name: string
  ): Promise<{ device: Device; isNew: boolean }> {
    // Try to find existing device
    const existing = await prisma.device.findUnique({
      where: {
        userId_fingerprint: {
          userId,
          fingerprint,
        },
      },
    });

    if (existing) {
      // Update last used
      const updated = await prisma.device.update({
        where: { id: existing.id },
        data: {
          lastUsedAt: new Date(),
          name, // Update name in case it changed
        },
      });
      return { device: updated, isNew: false };
    }

    // Check device limit
    const deviceCount = await prisma.device.count({
      where: { userId },
    });

    if (deviceCount >= AUTH.SESSION.MAX_DEVICES_PER_USER) {
      // Remove oldest device
      const oldest = await prisma.device.findFirst({
        where: { userId },
        orderBy: { lastUsedAt: 'asc' },
      });

      if (oldest) {
        await this.revoke(oldest.id, userId);
      }
    }

    // Create new device
    const device = await prisma.device.create({
      data: {
        userId,
        fingerprint,
        name,
        lastUsedAt: new Date(),
      },
    });

    return { device, isNew: true };
  },

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    const devices = await prisma.device.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });

    return devices.map((d) => ({
      id: d.id,
      name: d.name,
      fingerprint: d.fingerprint,
      isTrusted: d.isTrusted,
      lastUsedAt: d.lastUsedAt,
      createdAt: d.createdAt,
    }));
  },

  /**
   * Trust a device (skip some security checks)
   */
  async trust(deviceId: string, userId: string): Promise<void> {
    const device = await prisma.device.findFirst({
      where: {
        id: deviceId,
        userId,
      },
    });

    if (!device) {
      throw new NotFoundError('Device', deviceId);
    }

    await prisma.device.update({
      where: { id: deviceId },
      data: { isTrusted: true },
    });
  },

  /**
   * Untrust a device
   */
  async untrust(deviceId: string, userId: string): Promise<void> {
    const device = await prisma.device.findFirst({
      where: {
        id: deviceId,
        userId,
      },
    });

    if (!device) {
      throw new NotFoundError('Device', deviceId);
    }

    await prisma.device.update({
      where: { id: deviceId },
      data: { isTrusted: false },
    });
  },

  /**
   * Revoke a device (delete device and all its sessions)
   */
  async revoke(deviceId: string, userId: string): Promise<void> {
    const device = await prisma.device.findFirst({
      where: {
        id: deviceId,
        userId,
      },
    });

    if (!device) {
      throw new NotFoundError('Device', deviceId);
    }

    // Revoke all sessions for this device
    await sessionService.revokeDeviceSessions(deviceId);

    // Delete the device
    await prisma.device.delete({
      where: { id: deviceId },
    });
  },

  /**
   * Rename a device
   */
  async rename(deviceId: string, userId: string, name: string): Promise<void> {
    const device = await prisma.device.findFirst({
      where: {
        id: deviceId,
        userId,
      },
    });

    if (!device) {
      throw new NotFoundError('Device', deviceId);
    }

    await prisma.device.update({
      where: { id: deviceId },
      data: { name },
    });
  },

  /**
   * Check if device is trusted
   */
  async isTrusted(deviceId: string): Promise<boolean> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { isTrusted: true },
    });
    return device?.isTrusted ?? false;
  },
};

export default deviceService;
