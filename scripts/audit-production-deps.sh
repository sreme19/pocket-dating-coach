#!/usr/bin/env bash
#
# `npm audit` for the deploy gate, with the two failure modes told apart.
#
# The step this replaces ran `npm audit --audit-level=high --omit=dev` directly,
# which exits 1 both when it finds a high-severity vulnerability and when it
# cannot reach the registry at all. Those are not the same event and do not
# deserve the same response. On 2026-09-04 npmjs.org returned 503 twice, once
# after burning seven minutes, and the second failure blocked a staging deploy on
# a pull request whose dependencies had not changed.
#
# Three outcomes, deliberately distinct:
#
#   vulnerabilities found  -> exit 1. Block the deploy. This is the job's purpose.
#   registry unreachable   -> exit 0 with a loud warning annotation. npm being
#                             down is not evidence of a vulnerability, and a gate
#                             that depends on a third party's uptime otherwise
#                             fails on their bad day rather than on ours. The
#                             last successful audit still stands.
#   clean                  -> exit 0, quietly.
#
# The middle case is the one worth arguing about. "Could not check" is reported
# as itself rather than as either pass or fail, which is the rule this codebase
# already applies to data: an answer that could not be produced is never rendered
# as an answer that came back empty.

set -uo pipefail

ATTEMPTS="${AUDIT_ATTEMPTS:-3}"      # overridable so the branches are testable
RETRY_UNIT="${AUDIT_RETRY_UNIT:-10}" # seconds, multiplied by attempt number
LEVEL="${AUDIT_LEVEL:-high}"
out=""

for i in $(seq 1 "$ATTEMPTS"); do
  out="$(npm audit --audit-level="$LEVEL" --omit=dev --json 2>/dev/null)"
  if ! printf '%s' "$out" | grep -q '"error"'; then
    break
  fi
  if [ "$i" -lt "$ATTEMPTS" ]; then
    delay=$((i * RETRY_UNIT))
    echo "registry error on attempt $i/$ATTEMPTS, retrying in ${delay}s"
    sleep "$delay"
  fi
done

if printf '%s' "$out" | grep -q '"error"'; then
  detail="$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const e=JSON.parse(s).error;console.log(((e.code||"")+" "+(e.summary||e.detail||"")).slice(0,160))}catch{console.log("unparseable response")}})')"
  echo "::warning title=Dependency audit did not run::npm registry unreachable after ${ATTEMPTS} attempts (${detail}). This is NOT a clean audit, it is an unchecked one. The previous successful audit still stands; re-run when the registry recovers."
  exit 0
fi

counts="$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.stringify(JSON.parse(s).metadata.vulnerabilities))}catch{console.log("{}")}})')"
blocking="$(printf '%s' "$counts" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.high||0)+(v.critical||0))})')"

echo "vulnerability counts: $counts"
if [ "${blocking:-0}" -gt 0 ]; then
  echo "::error title=High-severity dependencies::${blocking} high or critical vulnerabilities in production dependencies."
  npm audit --audit-level="$LEVEL" --omit=dev || true
  exit 1
fi

echo "clean at --audit-level=$LEVEL"
