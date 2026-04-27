#!/usr/bin/env bash
set -euo pipefail

if rg "^<<<<<<<|^=======|^>>>>>>>" -n . >/tmp/conflicts.out 2>/dev/null; then
  echo "Merge conflict markers found:"
  cat /tmp/conflicts.out
  exit 1
fi

echo "No merge conflict markers detected."
