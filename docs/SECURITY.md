# Security Model — NeoTerritory

## 1. Scope

NeoTerritory is a **closed-lab research tool** deployed on a single server. The threat surface is intentionally narrow: a small cohort of invited testers submit C++ source code for design-pattern analysis. There is no public registration and no payment flow.

---

## 2. Assets

| Asset | Sensitivity | Notes |
|-------|-------------|-------|
| Analysis runs (source code) | Medium | Research participants' code; not PII but may contain proprietary logic |
| Survey responses | Medium | Participant opinions; linked to username |
| User credentials | High | bcrypt-hashed passwords, JWT tokens |
| Admin credentials | High | Full read/write access to all data |
| Logs | Low–Medium | Event audit trail; contain usernames and actions |
| Pattern catalog | Low | Static JSON shipped with the binary |

---

## 3. STRIDE Analysis

| Threat | Where it applies | Mitigation |
|--------|-----------------|-----------|
| **Spoofing** — impersonating a user or admin | All API routes | JWT bearer tokens required on every protected endpoint; `jwtAuth` middleware verifies signature and expiry. Admin routes additionally check `role === 'admin'` via `requireAdmin`. |
| **Tampering** — modifying data in transit or at rest | DB writes, API bodies | All SQL uses parameterized statements (better-sqlite3 prepared statements). Passwords hashed with bcrypt (cost 10). Analysis results are stored immutably once saved. |
| **Repudiation** — denying an action occurred | All state-changing operations | `logs` table records `event_type`, `user_id`, `created_at`, and a human-readable `message` for every significant action (login, seat claim, analysis, save run, manual review). |
| **Information Disclosure** — leaking sensitive data | Error messages, API responses | Admin routes (`/api/admin/*`) are gated behind `requireAdmin`. JWT secret is env-var only. Error responses return generic messages; detailed errors are logged server-side only. |
| **Denial of Service** — exhausting server resources | Analysis endpoint | `source_text` validated to ≤ 1,000,000 characters. Filename capped at 256 characters. Microservice spawned per-request with a 30 s timeout. |
| **Elevation of Privilege** — gaining admin access without authorization | `/api/admin/*` routes | Role check is enforced by `requireAdmin` middleware on every admin route. Tester seats are restricted to accounts matching the `Devcon%` username prefix. |

---

## 4. Input Validation Summary

| Endpoint | Field | Rule |
|----------|-------|------|
| `POST /auth/login` | `username` | Required, max 64 chars |
| `POST /auth/login` | `password` | Required, max 128 chars |
| `POST /auth/claim` | `username` | Required, max 64 chars |
| `POST /api/analyze` | `filename` | Max 256 chars |
| `POST /api/analyze` | `code` / `source_text` | Max 1,000,000 chars |
| `POST /api/analysis/:id/manual-review` | `line` | Integer ≥ 0 |
| `POST /api/analysis/:id/manual-review` | `chosenKind` | Enum: `pattern`, `none`, `other` |
| `DELETE /api/admin/logs` | `password` | Required, max 128 chars, bcrypt-verified |

Frontend inputs also enforce `maxLength` attributes as a secondary guard.

---

## 5. Secrets and Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `JWT_SECRET` | Signs and verifies all bearer tokens | Yes |
| `LOG_DELETE_HASH` | bcrypt hash of the log-deletion password | Optional (falls back to compiled-in default) |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin account password | Set at first run |

Rules:
- Secrets must never be committed to source control.
- The backend fails to start if `JWT_SECRET` is absent.
- Log-deletion requires a separate password (not the admin login password) to limit blast radius if the admin session is compromised.

---

## 6. Authentication Flow

