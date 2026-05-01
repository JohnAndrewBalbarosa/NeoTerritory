# TODO — Auth, seat-allocation queue, and AWS EC2 migration

This file collects auth and deployment work that is **deliberately deferred**
from the current sprint. Items here are scoped enough that a future round can
pick them up without re-discovery.

---

## 1. Tester-seat allocation queue (middleman)

### Why

The current claim path (`POST /auth/claim`) is a single atomic
`UPDATE users SET claimed_at = ... WHERE claimed_at IS NULL` — that prevents
double-claim races at the DB level, but it has no concept of "wait in line".

A user who hits "claim" while every seat is taken gets a hard 409. The user
wants a middleman / queue so:
- A claim attempt enrolls the requester in a FIFO queue when no seat is free.
- When a seat is freed (sign-out, heartbeat sweep, admin reset), the front of
  the queue gets a token push and the seat allocates atomically.
- A user already at the head of the queue with no seat free sees a "you are
  Nth in line, estimated wait ~X minutes" status.

### Sketch

- **Backend**: in-memory FIFO queue keyed by anonymous queue-token (signed
  short-lived JWT, no PII). Fields per entry: queue-token, claim-time,
  last-pinged. A queue-position WebSocket or 5-second long-poll endpoint
  feeds the frontend live position.
- **Allocator**: a single tick (~250 ms or seat-freed event) drains the queue
  head, attempts `claimSeatTransaction(claimable_devcon)`, and on success
  signs a real JWT and binds it to the queue-token for one HTTP turn.
- **Eviction**: queue entry expires if it stops pinging (mirror the
  heartbeat sweep semantics). Expired entries are silently dropped.
- **Multi-instance note**: the current revocation map and queue both live in
  process memory. Move both to Redis when the deployment goes multi-instance
  (see §3).

### Files likely to change

- `Codebase/Backend/src/controllers/authController.ts` — add `enqueueClaim`,
  `dequeueClaim`, `peekQueue` exports; rewrite `claimSeat` to delegate.
- `Codebase/Backend/src/routes/auth.ts` — `GET /auth/queue/:token`,
  `POST /auth/queue` (join), `DELETE /auth/queue/:token` (leave).
- `Codebase/Frontend/src/components/auth/LoginOverlay.tsx` — render queue
  state, poll position, hide claimed seats from picker (the data is already
  there; the disable logic is now wired but the queue waiting card is not).
- New file: `Codebase/Backend/src/services/seatQueueService.ts`.

### Acceptance

- Two browser tabs simultaneously hitting "claim" with no seats free: only
  one is allocated immediately when the next seat opens; the other sees a
  live "1st in line" indicator until the queue advances.
- Closing the queued tab removes the entry within `HEARTBEAT_GRACE_SECONDS`
  (90 s today).

---

## 2. Migrate Devcon* tester accounts → guest user model

### Why

The tester pool is a fixed roster of seeded `Devcon01` … `Devcon20` rows.
Future deployments should provision ephemeral guest users on demand
(no pre-seeded roster, no shared usernames across testers).

### Sketch

- Replace `Devcon*` regex with a runtime `is_guest` column on `users`.
- Guest user is created on first claim with a randomly generated username
  (e.g. `guest-{nanoid}`); the same `claimed_at` lifecycle still applies.
- Heartbeat sweep deletes guest rows whose seat has been free for >24 h so
  the table doesn't accumulate dead rows.
- Rename `tester-seats/reset` → `guest-seats/reset` (keep both for one
  release as a deprecation stop).

### Files likely to change

- `Codebase/Backend/src/db/initDb.ts` — schema migration adding `is_guest`.
- `Codebase/Backend/src/controllers/authController.ts` — replace the regex
  with `is_guest = 1` filter; create-on-claim path.
- `Codebase/Backend/src/routes/auth.ts` and admin reset routes — switch
  filter accordingly.
- Frontend: `LoginOverlay` "Pick a tester seat" copy → "Continue as guest";
  one-click claim creates and signs in.

### Acceptance

- No `Devcon` strings remain in the codebase except in a one-time migration
  script. New guest sessions create rows on demand and sweep them away on
  long inactivity.

---

## 3. AWS EC2 deployment

### Goals

- Single-region t3.small (or graviton equivalent) running the current Docker
  image, fronted by an Application Load Balancer with HTTPS via ACM.
- SQLite stays on an EBS volume mounted at `/data`; container restart
  preserves runs and tester roster.
- Microservice binary ships in the image; catalog JSON lives next to it.
- Anthropic API key in AWS Systems Manager Parameter Store, injected via
  the task's IAM role (no `.env` files baked into the image).
- Reverse-proxy DNS via Route 53 to the ALB; cert in ACM.

### Pre-deploy work this list captures

| Item | Reason |
|---|---|
| Move JWT revocation list and seat queue to Redis (or DynamoDB) | Both are in-process today; multi-instance scaling needs shared state. |
| Move tester roster off SQLite onto RDS Postgres (or keep SQLite + EFS mount and accept single-writer) | SQLite + EBS works for one EC2 instance; the moment we add a second, we need a real DB. |
| Add a healthcheck endpoint distinct from `/api/health` for ALB use (no DB reads) | ALB health checks should be cheap and side-effect-free. |
| Centralize logs to CloudWatch via the awslogs driver | `logEvent` writes to SQLite today; CloudWatch is the production destination. |
| Add a per-IP rate limiter on `/auth/claim` and `/auth/heartbeat` | Public endpoints; abuse vector. |
| Backup strategy for SQLite (or DB snapshots if RDS) | Daily snapshot + 7-day retention is the minimum. |
| Migrate from `localStorage` heartbeat token to `httpOnly` cookie + CSRF | Required once we are public; today's bearer-in-localStorage is a research-only compromise. |

### Files likely to change

- New: `infra/terraform/` (or `infra/cdk/`) — VPC, subnets, ALB, ASG, IAM,
  Route 53, ACM. Pick one; default to Terraform.
- `Dockerfile` — multi-stage build, drop dev deps, run as non-root.
- `Codebase/Backend/server.ts` — read `JWT_SECRET` from SSM Parameter Store
  in production, fall back to `.env` in development.
- `docs/DEPLOY.md` — runbook (this file is the seed).

### Acceptance

- `terraform apply` (or equivalent) produces a publicly reachable HTTPS URL
  serving the studio, with the microservice spawning correctly inside the
  container, runs persisting across container restarts, and the AI key
  rotated by changing the SSM parameter (no redeploy needed).

---

## Notes from the user request

- *"Pero para ma manage ito, dapat may middleman na naghahandle ng mga
  users."* — captured as §1.
- *"Kung ano man ang pwede dito may balak kasi akong imigrate tong test
  users to guest users."* — captured as §2.
- *"I plan to implement this sa aws ec2."* — captured as §3.

These three threads are interlocked: the queue moves to Redis when EC2
goes multi-instance; the guest-user migration is independent but should
ship before public launch so the Devcon roster never reaches production.
