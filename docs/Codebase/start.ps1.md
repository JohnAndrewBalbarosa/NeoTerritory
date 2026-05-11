# start.ps1

- Source: start.ps1
- Kind: PowerShell script (single root entry, dispatched by subcommand)

## Story
### What Happens Here
`start.ps1` is the only Windows entry point at the repo root. A first positional arg picks the subcommand (`dev`, `setup`, `k8s`, `browser`, `test`); flags after it tune that mode. Defaults to `dev`, so `.\start.ps1` boots the studio with the same behavior the old `start.ps1` + `run-dev.ps1` pair used to provide.

It folds in everything the previous root scripts did: provisioning (was `bootstrap.ps1` + `deploy.ps1` + `setup.cmd`), dev runner (`run-dev.ps1`), k8s/minikube orchestration (the misleadingly-named old `setup.ps1`), isolated Chromium launcher (`clean-browser.ps1`), and the multi-user k8s simulation (`test.sh`).

### Why It Matters In The Flow
Cross-cutting orchestrator. Anyone working on NeoTerritory hits this script first — it provisions on a fresh clone, runs the dev pipeline daily, and stays out of the way otherwise. Dispatch logic at the bottom routes to one of the `Invoke-*` functions.

### What To Watch While Reading
- `Resolve-BindHost` / `Resolve-AdvertiseHost` / `Get-LanIp` — the LAN-mode plumbing. `-Lan` binds backend to `0.0.0.0` and tells Vite `--host 0.0.0.0`; the advertised host (printed URL, CORS origin) is the detected LAN IPv4.
- `Invoke-Dev` — re-uses helpers `Ensure-NodeModules`, `Build-Microservice`, `Free-Port`, `Wait-Url`. Sets `$env:HOST` and `$env:VITE_HOST` so `server.ts` and `vite.config.ts` honor the bind address. When pod mode is enabled, the Docker daemon probe is soft-gated so startup can fall back to the local sandbox instead of aborting before `Ensure-PodImage`.
- `Invoke-Setup` — `-Mode dev` (default) is bootstrap-equivalent; `-Mode full` adds winget auto-install attempts, `.env` Anthropic prompts, and DB warm-up.
- `Invoke-K8s` — self-elevates; delegates to `Codebase\Infrastructure\session-orchestration\bootstrap_and_deploy.ps1`.
- `Invoke-Browser` — temp profile Chromium; defaults its URL to the studio LAN/local URL when called from `dev`.
- `Invoke-Test` — applies the YAML templates under `Codebase\Infrastructure\session-orchestration\k8s\templates` once per simulated user.

## Universal flags
| Flag | Effect |
|---|---|
| `-Lan` | Bind 0.0.0.0; auto-detect LAN IPv4; extend CORS; print LAN URL |
| `-BindHost <ip>` | Explicit bind IP (overrides `-Lan` autodetect) |
| `-BackendPort <n>` | default 3001 |
| `-FrontendPort <n>` | default 5173 |

See `docs/Codebase/DESIGN_DECISIONS.md` (D28) for the rationale.

## Reading Map
Read this file as the cross-platform sibling of `start.sh`. The two scripts share the same subcommand surface and flag spelling (PowerShell uses `-Lan`, bash uses `--lan`).

It collaborates with `scripts\verify-requirements.ps1` (sourced for `Test-Requirements`), `Codebase\Backend\server.ts` (consumes `HOST`/`PORT`), `Codebase\Frontend\vite.config.ts` (consumes `VITE_HOST`), and the k8s template files under `Codebase\Infrastructure\session-orchestration`.
