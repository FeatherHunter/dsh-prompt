# issue #160 复核：复跑全部探针并把真实 Chromium 的测量输出落盘
#
# 用法（仓库根目录）：pwsh -NoProfile -File research\hostfont-double-scale\run-probes.ps1
# 前置：node research\hostfont-double-scale\build-probe.mjs   （生成三个 HTML 探针）
#
# 为什么用 --dump-dom 而不是截图读字：--dump-dom 直接给出探针页里 getComputedStyle 的
# 文本结果，是真实 Chromium 的 JS 求值，没有 OCR 误差。海报截图（poster-double-scale.html）
# 只是给人看的旁证，独立再跑一遍同样的算式。

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$tmp = Join-Path $root 'scripts\.rt-tmp-160'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$ev = Join-Path $PSScriptRoot 'evidence'
New-Item -ItemType Directory -Force -Path $ev | Out-Null

$chrome = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw '未找到 Chrome / Edge，无法取得真实浏览器数值' }
Write-Output "browser = $chrome"

$jobs = @(
  @{ name = 'probe-double-scale';        file = 'research\hostfont-double-scale\probe-double-scale.html' },
  @{ name = 'probe-148-persistence';     file = 'research\hostfont-double-scale\probe-148-persistence.html' },
  @{ name = 'probe-hostfont-cascade';    file = 'research\probe-hostfont-cascade.html' }
)

$lines = @("# issue #160 复核 · 探针实跑记录", "# browser: $chrome", "# profile: scripts\.rt-tmp-160", '')

foreach ($j in $jobs) {
  $src = Join-Path $root $j.file
  $url = 'file:///' + ($src -replace '\\', '/')
  $domFile = Join-Path $tmp ($j.name + '.dom.html')
  $errFile = Join-Path $tmp ($j.name + '.err.txt')
  # chrome.exe 是 GUI 子系统程序，直接 & 调用拿不到 stdout，必须重定向到文件
  $p = Start-Process -FilePath $chrome -NoNewWindow -Wait -PassThru `
    -ArgumentList @('--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
      "--user-data-dir=$tmp", '--virtual-time-budget=8000', '--dump-dom', $url) `
    -RedirectStandardOutput $domFile -RedirectStandardError $errFile
  $dom = Get-Content -Raw $domFile
  $m = [regex]::Match($dom, '(?s)<pre id="out"[^>]*>(.*?)</pre>')
  if (-not $m.Success) { throw ("{0}: 未取到 <pre id=out>，exit={1}" -f $j.name, $p.ExitCode) }
  $text = $m.Groups[1].Value -replace '&lt;', '<' -replace '&gt;', '>' -replace '&amp;', '&'
  $outFile = Join-Path $ev ($j.name + '.out.txt')
  Set-Content -Path $outFile -Value $text -Encoding UTF8
  Write-Output ("[{0}] exit={1} -> {2}" -f $j.name, $p.ExitCode, $outFile)
  $lines += ("===== {0}（{1}） =====" -f $j.name, $j.file)
  $lines += $text.TrimEnd()
  $lines += ''
}

Set-Content -Path (Join-Path $ev 'all-probes.out.txt') -Value ($lines -join "`r`n") -Encoding UTF8
Write-Output ("合并记录 -> " + (Join-Path $ev 'all-probes.out.txt'))
