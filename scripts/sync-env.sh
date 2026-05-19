#!/bin/bash

# Syncs .env.local from the project root to the current working directory.
# Run this after creating a new git worktree so it inherits all env vars.
#
# Usage (from any worktree):
#   /path/to/pocket-dating-coach/scripts/sync-env.sh
#   -- or, if already in the root project --
#   ./scripts/sync-env.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_ENV="$SCRIPT_DIR/../.env.local"
TARGET_ENV="$(pwd)/.env.local"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -f "$ROOT_ENV" ]; then
  echo -e "${YELLOW}Root .env.local not found at $ROOT_ENV${NC}"
  exit 1
fi

if [ "$(realpath "$ROOT_ENV")" = "$(realpath "$TARGET_ENV" 2>/dev/null || echo '')" ]; then
  echo -e "${GREEN}Already at root — nothing to sync.${NC}"
  exit 0
fi

cp "$ROOT_ENV" "$TARGET_ENV"
echo -e "${GREEN}✓ Synced .env.local from root to $(pwd)${NC}"
