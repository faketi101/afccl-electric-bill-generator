#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$ROOT_DIR/deploy"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ZIP_PATH="$OUT_DIR/deploy-$TIMESTAMP.zip"

mkdir -p "$OUT_DIR"

if [[ ! -d "$ROOT_DIR/client/dist" ]]; then
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm not found. Install pnpm to build the client." >&2
    exit 1
  fi

  echo "client/dist not found. Building client..."
  (cd "$ROOT_DIR/client" && pnpm build)
fi

items=(
  "server"
  "client/dist"
  "package.json"
  "pnpm-lock.yaml"
  "README.md"
)

if [[ -d "$ROOT_DIR/dist" ]]; then
  items+=("dist")
fi

zip -r "$ZIP_PATH" "${items[@]}" \
  -x "**/node_modules/**" \
  -x "**/.git/**" \
  -x "**/deploy/**"

echo "Created: $ZIP_PATH"
