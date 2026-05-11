#!/usr/bin/env bash
# Local-vs-origin sync guard.
#
# Two things the project owner asked for:
#   1. Before any rebuild/run, warn if origin/main has commits the local
#      branch hasn't pulled yet — this is what stops the team's local
#      clones from drifting against AWS after a CI deploy.
#   2. Show the count of unpushed local commits, so a dev who's been
#      hacking offline doesn't accidentally rebuild on top of work that
#      hasn't been shared.
#
# Soft-fail by design: a missing git binary, a detached HEAD, or no
# network access does NOT block start.sh — we just skip the check and
# let the run proceed. The point is "remind", not "police".

# Skip silently when:
#   - NT_SYNC_GUARD=0 in the environment (escape hatch for CI / scripts)
#   - not in a git work tree
#   - git binary not on PATH
check_local_origin_sync() {
  if [[ "${NT_SYNC_GUARD:-1}" == "0" ]]; then
    return 0
  fi
  if ! command -v git >/dev/null 2>&1; then
    return 0
  fi
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi

  local branch
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
    # Detached HEAD or empty branch — nothing meaningful to compare against.
    return 0
  fi

  # Best-effort fetch with a tight timeout. Hard-cap at 5s so an offline
  # laptop does not hang the whole start.sh on a network reach.
  GIT_TERMINAL_PROMPT=0 timeout 5 git fetch --quiet origin "$branch" 2>/dev/null || {
    printf '\033[33m[sync] could not reach origin (offline?) — skipping freshness check\033[0m\n' >&2
    return 0
  }

  local upstream="origin/$branch"
  if ! git rev-parse --verify --quiet "$upstream" >/dev/null; then
    return 0
  fi

  local behind ahead
  behind="$(git rev-list --count "HEAD..$upstream" 2>/dev/null || echo 0)"
  ahead="$(git rev-list --count "$upstream..HEAD"  2>/dev/null || echo 0)"

  if [[ "$behind" -gt 0 ]]; then
    printf '\033[33m[sync] WARNING: local %s is %d commit(s) BEHIND origin/%s\033[0m\n' "$branch" "$behind" "$branch" >&2
    printf '       Run \033[1mgit pull --ff-only\033[0m before rebuilding so AWS and your laptop stay in sync.\n' >&2
    printf '       Recent commits you are missing:\n' >&2
    git log --oneline --no-decorate "HEAD..$upstream" 2>/dev/null \
      | head -5 \
      | sed 's/^/         /' >&2
  fi
  if [[ "$ahead" -gt 0 ]]; then
    printf '\033[36m[sync] note: local %s is %d commit(s) AHEAD of origin/%s (unpushed)\033[0m\n' "$branch" "$ahead" "$branch" >&2
  fi
  if [[ "$behind" -eq 0 && "$ahead" -eq 0 ]]; then
    printf '\033[32m[sync] local %s is in sync with origin/%s\033[0m\n' "$branch" "$branch" >&2
  fi
  return 0
}
