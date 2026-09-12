#!/bin/bash
# dsh-prompt build：client bundle（tsdown）→ lib/client.js；host 半：lib/index.js 为已检入，
# 更新能力（#39）的宿主半 src/update/host/ 由 esbuild 打包 → lib/update.js。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "=== build:client (tsdown) ==="
npm run build:client
echo "=== build:update-host (esbuild) ==="
# WSL 的 bash 下 `npm run` 跑的是 Linux 版 node，而本机 esbuild 的副本是 win32 的：
# 报错长成「You installed esbuild for another platform」，纯属环境串味，不是宿主半源码的问题
# （客户端 tsdown 走 rolldown，不受影响）。这种情形只能改用 Windows 的 node 跑同一条构建命令；
# 打包参数只有 scripts/update/build-host.mjs 一处，不在别处复制。
if node scripts/update/build-host.mjs; then
  :
elif command -v cmd.exe >/dev/null 2>&1 && cmd.exe /c "node scripts\\update\\build-host.mjs"; then
  echo "（改用 Windows 的 node 跑同一条构建命令）"
else
  echo "build:update-host 跑不了：当前 node 用不了本机 esbuild。" >&2
  echo "修法：在 Windows 的 PowerShell 里跑一次 —— npm run build:update-host" >&2
  echo "（成因：WSL 下 package.json 只装了 win32 的 esbuild，且本机 WSL interop 关着，跑不了 node.exe）" >&2
  exit 1
fi
echo "=== verify ==="
test -f lib/index.js && echo "lib/index.js OK"
test -f lib/client.js && echo "lib/client.js OK"
test -f lib/update.js && echo "lib/update.js OK"
