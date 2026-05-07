# start.sh

- Source: start.sh
- Kind: Bash script (single root entry, dispatched by subcommand)

## Story
### What Happens Here
POSIX twin of `start.ps1`. Same subcommand surface (`dev` default, plus `setup`, `k8s`, `browser`, `test`), same flag semantics with kebab-case spelling. Folds in the responsibilities that previously lived in separate root scripts (`bootstrap.sh`, `setup.sh` for k8s, `clean-browser.sh`, `test.sh`, plus `start.sh`/`run-dev.ps1` for dev mode).

### Why It Matters In The Flow
The entry point on Linux/macOS/WSL2. WSL2 callers running `--lan` get an explicit warning that WSL2's eth0 is not LAN-reachable; the recommendation is to run `start.ps1 -Lan` from Windows PowerShell instead, since the Windows host owns the routable interface.

### What To Watch While Reading
- Top-level flag parser — case statement that strips a leading subcommand, then a `while` loop that consumes flags. Unknown flag = exit 2.
- `resolve_bind_host` / `resolve_advertise_host` / `get_lan_ip` / `is_wsl2` — LAN plumbing.
- `invoke_dev` — runs verify-requirements (sourced from `scripts/verify-requirements.sh`), checks the pod image, installs node_modules on demand, writes `.env` if missing, builds the microservice, then launches backend + Vite as background jobs. When pod mode is enabled, the Docker daemon probe is soft-gated so startup can fall back to the local sandbox instead of aborting before `ensure_pod_image`. The `TMPDIR=/tmp` overrides are kept from the legacy script: tsx (used by `npm run dev`) cannot open a unix socket on an NTFS-backed `$TEMP` when WSL inherits Windows TEMP env.
- `invoke_setup` — `--mode dev` is the lightweight bootstrap, `--mode full` adds DB warm-up and an `--auto-start` rebound to `dev`.
- `invoke_k8s` — minikube + docker build + `kubectl apply` against the YAML templates.
- `invoke_browser_inline` — clean Chromium with random temp profile, deleted on exit.

## Reading Map
Mirror of `start.ps1`. Where they diverge: bash uses background jobs + `tail -F` for the dev runner instead of PowerShell's `Wait-Process`; bash launches the browser in a backgrounded subshell instead of a separate process.

Collaborates with `scripts/verify-requirements.sh`, `Codebase/Backend/server.ts` (HOST env), `Codebase/Frontend/vite.config.ts` (VITE_HOST env), and the k8s templates under `Codebase/Infrastructure/session-orchestration`.

See `docs/Codebase/DESIGN_DECISIONS.md` (D28) for the rationale behind the consolidation.
