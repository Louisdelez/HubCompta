# Domain Events: Finance Hub

**Branch**: `001-finance-hub` | **Date**: 2026-02-08

## Event Architecture

Events are used for:
1. **Audit logging** - All security-relevant actions
2. **Real-time updates** - WebSocket notifications to clients
3. **Background jobs** - Triggering async processing
4. **Integrations** - Future webhook/API integrations

## Event Format

```typescript
interface DomainEvent<T = unknown> {
  id: string;           // UUID v7 (time-ordered)
  type: string;         // Event type (namespaced)
  timestamp: string;    // ISO 8601
  version: number;      // Schema version

  // Context
  userId?: string;      // Actor (null for system events)
  workspaceId?: string; // Workspace context
  deviceId?: string;    // Device context
  correlationId?: string; // Request correlation

  // Payload
  payload: T;

  // Metadata
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    [key: string]: unknown;
  };
}
```

## Authentication Events

### auth.login.succeeded

User successfully logged in (after MFA if required).

```typescript
{
  type: "auth.login.succeeded",
  payload: {
    email: string;
    mfaMethod?: "totp" | "webauthn";
    deviceId: string;
    deviceName: string;
    isNewDevice: boolean;
  }
}
```

### auth.login.failed

Login attempt failed.

```typescript
{
  type: "auth.login.failed",
  payload: {
    email: string;
    reason: "invalid_credentials" | "mfa_failed" | "account_locked";
    attemptCount: number;
  }
}
```

### auth.mfa.setup

MFA method added.

```typescript
{
  type: "auth.mfa.setup",
  payload: {
    mfaId: string;
    type: "totp" | "webauthn";
    name: string;
  }
}
```

### auth.mfa.removed

MFA method removed.

```typescript
{
  type: "auth.mfa.removed",
  payload: {
    mfaId: string;
    type: "totp" | "webauthn";
    name: string;
  }
}
```

### auth.session.locked

Session locked due to inactivity.

```typescript
{
  type: "auth.session.locked",
  payload: {
    sessionId: string;
    reason: "inactivity" | "manual";
    inactivityMinutes?: number;
  }
}
```

### auth.session.unlocked

Session unlocked after re-authentication.

```typescript
{
  type: "auth.session.unlocked",
  payload: {
    sessionId: string;
  }
}
```

### auth.logout

User logged out.

```typescript
{
  type: "auth.logout",
  payload: {
    sessionId: string;
    reason: "manual" | "expired" | "revoked";
  }
}
```

### auth.device.revoked

Device access revoked.

```typescript
{
  type: "auth.device.revoked",
  payload: {
    revokedDeviceId: string;
    revokedDeviceName: string;
  }
}
```

## User Events

### user.created

New user registered.

```typescript
{
  type: "user.created",
  payload: {
    email: string;
    displayName: string;
  }
}
```

### user.updated

User profile updated.

```typescript
{
  type: "user.updated",
  payload: {
    changes: {
      displayName?: { old: string; new: string };
      email?: { old: string; new: string };
      locale?: { old: string; new: string };
      timezone?: { old: string; new: string };
    }
  }
}
```

### user.password.changed

Password changed.

```typescript
{
  type: "user.password.changed",
  payload: {
    // No sensitive data
  }
}
```

## Workspace Events

### workspace.created

New workspace created.

```typescript
{
  type: "workspace.created",
  payload: {
    name: string;
    type: "personal" | "family" | "flatshare" | "company";
    currency: string;
  }
}
```

### workspace.updated

Workspace settings updated.

```typescript
{
  type: "workspace.updated",
  payload: {
    changes: {
      name?: { old: string; new: string };
      currency?: { old: string; new: string };
    }
  }
}
```

### workspace.deleted

Workspace deleted (soft delete).

```typescript
{
  type: "workspace.deleted",
  payload: {
    name: string;
    accountCount: number;
    transactionCount: number;
  }
}
```

### workspace.member.invited

Member invited to workspace.

```typescript
{
  type: "workspace.member.invited",
  payload: {
    invitedEmail: string;
    role: string;
  }
}
```

### workspace.member.joined

Member joined workspace.

```typescript
{
  type: "workspace.member.joined",
  payload: {
    memberId: string;
    memberEmail: string;
    role: string;
  }
}
```

### workspace.member.role.changed

Member role changed.

```typescript
{
  type: "workspace.member.role.changed",
  payload: {
    memberId: string;
    memberEmail: string;
    oldRole: string;
    newRole: string;
  }
}
```

### workspace.member.removed

Member removed from workspace.

```typescript
{
  type: "workspace.member.removed",
  payload: {
    memberId: string;
    memberEmail: string;
    reason: "removed" | "left";
  }
}
```

## Transaction Events

### transaction.created

Transaction created.

```typescript
{
  type: "transaction.created",
  payload: {
    transactionId: string;
    accountId: string;
    type: "expense" | "income" | "transfer";
    amount: number;
    currency: string;
    date: string;
    description: string;
    categoryId?: string;
    isImported: boolean;
  }
}
```

### transaction.updated

Transaction updated.

