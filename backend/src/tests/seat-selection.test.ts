import { SeatLockService } from '../services/seatLock';

describe('interactive seat lock fallback', () => {
  const job = {
    jobId: 'seat-selection-qa', userId: 1001, trainId: '12951', seatClass: '3A',
    travelDate: '2026-09-01', passengerNames: ['QA Passenger'], admissionToken: 'admission', timestamp: Date.now(), selectedSeats: ['B2-01']
  };

  it('locks a selected available seat and makes it unavailable to a second booking', () => {
    expect(SeatLockService.getSeatMap(job.trainId, job.seatClass, job.travelDate).seats.find(seat => seat.number === 'B2-01')?.state).toBe('AVAILABLE');
    expect(SeatLockService.reserveSelectedSeats(job).status).toBe('RESERVED');
    expect(SeatLockService.reserveSelectedSeats({ ...job, jobId: 'seat-selection-duplicate', userId: 1002 }).status).toBe('SEATS_EXHAUSTED');
  });

  it('releases a selected seat after expiry', async () => {
    const result = SeatLockService.reserveSelectedSeats({ ...job, jobId: 'seat-selection-expiry', selectedSeats: ['B2-02'] });
    const token = await SeatLockService.getValidToken(result.tokenId!);
    token!.expiresAt = new Date(Date.now() - 1);
    await SeatLockService.reconcileExpiredTokens();
    expect(SeatLockService.getSeatMap(job.trainId, job.seatClass, job.travelDate).seats.find(seat => seat.number === 'B2-02')?.state).toBe('AVAILABLE');
  });
});
