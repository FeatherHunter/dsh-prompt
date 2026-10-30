# 坏样本：README 风格的本机证据目录（应被 M1 拒绝）

这一段故意模仿 `scripts/real/README.md` 里的运行命令与证据路径写法，
用来证明扫描范围已经覆盖实现层文档，而不只是方法层四篇。

```bash
node scripts/real/run.mjs --artifact D:/Temp/pack-review/dsh-prompt-0.4.39.tgz \
  --suite boundary --fixture templates \
  --evidence-dir D:/Temp/evidence-review
```

期望：M1（盘符绝对路径）命中；门禁必须红。
