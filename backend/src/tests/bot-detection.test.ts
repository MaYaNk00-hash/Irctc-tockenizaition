import { BotDetectionService, verifyProofOfWork } from '../services/botDetection';
import { WaitingRoomService } from '../services/waitingRoom';

describe('Bot Detection & Mitigation Layer Tests', () => {
  it('should score legitimate human sessions low (< 30) with no friction', async () => {
    const humanSignals = {
      timeToFirstInteractionMs: 1450,
      keystrokeVarianceMs: 45,
      mouseEntropy: 0.85,
      navigatedFromSearch: true
    };

    const res = await BotDetectionService.evaluateSession(
      'sess_human_1',
      '192.168.1.100',
      1001,
      'fp_genuine_browser_hash_12345',
      humanSignals
    );

    expect(res.score).toBeLessThan(30);
    expect(res.friction).toBe('NONE');
    expect(res.rateLimited).toBe(false);
  });

  it('should trigger MEDIUM_POW for automated scripts with fast interaction', async () => {
    const botSignals = {
      timeToFirstInteractionMs: 50, // fast interaction
      keystrokeVarianceMs: 2,        // robotic typing
      mouseEntropy: 0.05,            // straight line jump
      navigatedFromSearch: false     // direct URL jump
    };

    const res = await BotDetectionService.evaluateSession(
      'sess_bot_1',
      '192.168.1.101',
      1002,
      'fp_bot_script_hash',
      botSignals
    );

    expect(res.score).toBeGreaterThanOrEqual(30);
    expect(res.friction).not.toBe('NONE');
    expect(res.signals.instantInteraction).toBe(true);
    expect(res.signals.roboticTyping).toBe(true);
  });

  it('should correctly verify Proof-of-Work (Hashcash) nonces', () => {
    const challenge = 'test_challenge_abc';
    let nonce = 0;
    let foundNonce = '';

    // Solve PoW puzzle for 2 target zeros
    while (true) {
      if (verifyProofOfWork(challenge, nonce.toString(), 2)) {
        foundNonce = nonce.toString();
        break;
      }
      nonce++;
    }

    expect(verifyProofOfWork(challenge, foundNonce, 2)).toBe(true);
    expect(verifyProofOfWork(challenge, 'invalid_nonce_xyz', 2)).toBe(false);
  });

  it('rejects an invalid server-issued proof and accepts a valid one', async () => {
    const request = { userId: 3001, trainId: '12002', seatClass: 'CC', travelDate: '2026-09-02', sessionId: 'pow_validation_qa', fingerprint: 'fp_pow_validation_123', signals: { timeToFirstInteractionMs: 1, keystrokeVarianceMs: 50, mouseEntropy: 0, navigatedFromSearch: true } };
    const challenge = await WaitingRoomService.join(request, '127.0.0.1');
    expect(challenge.ticketId).toBe('');
    expect(challenge.powChallenge).toBeDefined();
    const invalid = await WaitingRoomService.join({ ...request, powNonce: 'invalid', verificationId: challenge.powChallenge.id }, '127.0.0.1');
    expect(invalid.ticketId).toBe('');
    let nonce = 0;
    while (!verifyProofOfWork(challenge.powChallenge.challenge, String(nonce), challenge.powChallenge.targetZeros)) nonce++;
    const accepted = await WaitingRoomService.join({ ...request, powNonce: String(nonce), verificationId: challenge.powChallenge.id }, '127.0.0.1');
    expect(accepted.ticketId).not.toBe('');
  });
});
