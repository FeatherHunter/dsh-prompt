# 好样本：零机器值的方法层文档

- 产物路径用占位符：`<pack-dir>/dsh-prompt-<version>.tgz`。
- 证据根用占位符：`<evidence-root>`。
- 用户级 skill 根是约定位置：`$DSH_HOME/skills` 或 `~/.dsh/skills`。
- 宿主端口交给系统分配：`--port 0`；连接地址形如 `<host>:<port>`。
- 运行期绑定都从参数进来：`--artifact`、`--dsh-cli`、`--browser`、`--evidence-dir`。
- 仓内引用只用相对路径：`docs/real/onboarding.md`、`scripts/real/run.mjs`。
