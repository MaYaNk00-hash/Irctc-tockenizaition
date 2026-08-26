import http from 'http';

const TARGET_URL = process.env.API_URL || 'http://localhost:5000/waiting-room/join';
const TOTAL_REQUESTS = 10000;
const CONCURRENCY_BATCH = 100;

console.log(`=======================================================`);
console.log(`⚡ TATKAL FAIR-BOOKING HIGH-CONCURRENCY LOAD SIMULATOR`);
console.log(`🎯 Target: ${TARGET_URL}`);
console.log(`📊 Simulating ${TOTAL_REQUESTS} concurrent Tatkal join requests...`);
console.log(`=======================================================`);

let completed = 0;
let successCount = 0;
let botBlockedCount = 0;
let errorCount = 0;

function sendJoinRequest(id: number): Promise<void> {
  return new Promise((resolve) => {
    const isBot = id % 5 === 0; // 20% simulated bots
    const postData = JSON.stringify({
      userId: 10000 + id,
      trainId: '12002',
      seatClass: '3A',
      travelDate: '2026-08-26',
      sessionId: `sess_sim_${id}`,
      fingerprint: isBot ? 'fp_puppeteer_script' : `fp_browser_${id % 20}`,
      signals: isBot
        ? { timeToFirstInteractionMs: 40, keystrokeVarianceMs: 2, mouseEntropy: 0.02, navigatedFromSearch: false }
        : { timeToFirstInteractionMs: 1200, keystrokeVarianceMs: 40, mouseEntropy: 0.8, navigatedFromSearch: true }
    });

    const req = http.request(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Idempotency-Key': `sim_join_${id}`
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        completed++;
        if (res.statusCode === 200) {
          successCount++;
        } else if (res.statusCode === 202) {
          botBlockedCount++;
        } else {
          errorCount++;
        }
        resolve();
      });
    });

    req.on('error', () => {
      completed++;
      errorCount++;
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

async function runLoad() {
  const startTime = Date.now();
  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY_BATCH) {
    const promises = [];
    for (let j = 0; j < CONCURRENCY_BATCH && (i + j) < TOTAL_REQUESTS; j++) {
      promises.push(sendJoinRequest(i + j));
    }
    await Promise.all(promises);

    if ((i + CONCURRENCY_BATCH) % 2000 === 0) {
      console.log(`[Progress] Processed ${Math.min(i + CONCURRENCY_BATCH, TOTAL_REQUESTS)} / ${TOTAL_REQUESTS} requests...`);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n=======================================================`);
  console.log(`✅ LOAD SIMULATION COMPLETE in ${durationSec} seconds`);
  console.log(`📈 Successful Queued: ${successCount}`);
  console.log(`🛡️ Bot Friction Applied: ${botBlockedCount}`);
  console.log(`❌ Network Errors: ${errorCount}`);
  console.log(`⚡ Throughput: ${(TOTAL_REQUESTS / parseFloat(durationSec)).toFixed(0)} req/sec`);
  console.log(`=======================================================`);
}

runLoad();