```typescript
{
  type: "transaction.updated",
  payload: {
    transactionId: string;
    changes: {
      amount?: { old: number; new: number };
      date?: { old: string; new: string };
      description?: { old: string; new: string };
      categoryId?: { old: string | null; new: string | null };
      status?: { old: string; new: string };
    }
  }
}
```

### transaction.deleted

Transaction deleted.

```typescript
{
  type: "transaction.deleted",
  payload: {
    transactionId: string;
    accountId: string;
    amount: number;
    description: string;
  }
}
```

### transaction.status.changed

Transaction status changed (cleared, reconciled).

```typescript
{
  type: "transaction.status.changed",
  payload: {
    transactionId: string;
    oldStatus: string;
    newStatus: string;
  }
}
```

## Import Events

### import.started

Import job started.

```typescript
{
  type: "import.started",
  payload: {
    jobId: string;
    accountId: string;
    filename: string;
    rowCount: number;
  }
}
```

### import.progress

Import progress update (WebSocket).

```typescript
{
  type: "import.progress",
  payload: {
    jobId: string;
    processed: number;
    total: number;
    imported: number;
    skipped: number;
    errors: number;
  }
}
```

### import.completed

Import job completed.

```typescript
{
  type: "import.completed",
  payload: {
    jobId: string;
    accountId: string;
    duration: number; // seconds
    imported: number;
    skipped: number;
    errors: number;
  }
}
```

### import.failed

Import job failed.

```typescript
{
  type: "import.failed",
  payload: {
    jobId: string;
    accountId: string;
    error: string;
    processedRows: number;
  }
}
```

## Document Events

### document.uploaded

Document uploaded.

```typescript
{
  type: "document.uploaded",
  payload: {
    documentId: string;
    filename: string;
    mimeType: string;
    size: number;
    isVault: boolean;
  }
}
```

### document.linked

Document linked to transaction.

```typescript
{
  type: "document.linked",
  payload: {
    documentId: string;
    transactionId: string;
  }
}
```

### document.unlinked

Document unlinked from transaction.

```typescript
{
  type: "document.unlinked",
  payload: {
    documentId: string;
    transactionId: string;
  }
}
```

### document.deleted

Document deleted.

```typescript
{
  type: "document.deleted",
  payload: {
    documentId: string;
    filename: string;
  }
}
```

## Budget Events

### budget.created

Budget created.

```typescript
{
  type: "budget.created",
  payload: {
    budgetId: string;
    name: string;
    categoryId: string;
    amount: number;
    period: "monthly" | "yearly";
  }
}
```

### budget.threshold.reached

Budget threshold reached (alert).

```typescript
{
  type: "budget.threshold.reached",
  payload: {
    budgetId: string;
    name: string;
    threshold: number; // percent
    spent: number;
    amount: number;
  }
}
```

### budget.exceeded

Budget exceeded.

```typescript
{
  type: "budget.exceeded",
  payload: {
    budgetId: string;
    name: string;
    spent: number;
    amount: number;
    overage: number;
  }
}
```

## Export Events

### export.requested

Data export requested (requires step-up auth).

```typescript
{
  type: "export.requested",
  payload: {
    exportId: string;
    format: "csv" | "pdf";
    dateRange?: {
      from: string;
      to: string;
    };
  }
}
```

### export.completed

Export ready for download.

```typescript
{
  type: "export.completed",
  payload: {
    exportId: string;
    format: string;
    size: number;
    expiresAt: string;
  }
}
```

## Security Events (Critical Audit)

These events are always logged and cannot be disabled.

### security.sensitive_action

Step-up authentication for sensitive action.

```typescript
{
  type: "security.sensitive_action",
  payload: {
    action: "export" | "vault_access" | "security_settings" | "member_management";
    verified: boolean;
  }
}
```

### security.suspicious_activity

Suspicious activity detected.

```typescript
{
  type: "security.suspicious_activity",
  payload: {
    reason: "unusual_location" | "multiple_failures" | "rapid_requests";
    details: Record<string, unknown>;
  }
}
```

## Event Consumers

| Event Pattern | Consumer | Action |
|---------------|----------|--------|
| `auth.*` | AuditLogger | Log to audit_logs table |
| `auth.login.failed` | SecurityMonitor | Track failures, trigger lockout |
| `workspace.*` | AuditLogger | Log to audit_logs table |
| `transaction.*` | BalanceUpdater | Update account balances |
| `transaction.created` | RuleEngine | Apply categorization rules |
| `import.progress` | WebSocketNotifier | Push to connected clients |
| `budget.threshold.*` | NotificationService | Send alerts |
| `security.*` | AuditLogger | Log with severity=critical |
| `*` | MetricsCollector | Update Prometheus metrics |

## WebSocket Subscriptions

Clients can subscribe to real-time events:

```typescript
// Subscribe to workspace events
ws.send({ type: "subscribe", channel: `workspace:${workspaceId}` });

// Events pushed to subscribers
{
  channel: "workspace:uuid",
  event: DomainEvent
}
```

**Subscribable channels**:
- `workspace:{id}` - All events for a workspace
- `import:{jobId}` - Import progress updates
- `user:{id}` - User-specific notifications
