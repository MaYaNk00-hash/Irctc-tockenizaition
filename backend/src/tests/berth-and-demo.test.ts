import { SeatLockService, computeBerthMetadata } from '../services/seatLock';
import { WaitingRoomService } from '../services/waitingRoom';

describe('Berth metadata and Demo scenario services', () => {
  it('correctly calculates 3A berth classifications and bay numbers', () => {
    // Seat 1 = LB (Lower Berth, Window)
    const s1 = computeBerthMetadata(0, '3A');
    expect(s1.berthType).toBe('LB');
    expect(s1.isWindow).toBe(true);
    expect(s1.bayNumber).toBe(1);

    // Seat 2 = MB (Middle Berth)
    const s2 = computeBerthMetadata(1, '3A');
    expect(s2.berthType).toBe('MB');
    expect(s2.isWindow).toBe(false);
    expect(s2.bayNumber).toBe(1);

    // Seat 3 = UB (Upper Berth)
    const s3 = computeBerthMetadata(2, '3A');
    expect(s3.berthType).toBe('UB');

    // Seat 7 = SL (Side Lower, Window)
    const s7 = computeBerthMetadata(6, '3A');
    expect(s7.berthType).toBe('SL');
    expect(s7.isWindow).toBe(true);

    // Seat 8 = SU (Side Upper, Window)
    const s8 = computeBerthMetadata(7, '3A');
    expect(s8.berthType).toBe('SU');
    expect(s8.isWindow).toBe(true);
    expect(s8.bayNumber).toBe(1);

    // Seat 9 = Bay 2 LB
    const s9 = computeBerthMetadata(8, '3A');
    expect(s9.bayNumber).toBe(2);
    expect(s9.berthType).toBe('LB');
  });

  it('correctly calculates 2A berth classifications', () => {
    // Seat 1 = LB (Window)
    const s1 = computeBerthMetadata(0, '2A');
    expect(s1.berthType).toBe('LB');
    expect(s1.isWindow).toBe(true);
    expect(s1.bayNumber).toBe(1);

    // Seat 3 = SL (Window)
    const s3 = computeBerthMetadata(2, '2A');
    expect(s3.berthType).toBe('SL');
    expect(s3.isWindow).toBe(true);
  });

  it('resets all demo state cleanly', async () => {
    // Lock a seat first
    const job = {
      jobId: 'job_test_reset',
      userId: 7777,
      trainId: '12951',
      seatClass: '3A',
      travelDate: '2026-08-26',
      passengerNames: ['Demo Passenger'],
      admissionToken: 'demo_token',
      timestamp: Date.now(),
      selectedSeats: ['B2-10']
    };

    const reserveRes = SeatLockService.reserveSelectedSeats(job);
    expect(reserveRes.status).toBe('RESERVED');

    // Verify seat is locked
    const mapBefore = SeatLockService.getSeatMap('12951', '3A', '2026-08-26');
    const seatBefore = mapBefore.seats.find(s => s.number === 'B2-10');
    expect(seatBefore?.state).toBe('LOCKED');

    // Reset demo state
    await SeatLockService.resetAllDemoState();
    await WaitingRoomService.resetDemoQueues();

    // Verify seat is available again
    const mapAfter = SeatLockService.getSeatMap('12951', '3A', '2026-08-26');
    const seatAfter = mapAfter.seats.find(s => s.number === 'B2-10');
    expect(seatAfter?.state).toBe('AVAILABLE');
  });
});
