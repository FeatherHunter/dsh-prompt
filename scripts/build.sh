#!/bin/sh
# 一行转发：真正的编排只有一处 —— scripts/build.mjs（node 直接跑，跨平台，见该文件头部）。
# 保留这个入口只是给习惯 `bash scripts/build.sh` 的人；`npm run build` 不经这里。
# 注意：在 WSL 的 bash 里跑本文件用的是 Linux 版 node，会和 win32 的 esbuild 平台对不上；
# 那种情形请改用 Windows 的 PowerShell / cmd 跑 `npm run build`（build.mjs 会给出同一条提示）。
exec node "$(dirname "$0")/build.mjs"
