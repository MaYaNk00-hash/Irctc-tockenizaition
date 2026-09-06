import { pool, redis } from '../db';
import { WebSocket } from 'ws';

export interface AuditLogEntry {
  id?: number;
  tokenId: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  createdAt: Date;
}

// Global WebSocket subscribers registry by tokenId
const wsSubscriptions: Map<string, Set<WebSocket>> = new Map();
const demoAuditLogs: Map<string, AuditLogEntry[]> = new Map();

function allowDemoAuditStore() {
  return process.env.NODE_ENV !== 'production' && process.env.DISABLE_DEMO_AUDIT !== 'true';
}

function storeDemoAudit(entry: AuditLogEntry) {
  const entries = demoAuditLogs.get(entry.tokenId) || [];
  entries.push(entry);
  demoAuditLogs.set(entry.tokenId, entries);
}

export class AuditService {
  public static async logWaitingRoomStatus(
    ticketId: string,
    fromStatus: string,
    toStatus: string,
    reason: string
  ): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = { tokenId: ticketId, fromStatus, toStatus, reason, createdAt: new Date() };
    try {
      const res = await pool.query(
        `INSERT INTO status_audit_log (ticket_id, from_status, to_status, reason, created_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [ticketId, fromStatus, toStatus, reason, entry.createdAt]
      );
      entry.id = parseInt(res.rows[0].id, 10);
    } catch {
      if (redis.status === 'ready') {
        await redis.lpush(`audit:ticket:${ticketId}`, JSON.stringify(entry));
        await redis.expire(`audit:ticket:${ticketId}`, 86400);
      } else {
        if (allowDemoAuditStore()) storeDemoAudit(entry);
        console.warn('[audit] waiting-room persistence unavailable; using development demo audit store');
      }
    }
    this.broadcastStatusChange(ticketId, entry);
    return entry;
  }

  public static async getAuditHistoryWithSource(tokenId: string): Promise<{ entries: AuditLogEntry[]; source: 'postgres' | 'redis' | 'demo' | 'unavailable' }> {
    try {
      const res = await pool.query(
        `SELECT id, token_id as "tokenId", from_status as "fromStatus", to_status as "toStatus", reason, created_at as "createdAt"
         FROM status_audit_log WHERE token_id = $1 ORDER BY created_at ASC`,
        [tokenId]
      );
      if (res.rows.length > 0) return { entries: res.rows, source: 'postgres' };
      const ticketResult = await pool.query(
        `SELECT id, ticket_id as "tokenId", from_status as "fromStatus", to_status as "toStatus", reason, created_at as "createdAt"
         FROM status_audit_log WHERE ticket_id = $1 ORDER BY created_at ASC`,
        [tokenId]
      );
      if (ticketResult.rows.length > 0) return { entries: ticketResult.rows, source: 'postgres' };
    } catch { /* Redis is the degraded durable store. */ }

    if (redis.status === 'ready') {
      try {
        const entries = await redis.lrange(`audit:${tokenId}`, 0, -1);
        if (entries.length > 0) return { entries: entries.map(entry => JSON.parse(entry) as AuditLogEntry).reverse(), source: 'redis' };
        const ticketEntries = await redis.lrange(`audit:ticket:${tokenId}`, 0, -1);
        return { entries: ticketEntries.map(entry => JSON.parse(entry) as AuditLogEntry).reverse(), source: 'redis' };
      } catch { /* both audit stores are unavailable */ }
    }

    const demoEntries = demoAuditLogs.get(tokenId) || [];
    if (demoEntries.length > 0 && allowDemoAuditStore()) return { entries: demoEntries, source: 'demo' };
    return { entries: [], source: 'unavailable' };
  }

  /**
   * Log a state transition to Postgres + push live update over WebSocket
   */
  public static async logStatus(
    tokenId: string,
    fromStatus: string,
    toStatus: string,
    reason: string
  ): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      tokenId,
      fromStatus,
      toStatus,
      reason,
      createdAt: new Date()
    };

    try {
      const res = await pool.query(
        `INSERT INTO status_audit_log (token_id, from_status, to_status, reason, created_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [tokenId, fromStatus, toStatus, reason, entry.createdAt]
      );
      entry.id = parseInt(res.rows[0].id, 10);
    } catch {
      if (redis.status === 'ready') {
        await redis.lpush(`audit:${tokenId}`, JSON.stringify(entry));
        await redis.expire(`audit:${tokenId}`, 86400);
      } else {
        if (allowDemoAuditStore()) storeDemoAudit(entry);
        console.warn('[audit] persistence unavailable; using development demo audit store');
      }
    }

    // Broadcast WebSocket update to subscribed clients
    this.broadcastStatusChange(tokenId, entry);

    return entry;
  }

  /**
   * Fetch audit trail history for a given token
   */
  public static async getAuditHistory(tokenId: string): Promise<AuditLogEntry[]> {
    return (await this.getAuditHistoryWithSource(tokenId)).entries;
  }

  /**
   * WebSocket subscription management
   */
  public static subscribeWs(tokenId: string, socket: WebSocket) {
    if (!wsSubscriptions.has(tokenId)) {
      wsSubscriptions.set(tokenId, new Set());
    }
    wsSubscriptions.get(tokenId)!.add(socket);

    socket.on('close', () => {
      const subs = wsSubscriptions.get(tokenId);
      if (subs) {
        subs.delete(socket);
        if (subs.size === 0) wsSubscriptions.delete(tokenId);
      }
    });
  }

  public static broadcastStatusChange(tokenId: string, entry: AuditLogEntry) {
    const subs = wsSubscriptions.get(tokenId);
    if (subs && subs.size > 0) {
      const payload = JSON.stringify({
        type: 'STATUS_UPDATE',
        tokenId,
        data: entry
      });
      for (const client of subs) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      }
    }
  }
}
