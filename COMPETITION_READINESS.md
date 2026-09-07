# Competition Readiness Backlog

This project already has a compelling core: a fair Tatkal waiting room, distributed seat locking, bot friction, idempotent payments, automatic refunds, and an audit trail. The next goal is to make those ideas easy to trust in a five-minute judge demo.

## 1. Must build before the competition

### P0: Make the demo reliable

- [ ] Add a single-command demo setup that waits for Postgres and Redis health before starting the API.
- [ ] Add a seeded demo account and seeded train/seat inventory. The judge should never need to create data manually.
- [ ] Add a `/demo/reset` flow or script that clears demo state safely between presentations.
- [ ] Add clear frontend API error states for backend down, database unavailable, expired queue ticket, expired seat lock, and payment timeout.
- [ ] Verify the complete flow from a clean Docker start: login -> search -> waiting room -> seat selection -> payment -> PNR -> audit trail.
- [ ] Add a visible `DEMO MODE` label anywhere simulated inventory, payments, or load numbers are shown.

### P0: Protect the control plane

- [ ] Require authenticated admin access for `/admin` and every `/api/admin/*` endpoint.
- [ ] Require a separate demo/admin role claim in the JWT; do not treat any signed-in user as an administrator.
- [ ] Lock down CORS in production. The current permissive default is useful locally but unsafe for deployment.
- [ ] Move all default secrets and database credentials out of deployment configuration and fail fast when production secrets are missing.
- [ ] Add request validation and bounded limits for admin configuration values, payment amount, passenger count, and query limits.
- [ ] Add rate limits to login, signup, queue join, payment, and admin endpoints.

### P0: Prove the core claims with a judge-facing demo

- [ ] Build a guided demo mode with three clickable scenarios:
  1. Normal booking succeeds.
  2. Two users race for one seat and only one lock wins.
  3. Payment completes after the seat lock expires and the system issues a refund.
- [ ] Add a live event timeline showing queue admission, token claim, seat lock, payment state, PNR issue, expiry, or refund.
- [ ] Add a seat-lock countdown that is visibly tied to backend state, not only a frontend timer.
- [ ] Add a fairness panel showing queue position, admission order, and the no-refresh advantage rule.
- [ ] Show idempotency in the UI by safely retrying the same payment request and displaying one resulting transaction.
- [ ] Add a short architecture view in the admin area: API -> Redis queue/locks -> workers -> Postgres -> payment/refund.

## 2. Must improve for a strong pitch

### Product experience

- [ ] Make the first screen immediately explain the problem in one sentence: high-demand Tatkal traffic should be fair, reliable, and recoverable.
- [ ] Replace prototype wording such as `Non-functional` with accurate, judge-friendly wording such as `Synthetic simulation` wherever possible.
- [ ] Add responsive mobile layouts for search, waiting room, seat map, payment, and admin screens.
- [ ] Add accessible labels, keyboard focus states, live regions for queue changes, and color-independent status indicators.
- [ ] Add loading, empty, retry, and expired-state UI for every data-fetching screen.
- [ ] Add a persistent booking summary: train, date, class, passenger count, selected seats, hold expiry, and payment status.
- [ ] Make the PNR/result screen presentation-ready with a printable booking receipt and audit summary.

### Backend correctness and observability

- [ ] Replace `Math.random()` identifiers with `crypto.randomUUID()` or a server-side ID generator in all user-facing flows.
- [ ] Add structured logs with request ID, user/session ID, train key, queue ticket, booking token, and outcome.
- [ ] Add metrics for queue wait time, admission latency, lock contention, payment success/failure, refunds, and bot friction decisions.
- [ ] Add a readiness check that verifies both Redis and Postgres rather than only exposing process health.
- [ ] Add graceful shutdown for HTTP, WebSocket, Redis, and Postgres resources.
- [ ] Confirm WebSocket reconnect and polling fallback behavior during a backend restart.
- [ ] Make database migrations versioned instead of relying only on schema initialization.
- [ ] Add explicit transaction boundaries and reconciliation jobs for every payment and seat-lock state transition.

### Testing and evidence

- [ ] Add API contract tests for success, malformed input, expired tokens, duplicate requests, authorization failures, and dependency outages.
- [ ] Add end-to-end tests for the three judge scenarios using Playwright or an equivalent browser runner.
- [ ] Add concurrency tests with multiple backend processes, not only multiple service calls in one test process.
- [ ] Add failure-injection tests: Redis unavailable, Postgres unavailable, worker crash, payment timeout, and duplicate webhook.
- [ ] Add a repeatable load test that reports real throughput and latency. Keep the synthetic admin visualization clearly separate from benchmark results.
- [ ] Add CI that runs frontend build, backend build, unit tests, integration tests when services are available, and security checks.
- [ ] Publish a small reproducible benchmark report with hardware, configuration, request mix, p50/p95 latency, and error rate.

## 3. Pitch and submission assets

- [ ] Rewrite the README around the problem, insight, architecture, demo flow, measured results, and limitations.
- [ ] Add a one-page architecture diagram with the exact consistency boundaries: Redis for short-lived coordination, Postgres for durable truth.
- [ ] Add a one-minute product demo video or GIF showing the queue, seat lock, and refund transition.
- [ ] Add a threat model: bots, queue jumping, duplicate payment, seat oversell, replayed admission tokens, and admin abuse.
- [ ] Add a production scaling plan for five million concurrent users with explicit assumptions and bottlenecks.
- [ ] Explain what is simulated versus implemented. Never present the local 10,000-request simulation as real load testing.
- [ ] Add a `KNOWN_LIMITATIONS.md` document covering mock inventory, sandbox payment, local infrastructure, and deployment constraints.
- [ ] Add a short judging script with exact clicks, expected state changes, and reset instructions.

## 4. Stretch goals after the core is stable

- [ ] Replace polling with a durable WebSocket/SSE event stream with reconnect support.
- [ ] Add a real payment-provider webhook adapter behind a sandbox interface.
- [ ] Add a pluggable CAPTCHA/behavior-verification provider interface.
- [ ] Add multi-region queue partitioning and a documented failover strategy.
- [ ] Add OpenTelemetry traces across queue admission, seat reservation, payment, and refund.
- [ ] Add a fairness simulator that compares FIFO, lottery, and the proposed admission policy.
- [ ] Add an operator runbook for stuck locks, replayed payments, queue recovery, and data reconciliation.

## Recommended implementation order

1. Secure admin and production configuration.
2. Make Docker setup, seed, reset, and the normal booking path deterministic.
3. Implement the three guided judge scenarios and event timeline.
4. Add end-to-end and failure-injection tests.
5. Add readiness, structured logs, metrics, and a real benchmark.
6. Polish responsive/accessibility details.
7. Rewrite the README and record the demo.

## Definition of competition-ready

A fresh clone should start with one documented command. A judge should be able to complete a normal booking in under two minutes, reproduce a seat race and a late-payment refund without developer intervention, and see the resulting state in the audit trail. Every number on the admin screen should be labelled as either measured telemetry or synthetic demo data. The README, architecture diagram, and live product should tell the same story.
