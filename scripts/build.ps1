# dsh-prompt build（Windows / PowerShell）：与 scripts/build.sh 同一条流水线，只是把
# 「bash 从哪来」这件事在 Windows 上说清楚。
#
# 为什么需要它：`npm run build` 走 `bash scripts/build.sh`，而本机 PATH 里的 bash 是
# `C:\Windows\system32\bash.exe`（WSL 启动器）。WSL 里跑的是 Linux 版 node，而 node_modules
# 里的 esbuild 是 win32 二进制，于是宿主半打包会报「You installed esbuild for another platform」。
# 客户端那半（tsdown / rolldown）不受影响，所以只在宿主半这一步换到 Windows 的 node。
#
# 用法：pwsh -File scripts/build.ps1  或  npm run build:pwsh
# 退出码：0 = 全部产物齐；非 0 = 有一步失败（与 build.sh 的 `set -e` 语义一致）。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Invoke-Step([string]$label, [scriptblock]$body) {
  Write-Host "=== $label ==="
  & $body
  if ($LASTEXITCODE -ne 0) { throw "$label 失败（退出码 $LASTEXITCODE）" }
}

# 客户端 bundle：任何 node 都行（rolldown 是纯 JS/wasm），走 npm 入口。
Invoke-Step 'build:client (tsdown)' { npm run build:client }

# 宿主半：必须用「与本机 esbuild 同平台」的 node。优先 Git Bash（它的 node 就是 Windows 的），
# 其次 Windows 的 node；两者都没有就老实失败，并给出修法。
# 用 `-c` 而不是 `-lc`：登录 shell 会去 source 用户的 ~/.bashrc，那里的报错混进来会盖住真错误。
$gitBash = @(
  'C:\Program Files\Git\bin\bash.exe',
  'C:\Program Files (x86)\Git\bin\bash.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1

Invoke-Step 'build:update-host (esbuild)' {
  if ($IsWindows -and $gitBash) {
    & $gitBash -c "cd '$($root.Replace('\', '/'))' && npm run build:update-host"
  } else {
    npm run build:update-host
  }
}

Write-Host '=== verify ==='
foreach ($f in @('lib/index.js', 'lib/client.js', 'lib/update.js')) {
  if (-not (Test-Path $f)) { throw "缺产物：$f" }
  Write-Host "$f OK"
}
