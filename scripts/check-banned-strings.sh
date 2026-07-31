#!/usr/bin/env bash
#
# Guideline 1.1.4 regression gate.
#
# App Store submission 3a44802f (App ID 6777096281) was rejected under Guideline
# 1.1.4 — Safety: Objectionable Content — because the app's copy read as
# compensated dating: a "Casual-Generous" man paired with a "Spoiled-Casual"
# woman, income brackets beside a menu of material benefits, a trust subscore
# named for generosity, and cash paid per verified woman recruited.
#
# This script fails the build if that vocabulary comes back. It is a regression
# gate, not a linter: every pattern here was live in the rejected build 1.0.5 (591).
#
# Full context: docs/requirements/AppStore_Rejection_Remediation.md
#
# Usage:  scripts/check-banned-strings.sh
# Exit:   0 = clean, 1 = banned string found
#
# SCOPING — deliberate, so the gate stays credible:
#  · USER-FACING scan covers Flutter screens and web pages/components. Server-side
#    AI prompts (src/lib/server, src/lib/verified-vibe/server, src/routes/api) are
#    NOT scanned for money vocabulary: telling Claude to "assess the spending
#    pattern in this bank statement" is internal analysis, not copy shown to
#    anyone. Prompt output IS constrained — see prompts.ts and §2.7.
#  · Comment lines (// # /// *) are skipped, so the explanatory notes left beside
#    each removal do not trip the gate they document.
#  · CSS class names are skipped (case-sensitive matching on display names means
#    `.casual-generous-preferences-step` does not match `Casual-Generous`).
#  · female-profile.ts is exempt entirely: GENEROUS_PROVIDER_TERMS is a detection
#    control that neutralises transactional answers, not copy. See §2.9.
#  · Income brackets in onboarding are an intentional exception (decision Q6):
#    private, never rendered to another user. So ₹ is scanned only in the referral
#    surface, not across mobile/lib.

set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

USER_FACING_WEB="src/routes/verified-vibe src/routes/beta src/routes/+page.svelte src/lib/verified-vibe/components"
USER_FACING_ALL="mobile/lib $USER_FACING_WEB"

# ── Case-insensitive: copy phrases that must not appear in any wording ───────
PATTERNS_PHRASE=(
  'nice hotels, no questions'
  'picks up the bill'
  'wined and dined'
  'generous without being asked'
  'surprise upgrades'
  'picked up & dropped off'
  'thoughtful gifting'
  'elevated experiences'
  'generosity on dates'
  'generosity as a love language'
  'financial generosity'
  'luxury treatment'
  'thoughtful luxury'
  'provider mindset'
  'designer shopping'
  'premium lifestyle'
  'luxury getaway'
  'luxury hotels'
  'exotic cars'
  'vip nightlife'
  'high-end social'
  'high-earning'
  'upscale experiences'
  'financial confidence'
  'financial stability'
  'verify generosity'
  'spending pattern'
  'photos, spending'
  'wealth proof'
  'pay later'
  'will be available to unlock'
)

# ── Case-sensitive: display names and identifiers ────────────────────────────
# Case-sensitive so CSS classes and DB ids (casual_generous_man,
# .casual-generous-profile-step) are untouched — those must NOT change.
PATTERNS_EXACT=(
  'Casual-Generous'
  'Spoiled-Casual'
  'generositySignals'
)

# ── Referral surface only: no money in the app's invite screen ───────────────
PATTERNS_REFER=(
  '₹'
  'UPI'
  'Refer & Earn'
  'earnedInr'
  'currentTier'
)

# Strip comment lines and the exempt guard file from any hit list.
#
# The line-number anchor accepts both `file:55:` and a bare `55:`. grep only
# prints the filename when it is scanning more than one file, so a single-file
# scan (the refer_screen.dart pass below) yields the bare form on Linux while
# macOS prints the filename — which silently un-stripped every comment in CI and
# failed the gate on its own explanatory notes. scan() now forces -H as well, so
# this is belt and braces rather than the only defence.
filter() {
  grep -vE '(^|:)[0-9]+:[[:space:]]*(//|///|#|\*|<!--)' \
    | grep -v 'female-profile.ts' \
    | grep -v 'check-banned-strings.sh' \
    || true
}

scan() {
  local flags="$1" pattern="$2"; shift 2
  local hits
  # -H: always print the filename, even for a single-file scan, so `filter`'s
  # comment stripping behaves identically on macOS and on the CI runner.
  hits=$(grep -rnH $flags --binary-files=without-match -- "$pattern" "$@" 2>/dev/null | filter)
  if [ -n "$hits" ]; then
    echo "✗ BANNED: \"$pattern\""
    echo "$hits" | sed 's/^/    /'
    echo
    fail=1
  fi
}

echo "Guideline 1.1.4 banned-string gate"
echo "──────────────────────────────────"

for p in "${PATTERNS_PHRASE[@]}"; do
  scan "-Fi" "$p" $USER_FACING_ALL
done

for p in "${PATTERNS_EXACT[@]}"; do
  scan "-F" "$p" $USER_FACING_ALL src/lib/verified-vibe/server src/lib/server
done

for p in "${PATTERNS_REFER[@]}"; do
  scan "-Fi" "$p" mobile/lib/refer_screen.dart
done

if [ "$fail" -eq 0 ]; then
  echo "✓ clean — no banned strings found"
  exit 0
fi

cat <<'EOM'
──────────────────────────────────────────────────────────────────────────────
One or more strings from the rejected build are back.

These are not style preferences. Each one was live in build 1.0.5 (591) when
Apple rejected the app under Guideline 1.1.4 for facilitating compensated
dating. Reintroducing any of them risks another rejection — and this app has
already been rejected twice.

Read docs/requirements/AppStore_Rejection_Remediation.md before changing this
gate. If a string genuinely needs to come back, that is a product decision for
the app owner, not a build fix.
EOM
exit 1
