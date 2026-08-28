import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { initDb } from './db';
import { BotDetectionService } from './services/botDetection';
import { WaitingRoomService, waitingRoomConfig } from './services/waitingRoom';
import { PartitionedSchedulerService, BookingJob } from './services/scheduler';
import { SeatLockService } from './services/seatLock';
import { PaymentOrchestratorService } from './services/paymentOrchestrator';
import { AuditService } from './services/auditService';
import { idempotencyMiddleware } from './middleware/idempotency';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

// Apply idempotency middleware to all mutating endpoints
app.use(idempotencyMiddleware);

// Initialize DB schema & Redis connections
initDb();

// Seeded Trains List
export const SEEDED_TRAINS = [
  { trainId: '12002', name: 'Bhopal Shatabdi Express', origin: 'NDLS (New Delhi)', destination: 'RKMP (Rani Kamalapati)', departureTime: '06:00 AM', arrivalTime: '14:40 PM', duration: '8h 40m', classes: ['1A', 'EC', 'CC'] },
  { trainId: '12951', name: 'Mumbai Rajdhani Express', origin: 'NDLS (New Delhi)', destination: 'MMCT (Mumbai Central)', departureTime: '16:55 PM', arrivalTime: '08:35 AM', duration: '15h 40m', classes: ['1A', '2A', '3A'] },
  { trainId: '20901', name: 'Vande Bharat Express', origin: 'MMCT (Mumbai Central)', destination: 'GNC (Gandhinagar Cap)', departureTime: '06:00 AM', arrivalTime: '12:25 PM', duration: '6h 25m', classes: ['EC', 'CC'] },
  { trainId: '12260', name: 'Sealdah Duronto Express', origin: 'NDLS (New Delhi)', destination: 'SDAH (Sealdah)', departureTime: '19:45 PM', arrivalTime: '12:30 PM', duration: '16h 45m', classes: ['1A', '2A', '3A', 'SL'] },
  { trainId: '12626', name: 'Kerala Express', origin: 'NDLS (New Delhi)', destination: 'TVC (Trivandrum)', departureTime: '20:10 PM', arrivalTime: '18:00 PM (+2 days)', duration: '45h 50m', classes: ['2A', '3A', 'SL'] }
];

let demoMetrics = { totalRequests: 0, queued: 0, admitted: 0, rejected: 0, duplicateRequests: 0, successfulBookings: 0, failedBookings: 0, activeSeatLocks: 0, seatsRemaining: 0, refunds: 0, processingTimeMs: 0, requestsPerSecond: 0, partitions: [0, 0, 0, 0] as number[] };

// --- API ROUTES ---

// 1. Health & Trains List
app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/api/trains', (req, res) => {
  res.json({ success: true, data: SEEDED_TRAINS });
});

app.get('/api/seats', (req, res) => {
  const { trainId, seatClass, travelDate } = req.query as Record<string, string>;
  if (!trainId || !seatClass || !travelDate) return res.status(400).json({ success: false, error: 'trainId, seatClass and travelDate are required' });
  res.json({ success: true, data: SeatLockService.getSeatMap(trainId, seatClass, travelDate) });
});

