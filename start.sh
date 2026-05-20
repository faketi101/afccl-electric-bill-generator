#!/usr/bin/env bash
set -euo pipefail

# Get the root directory of the project
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building client..."
if command -v pnpm >/dev/null 2>&1; then
  (cd "$ROOT_DIR/client" && pnpm build)
elif command -v npm >/dev/null 2>&1; then
  (cd "$ROOT_DIR/client" && npm run build)
else
  echo "Error: Neither pnpm nor npm found to build the client." >&2
  exit 1
fi

echo "Starting backend server..."
cd "$ROOT_DIR"
if command -v pnpm >/dev/null 2>&1; then
  exec pnpm start
elif command -v npm >/dev/null 2>&1; then
  exec npm start
else
  exec node server/index.js
fi
