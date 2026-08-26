import { pool } from '../db';
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
const inMemoryAuditLogs: AuditLogEntry[] = [];
let auditIdCounter = 1;

export class AuditService {
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
      entry.id = auditIdCounter++;
      inMemoryAuditLogs.push(entry);
    }

    // Broadcast WebSocket update to subscribed clients
    this.broadcastStatusChange(tokenId, entry);

    return entry;
  }

  /**
   * Fetch audit trail history for a given token
   */
  public static async getAuditHistory(tokenId: string): Promise<AuditLogEntry[]> {
    try {
      const res = await pool.query(
        `SELECT id, token_id as "tokenId", from_status as "fromStatus", to_status as "toStatus", reason, created_at as "createdAt"
         FROM status_audit_log WHERE token_id = $1 ORDER BY created_at ASC`,
        [tokenId]
      );
      if (res.rows.length > 0) return res.rows;
    } catch {
      // Fallback in-memory
    }

    return inMemoryAuditLogs.filter(log => log.tokenId === tokenId);
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