```
Client                       Server
  │── POST /auth/login ──────► authController.login()
  │                            • validates username / password lengths
  │                            • bcrypt.compare against stored hash
  │                            • issues JWT (30-day expiry)
  │◄── { token, user } ───────│
  │
  │── GET /api/... ──────────► jwtAuth middleware
  │   Authorization: Bearer   • verify JWT signature
  │                            • extract userId, role
  │                            • UPDATE users SET last_active = now()
  │                            • attach decoded payload to req
  │                           requireAdmin (admin routes only)
  │                            • check role === 'admin'
```

Tester seat claiming uses a separate `POST /auth/claim` flow that atomically marks a seat as claimed. Stale claims (older than 4 hours) are automatically overridable, and an admin reset endpoint is available.

---

## 7. Known Limitations

- **No HTTPS enforcement in dev**: The dev server runs plain HTTP. Production deployments should terminate TLS at a reverse proxy (nginx, Caddy).
- **Single SQLite file**: No row-level access control within the database itself. All access control is at the application layer.
- **No rate limiting**: The analysis endpoint has no per-IP or per-user rate limit beyond the 30 s request timeout. For a closed lab with known participants this is acceptable; a public deployment would need throttling.
- **JWT revocation**: Tokens cannot be revoked server-side before expiry. Seat reset clears the `claimed_at` flag but does not invalidate existing tokens.
- **Log deletion is destructive**: There is no soft-delete or archive; deleted logs are gone permanently.

---

## 8. Planned: Stateless message validation (asymmetric day-key)

This section documents a future replacement for the current bearer-JWT auth that ships with the next round. It is design intent so reviewers can comment before code lands.

### Goals

- Per-session asymmetric keypair, autogenerated by the frontend each time a tester signs in. No private key leaves the browser.
- Backend half rotates on a 7-day cadence. Both halves are ephemeral — nothing keyed to user identity is persisted on disk.
- A request is accepted iff the signature verifies *and* the embedded date matches today (UTC) within ±1 day, accommodating timezone skew.
- Replay protection comes from the per-message nonce + the day-window; the backend keeps no per-user state.

### Envelope

Every authenticated request carries a JSON envelope signed by the session key:

```json
{
  "nonce":   "<128-bit random hex>",
  "dayUtc":  "2026-05-12",
  "userId":  "<integer>",
  "payload": { /* ... */ }
}
```

The backend:

1. Verifies the signature against the session's public key (negotiated at sign-in via a TLS-protected `/auth/session-init` exchange).
2. Decodes `dayUtc` as ISO-8601 date.
3. Computes `delta = |systemDayUtc − dayUtc|` in days.
4. Accepts iff `delta ≤ 1`. Outside that window the message is treated as a forgery and 401'd, regardless of whether the signature is structurally valid.

The validator phrase is the date itself: a payload that decrypts cleanly *and* carries today's or yesterday's UTC date is accepted; everything else is wrong-key or replay.

### Why this is safe enough

- **No per-user key state on the server.** Restarting the backend invalidates all existing sessions — by design, that is the failure mode for a stateless system.
- **Replay window is bounded by the day-margin.** The worst-case stale request is ~24h old; after that the day-margin rejects it.
- **Forged keys are impossible without the private half**, which only the user's browser holds.
- **Clock skew is tolerated** to ±1 day. Beyond that, either the attacker's clock is wildly wrong or the message is genuinely stale — both cases reject correctly.

### Acceptance criteria for the implementing round

- A token with `dayUtc` two days off is rejected with 401.
- A token with `dayUtc` one day off (in either direction) is accepted.
- A token with an unknown signature is rejected with 401, regardless of `dayUtc`.
- A backend restart invalidates the previous server keypair; existing client sessions get 401 on their next request and re-init.
- No DB writes are performed during the verify path.

### Why not just use OAuth2 / refresh tokens

OAuth2 needs a server-side authorization store. The user wants a fully stateless backend so that a multi-instance deployment doesn't need a shared session store. The day-window + nonce gets us replay protection without any persistence at the cost of accepting one-day-stale messages, which is acceptable for this app's threat model (research instrument, not financial).
