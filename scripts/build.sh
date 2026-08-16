#!/bin/bash
# dsh-prompt build：client bundle（tsdown）→ lib/client.js；host lib/index.js 为已检入 no-op。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "=== build:client (tsdown) ==="
npm run build:client
echo "=== verify ==="
test -f lib/index.js && echo "lib/index.js OK"
test -f lib/client.js && echo "lib/client.js OK"
