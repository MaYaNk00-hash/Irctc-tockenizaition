const http = require('http');
const crypto = require('crypto');

async function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function solvePoW(challenge, targetZeros) {
  const prefix = '0'.repeat(targetZeros);
  let nonce = 0;
  while (true) {
    const hash = crypto.createHash('sha256').update(`${challenge}${nonce}`).digest('hex');
    if (hash.startsWith(prefix)) return String(nonce);
    nonce++;
  }
}

async function run() {
  console.log('1. Joining Waiting Room with human behavioral signals...');
  let joinRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/waiting-room/join',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    userId: 1,
    trainId: '12002',
    seatClass: '3A',
    travelDate: '2026-08-26',
    sessionId: 'sess_human_' + Date.now(),
    fingerprint: 'fp_human_browser',
    signals: {
      timeToFirstInteractionMs: 1450,
      keystrokeVarianceMs: 38,
      mouseEntropy: 0.82,
      navigatedFromSearch: true
    }
  });

  if (joinRes.body.requiresFriction && joinRes.body.powChallenge) {
    console.log('Solving PoW challenge on client...', joinRes.body.powChallenge);
    const nonce = solvePoW(joinRes.body.powChallenge.challenge, joinRes.body.powChallenge.targetZeros);
    joinRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/waiting-room/join',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      userId: 1,
      trainId: '12002',
      seatClass: '3A',
      travelDate: '2026-08-26',
      sessionId: 'sess_human_' + Date.now(),
      fingerprint: 'fp_human_browser',
      powNonce: nonce,
      verificationId: joinRes.body.powChallenge.id
    });
  }

  console.log('Join response:', joinRes.status, joinRes.body);
  const ticketId = joinRes.body.data.ticketId;

  console.log('2. Polling Waiting Room status for admission...');
  const statusRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/waiting-room/status?ticketId=${ticketId}&trainKey=12002:3A:2026-08-26`,
    method: 'GET'
  });
  console.log('Status response:', statusRes.status, statusRes.body);
  const admissionToken = statusRes.body.data.admissionToken;

  console.log('3. Submitting Seat Lock & Reservation for Seat B2-01...');
  const bookRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/booking/book',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    userId: 1,
    trainId: '12002',
    seatClass: '3A',
    travelDate: '2026-08-26',
    passengerNames: ['Mayank Kumar'],
    admissionToken: admissionToken,
    selectedSeats: ['B2-01']
  });
  console.log('Book response:', bookRes.status, bookRes.body);

  if (bookRes.body.success && bookRes.body.data.status === 'RESERVED') {
    console.log('4. Processing Payment for locked seat...');
    const payRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/payment/process',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      tokenId: bookRes.body.data.tokenId,
      amount: 1450,
      paymentMode: 'UPI',
      simulatedMode: 'SUCCESS'
    });
    console.log('Payment response:', payRes.status, payRes.body);
    console.log('\n>>> SUCCESS! Full Tatkal E2E Booking Pipeline PASSED (PNR: ' + payRes.body.data.pnr + ')! <<<');
  } else {
    console.error('Booking failed:', bookRes.body);
  }
}

run().catch(console.error);
