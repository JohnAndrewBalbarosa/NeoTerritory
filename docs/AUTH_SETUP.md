# Account creation — auth setup

NeoTerritory currently signs users in via the **Devcon test-account** path
(`devcon1` … `devcon100`, password `devcon`, seeded by `SEED_TEST_USERS=1`).
This is the dev default and ships with the deployed AWS instance for
classroom testing.

The next step is real account creation. Per project owner direction the
auth provider is **feature-flagged**, with two real-account paths:

| Mode                       | When to use                    | Flag                         |
|----------------------------|--------------------------------|------------------------------|
| `dev`                      | Devcon testers (current)       | `AUTH_PROVIDER=dev` (default)|
| `supabase_self_hosted`     | Primary — full local stack     | `AUTH_PROVIDER=supabase_self_hosted` |
| `supabase_cloud`           | Fallback — supabase.com        | `AUTH_PROVIDER=supabase_cloud` |

Self-hosted is the primary because it survives offline work and gives the
team full control over the auth tables. When the local stack is down, the
backend automatically falls back to `supabase_cloud` if its keys are set,
then to `dev` as the final safety net.

## Path 1 — Self-hosted Supabase (primary)

Requires Docker Desktop (or Docker Engine on Linux) + Node 20+.

```bash
./scripts/setup-supabase.sh self-hosted
```

The script installs the Supabase CLI (`npm install -g supabase`), runs
`supabase init` to drop a `supabase/` config folder at the repo root, then
runs `supabase start` to bring up the local stack (Postgres + GoTrue auth
+ Studio admin UI in Docker).

First start downloads ~2 GB of images; subsequent starts are fast. The
final output prints the API URL, anon key, and Studio URL — paste those
into `Codebase/Backend/.env`:

```env
AUTH_PROVIDER=supabase_self_hosted
AUTH_SUPABASE_SELF_HOSTED_URL=http://127.0.0.1:54321
AUTH_SUPABASE_ANON_KEY=<the anon key printed by `supabase start`>
```

Enable Google sign-in in the Studio UI:
**Authentication → Providers → Google → enable**, then paste your Google
OAuth client ID + secret from
<https://console.cloud.google.com> → Credentials → OAuth client ID.

## Path 2 — Cloud Supabase (fallback)

```bash
./scripts/setup-supabase.sh cloud
```

Prints a 5-step guide. Summary:

1. Create a free-tier project at <https://supabase.com>.
2. **Project Settings → API**, copy `Project URL`, `anon` key,
   `service_role` key.
3. **Authentication → Providers → Google**, enable, paste OAuth
   credentials, set redirect URI
   `https://<project>.supabase.co/auth/v1/callback`.
4. In `Codebase/Backend/.env`:
   ```env
   AUTH_PROVIDER=supabase_cloud
   AUTH_SUPABASE_ANON_KEY=...
   ```
5. Restart the backend.

## Status

```bash
./scripts/setup-supabase.sh status
```

Reads `Codebase/Backend/.env` and prints which provider is configured plus
the local Supabase stack status (if installed).

## Roll-out plan

The CLI scaffolding ships now; the backend handlers (`/auth/google`,
`/auth/signup`, profile + session APIs) land in a follow-up commit once
keys are in place. The flag stays at `dev` until that commit lands so
production stays on the Devcon testers throughout.
