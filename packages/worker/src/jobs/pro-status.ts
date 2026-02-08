// ============================================================================
// PRO STATUS UPDATE JOB - Finance Hub Worker
// Updates overdue invoices and expired quotes
// ============================================================================

import { prisma } from '../lib/prisma.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ProStatusResult {
  overdueInvoices: number;
  expiredQuotes: number;
  workspacesProcessed: number;
  duration: number;
}

// ----------------------------------------------------------------------------
// Invoice Status Update
// ----------------------------------------------------------------------------

/**
 * Update sent invoices that are past their due date to overdue
 */
export async function updateOverdueInvoices(): Promise<number> {
  const result = await prisma.invoice.updateMany({
    where: {
      status: 'sent',
      dueDate: { lt: new Date() },
      deletedAt: null,
    },
    data: { status: 'overdue' },
  });

  console.log(`Updated ${result.count} invoices to overdue status`);

  return result.count;
}

// ----------------------------------------------------------------------------
// Quote Status Update
// ----------------------------------------------------------------------------

/**
 * Update sent quotes that are past their validity date to expired
 */
export async function updateExpiredQuotes(): Promise<number> {
  const result = await prisma.quote.updateMany({
    where: {
      status: 'sent',
      validUntil: { lt: new Date() },
      deletedAt: null,
    },
    data: { status: 'expired' },
  });

  console.log(`Updated ${result.count} quotes to expired status`);

  return result.count;
}

// ----------------------------------------------------------------------------
// Per-Workspace Update
// ----------------------------------------------------------------------------

/**
 * Update statuses for a specific workspace
 */
export async function updateWorkspaceProStatus(
  workspaceId: string
): Promise<{ overdueInvoices: number; expiredQuotes: number }> {
  const [overdueResult, expiredResult] = await Promise.all([
    prisma.invoice.updateMany({
      where: {
        workspaceId,
        status: 'sent',
        dueDate: { lt: new Date() },
        deletedAt: null,
      },
      data: { status: 'overdue' },
    }),
    prisma.quote.updateMany({
      where: {
        workspaceId,
        status: 'sent',
        validUntil: { lt: new Date() },
        deletedAt: null,
      },
      data: { status: 'expired' },
    }),
  ]);

  return {
    overdueInvoices: overdueResult.count,
    expiredQuotes: expiredResult.count,
  };
}

// ----------------------------------------------------------------------------
// Main Job
// ----------------------------------------------------------------------------

/**
 * Run all Pro status updates
 */
export async function runProStatusUpdate(): Promise<ProStatusResult> {
  const startTime = Date.now();

  console.log('Starting Pro status update...');

  // Get distinct workspace IDs that have active invoices/quotes
  const workspacesWithActivity = await prisma.workspace.findMany({
    where: {
      OR: [
        {
          invoices: {
            some: {
              status: 'sent',
              deletedAt: null,
            },
          },
        },
        {
          quotes: {
            some: {
              status: 'sent',
              deletedAt: null,
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  let totalOverdue = 0;
  let totalExpired = 0;

  for (const workspace of workspacesWithActivity) {
    const result = await updateWorkspaceProStatus(workspace.id);
    totalOverdue += result.overdueInvoices;
    totalExpired += result.expiredQuotes;
  }

  const duration = Date.now() - startTime;

  console.log(`Pro status update completed in ${duration}ms`);
  console.log(`  Overdue invoices: ${totalOverdue}`);
  console.log(`  Expired quotes: ${totalExpired}`);
  console.log(`  Workspaces processed: ${workspacesWithActivity.length}`);

  return {
    overdueInvoices: totalOverdue,
    expiredQuotes: totalExpired,
    workspacesProcessed: workspacesWithActivity.length,
    duration,
  };
}

// ----------------------------------------------------------------------------
// Job Handler for BullMQ
// ----------------------------------------------------------------------------

export async function handleProStatusJob(data: {
  workspaceId?: string;
}): Promise<ProStatusResult | { overdueInvoices: number; expiredQuotes: number }> {
  if (data.workspaceId) {
    return updateWorkspaceProStatus(data.workspaceId);
  }

  return runProStatusUpdate();
}

export default handleProStatusJob;
