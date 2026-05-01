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
