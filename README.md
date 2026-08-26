# Tatkal Fair-Booking System

Redesigned architecture for India's Tatkal train ticket booking window. Solves seat-allocation race conditions, payment-succeeds-but-no-ticket edge cases, server crash loops, and bot manipulation.

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
|  | Bot Mitigation Engine   |  | Virtual Waiting Room   |  | Idempotency Engine |  |
|  +------------+------------+  +-----------+------------+  +---------+----------+  |
|               |                           |                         |             |
|               v                           v                         v             |
|  +-----------------------------------------------------------------------------+  |
|  |                  Partitioned Job Scheduler (Redis Streams)                  |  |
|  |        Partition 0  |  Partition 1  |  Partition 2  |  Partition 3         |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                 Seat Lock & Token Service + Expiry Worker                   |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                 Payment Orchestrator & Auto-Refund Engine                   |  |
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
- **Queue/Locking:** Redis Streams & Sorted Sets

---

## 🚀 Quick Start

### 1. Docker Compose (Recommended)
```bash
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`

### 2. Local Development (Nodemon)

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

---

## 🧪 Testing

```bash
cd backend
npm test
```
Executes test suites for Bot Risk Scoring & Seat Lock TTL Expiry Reconciliation.

---

## 📋 Scenarios Walkthrough

1. **Normal Flow**: Search train -> Join Waiting Room -> Batch admission -> Lock seats -> Process payment -> PNR issue & Audit log.
2. **High-Concurrency Load**: Open Admin Panel (`http://localhost:3000/admin`) -> Click "Simulate 10,000 Requests" -> Observe partition stream balancing without negative seat counts.
3. **Late-Payment Auto-Refund**: Select "Late Success" mode on payment page -> Payment completes after TTL expiry -> System automatically issues full refund (`REFUND_COMPLETED`).
4. **Bot Mitigation**: Submit request with automated behavioral signals -> Triggers Proof-of-Work / CAPTCHA challenge before queue entrance.
