# Tatkal Fair-Booking System (POC)

Redesigned architecture proof-of-concept for India's Tatkal train ticket booking window. Targets seat-allocation race conditions, payment-succeeds-but-no-ticket edge cases, server crash loops, and automated script abuse.

---

## 📐 System Architecture

```
+-----------------------------------------------------------------------------------+
|                           Next.js Web Frontend                                    |
| (Search, Waiting Room, Booking Form, Payment Sandbox, Audit Logs, Admin Panel)     |
+-----------------------------------------+-----------------------------------------+
                                          | REST + WebSockets
                                          v
+-----------------------------------------------------------------------------------+
|                           Node.js Express API Backend                             |
|                                                                                   |
|  +-------------------------+  +------------------------+  +--------------------+  |
|  | Bot Friction Engine     |  | Virtual Waiting Room   |  | Idempotency Engine |  |
|  | (Behavioral + PoW)      |  | (Redis Sorted Sets)    |  | (Memory / DB)      |  |
|  +------------+------------+  +-----------+------------+  +---------+----------+  |
|               |                           |                         |             |
|               v                           v                         v             |
|  +-----------------------------------------------------------------------------+  |
|  |                  Partitioned Job Scheduler (Redis Streams)                  |  |
|  |        Partition 0  |  Partition 1  |  Partition 2  |  Partition 3         |  |
|  |        (4 partitions coded; cross-replica validation pending Phase 2)       |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                 Seat Lock & Token Service + Expiry Worker                   |  |
|  |            (TTL-based locking prevents single-instance zombie locks;         |  |
|  |             cross-replica zero-oversell pending Phase 2 validation)          |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                 Payment Orchestrator & Auto-Refund Engine                   |  |
|  |                 (Mock Gateway with automated timeout refunds)               |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------+-----------------------------------------+
                                          |
                    +---------------------+---------------------+
                    |                                           |
                    v                                           v
       +-------------------------+                 +-------------------------+
       |   PostgreSQL Database   |                 |       Redis Cache       |
       |  (Durable Persistence)  |                 | (Sorted Sets & Locks)   |
       +-------------------------+                 +-------------------------+
```

---

## 🛠️ Stack

- **Frontend:** Next.js (App Router), Tailwind CSS, Lucide Icons, WebSockets
- **Backend:** Node.js, Express, TypeScript, `pg`, `ioredis`, `ws`, `jsonwebtoken`
- **Database:** PostgreSQL (`seat_inventory`, `seat_tokens`, `token_seats`, `transactions`, `status_audit_log`, `waiting_room_tickets`, `risk_scores`)
- **Queue/Locking:** Redis Streams & Sorted Sets (with in-memory fallbacks for local review)

---

## 🧪 Verified Test Evidence

| Area | Verified Capability | Test / Script Mapping |
| :--- | :--- | :--- |
| **Virtual Waiting Room** | Batch admission via Fisher-Yates shuffle | `src/tests/bot-detection.test.ts`, `src/tests/berth-and-demo.test.ts` |
| **Admission Throughput** | ~3,155 req/s over 10,000 requests, 0 network errors | Measured via `scripts/load-simulator.ts` on `/waiting-room/join` |
| **Seat Lock TTL Expiry** | 2-minute TTL releases held seats and prevents zombie locks | `src/tests/ttl-expiry.test.ts`, `SeatLockService.reconcileExpiredTokens()` |
| **Late Payment Auto-Refund** | Late webhook completion transitions to `REFUND_COMPLETED` | `src/tests/ttl-expiry.test.ts` |
| **Audit Trail** | State transitions recorded with timestamped reasons | `src/tests/ttl-expiry.test.ts`, `/api/booking/audit/:tokenId` |
| **Cross-Replica Concurrency** | Clustered lock contention & multi-instance deadlocks | **Pending Phase 2** (blocked on multi-instance Docker/WSL2 setup) |

---

## 🚀 Quick Start

### 1. Local Development

```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- Health check: `http://localhost:5000/health`

### 2. Supabase PostgreSQL

The backend uses Supabase's PostgreSQL database through the `pg` driver. In the
root `.env`, set `DATABASE_URL` to the PostgreSQL URI from Supabase **Project
Settings -> Database**, not the `/rest/v1/` REST URL. URL-encode special
characters in the database password. For Supabase, keep `DB_SSL=true`.

Apply the complete schema, including all tables, constraints, indexes, and the
audit-log migration, with:

```bash
cd backend
npm run db:migrate
```

To load the demo train inventory after migrating:

```bash
npx ts-node ../scripts/seed-db.ts
```

### 3. Vercel Production Deployment

This repository is configured as a single Vercel project with the Next.js
frontend and Express API function. In the Vercel project settings, add these
environment variables for **Production**:

- `DATABASE_URL`: a PostgreSQL connection URI. For Supabase, use the Session
       Pooler URI rather than the `/rest/v1/` URL or the direct database hostname.
- `DB_SSL=true`
- `DB_IPV4=true` when the selected database endpoint is IPv4-only.
- `REDIS_URL`: a Redis TCP connection URI from a managed Redis provider. A
       Redis REST URL and token are not interchangeable with `REDIS_URL`.
- `JWT_SECRET`: a generated secret of at least 32 characters.
- `NODE_ENV=production`
- Leave `NEXT_PUBLIC_API_URL` empty when frontend and API use the same Vercel
       project; the frontend then calls the routed `/api` function directly.

After setting the variables, run the database migration from a machine that
can reach the hosted database, then redeploy Vercel. Verify `/health` and
`/ready`; readiness must report both `postgres.connected` and
`redis.connected` as `true`. If either is false, booking audit history cannot
be durable in a serverless deployment.

### 4. Testing

```bash
cd backend
npm test
```
Executes automated test suites for Bot Risk Scoring, Berth Allocations, and Seat Lock TTL Expiry Reconciliation.

---

## Prototype Scope & Limitations

**This project is a functional hackathon proof-of-concept and is not connected to IRCTC production systems, live railway inventory, real payment gateways, or a commercial CAPTCHA network.**

- **Train Inventory & Payments:** Simulated locally to demonstrate state machine resilience.
- **Bot Mitigation:** Behavioral heuristics and SHA-256 Proof-of-Work reduce low-effort automated script patterns; does not claim to eliminate sophisticated bot syndicates.
- **Seat Locks:** TTL mechanism prevents zombie locks on a single node. Cross-replica oversell prevention is coded but pending multi-instance integration testing (Phase 2).
- **Demo Accounts:** `demo@codex.dev` and `admin@codex.dev` are pre-seeded judge sandbox credentials provided for presentation convenience, not representative of production auth.

---

## 📋 Verified Scenarios Walkthrough

1. **Normal Flow**: Search train -> Join Waiting Room -> Batch admission -> Select seat on 2D Coach Map -> Process sandbox payment -> PNR issued & Audit log recorded.
2. **Late-Payment Auto-Refund**: Select "Late Success" mode on payment page -> Payment arrives after 2-min lock TTL expiry -> System detects expired reservation and issues automated refund (`REFUND_COMPLETED`).
3. **Bot Friction Demonstration**: Submit automated behavioral signals -> Triggers client-side Proof-of-Work challenge before queue ticket issuance.
4. **Admission Benchmark**: Execute `npx ts-node scripts/load-simulator.ts` to reproduce the ~3,155 req/s admission burst test.

