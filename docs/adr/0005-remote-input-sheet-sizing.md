# 输入 Sheet 复用挑选器尺寸数学，不另起第三套（#123，ADR-0002 续篇）

**状态**：accepted（2026-10-05，#122 v3 定稿 → #123 落地）。

## 背景

- ADR-0002 已冻结远程尺寸唯一真相：高度取锚点上方全部可用高度、内部相对缩放，代码无绝对 px。
- 挑选器（picker.ts）已有一套 mask＋缩放根数学（root fixed inset 0 z MODAL_Z fontSize calc(1em*scale)；mask 居中；sheet 近全屏内缩）。
- 输入 Sheet（v3 A贴底）若另起一套 math，三处拷贝即漂移（档位表、根锚、遮罩色任一改即分叉）。

## 决定

1. **复用，不复制**：输入 Sheet 根＋遮罩与挑选器同式（同 MODAL_Z、同 calc 根、同 rgba 遮罩），仅三参数不同——对齐底贴（flex-end）、上限 62dvh、宽 min(100%-1em,36em)（em地板 min(100%-1em,20em)）。
2. **禁第三套 math**：后续远程面（模型弹窗有面后）同样只改这三参数，不得新写缩放根/档位表/遮罩色；回归断言此条（源码级）。
3. **dvh＋键盘感知**：上限用 dvh（键盘弹起即收），开框 focus＋scrollIntoView({block:'nearest'})，不另起 visualViewport 监听（原型同口径）。

## 后果

- 档位表只 remoteView.REMOTE_SIZE_SCALES 一处；改步进即全远程面同动。
- 验收只断相对（贴底/盖住 Dock/内滚），不断绝对 px。
