#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v go >/dev/null 2>&1; then
    echo "Go toolchain is required to build the DarkPanel Telegram Bot." >&2
    exit 2
fi

mkdir -p "$ROOT_DIR/dist"

output="$ROOT_DIR/dist/darkpanel-bot"
if [[ "${OS:-}" == "Windows_NT" ]]; then
    output="$ROOT_DIR/dist/darkpanel-bot.exe"
fi

echo "Building DarkPanel Telegram Bot..."
(
    cd "$ROOT_DIR/bot"
    CGO_ENABLED=0 go build -trimpath -buildvcs=false -o "$output" .
)

echo "DarkPanel Telegram Bot built at $output"
