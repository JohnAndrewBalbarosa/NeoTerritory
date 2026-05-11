# `secrets/` — local-only credential drop zone

This folder is **gitignored**. Anything here stays on the project owner's
machine and never reaches the repo, CI, or AWS.

## What lives here

| File | Source | Purpose |
|------|--------|---------|
| `google-oauth-client.json` | Downloaded from <https://console.cloud.google.com/apis/credentials> after creating the OAuth 2.0 web client. The "Download JSON" button on the credentials dialog. | Holds Client ID + Secret + redirect URIs for the Google sign-in OAuth client. Reference + backup. The values are also pasted into `scripts/.env.deploy` and `aws_deploy_env.secret` for runtime use. |
| `lightsail_neoterritory.pem` (optional) | AWS Lightsail SSH key | If you prefer to keep the SSH key local rather than under `~/.ssh/`. The deploy scripts default to `$HOME/.ssh/lightsail_neoterritory`, override via `AWS_SSH_KEY` in `scripts/.env.deploy`. |
| `*.bak.<timestamp>` | Auto-created by `tools/dev-setup/provision-google-oauth.sh` and similar | One-shot backups before in-place env edits. Safe to delete after a successful deploy. |

## Why this folder instead of repo root

- Single canonical place — no hunting for a `client_secret_*.json` in
  Downloads.
- Easier to back up: `cp -r secrets ~/Backups/` and you have a full
  credential snapshot.
- A single `secrets/` line in `.gitignore` is harder to miss than
  per-file ignores scattered through the tree.

## Rules

- **Never** commit anything from this folder. The repo `.gitignore`
  already excludes the entire path; do not add exceptions.
- **Never** paste the contents into chat, Notion, Slack, or any
  external service. Pinned messages get indexed.
- **Rotate immediately** if a value here ever ends up in a public
  diff or screenshot.
