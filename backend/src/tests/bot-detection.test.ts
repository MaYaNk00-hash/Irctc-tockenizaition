import { BotDetectionService, verifyProofOfWork } from '../services/botDetection';

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
});
