# Account creation — auth setup

NeoTerritory currently signs users in via the **Devcon test-account**
path (`devcon1` … `devcon100`, password `devcon`, seeded by
`SEED_TEST_USERS=1`). That's the dev default and ships with the deployed
AWS instance for classroom testing.

Real account creation (Sign in with Google) is layered on top via
Supabase Auth. The project owner runs Supabase locally on their own
laptop and the AWS server intentionally does NOT host Supabase.

| Mode                       | When to use                    | `AUTH_PROVIDER`        |
|----------------------------|--------------------------------|------------------------|
| `dev`                      | Devcon testers (current)       | `dev` (default)        |
| `supabase_self_hosted`     | Primary — full local stack     | `supabase_self_hosted` |
| `supabase_cloud`           | Fallback — supabase.com        | `supabase_cloud`       |

Self-hosted is the primary because it survives offline work and gives
the team full control over the auth tables. When the local stack is
down, the backend can fall back to `supabase_cloud` if its keys are
set, and to `dev` as the final safety net.

## Project owner's path

The project owner manages Supabase directly via the Supabase CLI on
their laptop:

```bash
npm install -g supabase    # one-time
supabase init              # at the repo root
supabase start             # postgres + auth + studio in Docker
supabase status -o env     # prints API_URL / ANON_KEY / SERVICE_ROLE_KEY
```

Paste the printed values into `Codebase/Backend/.env`:

```env
AUTH_PROVIDER=supabase_self_hosted
AUTH_SUPABASE_SELF_HOSTED_URL=http://127.0.0.1:54321
AUTH_SUPABASE_ANON_KEY=<anon key from `supabase status -o env`>
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_KEY=<service_role key from `supabase status -o env`>
```

For Google sign-in, configure the OAuth provider via Supabase Studio
(**Authentication → Providers → Google**) or by editing
`supabase/config.toml`'s `[auth.external.google]` block directly.

## Other developers — replicate the stack locally

If another developer wants to mirror this stack on their machine, the
optional tooling under `tools/dev-setup/` automates the parts Google's
APIs allow:

```bash
./tools/dev-setup/install-cli-tools.sh                        # one-time
./tools/dev-setup/provision-google-oauth.sh login
./tools/dev-setup/provision-google-oauth.sh project
./tools/dev-setup/provision-google-oauth.sh enable-apis
./tools/dev-setup/provision-google-oauth.sh open-creation-page
# ...click Web app + Create + Download JSON in the Cloud Console...
./tools/dev-setup/provision-google-oauth.sh from-json \
    --json ~/Downloads/client_secret_xxx.json
```

That last step parses the downloaded credentials JSON and writes:

- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  `GOOGLE_OAUTH_REDIRECT_URI` into `Codebase/Backend/.env`
- the `[auth.external.google]` block in `supabase/config.toml`

After that, restart Supabase (`supabase stop && supabase start`) to
pick up the new provider. See `tools/dev-setup/README.md` for full
docs.

The `tools/dev-setup/` scripts are project-agnostic — pass
`--env-file` / `--supabase-config` to point them at any other repo.

## Cloud Supabase (fallback path)

For the fallback `AUTH_PROVIDER=supabase_cloud`:

1. Create a free-tier project at <https://supabase.com>.
2. **Project Settings → API**, copy `Project URL`, `anon` key,
   `service_role` key.
3. **Authentication → Providers → Google**, enable, paste OAuth
   credentials, redirect URI
   `https://<project>.supabase.co/auth/v1/callback`.
4. In `Codebase/Backend/.env`:
   ```env
   AUTH_PROVIDER=supabase_cloud
   AUTH_SUPABASE_ANON_KEY=...
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_KEY=...
   ```
5. Restart the backend.

## Roll-out plan

The provisioning + scaffolding is ready; the actual backend handlers
(`/auth/google/start`, `/auth/google/callback`, profile + session APIs)
land in a follow-up commit once credentials are in place. The flag
stays at `dev` until that commit lands so production stays on the
Devcon testers throughout.
