# 不纳入范围：让「屏蔽预制模板」作用于 /prompt 斜杠源

- 日期：2026-11-02
- 关联：#195（按设计边界收口）、#196（裸 / 收口方案 B）、#165（hidePreset 的三表面合同）、#9（/prompt 源验收）
- 结论：不把 `hidePreset` 扩到 `/prompt` 触发源。这是既有的产品边界，不是待修的遗漏。

## 合同依据

- #165 把 `hidePreset` 定义为「列表与标签云」的全局偏好：CHANGELOG.md:123 只列「小列表底栏眼睛按钮、大列表底部按钮、设置页开关三处同源联动」；`src/client/strings.ts:55` 的提示文案也只承诺「列表与标签云」。
- `src/client/template-browser.ts:1689` 的设计注释明确：`/prompt`（`src/client/prompt-trigger.ts`）与智能卡（`src/client/smart-card.ts`）走 template-library 的独立检索，「不受影响，无需同步」。
- `/prompt` 的语义是显式命令：`/prompt` 列出全部模板、`/prompt<词>` 过滤（README.md:86、#9 验收与 OWNER 评论）。把 hidePreset 套进去会破坏这条公开承诺，并使「显式命令」与「列表浏览」两种入口行为分叉。

## 代码现状

- `applyHidePreset` 全仓唯一调用点：`src/client/template-browser.ts:1678`（面板可见池）。
- `/prompt` 两条分支都是裸 `allTemplates()`：`src/client/prompt-trigger.ts:45,47`。
- 其它裸 `allTemplates()` 检索点：`src/client/smart-score.ts:88`、`src/client/smart-card.ts:258`（智能卡/智能评分，边界另议）。

## 用户可见症状如何收口

#196 方案 B（空 query 返回 `[]`）落地后，裸 `/` 不再出现模板组，因此开启 hidePreset 的用户不会在 `/` 看到预制模板；只有显式输入 `/prompt` 才看到全量。这是刻意保留的显式语义。

## 若将来要改变

先改产品合同（strings、README、#165/#9 的验收），再评估是否把 hidePreset 扩到 `/prompt`；同时要一起评估智能卡/智能评分等其它裸 `allTemplates()` 检索点，不要只改一处。

---

本文件是 #195 triage 的决策记录，链接自 #195 的收口评论。
