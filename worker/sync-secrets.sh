#!/usr/bin/env bash
# Sync the 4 secrets this worker needs from a docker/.env file into GitHub
# repo secrets, via the GitHub CLI. See worker/README.md section 3a.
#
# Usage: ./sync-secrets.sh [path-to-docker/.env] [github-owner/repo]
# Defaults: docker/.env (relative to repo root), ModelEarth/CloudRoot

set -euo pipefail

ENV_FILE="${1:-../docker/.env}"
REPO="${2:-ModelEarth/CloudRoot}"
KEYS=(ANTHROPIC_API_KEY OPENAI_API_KEY CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Pass its path as the first argument." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) not found. Install from https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

echo "Syncing secrets from $ENV_FILE into $REPO ..."
echo

for key in "${KEYS[@]}"; do
  # last matching line wins, strip surrounding quotes, ignore commented-out lines
  value=$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d '=' -f2- | sed -e 's/^"//' -e 's/"$//')

  if [[ -z "$value" ]]; then
    echo "  skip  $key (not set in $ENV_FILE)"
    continue
  fi

  printf '%s' "$value" | gh secret set "$key" --repo "$REPO" >/dev/null
  echo "  set   $key"
done

echo
echo "Current secrets on $REPO:"
gh secret list --repo "$REPO"