// 2. Virtual Waiting Room - Join
app.post('/waiting-room/join', async (req, res) => {
  try {
    const { userId, trainId, seatClass, travelDate, sessionId, fingerprint, signals, powNonce, captchaAnswer, verificationId } = req.body;

    if (!trainId || !seatClass || !travelDate) {
      return res.status(400).json({ success: false, error: 'Missing required parameters (trainId, seatClass, travelDate)' });
    }

    const userIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const result = await WaitingRoomService.join({
      userId: userId || Math.floor(Math.random() * 900000) + 100000,
      trainId,
      seatClass,
      travelDate,
      sessionId: sessionId || req.headers['x-session-id'] as string || 'sess_' + Math.random().toString(36).substring(7),
      fingerprint: fingerprint || req.headers['user-agent'] || 'fp_default',
      signals,
      powNonce,
      captchaAnswer,
      verificationId
    }, userIp);

    if (result.friction !== 'NONE' && (!powNonce && captchaAnswer === undefined)) {
      return res.status(202).json({
        success: false,
        requiresFriction: true,
        frictionType: result.friction,
        riskScore: result.riskScore,
        powChallenge: result.powChallenge,
        captchaChallenge: result.captchaChallenge,
        message: 'Security verification required.'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Virtual Waiting Room - Status
app.get('/waiting-room/status', async (req, res) => {
  try {
    const ticketId = req.query.ticketId as string;
    const trainKey = req.query.trainKey as string;

    if (!ticketId || !trainKey) {
      return res.status(400).json({ success: false, error: 'ticketId and trainKey query params required' });
    }

    const status = await WaitingRoomService.getStatus(ticketId, trainKey);
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Booking Request -> Partitioned Job Scheduler
app.post('/api/booking/book', async (req, res) => {
  try {
    const { userId, trainId, seatClass, travelDate, passengerNames, admissionToken, selectedSeats } = req.body;

    if (!admissionToken) {
      return res.status(401).json({ success: false, error: 'Admission token required' });
    }

    const isValidToken = WaitingRoomService.isAdmissionTokenValid(admissionToken, userId || 1001, trainId, seatClass, travelDate);
    if (!isValidToken) {
      return res.status(403).json({ success: false, error: 'Admission token expired or invalid.' });
    }

    const job: BookingJob = {
      jobId: 'job_' + Math.random().toString(36).substring(7),
      userId: userId || 1001,
      trainId,
      seatClass,
      travelDate,
      passengerNames: passengerNames && passengerNames.length > 0 ? passengerNames : ['Passenger 1'],
      admissionToken,
      timestamp: Date.now(),
      selectedSeats
    };

    const result = await PartitionedSchedulerService.pushJob(job);
    if (result.status === 'RESERVED') await WaitingRoomService.consumeAdmissionToken(admissionToken, userId || 1001, trainId, seatClass, travelDate);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Booking Status REST Poll Fallback
app.get('/booking/status/:tokenId', async (req, res) => {
  try {
    const token = await SeatLockService.getValidToken(req.params.tokenId);
    if (!token) {
      return res.status(404).json({ success: false, error: 'Booking token not found' });
    }
    res.json({ success: true, data: token });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Audit Trail History
app.get('/api/booking/audit/:tokenId', async (req, res) => {
  try {
    const history = await AuditService.getAuditHistory(req.params.tokenId);
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Payment Processing
app.post('/api/payment/process', async (req, res) => {
  try {
    const { tokenId, amount, paymentMode, simulatedMode } = req.body;
    if (!tokenId || !amount) {
      return res.status(400).json({ success: false, error: 'tokenId and amount are required' });
    }

    const result = await PaymentOrchestratorService.processPayment({
      tokenId,
      amount,
      paymentMode: paymentMode || 'UPI',
      simulatedMode: simulatedMode || 'SUCCESS',
      idempotencyKey: req.header('Idempotency-Key')
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Admin - Bot Risk Scores Feed
app.get('/api/admin/bot-metrics', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const scores = await BotDetectionService.getRecentRiskScores(limit);
    res.json({ success: true, data: scores });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/metrics', (req, res) => res.json({ success: true, data: demoMetrics }));

app.post('/api/demo/simulate-load', (req, res) => {
  const started = Date.now();
  const total = 10000;
  const partitions = [0, 0, 0, 0];
  for (let index = 0; index < total; index++) partitions[index % 4]++;
  const admitted = 420;
  const failedBookings = 3;
  demoMetrics = { totalRequests: total, queued: total - admitted, admitted, rejected: 1840, duplicateRequests: 0, successfulBookings: admitted - failedBookings, failedBookings, activeSeatLocks: 0, seatsRemaining: 37, refunds: 0, processingTimeMs: Date.now() - started + 24, requestsPerSecond: 250000, partitions };
  res.json({ success: true, data: demoMetrics, label: 'DEMO SIMULATION — no real external traffic was generated.' });
});

// 9. Admin - Batch Release Manual Trigger
app.post('/api/waiting-room/admin/process-batch', async (req, res) => {
  try {
    const { trainKey } = req.body;
    const count = await WaitingRoomService.processNextBatch(trainKey || '12002:3A:2026-08-26');
    res.json({ success: true, admittedCount: count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Admin - Configuration Update
app.post('/api/admin/config', (req, res) => {
  const { batchSize, batchIntervalMs, admissionTtlSeconds } = req.body;
  if (batchSize) waitingRoomConfig.batchSize = batchSize;
  if (batchIntervalMs) waitingRoomConfig.batchIntervalMs = batchIntervalMs;
  if (admissionTtlSeconds) waitingRoomConfig.admissionTtlSeconds = admissionTtlSeconds;

  res.json({ success: true, config: waitingRoomConfig });
});

// --- WEBSOCKET HANDLING ---
wss.on('connection', (socket: WebSocket, req: http.IncomingMessage) => {
  const url = req.url || '';
  const match = url.match(/[?&]tokenId=([^&]+)/);
  if (match) {
    const tokenId = match[1];
    AuditService.subscribeWs(tokenId, socket);
  }

  socket.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'SUBSCRIBE' && data.tokenId) {
        AuditService.subscribeWs(data.tokenId, socket);
      }
    } catch {
      // Ignore
    }
  });
});

// --- BACKGROUND LOOPS ---
setInterval(async () => {
  try {
    await WaitingRoomService.processAllBatches();
    for (const train of SEEDED_TRAINS) {
      for (const cls of train.classes) {
        await WaitingRoomService.processNextBatch(`${train.trainId}:${cls}:2026-08-26`);
      }
    }
  } catch {
    // Suppress
  }
}, waitingRoomConfig.batchIntervalMs);

setInterval(async () => {
  try {
    await SeatLockService.reconcileExpiredTokens();
  } catch {
    // Suppress
  }
}, 2000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Tatkal backend listening on port ${PORT}`);
});
