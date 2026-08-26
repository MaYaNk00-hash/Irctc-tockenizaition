import crypto from 'crypto';
import { pool } from '../db';
import { SeatLockService } from './seatLock';
import { AuditService } from './auditService';

export interface ProcessPaymentRequest {
  tokenId: string;
  amount: number;
  paymentMode: 'UPI' | 'NET_BANKING' | 'CREDIT_CARD' | 'DEBIT_CARD';
  simulatedMode?: 'SUCCESS' | 'FAILED' | 'DELAYED_LATE_SUCCESS';
  idempotencyKey?: string;
}

export interface ProcessPaymentResponse {
  txnId: string;
  tokenId: string;
  status: 'CONFIRMED' | 'PAYMENT_FAILED' | 'EXPIRED' | 'REFUND_INITIATED' | 'REFUND_COMPLETED';
  pnr?: string;
  message: string;
  auditReason: string;
}

export class PaymentOrchestratorService {
  /**
   * Process payment with configurable simulation modes
   */
  public static async processPayment(req: ProcessPaymentRequest): Promise<ProcessPaymentResponse> {
    const txnId = crypto.randomUUID();
    const mode = req.simulatedMode || 'SUCCESS';

    // 1. Fetch current token state
    const tokenRecord = await SeatLockService.getValidToken(req.tokenId);
    if (!tokenRecord) {
      return {
        txnId,
        tokenId: req.tokenId,
        status: 'PAYMENT_FAILED',
        message: 'Invalid or non-existent seat lock token',
        auditReason: 'Token not found in database'
      };
    }

    // 2. Handle DELAYED_LATE_SUCCESS simulation (explicit edge case)
    if (mode === 'DELAYED_LATE_SUCCESS') {
      // Artificially expire the token for demo testing if it wasn't expired yet
      tokenRecord.status = 'EXPIRED';
      try {
        await pool.query(`UPDATE seat_tokens SET status = 'EXPIRED' WHERE token_id = $1`, [req.tokenId]);
      } catch {
        // Handled in memory
      }
    }

    // 3. Update token to PAYMENT_PROCESSING
    if (tokenRecord.status === 'RESERVED') {
      await AuditService.logStatus(
        req.tokenId,
        'RESERVED',
        'PAYMENT_PROCESSING',
        `User initiated payment of ₹${req.amount} via ${req.paymentMode}`
      );
    }

    // 4. Evaluate Gateway Result
    if (mode === 'FAILED') {
      await this.recordTransaction(txnId, req.tokenId, req.amount, 'FAILED');
      await AuditService.logStatus(
        req.tokenId,
        'PAYMENT_PROCESSING',
        'PAYMENT_FAILED',
        'Payment failed at bank gateway: Insufficient funds or user cancelled transaction.'
      );
      return {
        txnId,
        tokenId: req.tokenId,
        status: 'PAYMENT_FAILED',
        message: 'Payment declined by gateway',
        auditReason: 'Gateway response FAILED'
      };
    }

    // 5. Success Path — Verify if Token is still unexpired!
    const isStillValid = tokenRecord.status !== 'EXPIRED' && tokenRecord.expiresAt > new Date();

    if (isStillValid) {
      // Normal Success Path: Seat Lock is still VALID -> Generate PNR & CONFIRM
      const pnr = Math.floor(1000000000 + Math.random() * 9000000000).toString(); // 10-digit IRCTC PNR

      try {
        await pool.query(
          `UPDATE seat_tokens SET status = 'CONFIRMED', confirmed_at = NOW(), pnr = $1 WHERE token_id = $2`,
          [pnr, req.tokenId]
        );
      } catch {
        tokenRecord.status = 'CONFIRMED';
        tokenRecord.pnr = pnr;
      }

      await this.recordTransaction(txnId, req.tokenId, req.amount, 'SUCCESS');
      await AuditService.logStatus(
        req.tokenId,
        'PAYMENT_PROCESSING',
        'CONFIRMED',
        `Payment confirmed! 10-Digit Tatkal PNR ${pnr} issued.`
      );

      return {
        txnId,
        tokenId: req.tokenId,
        status: 'CONFIRMED',
        pnr,
        message: 'Ticket booked successfully!',
        auditReason: 'Payment succeeded within valid TTL window.'
      };
    } else {
      // EDGE CASE: Payment succeeded BUT Token already EXPIRED!
      // Trigger Automatic Instant Refund Flow
      await this.recordTransaction(txnId, req.tokenId, req.amount, 'LATE_SUCCESS_EXPIRED');

      // Transition: EXPIRED -> REFUND_INITIATED -> REFUND_COMPLETED
      await AuditService.logStatus(
        req.tokenId,
        'EXPIRED',
        'REFUND_INITIATED',
        'Payment succeeded after seat lock TTL expired. Auto-triggering refund flow.'
      );

      try {
        await pool.query(`UPDATE seat_tokens SET status = 'REFUND_INITIATED' WHERE token_id = $1`, [req.tokenId]);
      } catch {
        tokenRecord.status = 'REFUND_INITIATED';
      }

      // Simulate instantaneous refund completion
      try {
        await pool.query(`UPDATE seat_tokens SET status = 'REFUND_COMPLETED' WHERE token_id = $1`, [req.tokenId]);
      } catch {
        tokenRecord.status = 'REFUND_COMPLETED';
      }

      await AuditService.logStatus(
        req.tokenId,
        'REFUND_INITIATED',
        'REFUND_COMPLETED',
        `Automated refund of ₹${req.amount} processed back to user's source payment method. Zero manual intervention required.`
      );

      return {
        txnId,
        tokenId: req.tokenId,
        status: 'REFUND_COMPLETED',
        message: 'Payment received after seat lock expired. Full refund processed automatically.',
        auditReason: 'Late payment received post TTL expiry. Triggered automated refund system.'
      };
    }
  }

  private static async recordTransaction(
    txnId: string,
    tokenId: string,
    amount: number,
    status: string
  ) {
    try {
      await pool.query(
        `INSERT INTO transactions (txn_id, token_id, amount, gateway_status, initiated_at, resolved_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [txnId, tokenId, amount, status]
      );
    } catch {
      // In-memory fallback log
    }
  }
}
