#!/bin/bash
# setup-pdc43.sh
#
# Applies the profile-section staleness migration to Supabase (PDC-43),
# then refreshes all seed profiles from their markdown files (PDC-41).
#
# Usage:
#   chmod +x scripts/setup-pdc43.sh
#   ./scripts/setup-pdc43.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env.local"
MIGRATION_FILE="$ROOT_DIR/supabase/migrations/20260522_profile_section_staleness.sql"
SEED_SCRIPT="$SCRIPT_DIR/refresh-seed-profiles.ts"

echo ""
echo "============================================================"
echo "  PDC-43 Setup: Migration + Seed Refresh"
echo "============================================================"
echo ""

# ── Load env vars ─────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env.local not found at $ENV_FILE"
  exit 1
fi

set -o allexport
source "$ENV_FILE"
set +o allexport

# ── Step 1: Apply migration via Supabase CLI ───────────────────────────────────
echo "Step 1: Applying migration — 20260522_profile_section_staleness.sql"
echo "  File: $MIGRATION_FILE"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "ERROR: Migration file not found at $MIGRATION_FILE"
  exit 1
fi

SUPABASE=/opt/homebrew/bin/supabase

if [ ! -x "$SUPABASE" ]; then
  echo "ERROR: supabase CLI not found at $SUPABASE"
  echo "       Install with: brew install supabase/tap/supabase"
  exit 1
fi

"$SUPABASE" db query \
  --linked \
  --file "$MIGRATION_FILE" \
  --workdir "$ROOT_DIR"

echo ""
echo "  ✓ Migration applied"
echo ""

# ── Step 2: Refresh seed profiles ─────────────────────────────────────────────
echo "Step 2: Refreshing seed profiles from markdown files"
echo ""

if ! command -v tsx &> /dev/null; then
  echo "ERROR: tsx not found. Install with: npm install -g tsx"
  exit 1
fi

tsx --env-file="$ENV_FILE" "$SEED_SCRIPT"

echo ""
echo "============================================================"
echo "  Done!"
echo "============================================================"
echo ""
echo "Next steps:"
echo "  - Test the AI Bestie config page for female users"
echo "  - Verify seed profiles loaded in Supabase: ai_assistant_profiles table"
echo "  - Check profile_section_stale trigger fires on profile updates"
echo ""
