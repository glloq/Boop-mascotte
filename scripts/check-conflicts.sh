#!/usr/bin/env bash
set -euo pipefail
out="$(mktemp)"
trap 'rm -f "$out"' EXIT
if rg --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!dist/**' --glob '!coverage/**' \
  '^(<<<<<<<|=======|>>>>>>>)' . >"$out"; then
  echo "Merge conflict markers found:"
  cat "$out"
  exit 1
fi
echo "No merge conflict markers detected."
