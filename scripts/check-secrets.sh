#!/usr/bin/env bash
set -euo pipefail
fail=0
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  files=$(git diff --cached --name-only --diff-filter=ACM || true)
else
  files=$(find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*')
fi
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    *.example|*/README.txt) ;;  # documented templates are fine
    *.env|*.env.*|*.local|.vercel/*|*/.vercel/*) echo "BLOCKED secret/path: $f" >&2; fail=1 ;;
  esac
  case "$f" in
    .env.example|.env*.example|scripts/check-secrets.sh|./scripts/check-secrets.sh) ;;
    *) if [ -f "$f" ] && grep -n 'eyJhbGc' "$f" >/dev/null 2>&1; then echo "BLOCKED possible JWT/token in: $f" >&2; fail=1; fi ;;
  esac
done <<< "$files"
exit $fail
