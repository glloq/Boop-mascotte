#!/bin/sh
LOG=/tmp/claude-0/-home-user-Boop-mascotte/682cdc09-ef7d-59bd-a611-bec4f5635545/scratchpad/preview.log
pkill -f 'vite preview' >/dev/null 2>&1
sleep 1
npm run build >/dev/null 2>&1 || { echo "build failed"; exit 1; }
rm -f "$LOG"
nohup npm run preview -- --host 127.0.0.1 >"$LOG" 2>&1 &
until grep -q 'Local' "$LOG" 2>/dev/null; do sleep 1; done
echo up
