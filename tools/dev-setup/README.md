# Dev setup — local replication of the NeoTerritory stack

> **This folder is OPTIONAL.** It exists only for other developers who
> want to spin up a NeoTerritory-equivalent stack on their own laptop
> (Supabase auth + Google sign-in). The project owner's day-to-day
> workflow does **not** depend on anything here. Nothing in
> `scripts/` calls these — they're standalone, deliberately.

## Why this is here

The default NeoTerritory dev path uses the seeded Devcon test accounts
(`devcon1`–`devcon100`, password `devcon`). That's enough to run the
analyzer, the test runner, and the surveys without any external
service.

Real account creation (Sign in with Google) is layered on top via
Supabase Auth. Provisioning that involves:

1. Installing the Supabase CLI + Google Cloud SDK.
2. Pointing them at a project.
3. Creating an OAuth 2.0 web client in Google's Cloud Console.
4. Wiring the resulting credentials into both the project's `.env` and
   `supabase/config.toml`.

Steps 1–2 and most of 3 are CLI-driven; the OAuth web-client creation
step is the only one Google does not yet expose via API. This folder
automates everything around that single click.

## Files

| File                          | What it does                                           |
|-------------------------------|--------------------------------------------------------|
| `install-cli-tools.sh`        | Installs `gcloud`, `jq`, and the Supabase CLI.         |
| `provision-google-oauth.sh`   | gcloud login → project → enable APIs → open OAuth     |
|                               | creation page → read the downloaded `client_secret`    |
|                               | JSON → write to `.env` + patch `supabase/config.toml`. |

## Quick path

```bash
# 1. Install CLIs (one-time per laptop).
./tools/dev-setup/install-cli-tools.sh

# 2. Authenticate gcloud, pick a project, enable the APIs.
./tools/dev-setup/provision-google-oauth.sh login
./tools/dev-setup/provision-google-oauth.sh project
./tools/dev-setup/provision-google-oauth.sh enable-apis

# 3. Create the OAuth web client (single browser click).
./tools/dev-setup/provision-google-oauth.sh open-creation-page
#    -> click "Web application"
#    -> redirect URI is pre-filled
#    -> click Create
#    -> click "Download JSON"

# 4. Auto-extract everything from the downloaded JSON.
./tools/dev-setup/provision-google-oauth.sh from-json \
    --json ~/Downloads/client_secret_xxx.json
```

After step 4, restart Supabase (`supabase stop && supabase start`)
and Google sign-in will be live on the local stack.

## Reusable for future projects

Both scripts are project-agnostic. Drop them into any repo and use the
flags to point at that project's files:

```bash
./tools/dev-setup/provision-google-oauth.sh from-json \
  --json ~/Downloads/client_secret.json \
  --env-file path/to/your/.env \
  --supabase-config path/to/your/supabase/config.toml
```

Defaults match the NeoTerritory layout (`Codebase/Backend/.env` +
`./supabase/config.toml`); flags override.

## What this folder does NOT do

- Doesn't install or run Supabase. The project owner manages Supabase
  on their own laptop. If you also want a local Supabase stack, run
  the Supabase CLI yourself: `supabase init && supabase start` from
  the repo root after `install-cli-tools.sh`. The
  `provision-google-oauth.sh from-json` step writes into
  `supabase/config.toml` if it exists; otherwise it just writes the
  `.env` and you wire the values into your auth provider manually.
- Doesn't touch CI, deployment, or anything in `scripts/`.
- Doesn't add itself to any pre-commit hook or background job.

If any of those is what you wanted, this folder is the wrong place —
look at `scripts/` and `.github/workflows/` instead.
