import { SeatLockService } from '../services/seatLock';
import { PaymentOrchestratorService } from '../services/paymentOrchestrator';

describe('Seat Lock TTL Expiry & Auto-Refund Worker Tests', () => {
  it('should reconcile and expire seat locks when TTL expires', async () => {
    // 1. Reserve seat in fallback mode
    const jobRes = SeatLockService.fallbackReserveSeat({
      jobId: 'job_test_ttl_1',
      userId: 2001,
      trainId: '12002',
      seatClass: '3A',
      travelDate: '2026-08-26',
      passengerNames: ['Test Passenger'],
      admissionToken: 'token_adm_123',
      timestamp: Date.now()
    });

    expect(jobRes.status).toBe('RESERVED');
    expect(jobRes.tokenId).toBeDefined();

    const tokenId = jobRes.tokenId!;
    const tokenRecord = await SeatLockService.getValidToken(tokenId);
    expect(tokenRecord).not.toBeNull();
    expect(tokenRecord?.status).toBe('RESERVED');

    // Force expire the token for testing
    tokenRecord!.expiresAt = new Date(Date.now() - 1000);

    // Run TTL Expiry reconciliation
    const expiredCount = await SeatLockService.reconcileExpiredTokens();
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    const updatedRecord = await SeatLockService.getValidToken(tokenId);
    expect(updatedRecord?.status).toBe('EXPIRED');
  });

  it('should auto-trigger REFUND_COMPLETED when late payment arrives after token expiry', async () => {
    const jobRes = SeatLockService.fallbackReserveSeat({
      jobId: 'job_test_late_pay',
      userId: 2002,
      trainId: '12951',
      seatClass: '2A',
      travelDate: '2026-08-26',
      passengerNames: ['Late Payment Passenger'],
      admissionToken: 'token_adm_456',
      timestamp: Date.now()
    });

    const tokenId = jobRes.tokenId!;

    // Process payment with DELAYED_LATE_SUCCESS simulation switch
    const payRes = await PaymentOrchestratorService.processPayment({
      tokenId,
      amount: 1450,
      paymentMode: 'UPI',
      simulatedMode: 'DELAYED_LATE_SUCCESS'
    });

    expect(payRes.status).toBe('REFUND_COMPLETED');
    expect(payRes.message).toContain('refund');
  });
});
