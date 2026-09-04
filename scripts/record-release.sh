#!/usr/bin/env bash
#
# Tell store-release-ops that a release shipped from here.
#
# This is write path 1 in portfolio-commons/CONVENTIONS.md, and it is the only
# way another repo writes into that ledger: through store-release-ops' own CLI,
# so its append-only rules and its record shape still apply. Nothing here reaches
# into that repo's files.
#
# Why a script rather than a CI step: the ledger is a local, human-curated record
# of what the consoles say, and a GitHub runner has neither the CLI nor any
# business writing to another repo. Release is already a human action here --
# Apple's 2FA sees to that -- so the record is made by the person who made the
# release.
#
# Usage:
#   scripts/record-release.sh --platform ios [--summary "..."] [--dry-run]
#
# The version, build number and commit are read from the tree rather than typed,
# because a release record with the wrong build number is worse than none: it is
# the number you would later use to work out which build Apple rejected.

set -euo pipefail

platform=""
summary=""
dry_run=0

while [ $# -gt 0 ]; do
  case "$1" in
    --platform) platform="${2:-}"; shift 2 ;;
    --summary)  summary="${2:-}"; shift 2 ;;
    --dry-run)  dry_run=1; shift ;;
    -h|--help)  sed -n '3,25p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$platform" in
  ios|android) ;;
  *) echo "error: --platform must be ios or android" >&2; exit 2 ;;
esac

if ! command -v store-ops >/dev/null 2>&1; then
  cat >&2 <<'MSG'
error: `store-ops` is not on PATH, so this release cannot be recorded.

  uv tool install --editable ~/Desktop/Code/pdc-store-release-ops

A CLI called from another repo has to be globally reachable — see
portfolio-commons/CONVENTIONS.md, "Reachability". Failing here is deliberate:
silently skipping the record is how the ledger stops matching reality.
MSG
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
raw="$(grep -m1 '^version:' "$root/mobile/pubspec.yaml" | awk '{print $2}')"
version="${raw%%+*}"
build="${raw##*+}"
sha="$(git -C "$root" rev-parse --short HEAD)"
branch="$(git -C "$root" branch --show-current)"

if [ -z "$summary" ]; then
  summary="$version ($build) uploaded from $branch @ $sha"
fi

echo "recording to store-release-ops:"
echo "  platform : $platform"
echo "  version  : $version   build: $build"
echo "  commit   : $sha on $branch"
echo "  summary  : $summary"

if [ "$dry_run" -eq 1 ]; then
  echo
  echo "(dry run — nothing written)"
  exit 0
fi

store-ops check-in \
  --platform "$platform" \
  --summary "$summary" \
  --metric "version=$version" \
  --metric "build=$build" \
  --metric "commit=$sha"

echo
echo "Recorded. What this does NOT do: submit for review, promote a track, or"
echo "release to users. Those stay human actions — store-release-ops SPEC"
echo "decision 3."
