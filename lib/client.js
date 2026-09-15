window.__ModuleLoader__.load({
	id: "dsh-prompt",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/client/templates.ts
		const PRESET_TEMPLATES = [
			{
				id: "fp",
				name: "第一性原理拆解",
				nameEn: "First Principles",
				domain: "思考框架",
				stage: "执行前",
				action: ["拆解"],
				labels: [
					"思考框架",
					"执行前",
					"拆解"
				],
				builtin: true,
				body: [
					"请用第一性原理分析以下主题，按编号结构化输出，结论先行：",
					"1. 这个问题的基本组成单元是什么？",
					"2. 哪些是真正不可改变的真理（而非假设）？",
					"3. 如果去掉所有既有假设，问题本身还剩下什么？",
					"4. 有哪些被大多数人默认为常识、但其实可以颠覆的？",
					"5. 基于以上推演给出你的原创见解，并说明它与主流看法的差异。",
					"主题："
				].join("\n")
			},
			{
				id: "socratic",
				name: "苏格拉底式追问",
				nameEn: "Socratic Questioning",
				domain: "思考框架",
				stage: "执行前",
				action: ["检验"],
				labels: [
					"思考框架",
					"执行前",
					"检验"
				],
				builtin: true,
				body: [
					"请用苏格拉底式追问帮助我思考，按编号结构化输出：",
					"1. 先复述我当前的观点或核心假设；",
					"2. 提出 3 个最有力的质疑；",
					"3. 找出一个我尚未考虑到的视角；",
					"4. 如果你是深思熟虑的对话者，你会问我哪几个我没想到的问题？",
					"5. 追问结束后，把整个过程浓缩成一个更精准的问题。",
					"主题："
				].join("\n")
			},
			{
				id: "deep",
				name: "深度多维分析",
				nameEn: "Deep Analysis",
				domain: "思考框架",
				stage: "执行前",
				action: ["归因"],
				labels: [
					"思考框架",
					"执行前",
					"归因"
				],
				builtin: true,
				body: [
					"请从多个维度深度分析以下主题，按编号结构化输出，结论先行：",
					"1. 本质是什么？",
					"2. 有哪些常见的误解？",
					"3. 支持和反对的证据分别是什么？",
					"4. 这个问题的边界在哪里（什么情况下它不再成立）？",
					"5. 如果你必须做出一个判断，会是什么？",
					"6. 你最强的那个结论，弱点在哪里？",
					"主题："
				].join("\n")
			},
			{
				id: "adversarial",
				name: "对抗式审查",
				nameEn: "Adversarial Review",
				domain: "思考框架",
				stage: "执行前",
				action: ["检验"],
				labels: [
					"思考框架",
					"执行前",
					"检验"
				],
				builtin: true,
				body: [
					"请对以下方案/结论做对抗式审查（红队角色），先给一段结论摘要，再按编号展开：",
					"1. 找出其中最强的 5 个假设，逐一论证它们可能如何失效；",
					"2. 构造最可能推翻它的 3 个反例或失败场景；",
					"3. 指出其中隐藏的认知偏差与利益相关方视角的盲区；",
					"4. 给出「如果这个方案失败，最可能的原因是什么」的排序清单；",
					"5. 最后给出：在何种条件下你才会认为它是错的——以及何种证据能让你改变立场。",
					"方案 / 结论："
				].join("\n")
			},
			{
				id: "decision",
				name: "决策博弈分析",
				nameEn: "Decision Analysis",
				domain: "思考框架",
				stage: "执行前",
				action: ["决策"],
				labels: [
					"思考框架",
					"执行前",
					"决策"
				],
				builtin: true,
				body: [
					"你是一位冷静的决策分析师。请分析我的处境，按编号结构化输出（你的选择仅作参考，重点是分析过程）：",
					"1. 列出每个选项最坏的结果是什么；",
					"2. 每个选项最好的结果是什么；",
					"3. 最可能的结果是什么；",
					"4. 如果 10 年后回头看，我可能会后悔什么；",
					"5. 有没有哪条路是「没有回头路」的；",
					"6. 给出你本人的选择并说明理由；再指出我可能忽略的第三个选项。",
					"我的处境（选项与背景）："
				].join("\n")
			},
			{
				id: "premortem",
				name: "事前验尸",
				nameEn: "Pre-mortem",
				domain: "思考框架",
				stage: "执行前",
				action: ["决策"],
				labels: [
					"思考框架",
					"执行前",
					"决策"
				],
				builtin: true,
				body: [
					"假设以下方案/项目已经在一年后彻底失败。请以「事后回溯」的方式写失败分析，按编号结构化输出：",
					"1. 按可能性从高到低列出 8 个失败原因；",
					"2. 对前 3 个原因，给出现在就能做的预防措施；",
					"3. 指出哪些早期信号现在就该监控；",
					"4. 最后说明：这个方案是否从一开始就有致命缺陷。",
					"方案描述："
				].join("\n")
			},
			{
				id: "feynman",
				name: "费曼技巧",
				nameEn: "Feynman Technique",
				domain: "思考框架",
				stage: "执行后",
				action: ["理解"],
				labels: [
					"思考框架",
					"执行后",
					"理解"
				],
				builtin: true,
				body: [
					"请用费曼技巧确认我是否真正理解了以下概念，按编号结构化输出：",
					"1. 用最简单的语言、面向完全不懂的人解释这个概念（禁止术语）；",
					"2. 给出 2 个生动类比和 2 个反例；",
					"3. 指出我理解中的错误或不准确之处；",
					"4. 设计 3 个判断题检验我是否真的懂了。",
					"概念：",
					"我的理解（可选）："
				].join("\n")
			},
			{
				id: "fivewhys",
				name: "五个为什么",
				nameEn: "Five Whys",
				domain: "思考框架",
				stage: "执行中",
				action: ["归因"],
				labels: [
					"思考框架",
					"执行中",
					"归因"
				],
				builtin: true,
				body: ["针对以下问题，请连续追问五个「为什么」，每层基于上一层的事实回答，最后区分根本原因与表层触发因素并给出解决方向：", "问题描述："].join("\n")
			},
			{
				id: "mece",
				name: "MECE 拆解",
				nameEn: "MECE Decomposition",
				domain: "思考框架",
				stage: "执行前",
				action: ["拆解"],
				labels: [
					"思考框架",
					"执行前",
					"拆解"
				],
				builtin: true,
				body: [
					"请用 MECE 原则拆解以下问题，按编号结构化输出：",
					"1. 给出 3~6 个相互独立（Mutually Exclusive）的分类维度；",
					"2. 每个维度下列出所有子项，确保完全穷尽（Collectively Exhaustive）；",
					"3. 指出拆解中可能的遗漏与重叠；",
					"4. 给出按重要性排序后的关键子问题清单。",
					"问题："
				].join("\n")
			},
			{
				id: "bias",
				name: "认知偏差检查",
				nameEn: "Cognitive Bias Check",
				domain: "思考框架",
				stage: "执行前",
				action: ["检验"],
				labels: [
					"思考框架",
					"执行前",
					"检验"
				],
				builtin: true,
				body: [
					"请审查以下推理/计划/结论中的认知偏差，按编号结构化输出：",
					"1. 列出可能影响它的偏差（确认偏误、沉没成本、可得性、锚定、乐观/悲观偏差、群体思维等），并指出具体证据；",
					"2. 对每条偏差，给出「如何检验是否真的受影响」的方法；",
					"3. 给出一个反事实检验：如果结论被证明是错的，最可能因为哪条偏差？",
					"推理 / 计划 / 结论："
				].join("\n")
			},
			{
				id: "learnpath",
				name: "学习路线设计",
				nameEn: "Learning Path",
				domain: "学习",
				stage: "执行前",
				action: ["路线"],
				labels: [
					"学习",
					"执行前",
					"路线"
				],
				builtin: true,
				body: [
					"请为以下领域/技能设计一条从零到可实战的学习路线，按编号结构化输出：",
					"1. 按阶段拆分（入门→进阶→实战），每个阶段给出学习目标；",
					"2. 每个阶段推荐 2~3 个核心主题和练习方式；",
					"3. 指出常见的「伪学习陷阱」（只收藏不练习等）；",
					"4. 给出一个 30 天内可完成的最小闭环，以及检验掌握程度的基准。",
					"领域 / 技能：",
					"当前水平（可选）：",
					"目标（可选）："
				].join("\n")
			},
			{
				id: "concept",
				name: "概念澄清",
				nameEn: "Concept Clarification",
				domain: "学习",
				stage: "执行前",
				action: ["概念"],
				labels: [
					"学习",
					"执行前",
					"概念"
				],
				builtin: true,
				body: [
					"请帮我彻底理解以下概念，按编号结构化输出：",
					"1. 一句话定义 + 一个最小例子；",
					"2. 它与常见相近概念的本质区别（各给一个对比场景）；",
					"3. 这个概念在什么情况下不适用（边界）；",
					"4. 给出 3 个由浅入深的练习场景让我检验理解。",
					"概念：",
					"相近概念（可选，不知道可留空，AI 自行选常见相近概念对比）："
				].join("\n")
			},
			{
				id: "quiz",
				name: "AI 反向考验",
				nameEn: "AI Quiz",
				domain: "学习",
				stage: "执行后",
				action: ["考验"],
				labels: [
					"学习",
					"执行后",
					"考验"
				],
				builtin: true,
				body: [
					"请通过出题检验我是否真正理解了以下主题/交付内容：",
					"1. 设计选择题/判断题/简答题/案例题（由浅入深）；",
					"2. 我作答后指出错误与盲区；",
					"3. 直到回答正确、知识点无盲区后再确认交付。",
					"主题 / 交付内容："
				].join("\n")
			},
			{
				id: "codereview",
				name: "代码审查",
				nameEn: "Code Review",
				domain: "工程",
				stage: "执行前",
				action: ["审查"],
				labels: [
					"工程",
					"执行前",
					"审查"
				],
				builtin: true,
				body: [
					"请审查以下代码，先给总体结论，再按严重程度排序输出，每个问题附具体修改建议（含示例代码）：",
					"1. 正确性：潜在 bug、边界条件、并发/异步问题；",
					"2. 安全：注入、鉴权、敏感信息、依赖风险；",
					"3. 可维护性：命名、结构、重复、可读性；",
					"4. 性能：明显的低效点。",
					"代码过长时可分段审查，但最终汇总为一页结论。",
					"代码 / 文件 / 技术栈："
				].join("\n")
			},
			{
				id: "testdesign",
				name: "测试用例设计",
				nameEn: "Test Design",
				domain: "工程",
				stage: "执行中",
				action: ["测试"],
				labels: [
					"工程",
					"执行中",
					"测试"
				],
				builtin: true,
				body: [
					"请为以下功能设计测试用例，按编号结构化输出：",
					"1. 正常路径用例（含输入/预期输出）；",
					"2. 边界与极端值用例；",
					"3. 异常与错误处理用例；",
					"4. 并发/重复/幂等场景（如适用）；",
					"5. 指出哪些用例最容易漏、以及对应的风险。",
					"功能描述："
				].join("\n")
			},
			{
				id: "refactor",
				name: "重构方案",
				nameEn: "Refactoring Plan",
				domain: "工程",
				stage: "执行中",
				action: ["重构"],
				labels: [
					"工程",
					"执行中",
					"重构"
				],
				builtin: true,
				body: [
					"请为以下代码提出重构方案，按编号结构化输出：",
					"1. 指出当前结构的主要问题（职责、耦合、可测试性）；",
					"2. 给出目标结构（抽象与拆分建议，含示例）；",
					"3. 按「小步重构」顺序列出步骤，每一步可独立提交且行为不变；",
					"4. 指出哪些重构有风险、需要测试保护。",
					"代码 / 模块："
				].join("\n")
			},
			{
				id: "explain",
				name: "解释代码",
				nameEn: "Explain Code",
				domain: "工程",
				stage: "执行中",
				action: ["解读"],
				labels: [
					"工程",
					"执行中",
					"解读"
				],
				builtin: true,
				body: [
					"请解释以下代码，按编号结构化输出：",
					"1. 这段代码做什么（一句话）；",
					"2. 逐段讲解执行流程与关键数据结构；",
					"3. 指出其中「为什么这样写」的设计取舍；",
					"4. 指出潜在问题与改进点；",
					"5. 用一句话概括它在我更大的系统里扮演的角色。",
					"代码："
				].join("\n")
			},
			{
				id: "blindspot",
				name: "盲区检查",
				nameEn: "Blind Spot Pass",
				domain: "执行",
				stage: "执行前",
				action: ["启动"],
				labels: [
					"执行",
					"执行前",
					"启动"
				],
				builtin: true,
				body: [
					"在我开始以下任务之前，请帮我做一次盲区检查，按编号结构化输出：",
					"1. 我可能遗漏的关键变量有哪些？",
					"2. 潜在的风险与最容易忽略的影响因素？",
					"3. 哪些点需要提前决策、哪些可以后置？",
					"4. 给我一个 3 分钟内可完成的快速检查清单。",
					"我的计划（目标 / 约束）："
				].join("\n")
			},
			{
				id: "snapshot",
				name: "零丢失快照",
				nameEn: "Zero-loss Snapshot",
				domain: "执行",
				stage: "执行中",
				action: ["固化"],
				labels: [
					"执行",
					"执行中",
					"固化"
				],
				builtin: true,
				body: [
					"请执行一次「零丢失快照」：",
					"1. 把我们从会话开始至今的关键信息，按「目的地 / 约束与偏好 / 已确认的决定 / 待决问题 / 雾区（隐约可见但还不清晰）」五类逐条列出——不压缩、不合并，宁可啰嗦不可省略；",
					"2. 每条标注出处（引用我原话）；",
					"3. 单独列一节「可疑遗漏」：凡是我提过但你觉得与主线无关、太模糊或像执行细节而没纳入的，全部摆出并写明理由；",
					"4. 列完后停下等我逐条核对，确认后再落盘。"
				].join("\n")
			},
			{
				id: "kickoff",
				name: "任务启动",
				nameEn: "Task Kickoff",
				domain: "执行",
				stage: "执行前",
				action: ["启动"],
				labels: [
					"执行",
					"执行前",
					"启动"
				],
				builtin: true,
				body: [
					"在开始以下任务之前，请先确认起点并澄清细节，按编号结构化输出：",
					"1. 最终目标（要做什么）；",
					"2. 当前进度（目前想到哪一步）；",
					"3. 经验水平（新手 / 有经验 / 专家）；",
					"4. 不熟悉的地方；",
					"5. 成功的标准；",
					"6. 通过提问澄清细节（成功标准之外还有哪些约束、有哪些风险现在就该知道）。",
					"最终目标：",
					"当前进度（可选）：",
					"经验水平（新手 / 有经验 / 专家）：",
					"不熟悉的地方（可选）："
				].join("\n")
			},
			{
				id: "prototype",
				name: "原型验证",
				nameEn: "Prototype Validate",
				domain: "执行",
				stage: "执行前",
				action: ["启动"],
				labels: [
					"执行",
					"执行前",
					"启动"
				],
				builtin: true,
				body: [
					"请为以下主题/想法做原型验证，每轮输出保持克制（方向概要即可，不要太长）：",
					"1. 给出 2~4 个方向差距很大的候选方案；",
					"2. 每个方向给出最小的验证方式（怎么快速试错）；",
					"3. 由我选择和反馈，几轮后逐步收敛到满意的方向；",
					"4. 收敛后给出下一步的执行计划要点。",
					"主题 / 想法："
				].join("\n")
			},
			{
				id: "plan",
				name: "执行计划",
				nameEn: "Execution Plan",
				domain: "执行",
				stage: "执行前",
				action: ["启动"],
				labels: [
					"执行",
					"执行前",
					"启动"
				],
				builtin: true,
				body: [
					"请为以下目标制定执行计划，按编号结构化输出（时间安排是可调整的草案）：",
					"1. 明确步骤（含顺序与依赖）；",
					"2. 时间安排（每步预计时长/里程碑）；",
					"3. 所需资源和工具；",
					"4. 交付物和验收标准；",
					"5. 风险和应对方案。",
					"目标：",
					"约束（可选）："
				].join("\n")
			},
			{
				id: "deviation",
				name: "记录偏离",
				nameEn: "Deviation Log",
				domain: "执行",
				stage: "执行中",
				action: ["记录"],
				labels: [
					"执行",
					"执行中",
					"记录"
				],
				builtin: true,
				body: [
					"请担任我的过程记录员（多轮持续角色）：从现在起，在每次交互后更新一份简洁的偏离记录，按编号结构化：",
					"1. 遇到了什么新的情况？",
					"2. 为什么改变了方案？",
					"3. 做了哪些关键决定？",
					"4. 对结果有什么影响？",
					"每次只输出「新增/变更」条目，不要重复已记录内容。"
				].join("\n")
			},
			{
				id: "retro",
				name: "过程复盘",
				nameEn: "Retrospective",
				domain: "执行",
				stage: "执行后",
				action: ["复盘"],
				labels: [
					"执行",
					"执行后",
					"复盘"
				],
				builtin: true,
				body: [
					"请帮我复盘刚刚完成的以下任务/项目，按编号结构化输出：",
					"1. 整体步骤回顾（实际 vs 计划的差异）；",
					"2. 使用的资料和工具；",
					"3. 遇到的困难；",
					"4. 解决思路与可复用经验；",
					"5. 如果重来一次，哪些地方会做得不同？",
					"任务 / 项目："
				].join("\n")
			}
		];
		function getPresetById(id) {
			return PRESET_TEMPLATES.find((t) => t.id === id);
		}
		//#endregion
		//#region src/client/store.ts
		const MAX_PIN = 5;
		/** 输入分隔符：逗号（中英）/顿号/空白 */
		const LABEL_SEP = /[,，、\s]+/;
		/** 回落词：空标签回落（#19 R2 D4；不是归属维度，见自定义页签语义） */
		const LABEL_FALLBACK = "自定义";
		const STORE_URL = "/_dsh/dsh-prompt/store";
		const PUT_URL = "/_dsh/dsh-prompt/customs/put";
		const DELETE_URL = "/_dsh/dsh-prompt/customs/delete";
		const BUMP_URL = "/_dsh/dsh-prompt/usage/bump";
		const PINNED_URL = "/_dsh/dsh-prompt/pinned/set";
		const cache = {
			customs: [],
			usage: {},
			pinned: [],
			lastUsed: null
		};
		let storeLoaded = false;
		let loadPromise = null;
		const storeListeners = /* @__PURE__ */ new Set();
		function notifyStore() {
			storeListeners.forEach((fn) => {
				try {
					fn();
				} catch (e) {}
			});
		}
		/** 订阅存储变更（React 侧用 effect 订阅 + refresh；返回取消函数）。 */
		function subscribeStore(fn) {
			storeListeners.add(fn);
			return () => {
				storeListeners.delete(fn);
			};
		}
		async function fetchJSON(url, init) {
			try {
				if (typeof fetch === "undefined") return null;
				const res = await fetch(url, init);
				if (!res.ok) return null;
				return await res.json();
			} catch (e) {
				return null;
			}
		}
		/** 路由名（日志里只记这个枚举，不记 URL 原文；与事件清单的 route 取值一一对应）。 */
		const ROUTE_NAMES = {
			[PUT_URL]: "customs.put",
			[DELETE_URL]: "customs.delete",
			[BUMP_URL]: "usage.bump",
			[PINNED_URL]: "pinned.set"
		};
		/** 拉取 host 快照并装入缓存（失败 → 保持内存默认 + 记事件，不读旧 localStorage）。 */
		function ensureLoaded() {
			if (storeLoaded) return Promise.resolve();
			if (loadPromise) return loadPromise;
			loadPromise = (async () => {
				const startedAt = Date.now();
				const data = await fetchJSON(STORE_URL);
				if (data && data.ok && data.value) {
					const v = data.value;
					if (Array.isArray(v.customs)) cache.customs = v.customs;
					if (v.usage && typeof v.usage === "object") cache.usage = v.usage;
					if (Array.isArray(v.pinned)) cache.pinned = v.pinned.filter((x) => typeof x === "string");
					cache.lastUsed = typeof v.lastUsed === "string" ? v.lastUsed : null;
					logEvent$3("store.snapshot.ok", {
						customs: cache.customs.length,
						pinned: cache.pinned.length,
						latencyMs: Date.now() - startedAt
					});
				} else logEvent$3("store.snapshot.fail", {
					reason: typeof fetch === "undefined" ? "no-fetch" : "http-or-json-fail",
					latencyMs: Date.now() - startedAt
				});
				storeLoaded = true;
				notifyStore();
			})().finally(() => {});
			return loadPromise;
		}
		/** 落盘形状（#23：只写 labels；旧 tag 与占位三件套不写回，读时映射即可，不双写） */
		function toHostShape(t) {
			const rest = { ...t };
			delete rest.tag;
			delete rest.domain;
			delete rest.stage;
			delete rest.action;
			return {
				...rest,
				labels: templateLabels(t)
			};
		}
		/** fire-and-forget 落盘（失败记事件，不回滚内存、不抛给 UI）。 */
		function persist(url, body) {
			try {
				if (typeof fetch === "undefined") return;
				fetch(url, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body)
				}).then(() => void 0, (e) => {
					logEvent$3("store.persist.fail", {
						route: ROUTE_NAMES[url] ?? "unknown",
						errorHash: String(e && e.message || e)
					});
				});
			} catch (e) {}
		}
		function loadUsage() {
			return { ...cache.usage };
		}
		function bumpUsage(id) {
			cache.usage[id] = (cache.usage[id] || 0) + 1;
			cache.lastUsed = id;
			notifyStore();
			persist(BUMP_URL, { id });
		}
		/** 最近一次使用的模板 id（智能模式「最近使用」候选；无 → null） */
		function loadLastUsed() {
			return cache.lastUsed;
		}
		function loadPinned() {
			return [...cache.pinned];
		}
		/** 全部模板（预制 + 自定义） */
		function allTemplates() {
			return [...PRESET_TEMPLATES, ...cache.customs];
		}
		function getTemplate(id) {
			return allTemplates().find((t) => t.id === id);
		}
		/** 字数（按码点，CJK 一字计一） */
		function labelLen(s) {
			return Array.from(s).length;
		}
		/**
		* 模板标签：预置 = labels（回填值，恒 3 个）；自定义 = 自选 labels。
		* 读时兼容旧形状：labels 缺失/为空 → 预置按领域+阶段+动作机械派生（#19 R2 D3 公式），
		* 自定义取旧单 tag 为首元、空则回落「自定义」（#19 R2 D4；旧占位三件套直接丢弃）。
		*/
		function templateLabels(t) {
			const own = t.labels;
			if (Array.isArray(own) && own.length > 0) return [...own];
			if (t.builtin) {
				const derived = [
					t.domain,
					t.stage,
					...t.action || []
				].filter((x) => typeof x === "string");
				if (derived.length > 0) return derived;
			} else {
				const tag = (t.tag || "").trim();
				if (tag) return [tag];
			}
			return [LABEL_FALLBACK];
		}
		/** 标签串（展示共用；分隔符 '/'，与 #19 R2 附录记法一致） */
		function labelString(t, sep = "/") {
			return templateLabels(t).join(sep);
		}
		/** 标签命中（筛选共用；单选语义：包含所选标签即命中，#19 R3 D5） */
		function matchLabel(t, label) {
			return templateLabels(t).indexOf(label) >= 0;
		}
		/** 已有词（自定义标签输入的选取来源：预置 23 词 + 在用自定义词，去重保序） */
		function allKnownLabels() {
			const seen = /* @__PURE__ */ new Set();
			const out = [];
			const push = (l) => {
				if (l && !seen.has(l)) {
					seen.add(l);
					out.push(l);
				}
			};
			for (const t of PRESET_TEMPLATES) templateLabels(t).forEach(push);
			for (const t of cache.customs) templateLabels(t).forEach(push);
			return out;
		}
		/** 归一化：拆分 → 去首尾空 → 去空 → 去重（保序）。空标签与重复是自动清理项，不是错误。 */
		function normalizeLabels(input) {
			const parts = Array.isArray(input) ? input.slice() : typeof input === "string" ? input.split(LABEL_SEP) : [];
			const seen = /* @__PURE__ */ new Set();
			const out = [];
			for (const p of parts.flatMap((x) => String(x).split(LABEL_SEP))) {
				const w = p.trim();
				if (!w || seen.has(w)) continue;
				seen.add(w);
				out.push(w);
			}
			return out;
		}
		/**
		* 校验（保存时阻断并行内提示，不静默截断）：
		* 空输入 → 回落 ['自定义']（#19 R2 D4）；'任意' → 阻断；超长 → 阻断；超数 → 阻断。
		*/
		function validateLabels(input) {
			const cleaned = normalizeLabels(input);
			if (cleaned.length === 0) return {
				ok: true,
				labels: [LABEL_FALLBACK]
			};
			for (const w of cleaned) if (w === "任意") return {
				ok: false,
				error: "labelReserved"
			};
			for (const w of cleaned) {
				const n = labelLen(w);
				if (n < 1 || n > 10) return {
					ok: false,
					error: "labelTooLong"
				};
			}
			if (cleaned.length > 3) return {
				ok: false,
				error: "labelsTooMany"
			};
			return {
				ok: true,
				labels: cleaned
			};
		}
		/** 检索串（面板搜索与 /prompt 触发源共用）：名称/英文名/正文/领域/阶段/动作/标签（旧找法不断） */
		function templateHaystack(t) {
			return (t.name + " " + (t.nameEn || "") + " " + (t.body || "") + " " + (t.domain || "") + " " + (t.stage || "") + " " + (t.action || []).join(" ") + " " + templateLabels(t).join(" ")).toLowerCase();
		}
		/** 排序（#68 决议 2026-09-15）：设置页与 /prompt 忽略置顶，只按用量计数降序 → 末键。
		*  置顶仅悬浮列表生效（见 sortedTemplatesBottomUp）。用量仅供排序，不显示数字（显示由 #69/#71 落地）。
		*  #22 决议中“设置页置顶绝对优先”一句被本票推翻；降序方向本身维持（管理面与菜单首屏例外，见 #22 Q2/Q6）。 */
		function sortedTemplates(list) {
			const usage = cache.usage;
			return [...list].sort((a, b) => {
				const d = (usage[b.id] || 0) - (usage[a.id] || 0);
				if (d !== 0) return d;
				return tieBreakOrder(a, b);
			});
		}
		/** 统一末键（#22：三面 bottom-up 共用）——置顶原始顺序（预制按 final.md 定稿顺序，自定义按 createdAt） */
		const presetOrderMap = new Map(PRESET_TEMPLATES.map((t, i) => [t.id, i]));
		function tieBreakOrder(a, b) {
			const aCustom = a;
			const bCustom = b;
			const aBuilt = !!a.builtin;
			const bBuilt = !!b.builtin;
			if (aBuilt && bBuilt) return (presetOrderMap.get(a.id) ?? 9999) - (presetOrderMap.get(b.id) ?? 9999);
			if (!aBuilt && !bBuilt) return (aCustom.createdAt || 0) - (bCustom.createdAt || 0);
			return aBuilt ? -1 : 1;
		}
		/** bottom-up 排序（#68 终式 2026-09-15）：置顶簇在底部聚拢，分区内维持 bottom-up。
		*  - 一级分区：非置顶在上、置顶在下（置顶簇整体占底部连续段，不再按用量散插）——
		*    本票推翻 #22“用量主键、置顶只做同分 tie-break”（该式导致不同用量下置顶必散）。
		*  - 二级：分区内用量升序（0→max，max 最靠底；置顶簇内最常用置顶在非常底部，
		*    非置顶中最常用紧贴置顶簇之上）。
		*  - 三级：置顶簇内同用量时按 pin 顺序（维持 #22 原式）。
		*  - 末键：预制原始顺序 / 自定义创建时间（tieBreakOrder，维持 #22 原式）。
		*  设置页与 /prompt 不走此函数（走 sortedTemplates，忽略置顶）。
		*/
		function sortedTemplatesBottomUp(list) {
			const usage = cache.usage;
			const pinned = cache.pinned;
			const isPinned = (id) => pinned.indexOf(id) >= 0;
			const pinIdx = (id) => pinned.indexOf(id);
			return [...list].sort((a, b) => {
				const ap = isPinned(a.id), bp = isPinned(b.id);
				if (ap !== bp) return ap ? 1 : -1;
				const ua = usage[a.id] || 0, ub = usage[b.id] || 0;
				if (ua !== ub) return ua - ub;
				if (ap && bp) {
					const pa = pinIdx(a.id), pb = pinIdx(b.id);
					if (pa !== pb) return pa - pb;
				}
				return tieBreakOrder(a, b);
			});
		}
		/** 置顶切换（置顶数 ≤5）；返回是否成功（超限返回 false） */
		function togglePin(id) {
			const pinned = [...cache.pinned];
			const i = pinned.indexOf(id);
			if (i >= 0) pinned.splice(i, 1);
			else if (pinned.length >= MAX_PIN) return {
				pinned,
				ok: false
			};
			else pinned.push(id);
			cache.pinned = pinned;
			notifyStore();
			persist(PINNED_URL, { ids: pinned });
			return {
				pinned: [...pinned],
				ok: true
			};
		}
		function isPinned(id) {
			return cache.pinned.indexOf(id) >= 0;
		}
		/**
		* 新增自定义模板（#23）。
		* labels 接受数组或单字符串（单字符串兼容旧调用：视为一个标签）。
		* 先归一化+校验，不合法直接抛错——面板侧已做行内校验先行，此处是契约守卫，不静默截断。
		* 落盘新形状（只写 labels，不写旧 tag 与占位三件套）。
		*/
		function addCustom(name, labels, body) {
			const checked = validateLabels(labels);
			if (!checked.ok) throw new Error("[dsh-prompt] invalid labels: " + checked.error);
			const t = {
				id: "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
				name,
				nameEn: "",
				labels: checked.labels,
				body,
				builtin: false,
				createdAt: Date.now()
			};
			cache.customs = [...cache.customs, t];
			notifyStore();
			persist(PUT_URL, { template: toHostShape(t) });
			return t;
		}
		/** 更新自定义模板（#23：labels 数组或单字符串；兼容旧 patch.tag，折算为单标签） */
		function updateCustom(id, patch) {
			cache.customs = cache.customs.map((t) => {
				if (t.id !== id) return t;
				const next = { ...t };
				if (patch.name !== void 0) next.name = patch.name;
				const incoming = patch.labels !== void 0 ? patch.labels : patch.tag;
				if (incoming !== void 0) {
					const checked = validateLabels(incoming);
					if (!checked.ok) throw new Error("[dsh-prompt] invalid labels: " + checked.error);
					next.labels = checked.labels;
					delete next.tag;
				}
				if (patch.body !== void 0) next.body = patch.body;
				persist(PUT_URL, { template: toHostShape(next) });
				return next;
			});
			notifyStore();
		}
		/** 删除自定义模板（仅限 builtin=false）；返回是否成功 */
		function removeCustom(id) {
			const next = cache.customs.filter((t) => t.id !== id);
			if (next.length === cache.customs.length) return false;
			cache.customs = next;
			cache.pinned = cache.pinned.filter((p) => p !== id);
			notifyStore();
			persist(DELETE_URL, { id });
			persist(PINNED_URL, { ids: cache.pinned });
			return true;
		}
		/** 复制预制为自定义（#23：标签照搬预置派生串，最多 3 个天然合规） */
		function copyPresetToCustom(id) {
			const src = getPresetById(id);
			if (!src) return null;
			return addCustom(src.name + "（副本）", templateLabels(src), src.body);
		}
		/** 记一条日志事件。出口只有一个：日志能力装进 globalThis.__dshPromptLog 的那个实例。
		*  走槽而不是 import 的原因：本仓既有回归脚本会把客户端模块逐个转译后单独 require
		*  （scripts/.rt-tmp/*.cjs），而单文件 bundle 里也没有可用的模块内 require——槽是两边都能用的唯一机制。
		*  能力缺席时是空操作，绝不因为记日志失败而影响功能。 */
		function logEvent$3(event, fields) {
			try {
				const log = globalThis.__dshPromptLog;
				if (log && typeof log.log === "function") log.log(event, fields);
			} catch (e) {}
		}
		//#endregion
		//#region src/client/state.ts
		/**
		* dsh-prompt — 面板开合状态（入口按钮 ↔ 面板共享，模块级 + 订阅）
		*/
		let panelOpen = false;
		const listeners$2 = /* @__PURE__ */ new Set();
		let closeTimer = null;
		function isPanelOpen() {
			return panelOpen;
		}
		function setPanelOpen(v) {
			if (panelOpen !== v) {
				panelOpen = v;
				listeners$2.forEach((fn) => {
					try {
						fn(v);
					} catch (e) {}
				});
			}
		}
		/** 面板 hover 自动关窗在弹窗打开期间应抑制（#14 回归） */
		let hoverCloseSuppressed = false;
		function setHoverCloseSuppressed(v) {
			hoverCloseSuppressed = v;
			if (v && closeTimer !== null) {
				clearTimeout(closeTimer);
				closeTimer = null;
			}
		}
		/** hover 离开后延迟关窗（短暂计时，防止从按钮移动到列表之间的误关） */
		function schedulePanelClose(ms) {
			if (hoverCloseSuppressed) return;
			if (closeTimer !== null) clearTimeout(closeTimer);
			closeTimer = setTimeout(() => setPanelOpen(false), ms);
		}
		/** 取消待执行的延迟关窗（鼠标进入列表/按钮时调用） */
		function cancelPanelClose() {
			if (closeTimer !== null) {
				clearTimeout(closeTimer);
				closeTimer = null;
			}
		}
		function onPanelOpen(fn) {
			listeners$2.add(fn);
			return () => {
				listeners$2.delete(fn);
			};
		}
		//#endregion
		//#region src/client/i18n.ts
		function getLang() {
			try {
				const l = document.documentElement && document.documentElement.lang || navigator.language || "en";
				return /^zh/i.test(l) ? "zh" : "en";
			} catch (e) {
				return "zh";
			}
		}
		function tr(lang, m) {
			return lang === "zh" ? m.zh : m.en;
		}
		const STR = {
			panelTitle: {
				zh: "Prompt",
				en: "Prompt"
			},
			sectionName: {
				zh: "提示词模板",
				en: "Prompt Templates"
			},
			entryBtn: {
				zh: "Prompt",
				en: "Prompt"
			},
			add: {
				zh: "新增自定义模板",
				en: "Add custom template"
			},
			addShort: {
				zh: "新增",
				en: "Add"
			},
			searchPh: {
				zh: "搜索模板…",
				en: "Search templates…"
			},
			tabAll: {
				zh: "全部",
				en: "All"
			},
			tabBefore: {
				zh: "执行前",
				en: "Before"
			},
			tabDuring: {
				zh: "执行中",
				en: "During"
			},
			tabAfter: {
				zh: "执行后",
				en: "After"
			},
			tabCustom: {
				zh: "自定义",
				en: "Custom"
			},
			domainAll: {
				zh: "全领域",
				en: "All domains"
			},
			presetCount: {
				zh: "预制",
				en: "Preset"
			},
			customCount: {
				zh: "自定义",
				en: "Custom"
			},
			goSettings: {
				zh: "设置 → 模板管理",
				en: "Settings → Templates"
			},
			edit: {
				zh: "编辑",
				en: "Edit"
			},
			del: {
				zh: "删除",
				en: "Delete"
			},
			copy: {
				zh: "复制为自定义",
				en: "Copy to custom"
			},
			pin: {
				zh: "置顶/取消置顶",
				en: "Pin/Unpin"
			},
			noMatch: {
				zh: "无匹配模板",
				en: "No matching templates"
			},
			addTitle: {
				zh: "新增自定义模板",
				en: "Add custom template"
			},
			editTitle: {
				zh: "编辑自定义模板",
				en: "Edit custom template"
			},
			namePh: {
				zh: "模板名称",
				en: "Template name"
			},
			labelsPh: {
				zh: "添加标签（逗号/空格/顿号分隔，回车确认）",
				en: "Add labels (comma/space separated, Enter to confirm)"
			},
			labelsHint: {
				zh: "最多 3 个，每条 1–10 字；可从已有词里选，也可新造",
				en: "At most 3 labels, 1–10 chars each; pick existing or invent new"
			},
			labelsTooMany: {
				zh: "最多 3 个标签",
				en: "At most 3 labels"
			},
			labelTooLong: {
				zh: "每条标签 1–10 字",
				en: "Each label 1–10 chars"
			},
			labelReserved: {
				zh: "“任意”不能作为标签",
				en: "\"任意\" is reserved and cannot be a label"
			},
			removeLabel: {
				zh: "移除标签",
				en: "Remove label"
			},
			bodyPh: {
				zh: "Prompt 正文（≤10000 字）",
				en: "Prompt body (≤10000 chars)"
			},
			cancel: {
				zh: "取消",
				en: "Cancel"
			},
			save: {
				zh: "保存",
				en: "Save"
			},
			addOk: {
				zh: "添加",
				en: "Add"
			},
			nameRequired: {
				zh: "名称必填",
				en: "Name is required"
			},
			bodyTooLong: {
				zh: "正文超过 10000 字上限",
				en: "Body exceeds 10000 chars"
			},
			delTitle: {
				zh: "删除确认",
				en: "Confirm delete"
			},
			delMsg: {
				zh: "确定删除自定义模板",
				en: "Delete custom template"
			},
			delUnrecover: {
				zh: "此操作不可撤销。",
				en: "This cannot be undone."
			},
			delOk: {
				zh: "删除",
				en: "Delete"
			},
			pinFull: {
				zh: "置顶已达上限（5 个）",
				en: "Pin limit reached (5)"
			},
			insertHint: {
				zh: "点击即插入",
				en: "Click to insert"
			},
			close: {
				zh: "关闭",
				en: "Close"
			},
			smartToggle: {
				zh: "智能模式悬浮卡（输入匹配时推荐模板；默认关）",
				en: "Smart card (recommends templates while typing; off by default)"
			},
			smartToggleHint: {
				zh: "默认关；打开后仅在输入匹配时出卡",
				en: "Off by default; when on, the card appears on match"
			},
			smartDot: {
				zh: "智能模式 · 拖动调整位置；输入匹配时出卡",
				en: "Smart mode · drag to move; card appears on match"
			},
			smartTitle: {
				zh: "智能推荐",
				en: "Smart suggest"
			},
			smartHint: {
				zh: "点击即填入",
				en: "Click to insert"
			},
			smartFill: {
				zh: "点击填入",
				en: "Insert"
			},
			smartDismiss: {
				zh: "收起（继续输入可再次出现）",
				en: "Dismiss (reappears as you type)"
			},
			smartRecent: {
				zh: "最近使用",
				en: "Recently used"
			},
			smartCommon: {
				zh: "常用模板",
				en: "Common templates"
			},
			gitHubRepo: {
				zh: "GitHub 仓库",
				en: "GitHub repo"
			},
			feedback: {
				zh: "反馈故障",
				en: "Report issue"
			},
			starTip: {
				zh: "你的 ⭐是我夜空中最亮的星。",
				en: "Your ⭐ is the brightest star in my night sky."
			},
			feedbackTip: {
				zh: "提交反馈、建议和意见🌹",
				en: "Feedback, suggestions and ideas — all welcome 🌹"
			},
			moreTitle: {
				zh: "作者其他插件",
				en: "More plugins by the author"
			},
			moreDescDeck: {
				zh: "装好就有 25 个工程技能在右侧直接用",
				en: "25 engineering skills ready on the side once installed"
			},
			moreDescPalette: {
				zh: "38 款长时间编程护眼配色，一键换上",
				en: "38 eye-friendly palettes for long coding sessions, applied in one click"
			},
			moreDescPrompt: {
				zh: "本面板自己：24 条常用提示模板随手点，不用来回复制粘贴",
				en: "This panel itself: 24 everyday prompt templates at hand — no more copy-paste round trips"
			},
			moreDescCompanion: {
				zh: "聊天机器人的伴侣插件：扫码或填凭据就把飞书、微信等 9 路聊天接进来",
				en: "Companion plugin for chat bots: bring in 9 chat channels such as Feishu and WeChat by scanning a code or filling in credentials"
			},
			storageNote: {
				zh: "自定义模板与使用次数保存在 DSH 缓存目录（卸载重装保留）；历史 localStorage 数据不再读取。",
				en: "Custom templates and usage live in the DSH cache dir (kept across reinstall); legacy localStorage data is no longer read."
			},
			logToggle: {
				zh: "调试日志",
				en: "Debug log"
			},
			logToggleHint: {
				zh: "默认关。关只停信息与调试两级，错误与告警始终记录；开关以宿主为准，刷新后仍读宿主那份。",
				en: "Off by default. Off stops only info and debug, while errors and warnings are always recorded; the host is authoritative and the value survives a refresh."
			},
			logGroup: {
				zh: "诊断日志",
				en: "Diagnostics"
			},
			logWhere: {
				zh: "落点：~/.dsh/logs/dsh-prompt/",
				en: "Location: ~/.dsh/logs/dsh-prompt/"
			},
			smartGroup: {
				zh: "智能推荐",
				en: "Smart suggestions"
			},
			logExport: {
				zh: "导出日志",
				en: "Export log"
			},
			logCopyPath: {
				zh: "复制路径",
				en: "Copy path"
			},
			logClear: {
				zh: "清空日志",
				en: "Clear log"
			},
			logClearConfirm: {
				zh: "确认清空",
				en: "Confirm clear"
			},
			logClearAsk: {
				zh: "再点一次「确认清空」会删掉全部日志文件（正在排查的证据也会一起删掉）。",
				en: "Click \"Confirm clear\" again to delete every log file — including any evidence you are collecting."
			},
			logSwitchOn: {
				zh: "日志已开启（信息与调试也会记录）。",
				en: "Logging enabled (info and debug are recorded too)."
			},
			logSwitchOff: {
				zh: "日志已关闭：错误与告警仍会记录。",
				en: "Logging disabled: errors and warnings are still recorded."
			},
			logSwitchFail: {
				zh: "开关未保存，仍按原值：",
				en: "Switch not saved, previous value kept: "
			},
			logExportSaved: {
				zh: "已导出到下载目录：",
				en: "Exported to your downloads: "
			},
			logExportDownloadBlocked: {
				zh: "浏览器拦下了下载，请改用「复制正文」：",
				en: "The browser blocked the download — use \"Copy text\" instead: "
			},
			logExportEmpty: {
				zh: "当天还没有日志文件（开关关闭时只有错误与告警会落盘）。",
				en: "No log file for today yet (with the switch off, only errors and warnings are written)."
			},
			logExportFail: {
				zh: "导出失败：",
				en: "Export failed: "
			},
			logPathCopied: {
				zh: "已复制日志文件路径：",
				en: "Log file path copied: "
			},
			logPathFail: {
				zh: "拿不到日志路径，请改用「导出日志」。",
				en: "Could not resolve the log path — use \"Export log\" instead."
			},
			logClearOk: {
				zh: "已删除日志文件",
				en: "Deleted log files: "
			},
			logClearFail: {
				zh: "清空失败，请稍后再试。",
				en: "Clear failed, please try again."
			},
			logWorking: {
				zh: "处理中…",
				en: "Working…"
			},
			logDropped: {
				zh: "日志管道已丢弃条数：",
				en: "Entries dropped by the log pipeline: "
			},
			logUnavailable: {
				zh: "日志能力当前不可用（宿主未接通）。",
				en: "Logging is currently unavailable (host not reachable)."
			},
			logBytes: {
				zh: "字节",
				en: "bytes"
			},
			logFiles: {
				zh: "个文件",
				en: "file(s)"
			},
			logReasonHost: {
				zh: "宿主不可达",
				en: "host unreachable"
			},
			logReasonRejected: {
				zh: "宿主拒绝写入",
				en: "host rejected the write"
			},
			logReasonTimeout: {
				zh: "宿主超时未应答",
				en: "host timed out"
			},
			logReasonStale: {
				zh: "已有更新的开关操作，本次作废",
				en: "a newer switch action superseded this one"
			},
			logReasonOther: {
				zh: "未知原因",
				en: "unknown reason"
			},
			updateEntry: {
				zh: "检查更新",
				en: "Check for updates"
			},
			updateEntryHint: {
				zh: "看当前版本，并问官方源有没有新版",
				en: "See your version and ask the registry for a newer one"
			},
			updateVerdictUpToDate: {
				zh: "已是最新版本（{version}）",
				en: "Up to date ({version})"
			},
			updateVerdictNewer: {
				zh: "有新版本 {latest}（当前 {running}）",
				en: "Update {latest} available (you have {running})"
			},
			updateVerdictUnknown: {
				zh: "这次没查到",
				en: "Could not find out this time"
			},
			updateVerdictUnknownHint: {
				zh: "还没问过官方源：点「检查更新」问一次。",
				en: "The registry has not been asked yet — click \"Check now\"."
			},
			updateDetails: {
				zh: "详情",
				en: "Details"
			},
			updateVersionUnknown: {
				zh: "版本未知",
				en: "version unknown"
			},
			updateRowRunning: {
				zh: "当前版本",
				en: "Running"
			},
			updateRowInstalled: {
				zh: "已装版本",
				en: "Installed"
			},
			updateRowLatest: {
				zh: "最新版本",
				en: "Latest"
			},
			updateLatestNone: {
				zh: "还没查过（点「检查更新」问官方源）",
				en: "not checked yet (click \"Check now\" to ask the registry)"
			},
			updateNotAvailable: {
				zh: "未知",
				en: "unknown"
			},
			updateBtnCheck: {
				zh: "检查更新",
				en: "Check now"
			},
			updateBtnChecking: {
				zh: "查询中…",
				en: "Checking…"
			},
			updateBtnInstall: {
				zh: "安装新版本",
				en: "Install update"
			},
			updateBtnInstalling: {
				zh: "安装中…",
				en: "Installing…"
			},
			updateBtnCopy: {
				zh: "复制命令",
				en: "Copy command"
			},
			updateCopied: {
				zh: "已复制到剪贴板。",
				en: "Copied to the clipboard."
			},
			updateCopyFail: {
				zh: "复制失败，请手动选中命令复制。",
				en: "Copy failed — select the command manually."
			},
			updateClose: {
				zh: "关闭",
				en: "Close"
			},
			updateAutoNote: {
				zh: "这是启动时自动检查的结果：只在发现新版本时弹这一次，之后不再打扰。",
				en: "Automatic check on start: this dialog appears once, and only when a newer version exists."
			},
			updateSkipVersion: {
				zh: "跳过此版本",
				en: "Skip this version"
			},
			updateSkipDone: {
				zh: "已跳过 {version}：下次启动不再自动提示这个版本；点「检查更新」仍能看到它。",
				en: "Skipped {version}: it will not be auto-prompted on the next start; \"Check now\" still shows it."
			},
			updateSkipFail: {
				zh: "没能记住这个版本（本机存储不可用）：下次启动可能还会自动提示。",
				en: "Could not remember this version (local storage unavailable): it may be auto-prompted again next start."
			},
			updateHostFailTitle: {
				zh: "宿主没有回答更新状态",
				en: "The host did not answer the update status"
			},
			updateHostFailHint: {
				zh: "更新能力可能没接通（宿主半未加载），也可能宿主半刚起、还没就绪。刷新页面再点一次；一直这样就把日志导出后提 Issue。",
				en: "The update capability may not be wired up (host half not loaded), or the host half is not ready yet. Refresh the page and try again; if it keeps happening, export the log and open an issue."
			},
			updateCapDownTitle: {
				zh: "更新能力没接通（宿主半降级或未加载）",
				en: "The update capability is not wired up (host half degraded or not loaded)"
			},
			updateCapDownAction: {
				zh: "宿主回了这个码 = 它那边的更新能力没起来：把宿主整个重启一次（关掉 DSH 再开）让能力重建，再点「检查更新」。",
				en: "This code comes from the host and means its update capability did not come up: restart the host (quit DSH and start it again) so it is rebuilt, then click \"Check now\"."
			},
			updateFailAnsweredTitle: {
				zh: "宿主回答了：这次操作没成",
				en: "The host answered — this operation did not go through"
			},
			updateFailAnsweredHint: {
				zh: "往下看这个错误码与对应做法（表里没有的新码也会给一条兜底做法）；宿主这次确实回了话，除非那个码本身就说能力没接通，否则不用刷新页面、也不用按「宿主没接通」报故障。",
				en: "See the code below and what to do about it (an unknown code still gets a fallback action). The host did answer this time, so unless the code itself says the capability is not wired up, there is no need to refresh the page or report a \"host not reachable\" fault."
			},
			updateFailNoFault: {
				zh: "这不是故障码，是包设计内的守卫（README 第 11 节点名为正常错误码）。",
				en: "This is not a fault code but a guard the package documents (section 11 of its README names it a normal error code)."
			},
			updateFailBusy: {
				zh: "宿主正在装另一个任务或刚装完：等它跑完、面板会自己刷新；一直这样就把宿主重启一次。",
				en: "The host is busy with another install (or just finished one): wait for it to settle — the panel refreshes itself; if it persists, restart the host."
			},
			updateFailCheckFailed: {
				zh: "查新版没查成（多半是网络没通到官方源）：确认网络能访问 npm 官方源，再点一次「检查更新」。",
				en: "The version check did not complete (usually the registry was unreachable): make sure the npm registry is reachable, then click \"Check now\" again."
			},
			updateFailInvalidRelease: {
				zh: "官方源回的元数据不是本包或版本号非法：先确认没被代理/镜像换过内容，再点一次「检查更新」。",
				en: "The registry returned metadata that is not this package, or an invalid version: check that a proxy or mirror is not rewriting the response, then click \"Check now\" again."
			},
			updateFailInstallFailed: {
				zh: "这次安装没成功，磁盘上的版本没变：用下面的手工兜底命令装，或点「检查更新」拿到新凭证再试一次。",
				en: "This install did not succeed and the version on disk is unchanged: use the manual fallback command below, or click \"Check now\" to get a fresh credential and retry."
			},
			updateFailCheckExpired: {
				zh: "安装凭证过期了（默认 10 分钟）：点「检查更新」重新取一张凭证，再点「安装新版本」。",
				en: "The install credential expired (10 minutes by default): click \"Check now\" to get a fresh one, then click \"Install update\" again."
			},
			updateFailInstallationChanged: {
				zh: "安装位置在使用中途变了：把宿主重开一次，再点「检查更新」让指纹重新绑定。",
				en: "The installation moved mid-flight: reopen the host, then click \"Check now\" so the fingerprint rebinds."
			},
			updateFailRegistryConflict: {
				zh: "本地声明的版本与磁盘实际版本矛盾：打开使用范围的清单文件，把目标包那一行改成版本号再试。",
				en: "The version declared locally contradicts the one on disk: open the profile manifest, pin the target package to a version, and retry."
			},
			updateFailRecoveryRequired: {
				zh: "上次安装被打断，留下一个半截任务：点「检查更新」看现在的状态，必要时重新点一次安装。",
				en: "The previous install was interrupted and left a half-done job: click \"Check now\" to see the current state, then retry the install if needed."
			},
			updateFailUnknown: {
				zh: "面板还不认识这个码：把原始错误码记下来提 Issue，或点「检查更新」重试一次。",
				en: "The panel does not know this code yet: note the raw error code down and open an issue, or click \"Check now\" to retry."
			},
			updateNoCredential: {
				zh: "宿主这次没给安装凭证，装不了；再点一次「检查更新」拿张新凭证。",
				en: "The host returned no install credential this time, so nothing was installed; click \"Check now\" again for a fresh one."
			},
			updateBusyRetry: {
				zh: "面板上一次通话还没回来（多半是轮询那一发在飞），这次点击没发出去；等一拍再点一次「安装新版本」。",
				en: "A previous call from the panel has not returned yet (usually the polling shot), so this click sent nothing; wait a moment and click \"Install update\" again."
			},
			updateJobFailTitle: {
				zh: "这次安装没成功",
				en: "This install did not succeed"
			},
			updateJobFailHint: {
				zh: "磁盘上的版本没变。用下面的手工兜底命令重装，或点「检查更新」再试一次；一直这样就把日志导出后提 Issue。",
				en: "The version on disk is unchanged. Reinstall with the manual fallback command below, or click \"Check now\" to retry; if it keeps happening, export the log and open an issue."
			},
			updateReasonTitle: {
				zh: "装不了的原因",
				en: "Why it cannot install"
			},
			updateReasonUnknown: {
				zh: "这条原因码本面板还不认识（多半是更新包升版加了新码）。把原始原因码记下来提 Issue。",
				en: "This panel does not know this reason code (an update package upgrade probably added it). Note the raw code down and open an issue."
			},
			updateWhyUnknownProfile: {
				zh: "检查使用范围名是否含特殊字符、目录是否还在；这种情形不给手工命令，先把范围修好。",
				en: "Check whether the profile name has special characters and whether the directory still exists; no manual command is given for this case — fix the profile first."
			},
			updateWhySourceInstall: {
				zh: "这种情形不给手工命令；想走更新，先按版本号重装一次。",
				en: "No manual command is given for this case; to use updates, reinstall once from a published version."
			},
			updateWhyInvalidInstallation: {
				zh: "重装当前版本，把已装目录修好再查更新。",
				en: "Reinstall the current version, fix the installed directory, then check again."
			},
			updateWhyInstallationChanged: {
				zh: "重新打开宿主再查一次，让指纹重新绑定；还出现就重装。",
				en: "Reopen the host and check again so the fingerprint rebinds; if it still appears, reinstall."
			},
			updateWhyPendingRestart: {
				zh: "重启宿主，让新版跑起来；这是正常终态，不是失败。",
				en: "Restart the host so the new version takes over; this is a normal end state, not a failure."
			},
			updateWhyRegistryConflict: {
				zh: "打开使用范围的清单文件，看目标包名那一行写的是不是版本号，改成版本号再试。",
				en: "Open the profile manifest and check whether the target package line pins a version; pin one and retry."
			},
			updateWhyIncompatibleNode: {
				zh: "先升级 Node 到 22 或更高，再查更新。",
				en: "Upgrade Node to 22 or newer first, then check again."
			},
			updateWhyRecoveryRequired: {
				zh: "重新点一次「安装新版本」；一直出现就把日志导出后提 Issue。",
				en: "Click \"Install update\" once more; if it keeps appearing, export the log and open an issue."
			},
			updatePendingBanner: {
				zh: "⚠️ 新版 {new} 已装好，正在跑的还是 {old}，重启宿主后生效。",
				en: "⚠️ Update {new} is installed; {old} is still running — restart the host to apply it."
			},
			updatePendingHint: {
				zh: "桌面端完全退出重开；web 端重启后刷新页面（Ctrl+F5）。",
				en: "Fully quit and reopen the desktop app; for the web host, restart it and refresh the page (Ctrl+F5)."
			},
			updateManualTitle: {
				zh: "手工兜底命令",
				en: "Manual fallback command"
			},
			updateManualNone: {
				zh: "宿主这次没有给出手工命令（只展示上面的原因）。",
				en: "The host returned no manual command this time (only the reason above)."
			},
			updateManualHint: {
				zh: "这条命令会把「已装版本」重装一遍。",
				en: "This command reinstalls the version you already have."
			},
			updateManualStale: {
				zh: "这条命令来自上一次成功的通话，不是这次失败的答复。",
				en: "This command comes from the last call that succeeded, not from the call that just failed."
			}
		};
		//#endregion
		//#region src/client/panel.ts
		function getReact() {
			if (typeof require === "function") try {
				return require("react");
			} catch (e) {}
			if (typeof globalThis !== "undefined" && globalThis.React) return globalThis.React;
			return null;
		}
		/**
		* 插件标志（灯泡）单一定义 —— 模板浏览头行（本文件两条分支）与配置页头行（about.ts）共用。
		* 放在 panel.ts 而不是新开模块：本仓每个回归脚本都自己列一遍要转译的客户端模块，
		* 往 panel.ts 这条被普遍加载的路径上新增 import 边会让既有脚本全部找不到模块；
		* 导出比新模块代价小，且保住「标志只有一份定义」。改标志只改这里。
		*/
		function PromptMark(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const s = props && props.size || 15;
			return h("svg", {
				width: s,
				height: s,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "var(--dsw-specific-accent,#f0a45c)",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				style: { flex: "none" }
			}, [
				h("path", {
					key: "a",
					d: "M15 14c.2-1 .7-1.7 1.5-2.5C17.5 10.6 18 9.3 18 8a6 6 0 1 0-12 0c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"
				}),
				h("path", {
					key: "b",
					d: "M9 18h6"
				}),
				h("path", {
					key: "c",
					d: "M10 22h4"
				}),
				h("path", {
					key: "d",
					d: "M18.5 2.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z"
				})
			]);
		}
		const CLOUD_EXCLUDE = [
			"all",
			"思考框架",
			"学习",
			"工程",
			"执行",
			"执行前",
			"执行中",
			"执行后",
			"自定义"
		];
		function actionCloudLabels() {
			return allKnownLabels().filter((l) => CLOUD_EXCLUDE.indexOf(l) < 0);
		}
		const SCOPE_PRESET = "preset";
		const SCOPE_CUSTOM = "custom";
		const SCOPE_PRESET_LABEL = "预置";
		const SCOPE_CUSTOM_LABEL = "自定义";
		const ALL_LABEL = "全部";
		/** #61 真根因（宿主源码实证：dsh-client-ui-conversation 包）。
		* 1) 会话输入框是 Lexical contenteditable div，根本没有 textarea —— 旧的 textarea 扫描全瞎；
		* 2) useInput 是裸 selector hook（renderer 的 bindSnapshotSelector 产物：裸函数，
		*    无 getState/getSnapshot/subscribe），只能在组件 render 内调用，事件回调里根本读不到 store。
		* 两条路全瞎 ⇒ setDraft(模板正文) 整框覆盖（宿主 setDraft 语义即全文替换、光标置尾）。
		* 真修复只信两样活的东西：
		* - H（hook 草稿）：render 内合法订阅到的已提交草稿，引用 chip 的存储形精确；
		* - D（DOM 活读）：点击瞬间 contenteditable 的 innerText 级文本 + getSelection 活光标，
		*   含 IME 组词中尚未提交的文字。
		* 合并铁律：看得见的不丢 —— D 非空即信 D（唯二例外：读不到 D 信 H；H 含引用 chip 时信 H 保编码）。 */
		const CHIP_RE = /[\uE100-\uE11D\uFFFC]/;
		/** render 内订阅到的已提交草稿（面板打开期间由 DraftTap 保持新鲜；设置页无桥，不写）。 */
		let tapDraft = "";
		let tapSeen = false;
		/** render 内订阅输入桥。只能在 render 里调 useInput(selector)：它是裸 hook，
		* 事件回调/ effect 里调即抛（这就是 Q3 删掉的分支死因）。调用点只此一处。 */
		function DraftTap(props) {
			const react = getReact();
			if (!react) return null;
			let ok = false;
			let d = "";
			try {
				d = props.useInput((s) => s && s.draft || "");
				ok = true;
			} catch (e) {}
			(react.useLayoutEffect || react.useEffect)(() => {
				if (ok) {
					tapDraft = typeof d === "string" ? d : "";
					tapSeen = true;
				}
			});
			return null;
		}
		/** 用户最后摸过的输入元（作曲家 editable 或 textarea，#61 前版只记后者故全瞎）。 */
		let lastFocusEl = null;
		let focusTrackArmed = false;
		let armedDoc = null;
		function armInputFocusTrack() {
			try {
				const doc = typeof document !== "undefined" ? document : null;
				if (focusTrackArmed && armedDoc === doc) return;
				focusTrackArmed = true;
				armedDoc = doc;
				if (doc && typeof doc.addEventListener === "function") doc.addEventListener("focusin", (e) => {
					try {
						const t = e && e.target;
						if (!t || !t.tagName) return;
						try {
							if (t.closest && (t.closest("[data-dsh-prompt-modal]") || t.closest("[data-dsh-prompt-modal-root]"))) return;
						} catch (err) {}
						if (t.tagName === "TEXTAREA") {
							lastFocusEl = t;
							return;
						}
						try {
							if (t.getAttribute && t.getAttribute("contenteditable") === "true" && t.closest && t.closest("[data-composer-card]")) lastFocusEl = t;
						} catch (err) {}
					} catch (err) {}
				}, true);
			} catch (err) {}
		}
		/** 作曲家可编辑根：宿主 Lexical 编辑器绑定的 contenteditable（自家弹窗已排除）。 */
		function composerRoots() {
			try {
				if (typeof document === "undefined" || !document.querySelectorAll) return [];
				const out = [];
				const push = (el) => {
					try {
						if (el.closest && (el.closest("[data-dsh-prompt-modal]") || el.closest("[data-dsh-prompt-modal-root]"))) return;
					} catch (e) {}
					if (out.indexOf(el) < 0) out.push(el);
				};
				try {
					const scoped = document.querySelectorAll("[data-composer-card] [contenteditable=\"true\"]");
					for (let i = 0; i < scoped.length; i++) push(scoped[i]);
				} catch (e) {}
				if (out.length === 0) try {
					const all = document.querySelectorAll("[contenteditable=\"true\"]");
					for (let i = 0; i < all.length; i++) push(all[i]);
				} catch (e) {}
				return out;
			} catch (e) {
				return [];
			}
		}
		const BLOCK_TAGS = {
			P: 1,
			DIV: 1,
			LI: 1,
			UL: 1,
			OL: 1,
			H1: 1,
			H2: 1,
			H3: 1,
			H4: 1,
			H5: 1,
			H6: 1,
			BLOCKQUOTE: 1,
			PRE: 1,
			SECTION: 1,
			ARTICLE: 1,
			HEADER: 1,
			FOOTER: 1
		};
		/** 读一个可编辑根的纯文本与活光标（同一套块映射，文本与光标同源，绝不错位）。
		* 文本≈宿主 clipboardText（段落↔\n）；光标=当前 selection 锚点，无选择即末尾。 */
		function readEditable(root) {
			let text = "";
			try {
				const runs = [];
				const kids = root && root.childNodes ? Array.prototype.slice.call(root.childNodes) : [];
				const pushRun = (s, node) => {
					if (!s) return;
					runs.push({
						node,
						start: text.length,
						len: s.length
					});
					text += s;
				};
				let started = false;
				if (!kids.some((k) => k && k.nodeType === 1)) pushRun(root.textContent || "", null);
				else for (const k of kids) {
					if (!k) continue;
					if (k.nodeType === 3) {
						started = true;
						pushRun(k.nodeValue || "", k);
						continue;
					}
					if (k.nodeType !== 1) continue;
					const tag = String(k.tagName || "").toUpperCase();
					if (tag === "BR") {
						if (started) text += "\n";
						else started = true;
						continue;
					}
					if (BLOCK_TAGS[tag] === 1) {
						if (!started) started = true;
						else text += "\n";
					} else started = true;
					try {
						const stack = [k];
						const ordered = [];
						while (stack.length > 0) {
							const n = stack.pop();
							if (!n) continue;
							if (n.nodeType === 3) {
								ordered.push(n);
								continue;
							}
							if (n.nodeType !== 1) continue;
							const ch = n.childNodes ? Array.prototype.slice.call(n.childNodes) : [];
							for (let j = ch.length - 1; j >= 0; j--) stack.push(ch[j]);
						}
						for (const tn of ordered) pushRun(tn.nodeValue || "", tn);
					} catch (e) {
						pushRun(k.textContent || "", k);
					}
				}
				let caret = text.length;
				try {
					const g = typeof window !== "undefined" ? window : globalThis;
					const sel = g && typeof g.getSelection === "function" ? g.getSelection() : null;
					const an = sel && sel.rangeCount > 0 ? sel.anchorNode : null;
					if (an && root.contains) {
						let inside = false;
						try {
							inside = root.contains(an);
						} catch (e) {}
						if (inside) {
							const ao = sel && typeof sel.anchorOffset === "number" ? sel.anchorOffset : 0;
							if (an.nodeType === 3) {
								for (const r of runs) if (r.node === an) {
									caret = r.start + Math.max(0, Math.min(ao, r.len));
									break;
								}
							} else if (an === root) {
								const idx = Math.max(0, Math.min(ao, kids.length));
								let hit = -1;
								for (const r of runs) if ((r.node ? kids.indexOf(r.node) : -1) >= idx) {
									hit = r.start;
									break;
								}
								caret = hit >= 0 ? hit : text.length;
							} else for (const r of runs) if (r.node === an) {
								caret = ao > 0 ? r.start + r.len : r.start;
								break;
							}
						}
					}
				} catch (e) {}
				return {
					text,
					caret: Math.max(0, Math.min(caret, text.length))
				};
			} catch (e) {
				return {
					text: "",
					caret: 0
				};
			}
		}
		/** 选当前作曲家根：焦点命中的 > 用户最后摸过的 > 首个非空 > 首个。 */
		function pickEditable() {
			const roots = composerRoots();
			if (roots.length === 0) return null;
			try {
				if (typeof document !== "undefined" && document) {
					const ae = document.activeElement;
					if (ae && roots.indexOf(ae) >= 0) return ae;
				}
			} catch (e) {}
			try {
				if (lastFocusEl && roots.indexOf(lastFocusEl) >= 0) return lastFocusEl;
			} catch (e) {}
			try {
				for (const r of roots) try {
					if (readEditable(r).text) return r;
				} catch (e) {}
			} catch (e) {}
			return roots[0];
		}
		/** 把焦点送回作曲家（宿主 input.left 自家按钮同款 keepFocus 语义）。 */
		function focusComposer() {
			try {
				if (typeof document === "undefined") return;
				const el = pickEditable();
				if (el && typeof el.focus === "function") try {
					el.focus({ preventScroll: true });
				} catch (e2) {
					try {
						el.focus();
					} catch (e3) {}
				}
			} catch (e) {}
		}
		/** 保焦（行/入口 mousedown）：只拦焦点转移，click 照常；焦点已在面板内（搜索框）
		* 或编辑器内时绝不抢焦点 —— 抢了会 blur 搜索框，#34 的 hover 抑制一松面板就误关。 */
		function keepComposerFocus(e) {
			try {
				if (e && typeof e.preventDefault === "function") e.preventDefault();
			} catch (err) {}
			try {
				if (typeof document === "undefined") return;
				const ae = document.activeElement;
				if (ae && ae.closest && typeof ae.closest === "function") try {
					if (ae.closest("[data-dsh-prompt-panel-root]") || ae.closest("[data-dsh-prompt-modal-root]") || ae.closest("[data-dsh-prompt-modal]")) return;
				} catch (err) {}
				if (ae && ae.getAttribute && typeof ae.getAttribute === "function") try {
					if (ae.getAttribute("contenteditable") === "true") return;
				} catch (err) {}
				if (ae && ae.tagName === "TEXTAREA") return;
				focusComposer();
			} catch (err) {}
		}
		/** 决议当前草稿与插入点（#61 真修复：H=hook 已提交草稿，D=DOM 活读）。 */
		function resolveDraft() {
			const norm = (s) => (s || "").replace(/\r\n?/g, "\n");
			const H = norm(tapDraft);
			const root = pickEditable();
			if (root) {
				let d = "";
				let c = 0;
				try {
					const r = readEditable(root);
					d = norm(r.text);
					c = Math.max(0, Math.min(r.caret, d.length));
				} catch (e) {}
				if (!d) {
					if (H) return {
						text: H,
						caret: H.length
					};
					return {
						text: "",
						caret: 0
					};
				}
				if (!H) return {
					text: d,
					caret: c
				};
				if (H === d) return {
					text: H,
					caret: c
				};
				if (CHIP_RE.test(H)) return {
					text: H,
					caret: H.length
				};
				return {
					text: d,
					caret: c
				};
			}
			if (H) return {
				text: H,
				caret: H.length
			};
			try {
				if (typeof document !== "undefined" && document.querySelectorAll) {
					const tas = document.querySelectorAll("textarea");
					for (let i = 0; i < tas.length; i++) {
						const ta = tas[i];
						try {
							if (ta.closest && (ta.closest("[data-dsh-prompt-modal]") || ta.closest("[data-dsh-prompt-modal-root]"))) continue;
						} catch (e) {}
						const v = ta.value || "";
						if (v) {
							let p = v.length;
							try {
								if (typeof ta.selectionStart === "number" && ta.selectionStart > 0) p = ta.selectionStart;
							} catch (e) {}
							return {
								text: v,
								caret: p
							};
						}
					}
				}
			} catch (e) {}
			return {
				text: "",
				caret: 0
			};
		}
		/** 插入正文到当前草稿（光标处优先，否则末尾；不覆盖；自动聚焦）。返回插入前的草稿长度，供调用点记日志。
		* 注意：宿主 setDraft 语义是全文替换且光标置尾（无光标级写入 API），中部插入后光标回尾是宿主行为，
		* 不是本函数能定的；验收“光标在插入文本后”在尾插时精确成立。
		* useInput 只为兼容旧签名保留：真正的桥订阅在 render 内的 DraftTap，事件回调里不再碰它（Q3）。 */
		function insertBody(useInput, inputActions, body) {
			armInputFocusTrack();
			const r = resolveDraft();
			const draft = r.text;
			const pos = Math.max(0, Math.min(r.caret, draft.length));
			const newDraft = draft.slice(0, pos) + body + draft.slice(pos);
			if (inputActions && typeof inputActions.setDraft === "function") inputActions.setDraft(newDraft);
			setTimeout(() => {
				try {
					focusComposer();
				} catch (e) {}
			}, 0);
			return draft.length;
		}
		/** 点击模板：插入 + 用量 +1 + 面板关闭（并记一条插入事件：只记种类与散列，不记模板名与正文）。
		* #61：无写入能力（设置页纯管理面不传输入桥）时直接返回 —— 不插入、不涨用量、不记事件。 */
		function onPick(t, useInput, inputActions) {
			if (!inputActions || typeof inputActions.setDraft !== "function") return;
			pickProbe(useInput, inputActions);
			const draftChars = insertBody(useInput, inputActions, t.body);
			logEvent$2("pick.insert", {
				source: "panel",
				templateKind: t.builtin ? "preset" : "custom",
				idHash: t.id,
				draftChars
			});
			bumpUsage(t.id);
			setPanelOpen(false);
		}
		/** 模板浏览（面板 / 设置页共用） */
		const PANEL_Z = 9999;
		const MODAL_Z = 11e3;
		const modalMaskStyle = {
			position: "fixed",
			inset: 0,
			background: "rgba(0,0,0,0.55)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			zIndex: MODAL_Z
		};
		const modalCardStyle = {
			width: 460,
			background: "var(--dsw-specific-menu)",
			border: "1px solid var(--dsw-alias-border-inverted)",
			borderRadius: 12,
			padding: 16,
			display: "flex",
			flexDirection: "column",
			gap: 10,
			fontFamily: "var(--dsw-font-family)",
			color: "var(--dsw-alias-label-primary)"
		};
		const modalFieldStyle = {
			width: "100%",
			background: "var(--dsw-alias-bg-layer-3)",
			border: "1px solid var(--dsw-alias-border-l1)",
			color: "var(--dsw-alias-label-primary)",
			borderRadius: 8,
			padding: "8px 10px",
			fontFamily: "var(--dsw-font-family)",
			fontSize: "0.96em",
			outline: "none",
			boxSizing: "border-box"
		};
		const modalBtnsStyle = {
			display: "flex",
			justifyContent: "flex-end",
			gap: 8
		};
		const modalBtn = (primary, danger) => ({
			padding: "6px 14px",
			borderRadius: 8,
			border: primary ? 0 : "1px solid var(--dsw-alias-border-l1)",
			background: primary ? "var(--dsw-specific-accent,#f0a45c)" : "var(--dsw-alias-bg-layer-3)",
			color: primary ? "#1a1a1e" : danger ? "var(--dsw-specific-danger,#e06c75)" : "var(--dsw-alias-label-primary)",
			cursor: "pointer",
			fontFamily: "var(--dsw-font-family)",
			fontSize: "0.96em"
		});
		/** 新建/编辑弹窗（模块级稳定组件，避免父级重渲染时被卸载重置） */
		function TemplateModal(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const editing = props.kind === "edit" && !!props.tpl;
			const s1 = react.useState(editing ? props.tpl.name : "");
			const name = s1[0];
			const setName = s1[1];
			const s2 = react.useState(editing ? templateLabels(props.tpl) : []);
			const labels = s2[0];
			const setLabels = s2[1];
			const s2b = react.useState("");
			const labelInput = s2b[0];
			const setLabelInput = s2b[1];
			const s3 = react.useState(editing ? props.tpl.body : "");
			const body = s3[0];
			const setBody = s3[1];
			const errState = react.useState(null);
			const err = errState[0];
			const setErr = errState[1];
			const commitInput = () => {
				const fresh = normalizeLabels(labelInput);
				if (fresh.length === 0) {
					setLabelInput("");
					return;
				}
				setLabels(normalizeLabels([...labels, ...fresh]));
				setLabelInput("");
			};
			const doOk = () => {
				const nm = name.trim(), bd = body.trim();
				if (!nm) {
					setErr("nameRequired");
					return;
				}
				if (bd.length > 1e4) {
					setErr("bodyTooLong");
					return;
				}
				const checked = validateLabels([...labels, ...normalizeLabels(labelInput)]);
				if (!checked.ok) {
					setErr(checked.error);
					return;
				}
				props.onOk && props.onOk({
					name: nm,
					labels: checked.labels,
					body: bd
				});
			};
			const known = allKnownLabels();
			const chipStyle = {
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				fontSize: "0.85em",
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-layer-3)",
				border: "1px solid var(--dsw-alias-border-l2)",
				padding: "1px 4px 1px 9px",
				borderRadius: 999,
				whiteSpace: "nowrap"
			};
			const chipXStyle = {
				border: 0,
				background: "transparent",
				color: "var(--dsw-alias-label-tertiary)",
				cursor: "pointer",
				fontSize: "1em",
				lineHeight: 1,
				padding: "0 2px",
				fontFamily: "var(--dsw-font-family)"
			};
			return h("div", {
				style: modalMaskStyle,
				"data-dsh-prompt-modal": "",
				onClick: (e) => {
					if (e.target === e.currentTarget) props.onCancel();
				}
			}, [h("div", { style: modalCardStyle }, [
				h("h3", { style: {
					fontSize: "1.08em",
					margin: 0
				} }, editing ? props.t("editTitle") : props.t("addTitle")),
				h("input", {
					style: modalFieldStyle,
					placeholder: props.t("namePh"),
					value: name,
					onChange: (e) => setName(e.target.value)
				}),
				h("div", { style: {
					display: "flex",
					flexWrap: "wrap",
					gap: 6
				} }, labels.map((l) => h("span", {
					key: l,
					style: chipStyle
				}, [l, h("button", {
					style: chipXStyle,
					title: props.t("removeLabel"),
					onClick: () => setLabels(labels.filter((x) => x !== l))
				}, "×")]))),
				h("input", {
					style: modalFieldStyle,
					placeholder: props.t("labelsPh"),
					value: labelInput,
					onChange: (e) => setLabelInput(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							commitInput();
						}
					},
					list: "dsh-prompt-labels"
				}),
				h("datalist", { id: "dsh-prompt-labels" }, known.map((w) => h("option", {
					key: w,
					value: w
				}))),
				h("div", { style: {
					fontSize: "0.85em",
					color: "var(--dsw-alias-label-tertiary)"
				} }, props.t("labelsHint")),
				h("textarea", {
					style: {
						...modalFieldStyle,
						height: 110,
						resize: "vertical"
					},
					placeholder: props.t("bodyPh"),
					value: body,
					onChange: (e) => setBody(e.target.value)
				}),
				err ? h("div", { style: {
					fontSize: "0.92em",
					color: "var(--dsw-specific-danger,#e06c75)"
				} }, props.t(err)) : null,
				h("div", { style: modalBtnsStyle }, [h("button", {
					style: modalBtn(),
					onClick: props.onCancel
				}, props.t("cancel")), h("button", {
					style: modalBtn(true),
					onClick: doOk
				}, editing ? props.t("save") : props.t("addOk"))])
			])]);
		}
		/** 删除确认弹窗（同样模块级稳定组件） */
		function ConfirmDelete(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			return h("div", {
				style: modalMaskStyle,
				"data-dsh-prompt-modal": "",
				onClick: (e) => {
					if (e.target === e.currentTarget) props.onCancel();
				}
			}, [h("div", { style: modalCardStyle }, [
				h("h3", { style: {
					fontSize: "1.08em",
					margin: 0
				} }, props.t("delTitle")),
				h("div", { style: {
					fontSize: "0.96em",
					color: "var(--dsw-alias-label-tertiary)"
				} }, props.t("delMsg") + "「" + props.tpl.name + "」" + props.t("delUnrecover")),
				h("div", { style: modalBtnsStyle }, [h("button", {
					style: modalBtn(),
					onClick: props.onCancel
				}, props.t("cancel")), h("button", {
					style: modalBtn(false, true),
					onClick: props.onOk
				}, props.t("delOk"))])
			])]);
		}
		function getReactDom() {
			if (typeof require === "function") try {
				return require("react-dom");
			} catch (e) {}
			if (typeof globalThis !== "undefined" && globalThis.ReactDOM) return globalThis.ReactDOM;
			return null;
		}
		/**
		* 顶层 Portal 底座（#21）：把 children 挂到 document.body，逃离宿主 slot 的祖先层叠上下文，
		* 使 z 在全局生效而非相对祖先生效。React 事件仍冒泡给 React 祖先（portal 语义），hover 门控不受影响。
		* 无 DOM（单测）或无 react-dom 时回退为内联渲染，保持 #14 回归覆盖。
		* 模块级稳定组件：与 TemplateModal 同理，避免父级重渲染时卸载重置。
		*/
		function TopPortal(props) {
			const react = getReact();
			if (!react) return null;
			const reactDom = getReactDom();
			if (typeof document === "undefined" || !reactDom || typeof reactDom.createPortal !== "function") return props.children;
			const attr = props.rootAttr || "data-dsh-prompt-top-root";
			const holder = react.useMemo(() => {
				try {
					const el = document.createElement("div");
					el.setAttribute(attr, "");
					return el;
				} catch (e) {
					return null;
				}
			}, [attr]);
			react.useEffect(() => {
				if (!holder) return;
				try {
					document.body.appendChild(holder);
				} catch (e) {}
				return () => {
					try {
						document.body.removeChild(holder);
					} catch (e) {}
				};
			}, [holder]);
			if (!holder) return props.children;
			return reactDom.createPortal(props.children, holder);
		}
		/**
		* 弹窗顶层 Portal（#21）：新增/编辑/删除确认弹窗经 TopPortal 挂到 body，
		* 逃离面板层叠上下文（compact 面板 PANEL_Z 上下文 / 设置页 settings.section 上下文）。
		* #40 起导出：更新弹窗复用同一套顶层机制与同一个 rootAttr（`test:issue-21` 钉着这条）。
		*/
		function ModalPortal(props) {
			const react = getReact();
			if (!react) return null;
			return react.createElement(TopPortal, { rootAttr: "data-dsh-prompt-modal-root" }, props.children);
		}
		/**
		* 浮层顶层 Portal（#21 R2）：compact 选择浮层经 TopPortal 挂到 body。
		* 真机 R1 证实：浮层留在 conversation.input.overlay 内时 PANEL_Z=9999 仍被右侧面板盖住——
		* 数值从不是问题（宿主面板 host z=25/面板 z=40/drop 遮罩 z=1000，见 dsh-better-sidebar 实测），
		* 问题是 slot 祖先层叠上下文把整棵子树压平。仅 overlay 实例（PanelHost）用，设置页保持内联。
		*/
		function PanelPortal(props) {
			const react = getReact();
			if (!react) return null;
			return react.createElement(TopPortal, { rootAttr: "data-dsh-prompt-panel-root" }, props.children);
		}
		function TemplateBrowser(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const { compact, inputActions, useInput } = props;
			const langState = react.useState(getLang());
			const lang = langState[0];
			const setTick = react.useState(0)[1];
			const selectedState = react.useState(null);
			const selected = selectedState[0];
			const qState = react.useState("");
			const q = qState[0];
			const modalState = react.useState(null);
			const modal = modalState[0];
			const posState = react.useState(null);
			const pos = posState[0];
			const rootRef = react.useRef(null);
			const listRef = react.useRef(null);
			const highlightState = react.useState(null);
			const highlightId = highlightState[0];
			const expandedState = react.useState(/* @__PURE__ */ new Set());
			const expanded = expandedState[0];
			const toggleExpanded = (id) => {
				expandedState[1]((prev) => {
					const next = new Set(prev);
					if (next.has(id)) next.delete(id);
					else next.add(id);
					return next;
				});
			};
			const focusState = react.useState(false);
			const searchFocused = focusState[0];
			const compState = react.useState(false);
			const composing = compState[0];
			react.useEffect(() => {
				logEvent$2("panel.open", {
					mode: compact ? "compact" : "full",
					rows: allTemplates().length
				});
			}, []);
			(react.useLayoutEffect || react.useEffect)(() => {
				if (!compact) return;
				let disposed = false;
				let raf = null;
				let timer = null;
				let tries = 0;
				const clearPending = () => {
					try {
						if (raf !== null && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(raf);
						if (timer !== null) clearTimeout(timer);
					} catch (e) {}
					raf = null;
					timer = null;
				};
				const compute = () => {
					try {
						const btn = typeof document !== "undefined" ? document.querySelector("[data-dsh-prompt-entry]") : null;
						if (!btn) return false;
						const br = btn.getBoundingClientRect();
						if (br && br.width === 0 && br.height === 0 && br.left === 0 && br.top === 0) return false;
						const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
						const vh = typeof window !== "undefined" ? window.innerHeight : 800;
						const width = 560;
						let left = br.left;
						if (left < 8) left = 8;
						if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
						if (!disposed) posState[1]({
							left,
							bottom: vh - br.top + 8
						});
						return true;
					} catch (e) {
						return false;
					}
				};
				const again = () => {
					raf = null;
					timer = null;
					if (disposed) return;
					if (compute()) return;
					if (++tries < 10) {
						if (typeof requestAnimationFrame !== "undefined") raf = requestAnimationFrame(again);
						else timer = setTimeout(again, 50);
					} else if (!disposed) {
						logEvent$2("panel.position.fail", { attempts: tries });
						posState[1]({
							left: 8,
							bottom: 8
						});
					}
				};
				again();
				const onResize = () => {
					compute();
				};
				if (typeof window !== "undefined") window.addEventListener("resize", onResize);
				return () => {
					disposed = true;
					clearPending();
					if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
				};
			}, []);
			react.useEffect(() => {
				if (typeof document === "undefined") return;
				const onLang = () => {
					langState[1](getLang());
				};
				const obs = new MutationObserver(onLang);
				obs.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ["lang"]
				});
				return () => {
					obs.disconnect();
				};
			}, []);
			react.useEffect(() => {
				if (!compact) return;
				if (modal || searchFocused || composing) setHoverCloseSuppressed(true);
				else setHoverCloseSuppressed(false);
				return () => {
					setHoverCloseSuppressed(false);
				};
			}, [
				compact,
				!!modal,
				searchFocused,
				composing
			]);
			const refresh = () => setTick((n) => n + 1);
			const t = (k) => tr(lang, STR[k]);
			react.useEffect(() => {
				let on = true;
				ensureLoaded().then(() => {
					if (on) refresh();
				}, () => void 0);
				const off = subscribeStore(() => {
					if (on) refresh();
				});
				return () => {
					on = false;
					off();
				};
			}, []);
			const customs = allTemplates().filter((x) => !x.builtin);
			const list = allTemplates().filter((x) => {
				if (selected === null) return true;
				if (selected === SCOPE_PRESET) return x.builtin;
				if (selected === SCOPE_CUSTOM) return !x.builtin;
				return matchLabel(x, selected);
			});
			const ql = q.trim().toLowerCase();
			const filtered = ql ? list.filter((x) => templateHaystack(x).indexOf(ql) >= 0) : list;
			const sorted = compact ? sortedTemplatesBottomUp(filtered) : sortedTemplates(filtered);
			react.useEffect(() => {
				if (!compact) return;
				const el = listRef.current;
				if (!el) return;
				let raf1, raf2, tid;
				const scroll = () => {
					try {
						el.scrollTop = el.scrollHeight;
					} catch (e) {}
				};
				if (typeof requestAnimationFrame !== "undefined") raf1 = requestAnimationFrame(() => {
					raf2 = requestAnimationFrame(scroll);
					tid = setTimeout(scroll, 50);
				});
				else tid = setTimeout(scroll, 30);
				return () => {
					try {
						if (raf1) cancelAnimationFrame(raf1);
						if (raf2) cancelAnimationFrame(raf2);
						clearTimeout(tid);
					} catch (e) {}
				};
			}, [
				compact,
				selected,
				q,
				filtered.length,
				sorted.length
			]);
			const presetCount = PRESET_TEMPLATES.length;
			const customCount = customs.length;
			const base = "var(--dsw-alias-label-primary)";
			const muted = "var(--dsw-alias-label-secondary)";
			const dim = "var(--dsw-alias-label-tertiary)";
			const line = "1px solid var(--dsw-alias-border-l1)";
			const panelStyle = compact ? {
				position: "fixed",
				left: pos && pos.left || 0,
				bottom: pos && pos.bottom || 0,
				visibility: pos ? "visible" : "hidden",
				zIndex: PANEL_Z,
				width: 560,
				display: "flex",
				flexDirection: "column",
				background: "var(--dsw-specific-menu)",
				border: "1px solid var(--dsw-alias-border-inverted)",
				borderRadius: 12,
				boxShadow: "var(--dsw-shadow-lv3)",
				overflow: "hidden",
				fontFamily: "var(--dsw-font-family)",
				fontSize: "var(--dsw-font-markdown-base-font-size)",
				color: base
			} : {
				display: "flex",
				flexDirection: "column",
				gap: 6,
				padding: "6px 8px",
				fontFamily: "var(--dsw-font-family)",
				fontSize: "var(--dsw-font-markdown-base-font-size)",
				color: base
			};
			const headStyle = {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				padding: "6px 8px",
				borderBottom: line
			};
			const titleStyle = {
				fontWeight: 700,
				fontSize: "1em"
			};
			const addBtn = {
				width: 26,
				height: 26,
				borderRadius: 7,
				border: line,
				background: "var(--dsw-alias-bg-layer-3)",
				color: "var(--dsw-specific-accent,#f0a45c)",
				fontSize: "1.2em",
				lineHeight: 1,
				cursor: "pointer",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 0
			};
			const closeBtn = {
				width: 26,
				height: 26,
				borderRadius: 7,
				border: 0,
				background: "transparent",
				color: dim,
				fontSize: "1.2em",
				lineHeight: 1,
				cursor: "pointer",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 0
			};
			const headBtns = {
				display: "flex",
				gap: 4,
				alignItems: "center"
			};
			const cloudRowStyle = {
				display: "flex",
				gap: 4,
				padding: "3px 8px 0",
				flexWrap: "wrap"
			};
			const cloudBtn = (on) => ({
				padding: "2px 8px",
				borderRadius: 999,
				border: line,
				background: on ? "var(--dsw-alias-bg-layer-3)" : "transparent",
				color: on ? base : muted,
				cursor: "pointer",
				fontFamily: "var(--dsw-font-family)",
				fontSize: "0.85em"
			});
			const searchStyle = {
				margin: "5px 8px 4px",
				padding: "5px 9px",
				borderRadius: 8,
				border: line,
				background: "var(--dsw-alias-bg-layer-3)",
				color: base,
				fontFamily: "var(--dsw-font-family)",
				fontSize: "0.96em",
				outline: "none"
			};
			const listStyle = compact ? {
				overflow: "auto",
				padding: "2px 2px 8px",
				height: 360,
				display: "flex",
				flexDirection: "column",
				justifyContent: sorted.length <= 10 ? "flex-end" : "flex-start"
			} : { padding: "2px 2px 8px" };
			const itemStyle = {
				display: "flex",
				gap: 6,
				borderRadius: 8,
				cursor: "pointer",
				alignItems: compact ? "center" : "flex-start",
				padding: compact ? "3px 6px" : "4px 2px"
			};
			const pinStyle = (on) => ({
				flex: "none",
				width: 20,
				height: 20,
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				cursor: "pointer",
				border: 0,
				background: "transparent",
				borderRadius: 6
			});
			const nmStyle = {
				flex: "none",
				minWidth: 0,
				fontSize: "0.98em",
				color: base,
				fontWeight: 500,
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis"
			};
			const subStyle = {
				display: "block",
				fontSize: "0.85em",
				color: dim,
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis"
			};
			const tagStyle = {
				flex: "none",
				fontSize: "0.7em",
				fontWeight: 500,
				color: muted,
				background: "var(--dsw-alias-bg-layer-3)",
				border: "1px solid var(--dsw-alias-border-l2)",
				padding: "0 7px",
				borderRadius: 999,
				lineHeight: "15px",
				letterSpacing: "0.02em",
				whiteSpace: "nowrap"
			};
			const actStyle = {
				display: "flex",
				gap: 4,
				flex: "none"
			};
			const actBtn = (danger) => ({
				border: line,
				background: "transparent",
				color: danger ? "var(--dsw-specific-danger,#e06c75)" : dim,
				cursor: "pointer",
				fontSize: "0.85em",
				padding: "1px 8px",
				borderRadius: 999,
				fontFamily: "var(--dsw-font-family)",
				whiteSpace: "nowrap"
			});
			const footLink = {
				color: "var(--dsw-specific-accent,#f0a45c)",
				cursor: "pointer",
				textDecoration: "none",
				background: "transparent",
				border: 0,
				fontFamily: "var(--dsw-font-family)",
				fontSize: "0.85em"
			};
			const handlePick = (x) => {
				onPick(x, useInput, inputActions);
			};
			const handlePin = (e, x) => {
				e.stopPropagation();
				if (!togglePin(x.id).ok) alert(t("pinFull"));
				refresh();
			};
			const handleCopy = (e, id) => {
				e.stopPropagation();
				const c = copyPresetToCustom(id);
				if (!c) return;
				togglePin(c.id);
				selectedState[1](SCOPE_CUSTOM);
				highlightState[1](c.id);
				refresh();
				setTimeout(() => {
					highlightState[1](null);
					try {
						const el = typeof document !== "undefined" ? document.querySelector("[data-dsh-prompt-id=\"" + c.id + "\"]") : null;
						if (el) el.scrollIntoView({ block: "nearest" });
					} catch (err) {}
				}, 1600);
			};
			const handleDel = (e, x) => {
				e.stopPropagation();
				modalState[1]({
					kind: "del",
					t: x
				});
			};
			const handleEdit = (e, x) => {
				e.stopPropagation();
				modalState[1]({
					kind: "edit",
					t: x
				});
			};
			let modalNode = null;
			if (modal) {
				if (modal.kind === "add" || modal.kind === "edit") modalNode = h(ModalPortal, { key: "portal-tplmodal-" + modal.kind + (modal.t ? "-" + modal.t.id : "") }, [h("div", { key: "tplmodal-" + modal.kind + (modal.t ? "-" + modal.t.id : "") }, [h(TemplateModal, {
					kind: modal.kind,
					tpl: modal.t,
					t,
					onCancel: () => {
						setHoverCloseSuppressed(false);
						modalState[1](null);
					},
					onOk: (f) => {
						if (modal.kind === "edit" && modal.t) updateCustom(modal.t.id, f);
						else addCustom(f.name, f.labels, f.body);
						setHoverCloseSuppressed(false);
						modalState[1](null);
						refresh();
					}
				})])]);
				else if (modal.kind === "del" && modal.t) modalNode = h(ModalPortal, { key: "portal-del-" + modal.t.id }, [h("div", { key: "del-" + modal.t.id }, [h(ConfirmDelete, {
					tpl: modal.t,
					t,
					onCancel: () => {
						setHoverCloseSuppressed(false);
						modalState[1](null);
					},
					onOk: () => {
						removeCustom(modal.t.id);
						setHoverCloseSuppressed(false);
						modalState[1](null);
						refresh();
					}
				})])]);
			}
			const cloudNodes = h("div", { style: cloudRowStyle }, [
				h("button", {
					key: "scope-all",
					style: cloudBtn(selected === null),
					onClick: () => {
						selectedState[1](null);
						refresh();
					}
				}, ALL_LABEL),
				h("button", {
					key: "scope-preset",
					style: cloudBtn(selected === SCOPE_PRESET),
					onClick: () => {
						selectedState[1](selected === SCOPE_PRESET ? null : SCOPE_PRESET);
						refresh();
					}
				}, SCOPE_PRESET_LABEL),
				h("button", {
					key: "scope-custom",
					style: cloudBtn(selected === SCOPE_CUSTOM),
					onClick: () => {
						selectedState[1](selected === SCOPE_CUSTOM ? null : SCOPE_CUSTOM);
						refresh();
					}
				}, SCOPE_CUSTOM_LABEL),
				...actionCloudLabels().map((c) => h("button", {
					key: c,
					style: cloudBtn(selected === c),
					onClick: () => {
						selectedState[1](selected === c ? null : c);
						refresh();
					}
				}, c))
			]);
			const rows = sorted.map((x) => {
				const pinned = isPinned(x.id);
				const acts = !x.builtin ? h("span", { style: actStyle }, [h("button", {
					style: actBtn(),
					onClick: (e) => handleEdit(e, x)
				}, t("edit")), h("button", {
					style: actBtn(true),
					onClick: (e) => handleDel(e, x)
				}, t("del"))]) : h("span", { style: actStyle }, [h("button", {
					style: actBtn(),
					onClick: (e) => handleCopy(e, x.id)
				}, t("copy"))]);
				const itemBg = highlightId === x.id ? "var(--dsw-alias-interactive-bg-hover)" : void 0;
				const intro = (x.body || "").split("\n")[0].trim();
				const usageN = loadUsage()[x.id] || 0;
				const usageTitle = "已使用 " + usageN + " 次";
				const usageStyle = {
					flex: "none",
					fontSize: "0.75em",
					color: "var(--dsw-alias-label-tertiary)",
					minWidth: "4ch",
					textAlign: "right",
					fontVariantNumeric: "tabular-nums",
					fontFeatureSettings: "\"tnum\"",
					whiteSpace: "nowrap"
				};
				if (compact) {
					const keepFocus = { onMouseDown: keepComposerFocus };
					return h("div", {
						key: x.id,
						style: {
							...itemStyle,
							background: itemBg,
							minWidth: 0
						},
						"data-dsh-prompt-id": x.id,
						...keepFocus,
						onClick: () => handlePick(x),
						title: labelString(x) + " · " + t("insertHint")
					}, [
						h("button", {
							style: pinStyle(pinned),
							title: t("pin"),
							onClick: (e) => handlePin(e, x)
						}, [h("svg", {
							width: 14,
							height: 14,
							viewBox: "0 0 24 24",
							fill: pinned ? "var(--dsw-specific-accent,#f0a45c)" : "none",
							stroke: pinned ? "var(--dsw-specific-accent,#f0a45c)" : dim,
							strokeWidth: 1.8,
							strokeLinecap: "round",
							strokeLinejoin: "round",
							style: { display: "block" }
						}, [h("path", { d: "M12 17v5" }), h("path", { d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z" })])]),
						h("span", { style: {
							flex: 1,
							minWidth: 0,
							display: "flex",
							alignItems: "baseline",
							gap: 6,
							overflow: "hidden"
						} }, [
							h("span", { style: {
								flex: "none",
								fontSize: "0.95em",
								color: base,
								fontWeight: 600,
								whiteSpace: "nowrap"
							} }, x.name),
							h("span", { style: {
								flex: "0 1 auto",
								minWidth: 0,
								fontSize: "0.8em",
								color: muted,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis"
							} }, labelString(x)),
							h("span", { style: {
								flex: "1 1 auto",
								minWidth: 0,
								fontSize: "0.85em",
								color: dim,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis"
							} }, intro)
						]),
						h("span", { style: actStyle }, acts),
						h("span", {
							style: usageStyle,
							title: usageTitle
						}, String(usageN))
					]);
				}
				return h("div", {
					key: x.id,
					style: {
						...itemStyle,
						cursor: "pointer",
						background: itemBg
					},
					"data-dsh-prompt-id": x.id,
					title: labelString(x) + " · 点击展开/收起简介",
					"aria-expanded": expanded.has(x.id) ? "true" : "false",
					onClick: () => toggleExpanded(x.id)
				}, [
					h("div", { style: {
						flex: "none",
						paddingTop: 2
					} }, [h("button", {
						style: pinStyle(pinned),
						title: t("pin"),
						onClick: (e) => handlePin(e, x)
					}, [h("svg", {
						width: 14,
						height: 14,
						viewBox: "0 0 24 24",
						fill: pinned ? "var(--dsw-specific-accent,#f0a45c)" : "none",
						stroke: pinned ? "var(--dsw-specific-accent,#f0a45c)" : dim,
						strokeWidth: 1.8,
						strokeLinecap: "round",
						strokeLinejoin: "round",
						style: { display: "block" }
					}, [h("path", { d: "M12 17v5" }), h("path", { d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z" })])])]),
					h("div", { style: {
						flex: 1,
						minWidth: 0,
						display: "flex",
						flexDirection: "column",
						gap: 1
					} }, [h("div", { style: {
						display: "flex",
						alignItems: "center",
						gap: 6,
						minWidth: 0
					} }, [
						h("span", {
							style: {
								flex: "none",
								fontSize: "0.75em",
								color: dim,
								width: "1.2em",
								textAlign: "center",
								lineHeight: 1
							},
							"aria-hidden": "true"
						}, expanded.has(x.id) ? "▾" : "▸"),
						h("span", { style: nmStyle }, x.name),
						h("span", { style: tagStyle }, labelString(x))
					]), expanded.has(x.id) ? h("span", { style: subStyle }, (x.body || "").slice(0, 44) + "…") : null]),
					h("div", { style: {
						flex: "none",
						display: "flex",
						alignItems: "center",
						gap: 4,
						paddingTop: 2
					} }, [acts]),
					h("span", {
						style: {
							...usageStyle,
							paddingTop: 2
						},
						title: usageTitle
					}, String(usageN))
				]);
			});
			const listNode = rows.length > 0 ? h("div", {
				ref: compact ? listRef : null,
				style: listStyle
			}, rows) : h("div", { style: {
				height: 360,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				color: dim,
				fontSize: "0.92em",
				padding: "2px 2px 8px"
			} }, t("noMatch"));
			const footer = null;
			return h("div", {
				ref: rootRef,
				style: panelStyle,
				...compact ? {
					onMouseEnter: () => cancelPanelClose(),
					onMouseLeave: () => {
						if (modal || searchFocused || composing) return;
						schedulePanelClose(150);
					}
				} : null
			}, [
				useInput ? h(DraftTap, {
					key: "dsh-prompt-draft-tap",
					useInput
				}) : null,
				compact ? h("div", { style: headStyle }, [
					h(PromptMark, { size: 15 }),
					h("span", { style: titleStyle }, t("panelTitle")),
					h("span", { style: {
						fontSize: "0.85em",
						color: dim,
						marginLeft: 6
					} }, t("presetCount") + " " + presetCount + " · " + t("customCount") + " " + customCount),
					h("div", { style: { flex: 1 } }),
					h("button", {
						style: footLink,
						onClick: () => {
							setPanelOpen(false);
							emitGoSettings();
						}
					}, t("goSettings")),
					h("div", { style: headBtns }, [h("button", {
						style: addBtn,
						title: t("add"),
						onClick: () => modalState[1]({ kind: "add" })
					}, "＋"), h("button", {
						style: closeBtn,
						title: t("close"),
						onClick: () => setPanelOpen(false)
					}, "×")])
				]) : h("div", { style: headStyle }, [
					h(PromptMark, { size: 15 }),
					h("span", { style: titleStyle }, t("panelTitle")),
					h("div", { style: { flex: 1 } }),
					h("button", {
						style: {
							...addBtn,
							width: "auto",
							padding: "0 12px",
							fontSize: "0.92em"
						},
						title: t("add"),
						onClick: () => modalState[1]({ kind: "add" })
					}, "＋ " + t("addShort"))
				]),
				cloudNodes,
				h("input", {
					style: searchStyle,
					placeholder: t("searchPh"),
					value: q,
					onChange: (e) => qState[1](e.target.value),
					onFocus: () => {
						focusState[1](true);
						if (compact) setHoverCloseSuppressed(true);
					},
					onBlur: () => {
						focusState[1](false);
						if (compact && !composing && !modal) setHoverCloseSuppressed(false);
					},
					onCompositionStart: () => {
						compState[1](true);
						if (compact) setHoverCloseSuppressed(true);
					},
					onCompositionEnd: (e) => {
						compState[1](false);
						try {
							const v = e && e.target && typeof e.target.value === "string" ? e.target.value : null;
							if (v !== null) qState[1](v);
						} catch (err) {}
						if (compact && !modal && !searchFocused) setHoverCloseSuppressed(false);
					}
				}),
				listNode,
				footer,
				modalNode
			]);
		}
		/** 面板 → 设置页跳转（宿主 settings 路由：由 index.ts 注册） */
		let goSettingsHandler = null;
		function setGoSettingsHandler(fn) {
			goSettingsHandler = fn;
		}
		function emitGoSettings() {
			if (goSettingsHandler) goSettingsHandler();
		}
		/** 点击瞬间现场探针（#61 真机仍覆盖：draftChars 全 0，字活在 textarea/store 之外）。
		* 只记 DOM 计数与桥形状，不记任何正文；位图顺序冻结（见 pick.probe 的 guard）。 */
		const PICK_ACT_NAMES = [
			"setDraft",
			"insert",
			"insertText",
			"appendText",
			"setValue",
			"setText",
			"focus",
			"clear"
		];
		function pickProbe(useInput, inputActions) {
			try {
				let textareas = -1;
				let activeKind = "none";
				let editables = -1;
				try {
					if (typeof document !== "undefined") {
						if (document.querySelectorAll) {
							textareas = document.querySelectorAll("textarea").length;
							editables = document.querySelectorAll("[contenteditable=\"true\"]").length;
						}
						const ae = document.activeElement;
						activeKind = ae && ae.tagName || "none";
					}
				} catch (e) {}
				let storeChars = tapSeen ? tapDraft.length : -1;
				let hasSub = 0;
				try {
					if (useInput && typeof useInput.subscribe === "function") hasSub = 1;
				} catch (e) {}
				let actMask = 0;
				try {
					if (inputActions) for (let i = 0; i < PICK_ACT_NAMES.length; i++) try {
						if (typeof inputActions[PICK_ACT_NAMES[i]] === "function") actMask |= 1 << i;
					} catch (e) {}
				} catch (e) {}
				logEvent$2("pick.probe", {
					textareas,
					activeKind,
					editables,
					storeChars,
					actMask,
					hasSub
				});
			} catch (e) {}
		}
		/** 记一条日志事件。出口只有一个：日志能力装进 globalThis.__dshPromptLog 的那个实例。
		*  走槽而不是 import 的原因：本仓既有回归脚本会把客户端模块逐个转译后单独 require
		*  （scripts/.rt-tmp/*.cjs），而单文件 bundle 里也没有可用的模块内 require——槽是两边都能用的唯一机制。
		*  能力缺席时是空操作，绝不因为记日志失败而影响功能。 */
		function logEvent$2(event, fields) {
			try {
				const log = globalThis.__dshPromptLog;
				if (log && typeof log.log === "function") log.log(event, fields);
			} catch (e) {}
		}
		//#endregion
		//#region src/client/button.ts
		/**
		* dsh-prompt — 入口按钮（conversation.input.left）
		*/
		/**
		* #66 窄屏优化：对话框底部输入区变窄时，按钮收起文字、只剩图标。
		*
		* 为什么用容器查询而不是 ResizeObserver：宿主输入条那一行（InputBar 的 .row）自带
		* `container-type: inline-size`，插槽 wrapper 是 `display:contents`（不产生盒子、不遮挡），
		* 所以 `@container` 命中的正是那一行本身 —— 纯 CSS 就够，无 JS、无挂载闪烁。宿主自己的
		* 模型选择器用的就是同一套做法（360px 处把自己那一行文字换成图标）。
		*
		* 断点标定（#65 原型实测，真 Chrome 布局）：现状要 ≥530.4px 才不换行
		* （tools 254.7 + 间隙 12 + trailing 263.7）；本规则取 560px = 标定值 + 约 30px 余量
		* （相邻按钮宽度会随宿主与其它插件变化）。比的是「那一行的内容盒宽度」，不是视口宽度；
		* 收起「Prompt」文字省 46.7px，等于把「开始换行」的宽度往下推 46.7px。
		*
		* 兜底：若将来宿主去掉 container-type，规则静默不匹配 ⇒ 行为退回今天的宽屏样式，不产生回归。
		*/
		const NARROW_STYLE_ID = "dsh-prompt-entry-narrow";
		const NARROW_CSS = [
			"@container (max-width: 560px) {",
			"  [data-dsh-prompt-entry] [data-dsh-prompt-label] { display: none; }",
			"}"
		].join("\n");
		let narrowStyleReady = false;
		/** 注入窄屏样式（幂等；任何失败都不影响按钮本身可用） */
		function ensureNarrowStyle() {
			if (narrowStyleReady) return;
			try {
				const doc = globalThis.document;
				if (!doc || !doc.head || typeof doc.createElement !== "function") return;
				if (typeof doc.querySelector === "function" && doc.querySelector("style[data-dsh-prompt-style=\"dsh-prompt-entry-narrow\"]")) {
					narrowStyleReady = true;
					return;
				}
				const tag = doc.createElement("style");
				tag.setAttribute("data-dsh-prompt-style", NARROW_STYLE_ID);
				tag.textContent = NARROW_CSS;
				doc.head.appendChild(tag);
				narrowStyleReady = true;
			} catch (e) {}
		}
		function EntryButton(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const open = props.open ?? false;
			const label = tr(getLang(), STR.entryBtn);
			ensureNarrowStyle();
			return h("button", {
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
					padding: "5px 10px",
					borderRadius: 8,
					background: "var(--dsw-alias-bg-layer-3)",
					border: "1px solid var(--dsw-alias-border-l1)",
					color: open ? "var(--dsw-specific-accent,#f0a45c)" : "var(--dsw-alias-label-primary)",
					cursor: "pointer",
					fontSize: 12,
					fontWeight: 500,
					fontFamily: "var(--dsw-font-family)",
					whiteSpace: "nowrap",
					flex: "none"
				},
				title: label,
				"aria-label": label,
				"data-dsh-prompt-entry": "1",
				onMouseDown: keepComposerFocus,
				onMouseEnter: () => {
					cancelPanelClose();
					setPanelOpen(true);
				},
				onMouseLeave: () => {
					schedulePanelClose(150);
				},
				onClick: () => {
					cancelPanelClose();
					setPanelOpen(!isPanelOpen());
				}
			}, [h("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "var(--dsw-specific-accent,#f0a45c)",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				style: { flex: "none" }
			}, [
				h("path", { d: "M15 14c.2-1 .7-1.7 1.5-2.5C17.5 10.6 18 9.3 18 8a6 6 0 1 0-12 0c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" }),
				h("path", { d: "M9 18h6" }),
				h("path", { d: "M10 22h4" }),
				h("path", { d: "M18.5 2.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" })
			]), h("span", { "data-dsh-prompt-label": "1" }, label)]);
		}
		//#endregion
		//#region src/client/about.ts
		/**
		* dsh-prompt — 设置页对外入口区（#37）
		* 两件东西：顶部右上角两个图标按钮（🌟 仓库 / 💬 ISSUE 列表，各带自绘悬停气泡）+ 底部「作者其他插件」四行引流区。
		* 边界：纯前端展示，不发网络请求、不写本地存档键、不碰模板数据与智能召回。
		* 顶层显示：气泡经 panel 的 TopPortal 挂到 body —— 设置面板自身会滚动、且带层叠上下文，内联气泡会被裁剪或遮挡。
		* 契约：导出 SettingsHeaderLinks({ lang, entry? }) 与 AuthorPlugins({ lang }) 两个组件；气泡、定位、清单常量都是内部实现。
		* #60 追加交付 A 起多一个可选的 `entry`：调用方（settings.ts）把更新入口那枚按钮交进来，与两个图标同排。
		*/
		const REPO_URL = "https://github.com/FeatherHunter/dsh-prompt";
		const ISSUES_URL = "https://github.com/FeatherHunter/dsh-prompt/issues";
		const MORE_PLUGINS = [
			{
				slug: "dsh-mattpocock-skills-deck",
				url: "https://github.com/FeatherHunter/dsh-mattpocock-skills-deck",
				descKey: "moreDescDeck"
			},
			{
				slug: "dsh-opencode-palette",
				url: "https://github.com/FeatherHunter/dsh-opencode-palette",
				descKey: "moreDescPalette"
			},
			{
				slug: "dsh-prompt",
				url: REPO_URL,
				descKey: "moreDescPrompt"
			},
			{
				slug: "dsh-im-companion",
				url: "https://github.com/FeatherHunter/dsh-im-companion",
				descKey: "moreDescCompanion"
			}
		];
		/** 气泡层级：高于选择类浮层（PANEL_Z 9999）与设置面板自身，低于弹窗（MODAL_Z 11000）——弹窗打开时永远压住气泡。 */
		const TIP_Z = 10900;
		const headerRowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
			padding: "2px 4px 6px"
		};
		const brandStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			minWidth: 0
		};
		const brandNameStyle = {
			fontWeight: 600,
			fontSize: "0.95em",
			color: "var(--dsw-alias-label-primary)",
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis"
		};
		const headBtnsStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			flex: "0 1 auto",
			minWidth: 0
		};
		const iconBtnStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: 26,
			height: 26,
			borderRadius: 7,
			textDecoration: "none",
			cursor: "pointer",
			lineHeight: 1,
			border: "1px solid transparent",
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			flex: "none"
		};
		const iconBtnHover = {
			background: "var(--dsw-alias-bg-layer-3)",
			borderColor: "var(--dsw-alias-border-l1)",
			color: "var(--dsw-alias-label-primary)"
		};
		const tipStyle = {
			position: "fixed",
			zIndex: TIP_Z,
			maxWidth: 220,
			pointerEvents: "none",
			background: "var(--dsw-specific-menu)",
			color: "var(--dsw-alias-label-primary)",
			border: "1px solid var(--dsw-alias-border-l1)",
			borderRadius: 8,
			padding: "6px 10px",
			boxShadow: "var(--dsw-shadow-lv3)",
			fontFamily: "var(--dsw-font-family)",
			fontSize: 12,
			lineHeight: 1.55
		};
		const moreCardStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 2,
			margin: "12px 4px 4px",
			padding: "10px 12px",
			border: "1px solid var(--dsw-alias-border-l1)",
			borderRadius: 10,
			fontFamily: "var(--dsw-font-family)"
		};
		const moreTitleStyle = {
			fontSize: "0.9em",
			fontWeight: 600,
			color: "var(--dsw-alias-label-secondary)",
			paddingBottom: 4
		};
		const moreRowStyle = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			padding: "7px 4px",
			borderRadius: 7,
			textDecoration: "none",
			color: "var(--dsw-alias-label-primary)"
		};
		const moreRowHover = { background: "var(--dsw-alias-bg-layer-3)" };
		const moreSlugStyle = {
			flex: "none",
			fontFamily: "Consolas,Menlo,monospace",
			fontSize: 12,
			fontWeight: 650,
			whiteSpace: "nowrap"
		};
		const moreDescStyle = {
			flex: 1,
			minWidth: 0,
			fontSize: 11.5,
			color: "var(--dsw-alias-label-secondary)",
			lineHeight: 1.5
		};
		/**
		* 自绘悬停气泡：hover 与键盘 focus 都出，mouseleave / blur / Esc 收。
		* 坐标以锚点 rect 现算（fixed + 右对齐锚点右缘；下方放不下就翻到上方）。
		* 滚动 / 尺寸变化时**跟着锚点重算**而不是收起：键盘 Tab 聚焦时浏览器会先把按钮滚进视口，
		* 「一聚焦就收起」会把「聚焦时看得到气泡」这条用户故事打掉，也会留下停不下来的错位坐标；
		* 只有锚点整个滚出视口（或脱离文档）才收起。
		* pointerEvents: 'none' 保证气泡本身不抢鼠标（翻转时不会和锚点互相打架）。
		*/
		function HoverTip(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const st = react.useState(null);
			const tip = st[0];
			const setTip = st[1];
			const wrapRef = react.useRef(null);
			const open = !!tip;
			const rectOf = () => {
				try {
					const el = wrapRef.current;
					return el && typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
				} catch (e) {
					return null;
				}
			};
			const show = () => setTip({ rect: rectOf() });
			const hide = () => setTip(null);
			react.useEffect(() => {
				if (!open || typeof window === "undefined") return;
				let raf = 0;
				const schedule = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);
				const unschedule = (id) => {
					try {
						if (typeof cancelAnimationFrame === "function" && typeof id === "number") cancelAnimationFrame(id);
						else clearTimeout(id);
					} catch (e) {}
				};
				const sync = () => {
					if (raf) return;
					raf = schedule(() => {
						raf = 0;
						const r = rectOf();
						const vh = window.innerHeight || 0;
						if (!r || !r.width || vh > 0 && (r.bottom < 0 || r.top > vh)) setTip(null);
						else setTip({ rect: r });
					});
				};
				window.addEventListener("scroll", sync, true);
				window.addEventListener("resize", sync);
				return () => {
					window.removeEventListener("scroll", sync, true);
					window.removeEventListener("resize", sync);
					if (raf) unschedule(raf);
				};
			}, [open]);
			const r = tip && tip.rect;
			let style = tipStyle;
			if (r) {
				const vw = typeof window !== "undefined" && window.innerWidth || 0;
				const vh = typeof window !== "undefined" && window.innerHeight || 0;
				const right = Math.max(8, vw - r.right);
				const fitsBelow = vh <= 0 || r.bottom + 8 + 64 <= vh;
				style = Object.assign({}, tipStyle, fitsBelow ? {
					right,
					top: r.bottom + 8
				} : {
					right,
					bottom: Math.max(8, vh - r.top + 8)
				});
			}
			return h("span", {
				ref: wrapRef,
				style: { display: "inline-flex" },
				onMouseEnter: show,
				onMouseLeave: hide,
				onFocus: show,
				onBlur: hide,
				onKeyDown: (e) => {
					if (e && e.key === "Escape") hide();
				}
			}, [props.children, tip ? h(TopPortal, {
				key: "tip",
				rootAttr: "data-dsh-prompt-tip-root"
			}, h("div", {
				style,
				"data-dsh-prompt-tip": ""
			}, props.content)) : null]);
		}
		/** 单个图标按钮：26×26 方形热区，自绘 hover 底色；不写 outline，保留原生 focus ring（键盘可见）。 */
		function IconLink(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const st = react.useState(false);
			const over = st[0];
			const setOver = st[1];
			return h("a", {
				href: props.href,
				target: "_blank",
				rel: "noreferrer",
				"aria-label": props.label,
				style: Object.assign({}, iconBtnStyle, over ? iconBtnHover : null),
				onMouseEnter: () => setOver(true),
				onMouseLeave: () => setOver(false)
			}, h("span", {
				"aria-hidden": "true",
				style: {
					fontSize: 15,
					lineHeight: 1
				}
			}, props.emoji));
		}
		/** 引流区一行：等宽 slug + 灰色描述 + 右侧外链图标，整行可点跳仓库首页。 */
		function PluginRow(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const st = react.useState(false);
			const over = st[0];
			const setOver = st[1];
			return h("a", {
				href: props.url,
				target: "_blank",
				rel: "noreferrer",
				style: Object.assign({}, moreRowStyle, over ? moreRowHover : null),
				onMouseEnter: () => setOver(true),
				onMouseLeave: () => setOver(false)
			}, [
				h("span", {
					key: "slug",
					style: moreSlugStyle
				}, props.slug),
				h("span", {
					key: "desc",
					style: moreDescStyle
				}, props.desc),
				h("svg", {
					key: "ext",
					width: 12,
					height: 12,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 2,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": "true",
					style: {
						flex: "none",
						opacity: .7
					}
				}, [
					h("path", {
						key: "a",
						d: "M14 4h6v6"
					}),
					h("path", {
						key: "b",
						d: "M20 4l-8.6 8.6"
					}),
					h("path", {
						key: "c",
						d: "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
					})
				])
			]);
		}
		/**
		* 顶部头行：左边插件标志与页面名，右边「更新入口（调用方给了就渲染）+ 两个图标按钮」。
		*
		* #60 追加交付 A：更新入口不再是独立卡片，而是**这一行里的一枚按钮** —— 与 🌟 / 💬 同一个父节点
		* （`headBtnsStyle` 那个 span）、DOM 顺序排在这两个图标**之前**。`entry` 由 settings.ts 交进来
		* （它同时持有 about.ts 与 update.ts 的引用），本文件因此不 import update.ts，两边都不成环。
		* 不传 `entry` 时这一行与 #37 完全一致（本文件的回归脚本就是单独挂载它）。
		*/
		function SettingsHeaderLinks(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const t = (k) => tr(props.lang, STR[k]);
			return h("div", { style: headerRowStyle }, [h("span", {
				key: "brand",
				style: brandStyle
			}, [h(PromptMark, {
				key: "mark",
				size: 16
			}), h("span", {
				key: "name",
				style: brandNameStyle
			}, t("sectionName"))]), h("span", {
				key: "btns",
				style: headBtnsStyle
			}, [
				props.entry || null,
				h(HoverTip, {
					key: "star",
					content: t("starTip")
				}, h(IconLink, {
					href: REPO_URL,
					label: t("gitHubRepo"),
					emoji: "🌟"
				})),
				h(HoverTip, {
					key: "feedback",
					content: t("feedbackTip")
				}, h(IconLink, {
					href: ISSUES_URL,
					label: t("feedback"),
					emoji: "💬"
				}))
			])]);
		}
		/** 底部「作者其他插件」引流区：四行，每一行都能点开对应仓库首页。 */
		function AuthorPlugins(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const t = (k) => tr(props.lang, STR[k]);
			const rows = MORE_PLUGINS.map((p) => h(PluginRow, {
				key: p.slug,
				slug: p.slug,
				url: p.url,
				desc: t(p.descKey)
			}));
			return h("div", {
				style: moreCardStyle,
				"data-dsh-prompt-more": ""
			}, [h("div", {
				key: "title",
				style: moreTitleStyle
			}, t("moreTitle"))].concat(rows));
		}
		//#endregion
		//#region src/update/gen/updateClient.derived.js
		var DEFAULT_PANEL_POLL_MS = 1e3;
		var MIN_PANEL_POLL_MS = 250;
		function assertPrefix(value, role) {
			if (typeof value !== "string" || value.length === 0) throw new Error("[dsh-plugin-update] " + role + " 非法：须为非空字符串（收到 " + JSON.stringify(value) + "）");
			if (value.includes(".") || value.includes("/") || value.includes("\\") || /\s/.test(value)) throw new Error("[dsh-plugin-update] " + role + " 非法：不得含有点、路径分隔符或空白（收到 " + JSON.stringify(value) + "）");
			return value;
		}
		function buildPhoneNames$1(prefix) {
			const checked = assertPrefix(prefix, "电话名前缀 prefix");
			return {
				updateStatus: checked + ".updateStatus",
				updateCheck: checked + ".updateCheck",
				updateInstall: checked + ".updateInstall"
			};
		}
		var CLIENT_POLL = {
			defaultMs: DEFAULT_PANEL_POLL_MS,
			minMs: MIN_PANEL_POLL_MS
		};
		function buildClientPhoneNames$1(prefix) {
			return buildPhoneNames$1(prefix);
		}
		const UPD_PHONE_NAMES = buildClientPhoneNames$1("prompt");
		const UPD_POLL_MS = CLIENT_POLL.defaultMs;
		CLIENT_POLL.minMs;
		const UPD_STATUS = UPD_PHONE_NAMES.updateStatus;
		const UPD_CHECK = UPD_PHONE_NAMES.updateCheck;
		const UPD_INSTALL = UPD_PHONE_NAMES.updateInstall;
		const UPD_POLL = UPD_POLL_MS;
		//#endregion
		//#region src/update/bridge.ts
		/**
		* dsh-prompt — 更新能力的客户端半（#39）：把「电话名」落到既有 HTTP 桥的三条端点上
		*
		* 客户端不能读盘、不能起子进程，只能发 HTTP 请求；宿主半在本地 web 服务上开了
		* `/_dsh/dsh-prompt/*` 这条桥（见 lib/index.js 的 buildPromptRoute）。更新包文档里说的
		* 「电话表」是使用方自建的一张「名字 → 函数」表 —— 本插件不另造一张：三个电话直接挂到
		* 这条既有桥上。这个文件就是那张表在本插件里的唯一形态，住在更新能力自己的目录里，
		* 不外泄给别的模块（别的模块要用更新，只走 host()）。
		*
		* 两条纪律：
		* - 电话名只从派生文件读（`gen/updateClient.derived.js`，官方 derive 工具生成、入库），
		*   不许在别处写 `'prompt.updateStatus'` 这种字面量，也不许写死轮询数字。
		* - 三条路由路径只在本文件写一次，宿主半 `src/update/host/index.ts` 从同一处导入；
		*   构建产物 `lib/update.js` 侧由 `scripts/test-issue-39.cjs` 做源码级漂移告警。
		*/
		/** 更新状态快照端点（宿主半 `createUpdateCapability` 注册）。 */
		const UPDATE_STATUS_PATH = "/_dsh/dsh-prompt/update/status";
		/** 查新版本端点（会联网问官方源）。 */
		const UPDATE_CHECK_PATH = "/_dsh/dsh-prompt/update/check";
		/** 装更新端点（真装，耗时最长）。 */
		const UPDATE_INSTALL_PATH = "/_dsh/dsh-prompt/update/install";
		/** 电话名（从派生文件读；更新包生成的常量本来就叫这个名字，此处只做一次改名收敛）。 */
		const updatePhoneNames = {
			updateStatus: UPD_STATUS,
			updateCheck: UPD_CHECK,
			updateInstall: UPD_INSTALL
		};
		/**
		* 当前浏览器原点的桥地址；没有 location 时回相对路径（`fetch` 自己会补原点）。
		* 宿主半没有 location，所以这里不直接写 `globalThis.location` —— 同一份源码要同时过
		* 「浏览器 lib」与「Node lib」两套类型检查（见 tsconfig.json 与 tsconfig.host.json）。
		*/
		function pathOf(route) {
			const withLocation = globalThis;
			try {
				const origin = withLocation.location?.origin;
				if (typeof origin === "string" && origin) return new URL(route, origin).toString();
			} catch (e) {}
			return route;
		}
		/** 把「不认识的 JSON」收成信封：只认 ok 是布尔的那种，别的一律当坏回包。 */
		function asEnvelope(raw) {
			if (raw !== null && typeof raw === "object" && typeof raw.ok === "boolean") return raw;
			return {
				ok: false,
				error: {
					code: "bridge-bad-shape",
					message: "bridge returned a non-envelope body"
				}
			};
		}
		async function readEnvelope(res) {
			try {
				return asEnvelope(await res.json());
			} catch (e) {
				return {
					ok: false,
					error: {
						code: "bridge-bad-json",
						message: `HTTP ${res.status}`
					}
				};
			}
		}
		function shape(env) {
			if (!env.ok) return {
				ok: false,
				snapshot: null,
				manual: null,
				receipt: null,
				error: env.error ?? {
					code: "bridge-error",
					message: "unknown bridge error"
				}
			};
			const value = env.value !== null && typeof env.value === "object" ? env.value : {};
			return {
				ok: true,
				snapshot: value.snapshot !== null && typeof value.snapshot === "object" ? value.snapshot : null,
				manual: typeof value.manual === "string" ? value.manual : null,
				receipt: value.receipt ?? null,
				error: null
			};
		}
		/**
		* 建更新电话客户端。电话一律走 POST：三条路的入参都过 JSON 请求体，
		* 宿主半按路由分流（`runRoute`），不按请求体分流。
		*/
		function createUpdateBridge() {
			const call = async (route, args) => {
				if (typeof fetch === "undefined") return {
					ok: false,
					snapshot: null,
					manual: null,
					receipt: null,
					error: {
						code: "no-fetch",
						message: "fetch is unavailable in this environment"
					}
				};
				try {
					return shape(await readEnvelope(await fetch(pathOf(route), {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(args ?? {})
					})));
				} catch (e) {
					return {
						ok: false,
						snapshot: null,
						manual: null,
						receipt: null,
						error: {
							code: "bridge-unreachable",
							message: e instanceof Error ? e.message : String(e)
						}
					};
				}
			};
			return {
				[UPD_STATUS]: (args = {}) => call(UPDATE_STATUS_PATH, args),
				[UPD_CHECK]: (args = {}) => call(UPDATE_CHECK_PATH, args),
				[UPD_INSTALL]: (args = {}) => call(UPDATE_INSTALL_PATH, args)
			};
		}
		//#endregion
		//#region src/client/updauto.ts
		/**
		* dsh-prompt — 启动自动检查的两块判据与一道闸（#41）：跳过记录存哪、这次该不该弹、能不能发
		*
		* 本文件的性格与 `src/client/state.ts` 一样：不渲染、不认识 RPC、也不 import update.ts
		* （免得和它绕成一个环）。#41 新增的能力里，凡是**不需要 React 与电话**的部分都落在这里：
		*   1. 「跳过此版本」的存取 —— 只落 localStorage 一个键；
		*   2. 「这次该不该自动弹」的纯判据 `decideAutoOpen`；
		*   3. 「一次启动只自动查一次」的闸 `claimAutoCheck` / `deliverAutoCheck`（三态 + 回包交接，见注释）。
		* 另一道闸（弹窗归属：同屏不许叠两只可各自点安装的窗）在 `upddialog.ts`：那边要订阅 React 重渲染，
		* 与这里的纯判据分开，两边都不认识对方。
		* 调用点在 update.ts 的 auto 模式：延迟到点 → 领闸 → 发一条 check → 回包落地交给**当前挂载**的
		* `applyAutoResult`（落状态 + 把快照喂给 `decideAutoOpen`）→ 为真才开弹窗（弹窗本身仍是 #40 那一只，
		* 没有第二只）；结算由 `deliverAutoCheck` 做，交接不到活着的挂载就把名额放回去。
		*
		* 三条边界（map #38 的 grilling 定案）：
		* 1. 「跳过此版本」**只落 localStorage**，不进 `storages/dsh_prompt.json`（那个 schema 已冻结），
		*    也不另造第二套存储：它与 smartstore.ts 的 `dsh.prompt.smart.v2` / `dsh.prompt.smartPos`
		*    是同一层东西 —— 纯本机 UI 偏好，不跨端、不进 domain、不需要宿主参与。所以本文件不认识
		*    store.ts，也不写任何端点路径。
		* 2. 判据只在客户端做：宿主回包里的快照本来就有 `runningVersion` / `latestVersion` 两个字段，
		*    比一比就够，不为「有没有新版」新增电话（#41 一个字节都不改宿主半）。
		* 3. 比不出大小就不弹：版本字段是坏形状 / 认不出时，宁可这次不打扰用户，也不凭猜测弹窗。
		*    代价是「宿主读不出当前版本 ⇒ 这次不弹」，这正是要的保守侧。
		*/
		/**
		* localStorage 键：记下「用户点过跳过此版本」的那个版本号（与 smartstore 的键同一个命名空间）。
		* 值是 `{"version":"x.y.z"}` 的 JSON 文本；读不出来的历史值一律按「没跳过任何版本」处理。
		* 本机偏好键不写日志（与 smartstore 同一取舍），所以本文件不引日志能力。
		*/
		const UPD_SKIP_KEY = "dsh.prompt.upd.skip";
		/**
		* 用户在这一台机器上点过「跳过此版本」的版本号；没有记录 / 坏形状 / 存储不可用一律回空串。
		* 读失败绝不上抛：存储坏了最多是「下次启动再弹一次」，不能因此影响界面。
		*/
		function loadSkippedVersion() {
			try {
				const store = globalThis.localStorage;
				if (!store) return "";
				const raw = store.getItem(UPD_SKIP_KEY);
				if (!raw) return "";
				const parsed = JSON.parse(raw);
				if (!parsed || typeof parsed !== "object") return "";
				return typeof parsed.version === "string" ? parsed.version : "";
			} catch (e) {
				return "";
			}
		}
		/**
		* 记下要跳过的版本号；写失败（隐私模式 / 配额满 / 没有存储）只回 false，不抛 ——
		* 调用方拿到 false 就必须把「这次没记成」说清楚，别让用户以为下次不弹了。
		*/
		function saveSkippedVersion(version) {
			if (!version) return false;
			try {
				const store = globalThis.localStorage;
				if (!store) return false;
				store.setItem(UPD_SKIP_KEY, JSON.stringify({ version }));
				return true;
			} catch (e) {
				return false;
			}
		}
		/**
		* 从更新包抄来的口径：`dist/commands.js` 的 `validVersion` 与客户端派生的东西一样，
		* 要求**正好三段十进制数字**（包自己的 `parseTriple` 其实会把 `x.y` 补成 `x.y.0`，但那只用于
		* 手工命令的版本排序；这里判的是「要不要自动弹窗」，取更严的那一条：认不出就不弹）。
		* 于是 `0.1.2-beta.1` / `0.1` / `v0.1.2` 都落进「认不出」这一侧。
		*/
		const TRIPLE = /^\d+\.\d+\.\d+$/;
		/** 把版本号读成三段；非字符串 / 段数不对 / 含非数字段 → null（不抛）。 */
		function parseTriple(v) {
			if (typeof v !== "string" || !TRIPLE.test(v)) return null;
			const parts = v.split(".");
			const nums = [];
			for (const p of parts) {
				const n = Number(p);
				if (!Number.isSafeInteger(n) || n < 0) return null;
				nums.push(n);
			}
			return [
				nums[0],
				nums[1],
				nums[2]
			];
		}
		/**
		* `a` 比 `b` 新回 1、一样回 0、旧回 -1；任一边读不出来回 `null`（调用方据此别当「有新版本」）。
		* 只比数字，不处理预发布后缀 —— 本仓与更新包的版本号都是三段式。
		*/
		function compareVersionsText(a, b) {
			const pa = parseTriple(a);
			const pb = parseTriple(b);
			if (!pa || !pb) return null;
			for (let i = 0; i < 3; i++) {
				if (pa[i] < pb[i]) return -1;
				if (pa[i] > pb[i]) return 1;
			}
			return 0;
		}
		/**
		* 这次该不该自动弹更新弹窗。五条判据，按顺序早退（`why` 就是先撞上的那一条）：
		*   `bad-version`  版本号读不出来（含 latest / running 任一边）⇒ 不弹（见文件头第 3 条）；
		*   `not-newer`    latest 不比 running 新（相等或更旧）⇒ 不弹；
		*   `skipped`      latest 正好是用户点过「跳过此版本」的那一个 ⇒ 不弹；
		*   `newer`        其余 ⇒ 弹。
		*
		* 两句必须记住的话：
		* 1. **「跳过」只挡自动弹**，不挡手动检查 —— 手动路径根本不走这个函数，用户在面板里点
		*    「检查更新」仍然看得到这个版本（票面交付 3 的后半句）。
		* 2. 判据里没有「跳过多久 / 跳过哪些版本」这类策略：只认**一个**版本号，换个新版本号就会再弹一次
		*    （票面「不做」那一节把「忽略 N 天」明确留给了将来的票）。
		*/
		function decideAutoOpen(input) {
			const latest = input ? input.latest : "";
			const running = input ? input.running : "";
			const skipped = input ? input.skipped : "";
			if (compareVersionsText(latest, running) !== 1) return {
				open: false,
				why: parseTriple(latest) !== null && parseTriple(running) !== null ? "not-newer" : "bad-version"
			};
			if (latest === skipped) return {
				open: false,
				why: "skipped"
			};
			return {
				open: true,
				why: "newer"
			};
		}
		/**
		* 启动后等多久才发那条自动检查的电话（毫秒）。
		*
		* 为什么是 8 秒：宿主半的更新能力是在 boot 之后才装载的（装载失败会回 `update-capability-unavailable`，
		* 见 update.ts 的 CAP_DOWN_CODES），桥路由也要等本地 web 服务起来 —— 早于这个窗口发出去只是白费
		* 这一次机会（本票一个页面会话只自动查一次）。8 秒既避开启动竞争，又不至于让用户以为「它根本没查」。
		*
		* **这个数字在本仓的代码里只出现这一处**（票面交付 1）：调用点引用常量，回归脚本把同一个期望写死。
		*/
		const AUTO_CHECK_DELAY_MS = 8e3;
		/**
		* 「一次启动只自动查一次」的闸（#41 收口 R1，三态 + 回包交接）。
		*
		* 宿主把浮层槽重建、会话切换都可能让宿主组件重挂载，那不该变成第二条电话、第二只弹窗 —— 票面的
		* 「有新版本弹一次」说的是**每次启动至多一次**（页面重载 = 新的一次启动，闸跟着模块重建）。
		*
		* 三态而不是「领了就花掉」（红队 N §4 实测的洞）：第一条 check 还在飞的时候宿主重挂载，旧写法里
		* 名额已经被前一次挂载花掉，新挂载的延迟到点后什么也不做 ⇒ **这一整个会话再也不自动弹窗**
		* （实测通话只有 `check×1`、没有窗口）。所以分成三件事：
		*   - 还没发出去：`autoInFlight` / `autoSpent` 都是假 ⇒ 可以领；
		*   - 已经有一条在飞：`autoInFlight` ⇒ 不重发（不变成两条电话），回包**交给还活着的那个挂载**收
		*     （见 `setAutoCheckHandler`）—— 发出去的那次挂载会卸载，不交接就等于把结果扔掉；
		*   - 拿到了**可判读的回包**：`autoSpent` ⇒ 从此不再发（一次启动就一次）；
		*   - 回包不可判读（桥没答 / 能力没接通 / 连快照都没有）：`deliverAutoCheck` 放闸 ——
		*     「花掉名额」这件事只在真的换来一次判断之后才算数，而不是把「这一整个会话」赔进去。
		*
		* 用户手动点「检查更新」不走这里：想查几次查几次（交付 3 的后半句就靠这条分界）。
		*/
		let autoInFlight = false;
		let autoSpent = false;
		const autoHandlers = [];
		/**
		* 领这一次启动的自动检查名额：名额空着就发（`true`），已经有一条在飞或已经拿到过可判读的回包就
		* 不发（`false`）。拿到 `true` 的调用方**必须**在回包落地时叫一次 `deliverAutoCheck(result)`。
		*/
		function claimAutoCheck() {
			if (autoInFlight || autoSpent) return false;
			autoInFlight = true;
			return true;
		}
		/**
		* 登记「回包交给谁」：当前挂载的实例在挂载时登记、卸载时注销（拿返回值当注销函数）。
		* 挂载顺序保证新挂载一登记就能接住在飞的那一条（登记只用 `useState`，比 8 秒的延迟早得多）。
		*/
		function setAutoCheckHandler(fn) {
			autoHandlers.push(fn);
			return () => {
				const i = autoHandlers.indexOf(fn);
				if (i >= 0) autoHandlers.splice(i, 1);
			};
		}
		/**
		* 一条自动 check 的回包落地：交给**当前还活着**的挂载处理（它负责落状态、判据、开窗、把话说清楚），
		* 并据此结算闸 —— handler 回 `true` 表示这次拿到的是可判读的回包（名额落定），回 `false`
		* （或压根没人接：卸载后再也没有挂载）就把名额放回去。
		*
		* `result` 用 `unknown`：本模块不认识通话结果的形状，只当交接物。
		*/
		function deliverAutoCheck(result) {
			autoInFlight = false;
			let readable = false;
			for (const fn of autoHandlers.slice()) try {
				if (fn(result)) readable = true;
			} catch (e) {}
			if (readable) autoSpent = true;
		}
		//#endregion
		//#region src/client/upddialog.ts
		/**
		* dsh-prompt — 更新弹窗的**归属闸**（#41 收口 R2）：同一时刻只允许一只更新弹窗处于可操作态。
		*
		* 为什么需要它（红队 N §1 实测）：同一个组件在真机上有两个实例 —— 设置页那一份（`auto` 不传）与
		* shell.overlay 那一份（`auto: true`）。两份各自持有一份 `open` 状态、各走一次 ModalPortal，
		* 于是「用户点开设置页入口行」+「自动检查到点」会**同屏叠出两只**（两个全屏遮罩 + 两套
		* 检查/跳过/安装按钮）。真包有两道闸（job 状态 + `acquire()` 独占锁）兜住磁盘，但第二只对用户显示
		* 「安装失败」，而真实情况只是「另一次安装正在进行」—— 客户端这一侧当时零防护。
		*
		* 口径（本闸只管「谁来开」，不管怎么渲染）：
		*   1. 一只已经打开 ⇒ 自动那一只**不接手**（用户已经在看的就是唯一那只）；
		*   2. 用户主动开（点设置页入口行）⇒ 压掉自动那一只（那只立刻关闭），用户的手高于背景动作；
		*   3. 窗口关掉后**不释放**名额：自动那只绝不「关了又弹回来」，不再打扰是这个 UI 的契约。
		*      名额跟着实例卸载走（`releasePort`），所以下次挂载 / 下次启动不受影响。
		*
		* 与 `updauto.ts` 的分工：那边是**纯判据**（不认识 React），这边是**模块级状态 + 订阅**（不认识
		* 版本号、不认识电话、不渲染）。两块都发生在同一个会话里，各管各的闸，合起来才够。
		*
		* 本文件不认识 localStorage / storages：与 `state.ts`、`smartstore.ts` 同一套「纯客户端模块」性格。
		*/
		/** 当前占着名额的实例；`''` = 没人占（可以开）。 */
		let owner = "";
		/** 自动那一只是否被用户的手压掉（压掉后它自己关，且不再接手）。 */
		let autoBlocked = false;
		/** 归属变化时的订阅者（每个组件实例一份）。 */
		const listeners$1 = [];
		/**
		* 本闸**主动指派**的归属（订阅者据此决定要不要关自己）：`null` = 这次变化不是指派
		* （例如用户那只重开自己的窗），订阅者什么都不做。
		*/
		let nextOwner = null;
		/** 实例 token：每个挂载一份，用来回答「名额现在是不是我占着」。 */
		function newPortToken() {
			return "updport-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
		}
		function notify$1() {
			for (const fn of listeners$1.slice()) try {
				fn();
			} catch (e) {}
		}
		/** 订阅归属变化（组件把回调交给 `useState` 即可重新渲染）；返回退订函数。 */
		function subscribePort(fn) {
			listeners$1.push(fn);
			return () => {
				const i = listeners$1.indexOf(fn);
				if (i >= 0) listeners$1.splice(i, 1);
			};
		}
		/** 让 `token` 占住名额并广播（`takeAutoPort` 与用户主动开都走这里）。 */
		function take(token) {
			owner = token;
			nextOwner = token;
			notify$1();
		}
		/**
		* 自动那一只请求开窗：名额空着才给 true。
		*
		* 两道条件：
		*   1. 名额空着（有另一只已经打开 ⇒ 不接手，用户正在看的就是唯一那只）；
		*   2. 没被用户的手压掉过（点过设置页入口行 ⇒ 自动那只不再开）。
		* 同一次 render 里连调两次也只成功一次（`take` 之后 `owner` 已是自己，第二次照样回 false）。
		*/
		function takeAutoPort(token) {
			if (owner !== "" || autoBlocked) return false;
			take(token);
			return true;
		}
		/**
		* 用户主动开窗（点设置页那一行入口）：调用方拿到之后 `setOpen(true)` 即可 —— 用户的手总是算数。
		*
		* 用户的手高于背景动作：名额被别人（自动那一只）占着就先压掉它（订阅者据此自己关，见
		* `portAutoShouldClose`），并记下「自动不再接手」—— 用户关掉这只窗之后，被压掉的那只**不会**弹回来。
		*/
		function askPort(token) {
			if (owner !== "" && owner !== token) autoBlocked = true;
			take(token);
		}
		/**
		* 卸载时归还名额（只在「还占着」时才还：晚挂载的实例接手后，旧实例的清理不许把名额抢回来）。
		* **关窗不调用它** —— 名额要一直占到实例卸载，自动那只才不会「关了又弹回来」。
		*/
		function releasePort(token) {
			if (owner === "" || owner !== token) return;
			owner = "";
			nextOwner = null;
		}
		/** 自动那一只要不要主动关掉：本闸指派了别的实例（通常是用户那只）⇒ true。 */
		function portAutoShouldClose(token) {
			return nextOwner !== null && nextOwner !== token;
		}
		//#endregion
		//#region src/client/update.ts
		/**
		* dsh-prompt — 更新入口 + 更新弹窗（#40）：设置面板里一枚「检查更新」，点开做全四件事
		* （#60 追加交付 A 起这枚按钮坐在插件身份行里 —— 与 🌟 / 💬 同一行、排在两个图标之前，见 row 上的注释）
		*
		* 数据来源只有一个：更新包的电话 —— 就是 `src/update/bridge.ts` 那张表。本文件**一个电话名与
		* 端点路径都不写**：名字从 `updatePhoneNames` 取、路径由 bridge 决定（派生文件是唯一真值）。
		* 三条电话的分工（包 README 第 3 / 8 / 9 / 10 节）：
		*   status  只读本机、不联网（`dist/service.js` 的 `status()`）：当前版本 / 已装版本 / 能不能装 /
		*           装不了的原因 / 手工兜底命令。**面板打开时拿它填「当前版本」是安全的**。
		*   check   联网问官方源要最新版本，并**发一张安装凭证**（回包 `receipt.checkId`）。
		*   install 入参 `{checkId, requestId}`；**没先 check 的裸调必回 `check-expired`** —— 那是包的
		*           功能守卫，不是降级，所以本面板绝不对它赌运气（见 ensureCheckId）。
		*
		* 四个必须做对的地方（票面交付 3 + 开工前置 5/6）：
		* 1. 状态区宁可说「没查到」，也不许空白：电话级失败时宿主回 `{ok:false, value:{…}, error:{code}}`，
		*    bridge 收成 `snapshot:null` —— 只按 `snapshot.blockedReason` 渲染会是一片空白，那正是 #55
		*    真机踩到的形态。这一支由 `data-dsh-prompt-update-hostfail` 那块独占呈现。
		* 2. 装不了的原因不止给原因码，还要给「用户该做什么」（包 README 第 8 节第三列）。本版本实产 7 条，
		*    第 8 条 `registry-conflict` 在 0.1.1 里零处产出（#55 实测）⇒ 文案预留，但不许为它编情形。
		* 3. `pending-restart` 不是失败：顶部显眼横幅 + 说清新版号与「重启宿主后生效」，且不给安装按钮。
		* 4. 手工兜底命令按回包现刷、**不缓存**；为空时只讲原因、不展示命令。**它不再是常驻块**（#60 追加交付 B
		*    第 4 条）：只在「这台机器自动装不了」（宿主给了 `blockedReason` 且 `canInstall` 为假）或「这次失败」
		*    （电话级失败 / 安装任务终态失败）时才出现，命令下面只留**一句**说清它能做什么 —— 上一版那段
		*    四行免责声明与底部那句缓存机制说明都删了（把作者的不确定感摊给用户，主次颠倒）。
		*
		* 本文件不记客户端日志事件：宿主半已经把三条更新事件写进诊断日志（#39），客户端再加事件要同时改
		* 事件清单与 `test:log` 的计数，超出本票范围（要加就单独开票）。
		*
		* #41 起本组件有**两种模式**（同一个组件，不是第二只弹窗）：
		*   设置页那一份（默认，`auto` 不传）：一行入口 + 弹窗，行为与 #40 一字不差；
		*   全局那一份（`auto: true`，`index.ts` 挂在 shell.overlay）：不渲染入口行，改为「延迟一次 check →
		*   有新版本才开同一只弹窗」。判据与跳过记录的落点都在 `updauto.ts`，本文件只做接线。
		*
		* #41 收口（R1/R2）起本组件还持两份**闸**（都是模块级、都跨重挂载）：
		*   一次启动只自动查一次 —— `updauto.ts` 的 `claimAutoCheck` / `deliverAutoCheck`，闸只有在**回包真的
		*   交到活着的挂载手里**之后才算花掉（第一条 check 还在飞时重挂载，那次机会不会被白花掉）；
		*   同一时刻只有一只弹窗可操作 —— `upddialog.ts` 的归属名额（用户那只压掉自动那只，自动那只不接手
		*   已经打开的那只），否则两只同屏、被拒的那只会对用户显示「安装失败」（真包的两道闸只保证不装两次）。
		*/
		/** 样式令牌：与 settings.ts 同一套宿主变量，不发明第二套视觉。 */
		const TOK$1 = {
			labelPrimary: "var(--dsw-alias-label-primary)",
			labelSecondary: "var(--dsw-alias-label-secondary)",
			labelTertiary: "var(--dsw-alias-label-tertiary)",
			bgLayer: "var(--dsw-alias-bg-layer-3)",
			bgHover: "var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))",
			border: "var(--dsw-alias-border-l1)",
			accent: "var(--dsw-specific-accent,#f0a45c)",
			font: "var(--dsw-font-family)",
			mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
		};
		/**
		* 八条 `blockedReason` → 文案键（包 README 第 8 节第三列「用户该做什么」）。
		* 本版本实产 7 条（#55 真机实测：unknown-profile / invalid-installation / installation-changed /
		* source-install / pending-restart / incompatible-node / recovery-required）；第 8 条
		* `registry-conflict` 在 0.1.1 的发行物里**零处产出** —— 预留文案，但别为它编情形。
		* `test:issue-40` 会拿包 README 的表逐条对账，并当场量「哪几条是本版本真会产出的」。
		*/
		const UPDATE_REASON_KEYS = {
			"unknown-profile": "updateWhyUnknownProfile",
			"source-install": "updateWhySourceInstall",
			"invalid-installation": "updateWhyInvalidInstallation",
			"installation-changed": "updateWhyInstallationChanged",
			"pending-restart": "updateWhyPendingRestart",
			"registry-conflict": "updateWhyRegistryConflict",
			"incompatible-node": "updateWhyIncompatibleNode",
			"recovery-required": "updateWhyRecoveryRequired"
		};
		/**
		* 「电话级失败」分三类，**文案必须分开**（红队 L2 打出来的撒谎；L2 第二轮的 N1/N4 又修了两处边角）：
		*
		* 1. `BRIDGE_DOWN_CODES`：**桥本身没回答** —— 没 catch 到 HTTP、回的不是信封、body 不是 JSON、环境没有
		*    fetch。只有这一类的成就是「宿主这次一个字都没回」，`updateHostFailTitle` + `updateHostFailHint`
		*    是给它的。
		* 2. `CAP_DOWN_CODES`：宿主**回了话**，但回的是「更新能力本身没接通」——
		*    `update-capability-unavailable` 是宿主半 `src/update/host/index.ts:52` 的实产码（degraded 实例：
		*    依赖装载失败 / 能力建不起来，两条路都回它，宿主半还专门为它们落了 `dep-load-fail` /
		*    `capability-degraded` / `capability-build-fail` 事件）；`phone-failed` / `unknown-phone` 是同一个
		*    文件里电话路由那一层的实产码（电话抛错 / 路由没有对应电话）。判据是**码的语义，不是它从哪条路
		*    返回**：把它们划进「宿主是通的」那一侧就是撒谎 —— 上一版那句「更新能力可能没接通」对它们本来
		*    是对的，划错类之后反而告诉用户「不用报宿主没接通」、且一个动作都不给（#43 真机验收最容易撞的
		*    失败态正是宿主半没加载）。这一支给 `updateCapDownTitle` + `updateHostFailHint`（同一句
		*    「更新能力可能没接通」）+ 一条动作行。
		* 3. 其余码：宿主回答了「这次操作没成」，给了精确的错误码（`check-expired` / `invalid-release` /
		*    `check-failed` / `install-failed` / `update-busy`…）。对这一类说「宿主没有回答更新状态」才是撒谎
		*    （用户会去报一个不存在的「宿主没接通」故障）⇒ 标题 `updateFailAnsweredTitle` + 按码动作。
		*
		* 第 3 类里**不认识的码**一律落 `updateFailUnknown` 的动作行：说了「往下看这个码与对应做法」就必须给
		* 得出来（N4 —— 曾经 `phone-failed` 与表外的新码拿到的是「承诺了做法却不给做法」）。
		*/
		const BRIDGE_DOWN_CODES = [
			"bridge-unreachable",
			"bridge-bad-shape",
			"bridge-bad-json",
			"no-fetch"
		];
		/** 宿主回了话、但回的是「更新能力/电话通道本身没接通」（见上面第 2 类）。 */
		const CAP_DOWN_CODES = [
			"update-capability-unavailable",
			"phone-failed",
			"unknown-phone"
		];
		/**
		* 实产失败码 → 「下一步动作」文案键。码从两处抄来，都不是猜的（表里不许有凭空编的码）：
		* - 更新包 `dist/service.js` / `host.js` 里 `updateError(...)` 的实参（`check-expired` / `check-failed` /
		*   `invalid-release` / `install-failed` / `update-busy` / `installation-changed` / `registry-conflict` /
		*   `recovery-required`）；
		* - 宿主半 `src/update/host/index.ts` 的路由层（`update-capability-unavailable` / `phone-failed` /
		*   `unknown-phone`）与桥自己的兜底形状码（`bridge-error`）。
		* 包 README 第 11 节点名 `check-expired` 是「正常错误码，不是程序缺陷」⇒ 它的动作就是「重取凭证再提交」，
		* 而且这一句同时由 `ensureCheckId` 在**源头**上自动做掉（见 onInstall 的重试）。
		*/
		const UPDATE_FAIL_KEYS = {
			"update-busy": "updateFailBusy",
			"check-failed": "updateFailCheckFailed",
			"invalid-release": "updateFailInvalidRelease",
			"install-failed": "updateFailInstallFailed",
			"check-expired": "updateFailCheckExpired",
			"installation-changed": "updateFailInstallationChanged",
			"registry-conflict": "updateFailRegistryConflict",
			"recovery-required": "updateFailRecoveryRequired",
			"update-capability-unavailable": "updateCapDownAction",
			"phone-failed": "updateCapDownAction",
			"unknown-phone": "updateCapDownAction",
			"bridge-error": "updateFailUnknown"
		};
		const asText = (v) => typeof v === "string" ? v : "";
		/** 填 STR 里的 `{name}` 占位（只有待重启横幅那一句需要带版本号，为此引模板引擎不值得）。 */
		function fill(template, vars) {
			return template.replace(/\{(\w+)\}/g, (m, k) => Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m);
		}
		/** 一次电话回包里的快照（六字段，本面板只用其中五个 + job 的状态）。 */
		function snapOf(res) {
			return res && res.ok && res.snapshot ? res.snapshot : null;
		}
		/** 回包里的安装凭证（只有 `check` 会给；`status` 永远是 null）。 */
		function checkIdOf(res) {
			const receipt = res && res.receipt;
			if (!receipt || typeof receipt !== "object") return "";
			return asText(receipt.checkId);
		}
		/** 复制到剪贴板（与 settings.ts 同一个两段式兜底；那边的是模块私有，本票不为它重构 settings.ts）。 */
		async function copyText$1(text) {
			try {
				if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
					await navigator.clipboard.writeText(text);
					return true;
				}
			} catch (e) {}
			try {
				if (typeof document === "undefined") return false;
				const ta = document.createElement("textarea");
				ta.value = text;
				ta.style.position = "fixed";
				ta.style.opacity = "0";
				document.body.appendChild(ta);
				ta.select();
				const done = typeof document.execCommand === "function" ? document.execCommand("copy") : false;
				ta.remove();
				return !!done;
			} catch (e) {
				return false;
			}
		}
		const cardStyle = {
			width: 480,
			maxWidth: "92vw",
			maxHeight: "82vh",
			overflowY: "auto",
			background: "var(--dsw-specific-menu)",
			border: "1px solid var(--dsw-alias-border-inverted)",
			borderRadius: 12,
			padding: 16,
			display: "flex",
			flexDirection: "column",
			gap: 10,
			fontFamily: TOK$1.font,
			color: TOK$1.labelPrimary
		};
		const maskStyle = {
			position: "fixed",
			inset: 0,
			background: "rgba(0,0,0,0.55)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			zIndex: MODAL_Z
		};
		const btn = (primary) => ({
			padding: "6px 14px",
			borderRadius: 8,
			border: primary ? 0 : "1px solid " + TOK$1.border,
			background: primary ? TOK$1.accent : TOK$1.bgLayer,
			color: primary ? "#1a1a1e" : TOK$1.labelPrimary,
			cursor: "pointer",
			fontFamily: TOK$1.font,
			fontSize: "0.96em"
		});
		const blockStyle = {
			border: "1px solid " + TOK$1.border,
			borderRadius: 8,
			padding: "10px 12px",
			display: "flex",
			flexDirection: "column",
			gap: 6
		};
		const codeStyle = {
			fontFamily: TOK$1.mono,
			fontSize: 11.5,
			color: TOK$1.labelSecondary,
			wordBreak: "break-all",
			background: TOK$1.bgLayer,
			border: "1px solid " + TOK$1.border,
			borderRadius: 6,
			padding: "6px 8px",
			userSelect: "text"
		};
		/**
		* 入口按钮的样式（#60 追加交付 A）：它现在是**插件身份行里的一枚按钮** —— 与右上角 🌟 / 💬
		* 同一行、同一父节点，排在这两个图标之前。因此它不再有任何自己的容器：`SettingGroup` 那张卡片
		* 与那条整宽 `borderBottom` 都删掉了（上一版把入口做成卡片行，这次连卡片也不要了）。
		*
		* 仍是按钮、不是纯文字，三条可点线索保留：
		*   · 整枚 `cursor: 'pointer'`；
		*   · 悬停铺 `TOK.bgHover`（内联样式没有 `:hover`，沿用既有 `Btn` 的 `useState` + 进入/离开写法）；
		*   · 版本号是一枚**徽标**（等宽 11.5 / `labelSecondary` / 底 `bgLayer` / 圆角 6 / 内距 `1px 6px`）。
		* 数值全部是这一页既有的：字号 12.5（= `Btn`）、11.5（= 徽标 / 日志落点行），圆角 8（= `Btn`）、6（= 徽标），
		* 内距 `4px 6px`、间距 6 —— 没有新造颜色 / 字号 / 圆角。
		*
		* 窄容器（票面追加交付 A 的硬要求）：这一枚可收缩（`minWidth: 0` + 文案省略号），徽标 `flex: 'none'`、
		* 两个图标各自 `flex: 'none'` —— 挤的时候先牺牲文案，**徽标与图标必须留着**。
		*/
		const entryRowStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			minWidth: 0,
			maxWidth: "100%",
			padding: "4px 6px",
			border: 0,
			borderRadius: 8,
			cursor: "pointer",
			textAlign: "left",
			fontFamily: TOK$1.font,
			color: TOK$1.labelPrimary,
			transition: "background-color .12s ease"
		};
		/** 入口文案：可以被挤掉（省略号），与身份行的插件名字同一个处理方式。 */
		const entryLabelStyle = {
			fontSize: 12.5,
			minWidth: 0,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		/** 版本徽标：恒定不收缩、不换行（挤的时候它是必须留着的那两样之一）。 */
		const entryBadgeStyle = {
			flex: "none",
			whiteSpace: "nowrap",
			fontFamily: TOK$1.mono,
			fontSize: 11.5,
			color: TOK$1.labelSecondary,
			background: TOK$1.bgLayer,
			borderRadius: 6,
			padding: "1px 6px"
		};
		/**
		* 设置面板顶部那一行入口 +（点开后）更新弹窗。自带状态：打开设置页时读一次 `status`（只读本机、不联网）。
		*
		* 行与弹窗放同一个组件里是刻意的：版本号来自同一次回包，拆成两处会各自持有一份可能不同步的状态。
		*/
		function UpdateEntry(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const lang = getLang();
			const t = (k) => tr(lang, STR[k]);
			/** 自动模式（#41）：全局宿主渲染的那一份 —— 只出弹窗，不出设置页那一行（见文件头）。 */
			const auto = !!(props && props.auto);
			/**
			* 本实例的弹窗归属名额（#41 收口 R2，见 upddialog.ts）。token 每个挂载一份，跨重挂载不复用：
			* `shell.overlay` 那一份与设置页那一份是两个实例，只有一只能在同一时刻处于可操作态。
			*/
			const portRef = react.useRef("");
			if (!portRef.current) portRef.current = newPortToken();
			const port = portRef.current;
			const resState = react.useState(null);
			const res = resState[0];
			const setRes = resState[1];
			/**
			* 上一份**成功**的回包。一次失败的 check / install 不该把已知版本整块抹成「版本未知」——
			* 失败时下面前提是「多一块失败说明」，不是「把已知的事忘掉」（L2 实测：成功过 `v0.1.7 / 0.1.7 /
			* 0.1.9 + 命令块`，再失败一次全被抹成 `版本未知 / 未知 / 未知 / 还没查过`，命令块消失）。
			*/
			const lastGood = react.useState(null);
			const lastGoodRes = lastGood[0];
			const setLastGood = lastGood[1];
			const openState = react.useState(false);
			const open = openState[0];
			const setOpen = openState[1];
			const busyState = react.useState("");
			const busy = busyState[0];
			const setBusy = busyState[1];
			const noteState = react.useState("");
			const note = noteState[0];
			const setNote = noteState[1];
			/** 同一时刻只允许一次通话：按钮会被 busy 关掉，但双击 / 回车连发仍可能撞上。 */
			const lock = react.useRef(false);
			/**
			* 用户点过「跳过此版本」的版本号（#41，只落 localStorage；见 updauto.ts）。
			* 初始值从存储里读一次，写成功后就地更新 —— 按钮随即消失，界面不必等下一次启动才对上。
			*/
			const skipState = react.useState(loadSkippedVersion);
			const skipped = skipState[0];
			const setSkipped = skipState[1];
			/**
			* 入口那一行的悬停态（#60）：内联样式没有 `:hover`，所以沿用既有 `Btn` 的写法（useState + 进入/离开）。
			* 可点线索一共三条：整行 `cursor: pointer`、整行底色变 `bgHover`、右侧 chevron。
			*/
			const rowHoverState = react.useState(false);
			const rowHover = rowHoverState[0];
			const setRowHover = rowHoverState[1];
			/**
			* 「详情」的展开状态（#60 追加交付 B 第 5 条）：当前 / 已装 / 最新三个版本号是**排查用的实现细节**，
			* 默认收起 —— 用户来这一页问的不是它们，而是「我是不是最新版」。
			*/
			const detailState = react.useState(false);
			const detailOpen = detailState[0];
			const setDetailOpen = detailState[1];
			/**
			* 一条电话。任何异常都收成回包形状（`ok:false` + 错误码），**绝不向上抛** ——
			* 一次网络抖动不该把设置页炸掉，界面只该多一块「宿主没回答」。
			*/
			const call = async (phone, args) => {
				try {
					return await createUpdateBridge()[phone](args);
				} catch (e) {
					return {
						ok: false,
						snapshot: null,
						manual: null,
						receipt: null,
						error: {
							code: "bridge-unreachable",
							message: e instanceof Error ? e.message : String(e)
						}
					};
				}
			};
			/** 跑一次通话并把回包落进状态。`label` 只影响按钮上的字。 */
			const run = async (phone, label, args = {}) => {
				if (lock.current) return null;
				lock.current = true;
				setBusy(label);
				setNote("");
				let out;
				try {
					out = await call(phone, args);
				} finally {
					lock.current = false;
					setBusy("");
				}
				setRes(out);
				if (out.ok) setLastGood(out);
				return out;
			};
			const snap = snapOf(res) ?? snapOf(lastGoodRes);
			const failed = res !== null && !res.ok;
			const failCode = failed ? asText(res && res.error && res.error.code) : "";
			const code = failCode;
			const bridgeDown = failed && BRIDGE_DOWN_CODES.indexOf(failCode) >= 0;
			const capDown = failed && !bridgeDown && CAP_DOWN_CODES.indexOf(failCode) >= 0;
			const failAction = failed && !bridgeDown ? t(UPDATE_FAIL_KEYS[failCode] || "updateFailUnknown") : "";
			const failTitle = bridgeDown ? "updateHostFailTitle" : capDown ? "updateCapDownTitle" : "updateFailAnsweredTitle";
			const failHint = bridgeDown || capDown ? "updateHostFailHint" : "updateFailAnsweredHint";
			const reason = asText(snap && snap.blockedReason);
			const running = asText(snap && snap.runningVersion);
			const installed = asText(snap && snap.installedVersion);
			const latest = asText(snap && snap.latestVersion);
			const canInstall = !!(snap && snap.canInstall === true);
			/**
			* 恶意形状的降级口（L5 边角）：版本字段不是字符串（数字 / 数组 / 对象）时 `asText` 会把它读成空串，
			* 界面只剩「未知」，安装按钮却照给。这里认一次「快照里确实给了版本字段但不是字符串」，把那个按钮收掉 ——
			* 类型不对时不给安装按钮，宁可让用户重查一次。真宿主 `readRunningVersion` 恒为字符串，这条只挡坏形状。
			*/
			const malformedVersions = !!snap && [
				snap.runningVersion,
				snap.installedVersion,
				snap.latestVersion
			].some((v) => v !== null && v !== void 0 && typeof v !== "string");
			const canInstallSafe = canInstall && !malformedVersions;
			const jobState = asText(snap && snap.job?.state);
			const jobMessage = asText(snap && snap.job?.message);
			const installing = jobState === "installing" || jobState === "verifying";
			/**
			* 安装任务的终态失败（L1 打出来的静默失败）：`job.state` 为 `failed`，`job.message` 是包写的精确码
			* （`install-failed` / `installation-changed` / `registry-conflict`，见包 `dist/service.js` 的
			* `runBackground` catch）。宿主**不会**把这种情况翻成 `blockedReason` —— 包只在「已装版本 != 正在跑的
			* 版本」时才翻 `recovery-required`，所以「安装失败、磁盘上的版本没变」这条路在面板上曾经一个字都没有：
			* 用户点安装 →「安装中…」→ 一切恢复正常、按钮还回来，没人告诉他失败。这里把它当成与 `blockedReason`
			* 同级的一条**失败原因**呈现，码取任务自己的 `message`。
			* `interrupted` 同理（同一个 heal 逻辑的另一半：半截任务）。
			*/
			const jobFailed = jobState === "failed" || jobState === "interrupted";
			const jobCode = jobFailed ? jobMessage || "install-failed" : "";
			const pendingRestart = reason === "pending-restart";
			const manual = res && res.ok ? asText(res.manual) : asText(lastGoodRes && lastGoodRes.manual);
			const versionLine = running ? "v" + running : t("updateVersionUnknown");
			/**
			* 结论判据（#60 追加交付 B 第 1 条）：这个弹窗只回答一个问题 ——「我是不是最新版？不是的话怎么装上？」
			* 所以先算出这次该说的是哪一句，后面每一块的取舍都挂在它上面：
			*   `newer`    最新版比正在跑的新 ⇒「有新版本 x（当前 y）」；
			*   `uptodate` 两边都读得出来、且最新版不比正在跑的新 ⇒「已是最新版本（x）」；
			*   `unknown`  其余（还没查过 / 版本读不出来 / 电话级失败）⇒「这次没查到」+ 一句下一步；
			*   `restart`  待重启：主角是上面那条横幅，结论行不出现（同一时刻只许有一个主角）。
			* 「有没有新版」不另立第二套口径：与自动弹窗共用 `decideAutoOpen`（它内部就是 `compareVersionsText`）。
			*/
			const hasNewer = decideAutoOpen({
				latest,
				running,
				skipped: ""
			}).open;
			const verdict = pendingRestart ? "restart" : hasNewer ? "newer" : latest && running ? "uptodate" : "unknown";
			react.useEffect(() => {
				if (auto) return void 0;
				run(updatePhoneNames.updateStatus, "status").catch(() => void 0);
			}, [auto]);
			/**
			* 打开设置页读一次状态不够：install 的回包只是「安装中…」（真装在宿主后台跑），
			* 没有轮询面板就**永远停在「安装中…」**，直到用户自己再点一次「检查更新」——同一件事也是
			* 「安装失败了没有任何触发点」的根因（包 README 第 3 节客户端三件事之一就是「按间隔轮询查状态」，
			* 示例正是 `setInterval(readStatus, UPD_POLL)`）。
			*
			* 三条纪律：
			* 1. 间隔取派生文件的 `UPD_POLL`（不写字面量；换前缀或升级包时重跑 derive 即可）；
			* 2. **只在弹窗打开期间**跑，关闭 / 卸载时 `clearInterval`（`open` 为假就一条不发：启动自动检查走
			*    下面的 auto 分支，不在这里）；
			* 3. 不重入：轮询只发**上一次还没回来**就不发下一次（`run` 里的 `lock` 挡掉，并且这里再判一次）。
			*    另外只在「安装任务还没到终态」时轮询：空闲面板不需要每秒问一次宿主。
			*/
			const lastRun = react.useRef(run);
			lastRun.current = run;
			react.useEffect(() => {
				if (!open) return void 0;
				if (!installing) return void 0;
				const timer = setInterval(() => {
					lastRun.current(updatePhoneNames.updateStatus, "status").catch(() => void 0);
				}, UPD_POLL);
				return () => clearInterval(timer);
			}, [open, installing]);
			/**
			* 启动自动检查（#41，只在 `auto` 模式跑）：延迟到点领闸，领到才发**一条** check；回包落地交给
			* **当前活着的挂载**处理（`applyAutoResult`），有新版本、且不是用户点过「跳过此版本」的那一个，
			* 才把同一只弹窗开出来。
			*
			* 五条纪律：
			* 1. **延迟常量只在 updauto.ts 定义一次**（这里引用，不写第二个数字）；
			* 2. 一个页面会话至多一次自动开窗：名额是 #41 收口 R1 的三态闸，只在**回包真的交到活着的挂载手里**之后
			*    才算花掉（`deliverAutoCheck` 看 handler 的返回值）—— 第一条 check 还在飞、或回包读不出来时
			*    重挂载，名额不会被白花掉（见 updauto.ts 的注释）；
			* 3. 判据是纯函数 `decideAutoOpen` —— 比不出大小就不弹；这一支的失败**不上面**（后台动作不该把设置页
			*    炸掉，也不该在界面上多一块用户没点过的失败），用户手动点「检查更新」仍有 #40 的全套说明；
			* 4. **开窗先领弹窗名额**（R2）：名额被占（多半是设置页那只已经打开）就不接手，`setOpen` 一次都不调 ——
			*    同一时刻只许一只可操作态的弹窗（见 upddialog.ts）；
			* 5. 卸载即清定时器：关掉弹窗 / 卸载宿主后不留任何常驻定时器（票面验收第 3 条）。
			*/
			/**
			* 回包交接的接收端（R1 的关键一条）：一条自动 check 的在飞时间（8 秒延迟 + 通话）足够宿主重挂载，
			* 发起那次挂载的闭包会随卸载作废 —— 所以回包不写进「发起者的状态」，而是回到**当前挂载**这里：
			* 落状态、判据、开窗都由还活着的那一份做。返回值 = 这次是不是可判读的回包（闸据此结算）。
			*
			* `res` 与手动路径落到同一个 `res` / `lastGoodRes`：版本行读的就是它 —— 只把快照拿来判据、
			* 不落状态，弹出来的窗上会是「版本未知」（红队 R1 场景实测）。
			*/
			const applyAutoResult = (resRaw) => {
				const out = resRaw && typeof resRaw === "object" ? resRaw : null;
				if (out) {
					setRes(out);
					if (out.ok) setLastGood(out);
					else setNote("");
				}
				const s = snapOf(out);
				if (decideAutoOpen({
					latest: asText(s && s.latestVersion),
					running: asText(s && s.runningVersion),
					skipped: loadSkippedVersion()
				}).open && takeAutoPort(port)) {
					setNote(t("updateAutoNote"));
					setOpen(true);
				}
				return !!s;
			};
			/**
			* 挂载时登记接收端（依赖是 `[auto]` 常量：登记一次不再重建，回包落到最新挂载的实例上）。
			* 只有 auto 那一份登记：设置页那份一挂上就会抢在自动检查前面占掉弹窗名额，但它绝不代为开窗。
			*/
			react.useEffect(() => {
				if (!auto) return void 0;
				return setAutoCheckHandler(applyAutoResult);
			}, [auto]);
			react.useEffect(() => {
				if (!auto) return void 0;
				const timer = setTimeout(() => {
					if (!claimAutoCheck()) return;
					run(updatePhoneNames.updateCheck, "check").then((out) => {
						deliverAutoCheck(out);
					}).catch(() => {
						deliverAutoCheck(null);
					});
				}, AUTO_CHECK_DELAY_MS);
				return () => clearTimeout(timer);
			}, [auto]);
			/**
			* 弹窗归属的订阅（R2）：名额被别人（用户那只）接管时，自动那一只自己关掉，不留一只**可被点安装的**
			* 背景弹窗；用户那只则什么都不做（它是被用户亲手开出来的，见 upddialog.ts 的口径 2）。
			* 依赖是 `[auto, port]` 两个常量，订阅一次不再重建：回调里读的是 `portRef.current` 的现值。
			*/
			react.useEffect(() => {
				const onPort = () => {
					if (portAutoShouldClose(port)) setOpen(false);
				};
				onPort();
				const off = subscribePort(onPort);
				return () => {
					off();
					releasePort(port);
				};
			}, [auto, port]);
			/**
			* 手里那张凭证还能不能用。包 README 第 11 节的表：凭证（`confirmationTtlMs`）默认 10 分钟，
			* 「用户查完新版隔很久才点安装，凭证过期要重查」；同一节还点名 `check-expired` 是**正常错误码**，
			* 指令是「面板此时重新调一次查新版、拿新凭证再提交即可」。
			* 主路径上 install 只接受 `check` 回的凭证，所以判 `expiresAt` 就够。
			*/
			const receiptFresh = (r) => {
				const receipt = r && r.receipt;
				if (!receipt || typeof receipt !== "object") return false;
				const exp = receipt.expiresAt;
				return typeof exp === "number" && Number.isFinite(exp) && exp > Date.now();
			};
			/**
			* 安装前先确保手里有凭证。裸调 install 必回 `check-expired`（包的功能守卫），
			* 所以这里不赌：没有 checkId（或那张凭证已经过期）就先补一次 check —— 用户点的是「安装」，
			* 跑两步是本面板的事，不该让用户自己去理解「先查再装」。
			*
			* `force` 给重试那一轮用（N3）：收到 `check-expired` 时，宿主眼里的凭证已经死了，而面板自己那份
			* `expiresAt` 可能还说它新鲜（两边时钟差、或另一端把唯一的 `checked` 槽抢走了）。这时 `held` 与这里
			* 读的 `res` 是**同一次渲染的闭包**，失败回包还没落地 ⇒ 不强制就只会把同一张死凭证原样再交一遍
			* （红队实测：`status,check,install[rid-1],install[rid-1]`，中间零 check ⇒ 重试是空转）。
			*
			* 返回值三态：凭证字符串 / `''`（这次真没拿到凭证）/ `null`（单飞锁挡着：上一次通话还在飞）。
			*/
			const ensureCheckId = async (force = false) => {
				const held = checkIdOf(res);
				if (!force && held && receiptFresh(res)) return held;
				const out = await run(updatePhoneNames.updateCheck, "check");
				if (!out) return null;
				if (!out.ok) return "";
				return checkIdOf(out);
			};
			/**
			* 点「安装新版本」。凭证在**提交那一刻已经过期**是实产路径（用户查完新版去干别的、回来再点安装），
			* 这不是程序缺陷也不是「宿主没接通」：重取一次凭证再提交一次，最多两轮（`check-expired` 后重试一次
			* 就地收敛，不给无限循环留口子）。第二轮**强制重查**（N3）：手里那张在宿主眼里已经死了，不重查就是
			* 拿同一张再撞一次。两轮都过期才把码摆到界面上让用户看见。
			* 同一个 `requestId` 贯穿两轮（包里对同 requestId 是幂等重放 ⇒ 不是「装两次」）。
			*/
			const onInstall = async () => {
				const requestId = "upd-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
				for (let attempt = 0; attempt < 2; attempt++) {
					const checkId = await ensureCheckId(attempt > 0);
					if (checkId === null) {
						setNote(t("updateBusyRetry"));
						return;
					}
					if (!checkId) {
						setNote(t("updateNoCredential"));
						return;
					}
					const out = await run(updatePhoneNames.updateInstall, "install", {
						checkId,
						requestId
					});
					if (!out || out.ok || asText(out.error && out.error.code) !== "check-expired") return;
				}
			};
			const onCopy = async () => {
				const ok = await copyText$1(manual);
				setNote(ok ? t("updateCopied") : t("updateCopyFail"));
			};
			/**
			* 关窗：**只关窗，不释放弹窗名额** —— 名额要一直占到实例卸载（`releasePort` 在那条 effect 的清理里）。
			* 这样自动那只才不会「用户刚关掉又弹回来」，而设置页这一份重开也不受影响（它本来就占着名额）。
			*/
			const close = () => {
				setOpen(false);
				setNote("");
			};
			/**
			* 设置页那一枚入口按钮（#60 追加交付 A，用户原话「检查更新和版本号和 star 的按钮在一起」）：
			* 它由 `settings.ts` 交给身份行渲染 —— 与 🌟 / 💬 同一行、同一父节点、顺序在两个图标之前。
			*
			* 所以这里**只出这一枚按钮**（外加弹窗，见函数尾）：没有卡片、没有 `borderBottom`、没有整行布局。
			* 三条可点线索与窄容器口径见 `entryRowStyle` 上面那段注释。
			* 行为一字不动（#40/#41 已验收）：点它仍是 askPort + setOpen，`data-dsh-prompt-update` 仍在**可点的
			* 那一个**元素上（回归脚本点它、并在 auto 模式数它为 0）。
			*/
			const row = h("button", {
				key: "update-row",
				type: "button",
				"data-dsh-prompt-update": "",
				onClick: () => {
					askPort(port);
					setOpen(true);
				},
				onMouseEnter: () => setRowHover(true),
				onMouseLeave: () => setRowHover(false),
				style: {
					...entryRowStyle,
					background: rowHover ? TOK$1.bgHover : "transparent"
				}
			}, [h("span", {
				key: "label",
				style: entryLabelStyle
			}, t("updateEntry")), h("span", {
				key: "ver",
				"data-dsh-prompt-update-version": "",
				style: entryBadgeStyle
			}, versionLine)]);
			const versionRow = (key, label, value) => h("div", {
				key,
				style: {
					display: "flex",
					alignItems: "baseline",
					justifyContent: "space-between",
					gap: 12
				}
			}, [h("span", {
				key: "l",
				style: {
					fontSize: 12,
					color: TOK$1.labelTertiary
				}
			}, label), h("span", {
				key: "v",
				"data-dsh-prompt-update-field": key,
				style: {
					fontFamily: TOK$1.mono,
					fontSize: 12.5,
					color: TOK$1.labelPrimary,
					wordBreak: "break-all"
				}
			}, value)]);
			const children = [h("div", {
				key: "head",
				style: {
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 12
				}
			}, [h("span", {
				key: "title",
				style: {
					fontSize: 14,
					fontWeight: 600,
					color: TOK$1.labelPrimary
				}
			}, t("updateEntry")), h("button", {
				key: "close",
				type: "button",
				"data-dsh-prompt-update-action": "close",
				"aria-label": t("updateClose"),
				onClick: close,
				style: {
					...btn(false),
					padding: "4px 10px"
				}
			}, "✕")])];
			if (pendingRestart) children.push(h("div", {
				key: "banner",
				"data-dsh-prompt-update-banner": "",
				style: {
					border: "1px solid " + TOK$1.accent,
					background: "rgba(240,164,92,.16)",
					borderRadius: 8,
					padding: "10px 12px",
					display: "flex",
					flexDirection: "column",
					gap: 4
				}
			}, [h("span", {
				key: "line",
				style: {
					fontSize: 13,
					fontWeight: 600,
					lineHeight: 1.6
				}
			}, fill(t("updatePendingBanner"), {
				new: installed || latest || t("updateNotAvailable"),
				old: running || t("updateNotAvailable")
			})), h("span", {
				key: "how",
				style: {
					fontSize: 12,
					color: TOK$1.labelSecondary,
					lineHeight: 1.6
				}
			}, t("updatePendingHint"))]));
			if (verdict !== "restart") {
				const line = verdict === "newer" ? fill(t("updateVerdictNewer"), {
					latest,
					running
				}) : verdict === "uptodate" ? fill(t("updateVerdictUpToDate"), { version: latest || running }) : t("updateVerdictUnknown");
				const parts = [h("span", {
					key: "v",
					"data-dsh-prompt-update-verdict": verdict,
					style: {
						fontSize: 13,
						fontWeight: 600,
						lineHeight: 1.6,
						color: TOK$1.labelPrimary
					}
				}, line)];
				if (verdict === "unknown" && !failed && !reason) parts.push(h("span", {
					key: "next",
					style: {
						fontSize: 12,
						lineHeight: 1.65,
						color: TOK$1.labelSecondary
					}
				}, t("updateVerdictUnknownHint")));
				children.push(h("div", {
					key: "verdict",
					"data-dsh-prompt-update-verdict-box": "",
					style: {
						...blockStyle,
						background: TOK$1.bgLayer
					}
				}, parts));
			}
			if (failed) {
				const why = UPDATE_REASON_KEYS[code];
				const parts = [
					h("span", {
						key: "t",
						style: {
							fontSize: 13,
							fontWeight: 600
						}
					}, t(failTitle)),
					h("span", {
						key: "code",
						"data-dsh-prompt-update-code": "",
						style: codeStyle
					}, code || "unknown"),
					h("span", {
						key: "hint",
						style: {
							fontSize: 12,
							color: TOK$1.labelSecondary,
							lineHeight: 1.6
						}
					}, t(failHint))
				];
				if (failAction) parts.push(h("span", {
					key: "action",
					"data-dsh-prompt-update-fail-action": "",
					style: {
						fontSize: 12.5,
						lineHeight: 1.65
					}
				}, failAction));
				if (code === "check-expired") parts.push(h("span", {
					key: "nofault",
					"data-dsh-prompt-update-fail-nofault": "",
					style: {
						fontSize: 11.5,
						lineHeight: 1.65,
						color: TOK$1.labelTertiary
					}
				}, t("updateFailNoFault")));
				if (why) parts.push(h("span", {
					key: "why",
					"data-dsh-prompt-update-why": "",
					style: {
						fontSize: 12.5,
						lineHeight: 1.65
					}
				}, t(why)));
				children.push(h("div", {
					key: "hostfail",
					"data-dsh-prompt-update-hostfail": "",
					style: {
						...blockStyle,
						borderColor: TOK$1.accent
					}
				}, parts));
			}
			if (installing) children.push(h("div", {
				key: "job",
				style: {
					fontSize: 12,
					color: TOK$1.labelSecondary
				}
			}, t("updateBtnInstalling")));
			if (jobFailed) children.push(h("div", {
				key: "job-failed",
				"data-dsh-prompt-update-job-failed": "",
				"data-dsh-prompt-update-job-state": jobState,
				style: {
					...blockStyle,
					borderColor: TOK$1.accent
				}
			}, [h("div", {
				key: "h",
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8
				}
			}, [h("span", {
				key: "t",
				style: {
					fontSize: 12.5,
					fontWeight: 600
				}
			}, t("updateJobFailTitle")), h("span", {
				key: "code",
				style: {
					fontFamily: TOK$1.mono,
					fontSize: 11.5,
					color: TOK$1.labelTertiary
				}
			}, jobCode)]), h("span", {
				key: "why",
				style: {
					fontSize: 12.5,
					lineHeight: 1.65,
					color: TOK$1.labelPrimary
				}
			}, UPDATE_FAIL_KEYS[jobCode] ? t(UPDATE_FAIL_KEYS[jobCode]) : t("updateJobFailHint"))]));
			if (reason) {
				const key = UPDATE_REASON_KEYS[reason];
				children.push(h("div", {
					key: "reason",
					"data-dsh-prompt-update-reason": "",
					style: {
						...blockStyle,
						borderColor: pendingRestart ? TOK$1.accent : TOK$1.border
					}
				}, [h("div", {
					key: "h",
					style: {
						display: "flex",
						alignItems: "center",
						gap: 8
					}
				}, [h("span", {
					key: "t",
					style: {
						fontSize: 12.5,
						fontWeight: 600
					}
				}, t("updateReasonTitle")), h("span", {
					key: "code",
					style: {
						fontFamily: TOK$1.mono,
						fontSize: 11.5,
						color: TOK$1.labelTertiary
					}
				}, reason)]), h("span", {
					key: "why",
					style: {
						fontSize: 12.5,
						lineHeight: 1.65,
						color: TOK$1.labelPrimary
					}
				}, key ? t(key) : t("updateReasonUnknown"))]));
			}
			/**
			* ⑤ 按钮行（#60 追加交付 B 第 2 条）：**同一时刻只有一个主（accent）按钮**，随结论变 ——
			*   结论是「有新版本」且宿主说能装时，主按钮是「安装新版本」，「检查更新」降为次级（随时能重查）；
			*   其余结论（已是最新 / 这次没查到 / 待重启）主按钮就是「检查更新」，**不给安装按钮**
			*   （没有已知的新版本时摆一个安装按钮，正是用户说的「主次颠倒」）。
			* 「跳过此版本」（#41 交付 3）是次级按钮，仍在最左：
			*   只在新版本确实比正在跑的新、且还没跳过**这一个**版本号时给？—— 是，判据与自动弹窗共用同一条
			*   （`hasNewer` 就是 `decideAutoOpen` 的结果），不另立第二套口径；点下去只写 localStorage
			*   （`storages/dsh_prompt.json` 的 schema 已冻结，不许动，见 map #38 定案）。
			*   已经跳过这一个版本时按钮不再给（没什么可跳的了）：跳过**只挡自动弹窗**，手动点「检查更新」
			*   照旧看得到这个版本与安装按钮（票面交付 3 的后半句）。
			*/
			const canSkip = hasNewer && skipped !== latest;
			const onSkip = () => {
				if (saveSkippedVersion(latest)) {
					setSkipped(latest);
					setNote(fill(t("updateSkipDone"), { version: latest }));
				} else setNote(t("updateSkipFail"));
			};
			const primaryIsInstall = verdict === "newer" && canInstallSafe && !pendingRestart;
			children.push(h("div", {
				key: "actions",
				style: {
					display: "flex",
					justifyContent: "flex-end",
					gap: 8
				}
			}, [
				canSkip ? h("button", {
					key: "skip",
					type: "button",
					"data-dsh-prompt-update-action": "skip",
					disabled: busy !== "",
					onClick: () => {
						onSkip();
					},
					style: btn(false)
				}, t("updateSkipVersion")) : null,
				h("button", {
					key: "check",
					type: "button",
					"data-dsh-prompt-update-action": "check",
					disabled: busy !== "",
					onClick: () => {
						run(updatePhoneNames.updateCheck, "check").catch(() => void 0);
					},
					style: btn(!primaryIsInstall)
				}, busy === "check" ? t("updateBtnChecking") : t("updateBtnCheck")),
				primaryIsInstall ? h("button", {
					key: "install",
					type: "button",
					"data-dsh-prompt-update-action": "install",
					disabled: busy !== "",
					onClick: () => {
						onInstall().catch(() => void 0);
					},
					style: btn(true)
				}, busy === "install" ? t("updateBtnInstalling") : t("updateBtnInstall")) : null
			]));
			/**
			* ⑥ 手工兜底命令（#60 追加交付 B 第 4 条）：**只在「自动安装不可用」或「这次失败」时才出现**，
			*    不再常驻 ——
			*      · 宿主说这台机器装不了：`blockedReason` 非空且 `canInstall` 为假（八条原因里的每一条都算，含待重启）；
			*      · 这次通话失败：电话级失败（`failed`）或安装任务的终态失败（`jobFailed`）。
			*    一切正常时（刚打开 / 已是最新 / 查到新版且可装）一个字都不出现。
			*
			*    命令值仍是宿主每次回包里的那个，现刷、不缓存；一次失败的 check 不该把手上那条还能用的命令
			*    整块藏掉（L2：成功过就有命令，失败后命令块消失），但必须标清它来自上一份回包。
			*/
			const manualNeeded = failed || jobFailed || !!reason && !canInstallSafe;
			if (manualNeeded && manual) children.push(h("div", {
				key: "manual",
				"data-dsh-prompt-update-manual": "",
				style: blockStyle
			}, [
				h("div", {
					key: "h",
					style: {
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 8
					}
				}, [h("span", {
					key: "t",
					style: {
						fontSize: 12.5,
						fontWeight: 600
					}
				}, t("updateManualTitle")), h("button", {
					key: "copy",
					type: "button",
					"data-dsh-prompt-update-action": "copy",
					onClick: () => {
						onCopy().catch(() => void 0);
					},
					style: {
						...btn(false),
						padding: "4px 10px"
					}
				}, t("updateBtnCopy"))]),
				h("code", {
					key: "cmd",
					"data-dsh-prompt-update-command": "",
					style: codeStyle
				}, manual),
				h("span", {
					key: "hint",
					style: {
						fontSize: 11.5,
						lineHeight: 1.65,
						color: TOK$1.labelTertiary
					}
				}, t("updateManualHint")),
				failed ? h("span", {
					key: "stale",
					"data-dsh-prompt-update-manual-stale": "",
					style: {
						fontSize: 11.5,
						lineHeight: 1.65,
						color: TOK$1.labelTertiary
					}
				}, t("updateManualStale")) : null
			].filter(Boolean)));
			else if (manualNeeded) children.push(h("div", {
				key: "manual-none",
				"data-dsh-prompt-update-manual-empty": "",
				style: {
					fontSize: 11.5,
					lineHeight: 1.65,
					color: TOK$1.labelTertiary
				}
			}, t("updateManualNone")));
			if (note) children.push(h("div", {
				key: "note",
				style: {
					fontSize: 11.5,
					color: TOK$1.labelTertiary
				}
			}, note));
			/**
			* ⑦ 详情（#60 追加交付 B 第 5 条）：当前 / 已装 / 最新三个版本号**默认收起**。
			*    它们是排查用的实现细节（报 Issue 时才要），不是用户的主问题；展开按钮是一枚纯文本切换，
			*    不带 `data-dsh-prompt-update-action`（它不是动作，别混进「这只窗有几个动作」的账里）。
			*    三个字段的挂点（`data-dsh-prompt-update-field`）顺序与名字一字不动，只是搬进了这一层。
			*/
			children.push(h("div", {
				key: "details",
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 6,
					borderTop: "1px solid " + TOK$1.border,
					marginTop: 2,
					paddingTop: 10
				}
			}, [h("button", {
				key: "toggle",
				type: "button",
				"data-dsh-prompt-update-details-toggle": "",
				onClick: () => {
					setDetailOpen(!detailOpen);
				},
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
					alignSelf: "flex-start",
					padding: 0,
					border: 0,
					background: "transparent",
					cursor: "pointer",
					fontFamily: TOK$1.font,
					fontSize: 12,
					color: TOK$1.labelTertiary
				}
			}, [t("updateDetails"), h("span", {
				key: "c",
				"aria-hidden": "true",
				style: {
					display: "inline-block",
					fontSize: 12,
					transform: detailOpen ? "rotate(90deg)" : "none"
				}
			}, "›")]), detailOpen ? h("div", {
				key: "fields",
				"data-dsh-prompt-update-details": "",
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 6
				}
			}, [
				versionRow("running", t("updateRowRunning"), running || t("updateNotAvailable")),
				versionRow("installed", t("updateRowInstalled"), installed || t("updateNotAvailable")),
				versionRow("latest", t("updateRowLatest"), latest || t("updateLatestNone"))
			]) : null]));
			const modal = !open ? null : h(ModalPortal, { key: "update-modal" }, h("div", {
				"data-dsh-prompt-update-modal": "",
				style: maskStyle,
				onClick: close
			}, h("div", {
				style: cardStyle,
				onClick: (e) => {
					if (e && typeof e.stopPropagation === "function") e.stopPropagation();
				}
			}, children)));
			if (auto) return modal;
			return h(react.Fragment, null, [row, modal]);
		}
		//#endregion
		//#region src/client/smartstore.ts
		let current$1 = { draft: "" };
		const listeners = /* @__PURE__ */ new Set();
		function setSmartInput(next) {
			if (next.draft === current$1.draft && next.sessionId === current$1.sessionId && next.actions === current$1.actions && next.useInput === current$1.useInput) return;
			current$1 = next;
			listeners.forEach((fn) => {
				try {
					fn();
				} catch (e) {}
			});
		}
		function getSmartInput() {
			return current$1;
		}
		function onSmartInput(fn) {
			listeners.add(fn);
			return () => {
				listeners.delete(fn);
			};
		}
		/**
		* 智能模式开关键。v2：用户 2026-09-10 裁定——智能卡暂按 BUG 处理（输入匹配不自动出卡，见 issue），
		* 开关**默认关**，且关时连悬浮小点都不出现。旧键 'dsh.prompt.smart' 曾为"历史默认开"的老用户保留
		* '1'（#23 兼容决定），本票撤销该兼容：只认 v2，老键一律不继承，保证所有人首次启动都是关。
		*/
		const SMART_KEY = "dsh.prompt.smart.v2";
		const POS_KEY = "dsh.prompt.smartPos";
		/** 开关：true 仅当用户显式置 '1'；缺键（首次/升键）与 '0' 都是关。关 → 组件不渲染（无小点、无卡片）。 */
		const enabledListeners = /* @__PURE__ */ new Set();
		function isSmartEnabled() {
			try {
				const s = globalThis.localStorage;
				if (!s) return false;
				const v = s.getItem(SMART_KEY);
				return v === null ? false : v !== "0";
			} catch (e) {
				return false;
			}
		}
		function setSmartEnabled(on) {
			try {
				globalThis.localStorage?.setItem(SMART_KEY, on ? "1" : "0");
			} catch (e) {}
			enabledListeners.forEach((fn) => {
				try {
					fn(on);
				} catch (e) {}
			});
		}
		function onSmartEnabled(fn) {
			enabledListeners.add(fn);
			return () => {
				enabledListeners.delete(fn);
			};
		}
		function loadSmartPos() {
			try {
				const s = globalThis.localStorage;
				if (!s) return null;
				const raw = s.getItem(POS_KEY);
				if (!raw) return null;
				const p = JSON.parse(raw);
				return typeof p.x === "number" && typeof p.y === "number" ? p : null;
			} catch (e) {
				return null;
			}
		}
		function saveSmartPos(p) {
			try {
				globalThis.localStorage?.setItem(POS_KEY, JSON.stringify(p));
			} catch (e) {}
		}
		/** 插入抑制：插入后 draft 变为新值 → 卡片不重现；用户改动草稿后自动解除 */
		let suppressDraft = null;
		function suppressCard(draft) {
			suppressDraft = draft;
		}
		function isSuppressed(draft) {
			return suppressDraft !== null && suppressDraft === draft;
		}
		function clearSuppression(draft) {
			if (suppressDraft !== null && suppressDraft !== draft) suppressDraft = null;
		}
		//#endregion
		//#region src/client/settings.ts
		/**
		* dsh-prompt — 设置页（模板管理 + 智能开关 + 日志三入口）
		*
		* 版式规则（#51 落地、#52 按"一致性优先"重修）：这一页寄居在 DSH 的设置对话框里，
		* 只继承宿主的设计语言（--dsw-* 变量），不发明第二套视觉。页面由两个原语搭出来，
		* 避免"每块各写各的 div"导致多条左边缘与散装间距：
		*   SettingRow   一行：标签 + 右侧控件，说明文字缩进到标签列
		*   SettingGroup 一组：有边框的卡片 + 组标题，组内间距统一（4/8/12/16/24 这个比例）
		* 不可逆操作（清空日志）不与常规操作平权：单独一行、默认低调、hover 才显示危险色，并两步确认。
		*/
		/** 取日志能力（装在槽里的那个实例）；能力缺席时返回 null，界面据此走「不可用」分支，不静默。 */
		function logCap() {
			try {
				const log = globalThis.__dshPromptLog;
				return log && typeof log.log === "function" ? log : null;
			} catch (e) {
				return null;
			}
		}
		const TOK = {
			labelPrimary: "var(--dsw-alias-label-primary)",
			labelSecondary: "var(--dsw-alias-label-secondary)",
			labelTertiary: "var(--dsw-alias-label-tertiary)",
			bgLayer: "var(--dsw-alias-bg-layer-3)",
			bgHover: "var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))",
			border: "var(--dsw-alias-border-l1)",
			accent: "var(--dsw-specific-accent,#f0a45c)",
			danger: "var(--dsw-specific-danger,#e06c75)",
			font: "var(--dsw-font-family)"
		};
		/** 一行：标签在左、控件在右，说明缩进到标签列（整页同一条左轨）。 */
		function SettingRow(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const kids = [h("div", {
				key: "head",
				style: {
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 12
				}
			}, [h("span", {
				key: "label",
				style: {
					fontFamily: TOK.font,
					fontSize: 13,
					color: TOK.labelPrimary
				}
			}, props.label), props.control ? h("span", {
				key: "control",
				style: {
					display: "inline-flex",
					alignItems: "center"
				}
			}, props.control) : null])];
			if (props.description) kids.push(h("div", {
				key: "desc",
				style: {
					fontFamily: TOK.font,
					fontSize: 12,
					lineHeight: 1.65,
					color: TOK.labelTertiary,
					maxWidth: 520
				}
			}, props.description));
			return h("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 6,
				padding: "10px 0"
			} }, kids);
		}
		/** 一组：卡片 + 组标题，组内元素由调用方给，间距由这里统一。 */
		function SettingGroup(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			return h("section", { style: {
				border: "1px solid " + TOK.border,
				borderRadius: 12,
				padding: "2px 14px 12px",
				margin: "14px 0 4px",
				display: "flex",
				flexDirection: "column",
				fontFamily: TOK.font
			} }, [props.title ? h("div", {
				key: "title",
				style: {
					fontSize: 12,
					fontWeight: 600,
					color: TOK.labelSecondary,
					padding: "12px 0 0",
					letterSpacing: .2
				}
			}, props.title) : null, ...props.children || []]);
		}
		/** 按钮：三种权重（常规 / 次级 / 危险）。内联样式没有 hover，用一个极小的悬停态实现。 */
		function Btn(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const tone = props.tone || "normal";
			const hoverState = react.useState(false);
			const hover = hoverState[0];
			const base = {
				fontFamily: TOK.font,
				fontSize: 12.5,
				padding: "6px 12px",
				borderRadius: 8,
				cursor: "pointer",
				transition: "background-color .12s ease, color .12s ease, border-color .12s ease"
			};
			return h("button", {
				type: "button",
				style: tone === "ghost" ? {
					...base,
					border: "1px solid transparent",
					background: hover ? TOK.bgLayer : "transparent",
					color: hover ? TOK.labelPrimary : TOK.labelSecondary
				} : tone === "danger" ? {
					...base,
					border: "1px solid " + (hover ? TOK.danger : TOK.border),
					background: "transparent",
					color: hover ? TOK.danger : TOK.labelSecondary
				} : {
					...base,
					border: "1px solid " + TOK.border,
					background: hover ? TOK.bgHover : TOK.bgLayer,
					color: TOK.labelPrimary
				},
				onMouseEnter: () => hoverState[1](true),
				onMouseLeave: () => hoverState[1](false),
				onClick: props.onClick
			}, props.children);
		}
		/** 复选框：宿主风格的圆角小方框（accent-color 跟随主题），不再是自己画一个控件。 */
		function Check(props) {
			const react = getReact();
			if (!react) return null;
			return react.createElement("input", {
				type: "checkbox",
				checked: props.checked,
				disabled: props.disabled,
				style: {
					width: 16,
					height: 16,
					accentColor: TOK.accent,
					cursor: props.disabled ? "not-allowed" : "pointer",
					margin: 0
				},
				onChange: props.onChange
			});
		}
		/** 下载文本为文件。返回是否成功（失败时调用方改走复制路径）。 */
		function downloadText(text, fileName) {
			try {
				if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") return false;
				if (typeof URL.createObjectURL !== "function") return false;
				const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = fileName;
				document.body.appendChild(a);
				a.click();
				a.remove();
				setTimeout(() => {
					try {
						URL.revokeObjectURL(url);
					} catch (e) {}
				}, 1e3);
				return true;
			} catch (e) {
				return false;
			}
		}
		/** 复制到剪贴板（异步 API 不可用时退回临时 textarea）。返回是否成功。 */
		async function copyText(text) {
			try {
				if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
					await navigator.clipboard.writeText(text);
					return true;
				}
			} catch (e) {}
			try {
				if (typeof document === "undefined") return false;
				const ta = document.createElement("textarea");
				ta.value = text;
				ta.style.position = "fixed";
				ta.style.opacity = "0";
				document.body.appendChild(ta);
				ta.select();
				const done = typeof document.execCommand === "function" ? document.execCommand("copy") : false;
				ta.remove();
				return !!done;
			} catch (e) {
				return false;
			}
		}
		function SettingsPage(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const smartState = react.useState(isSmartEnabled());
			const smartOn = smartState[0];
			const log = logCap();
			const logOnState = react.useState(log ? !!log.getSwitch().enabled : false);
			const logOn = logOnState[0];
			const noteState = react.useState("");
			const note = noteState[0];
			const confirmState = react.useState(false);
			const confirming = confirmState[0];
			const lang = getLang();
			const t = (k) => tr(lang, STR[k]);
			const reasonText = (code) => {
				return t(code === "host-unavailable" || code === "host-unreachable" ? "logReasonHost" : code === "host-rejected" ? "logReasonRejected" : code === "switch-timeout" ? "logReasonTimeout" : code === "stale" ? "logReasonStale" : "logReasonOther");
			};
			react.useEffect(() => {
				const cap = logCap();
				if (!cap || typeof cap.subscribe !== "function") return void 0;
				return cap.subscribe(() => {
					try {
						logOnState[1](!!cap.getSwitch().enabled);
					} catch (e) {}
				});
			}, []);
			const onToggleLog = async (next) => {
				const cap = logCap();
				if (!cap) {
					noteState[1](t("logUnavailable"));
					return;
				}
				const res = await cap.setSwitch(next);
				logEvent$1("settings.log.switch", {
					on: !!res.enabled,
					ok: !!res.ok,
					reason: res.error ?? ""
				});
				if (!res.ok) {
					noteState[1](t("logSwitchFail") + reasonText(res.error));
					try {
						logOnState[1](!!cap.getSwitch().enabled);
					} catch (e) {}
					return;
				}
				logOnState[1](!!res.enabled);
				noteState[1](res.enabled ? t("logSwitchOn") : t("logSwitchOff"));
			};
			const onExport = async () => {
				const cap = logCap();
				if (!cap) {
					noteState[1](t("logUnavailable"));
					return;
				}
				noteState[1](t("logWorking"));
				const res = await cap.exportLog();
				if (!res.ok) {
					noteState[1](t("logExportFail") + reasonText(res.reason));
					return;
				}
				const text = res.text ?? "";
				if (!text) {
					noteState[1](t("logExportEmpty"));
					return;
				}
				const name = res.fileName || "dsh-prompt.log";
				const saved = downloadText(text, name);
				const where = res.path || res.dir || "";
				noteState[1]((saved ? t("logExportSaved") : t("logExportDownloadBlocked")) + " " + name + "（" + (res.bytes ?? text.length) + " " + t("logBytes") + "）" + (where ? " · " + where : ""));
			};
			const onCopyPath = async () => {
				const cap = logCap();
				if (!cap) {
					noteState[1](t("logUnavailable"));
					return;
				}
				noteState[1](t("logWorking"));
				const res = await cap.exportLog();
				if (!res.ok) {
					noteState[1](t("logExportFail") + reasonText(res.reason));
					return;
				}
				let target = String(res.path || "").trim();
				if (!target && res.dir) {
					const sep = String(res.dir).indexOf("\\") >= 0 ? "\\" : "/";
					target = String(res.dir).replace(/[\\/]+$/, "") + sep + String(res.fileName || "");
				}
				if (!target) {
					noteState[1](t("logPathFail"));
					return;
				}
				const ok = await copyText(target);
				noteState[1](ok ? t("logPathCopied") + " " + target : t("logPathFail"));
			};
			const onClear = async () => {
				const cap = logCap();
				if (!cap) {
					noteState[1](t("logUnavailable"));
					return;
				}
				if (!confirming) {
					confirmState[1](true);
					noteState[1](t("logClearAsk"));
					return;
				}
				confirmState[1](false);
				const res = await cap.clearLog("all");
				noteState[1](res.ok ? t("logClearOk") + " " + res.removed + " " + t("logFiles") : t("logClearFail"));
			};
			const dropped = (() => {
				try {
					const st = log && typeof log.status === "function" ? log.status() : null;
					return st ? st.dropped : 0;
				} catch (e) {
					return 0;
				}
			})();
			const noteStyle = {
				fontFamily: TOK.font,
				fontSize: 12,
				lineHeight: 1.65,
				color: TOK.labelTertiary,
				paddingTop: 8
			};
			const logGroup = h(SettingGroup, {
				key: "log",
				title: t("logGroup")
			}, [
				h(SettingRow, {
					key: "log-switch",
					label: t("logToggle"),
					description: t("logToggleHint"),
					control: h(Check, {
						checked: logOn,
						disabled: !log,
						onChange: (e) => {
							onToggleLog(!!e.target.checked).catch(() => void 0);
						}
					})
				}),
				h("div", {
					key: "log-where",
					style: {
						fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
						fontSize: 11.5,
						color: TOK.labelTertiary,
						padding: "0 0 10px",
						wordBreak: "break-all",
						userSelect: "text"
					}
				}, t("logWhere")),
				h("div", {
					key: "log-actions",
					style: {
						display: "flex",
						gap: 8,
						paddingBottom: 2
					}
				}, [h(Btn, {
					key: "export",
					onClick: () => {
						onExport().catch(() => void 0);
					}
				}, t("logExport")), h(Btn, {
					key: "copy",
					tone: "ghost",
					onClick: () => {
						onCopyPath().catch(() => void 0);
					}
				}, t("logCopyPath"))]),
				h("div", {
					key: "log-danger",
					style: {
						display: "flex",
						alignItems: "center",
						gap: 10,
						marginTop: 10,
						paddingTop: 10,
						borderTop: "1px solid " + TOK.border
					}
				}, [h(Btn, {
					key: "clear",
					tone: "danger",
					onClick: () => {
						onClear().catch(() => void 0);
					}
				}, confirming ? t("logClearConfirm") : t("logClear")), dropped > 0 ? h("span", {
					key: "dropped",
					style: {
						fontFamily: TOK.font,
						fontSize: 11.5,
						color: TOK.labelTertiary
					}
				}, t("logDropped") + " " + dropped) : null])
			]);
			if (note) logGroup.props.children.push(h("div", {
				key: "log-note",
				style: noteStyle
			}, note));
			return h("div", { style: {
				padding: 4,
				display: "flex",
				flexDirection: "column"
			} }, [
				h(SettingsHeaderLinks, {
					key: "links",
					lang,
					entry: h(UpdateEntry, { key: "update" })
				}),
				h(SettingGroup, {
					key: "smart",
					title: t("smartGroup")
				}, [h(SettingRow, {
					key: "smart-row",
					label: t("smartToggle"),
					description: t("smartToggleHint"),
					control: h(Check, {
						checked: smartOn,
						onChange: (e) => {
							const on = e.target.checked;
							smartState[1](on);
							setSmartEnabled(on);
							logEvent$1("settings.smart.toggle", { on });
						}
					})
				})]),
				logGroup,
				h(TemplateBrowser, {
					key: "list",
					compact: false
				}),
				h("div", {
					key: "storage",
					style: noteStyle
				}, t("storageNote")),
				h(AuthorPlugins, {
					key: "more",
					lang
				})
			]);
		}
		/** 记一条日志事件。出口只有一个：日志能力装进 globalThis.__dshPromptLog 的那个实例。
		*  走槽而不是 import 的原因：本仓既有回归脚本会把客户端模块逐个转译后单独 require
		*  （scripts/.rt-tmp/*.cjs），而单文件 bundle 里也没有可用的模块内 require——槽是两边都能用的唯一机制。
		*  能力缺席时是空操作，绝不因为记日志失败而影响功能。 */
		function logEvent$1(event, fields) {
			try {
				const log = globalThis.__dshPromptLog;
				if (log && typeof log.log === "function") log.log(event, fields);
			} catch (e) {}
		}
		//#endregion
		//#region src/client/trigger.ts
		const SOURCE_NAME = "prompt";
		const MAX_ITEMS = 30;
		/**
		* /prompt 过滤：先剥离源名前缀（`/prompt` 本身 → 全量列出；`/prompt <词>` 与
		* `/prompt<词>`（无空格，宿主 slash 会话遇到空白即结束、带空格的 query 到不了这里）
		* → 按词过滤），剩余词匹配同一标签（含预置派生与自定义自选）或全文检索（haystack 兼容旧找法）。
		*/
		function filterPromptTemplates(query) {
			let q = (query || "").trim();
			const ql = q.toLowerCase();
			const src = SOURCE_NAME.toLowerCase();
			if (ql.startsWith(src)) q = q.slice(6).trim();
			if (!q) return sortedTemplates(allTemplates());
			const needle = q.toLowerCase();
			return sortedTemplates(allTemplates().filter((x) => matchLabel(x, q) || templateHaystack(x).indexOf(needle) >= 0));
		}
		/** /prompt 触发源（inputTriggers source 契约：candidates → onPick → {text} span 替换） */
		function buildPromptSource() {
			return {
				trigger: "/",
				name: SOURCE_NAME,
				order: 5,
				candidates: async (_projection, req) => {
					try {
						await ensureLoaded();
					} catch (e) {}
					return filterPromptTemplates(req.query).slice(0, MAX_ITEMS).map((t) => ({
						name: t.name,
						description: labelString(t) + " — " + (t.body || "").replace(/\s+/g, " ").slice(0, 42),
						templateId: t.id
					}));
				},
				onPick: (pick) => {
					const tpl = getTemplate(pick.candidate.templateId);
					if (!tpl) return void 0;
					bumpUsage(tpl.id);
					return { text: tpl.body };
				}
			};
		}
		//#endregion
		//#region src/client/words.ts
		const SMART_WORDS = {
			fp: {
				strong: [
					"第一性原理",
					"基本组成单元",
					"不可改变的真理",
					"颠覆",
					"去掉假设"
				],
				weak: [
					"分析",
					"本质",
					"假设",
					"拆解",
					"主题"
				]
			},
			socratic: {
				strong: [
					"苏格拉底",
					"追问",
					"质疑",
					"复述观点",
					"没想到的问题"
				],
				weak: [
					"思考",
					"问题",
					"假设",
					"观点"
				]
			},
			deep: {
				strong: [
					"深度分析",
					"多维",
					"常见误解",
					"边界",
					"证据"
				],
				weak: [
					"分析",
					"本质",
					"判断",
					"主题"
				]
			},
			adversarial: {
				strong: [
					"对抗式",
					"红队",
					"反例",
					"推翻",
					"失败场景",
					"认知偏差"
				],
				weak: [
					"审查",
					"方案",
					"结论",
					"假设"
				]
			},
			decision: {
				strong: [
					"决策",
					"选项",
					"纠结",
					"后悔",
					"最坏",
					"沉没成本",
					"没有回头路"
				],
				weak: [
					"选择",
					"权衡",
					"处境",
					"分析"
				]
			},
			premortem: {
				strong: [
					"事前验尸",
					"premortem",
					"失败原因",
					"回溯",
					"预防",
					"致命缺陷",
					"早期信号"
				],
				weak: [
					"方案",
					"项目",
					"风险",
					"失败"
				]
			},
			feynman: {
				strong: [
					"费曼",
					"类比",
					"反例",
					"禁止术语",
					"判断题"
				],
				weak: [
					"理解",
					"概念",
					"解释"
				]
			},
			fivewhys: {
				strong: [
					"五个为什么",
					"5why",
					"根本原因",
					"根因",
					"连续追问"
				],
				weak: [
					"为什么",
					"问题",
					"原因"
				]
			},
			mece: {
				strong: [
					"mece",
					"相互独立",
					"完全穷尽",
					"不重不漏",
					"分类维度"
				],
				weak: [
					"拆解",
					"分类",
					"问题"
				]
			},
			bias: {
				strong: [
					"认知偏差",
					"确认偏误",
					"锚定",
					"群体思维",
					"反事实",
					"可得性"
				],
				weak: [
					"偏差",
					"检查",
					"推理",
					"结论"
				]
			},
			learnpath: {
				strong: [
					"学习路线",
					"从零到实战",
					"伪学习",
					"最小闭环",
					"掌握程度"
				],
				weak: [
					"学习",
					"路线",
					"技能",
					"入门",
					"进阶"
				]
			},
			concept: {
				strong: [
					"概念澄清",
					"本质区别",
					"一句话定义",
					"对比场景",
					"不适用"
				],
				weak: [
					"概念",
					"理解",
					"定义"
				]
			},
			codereview: {
				strong: [
					"代码审查",
					"code review",
					"review",
					"pr",
					"正确性",
					"并发",
					"注入",
					"可维护性",
					"性能"
				],
				weak: ["安全", "技术栈"]
			},
			testdesign: {
				strong: [
					"测试用例",
					"正常路径",
					"边界值",
					"异常",
					"幂等",
					"并发"
				],
				weak: [
					"测试",
					"用例",
					"功能"
				]
			},
			refactor: {
				strong: [
					"重构",
					"refactor",
					"小步",
					"可测试性",
					"耦合"
				],
				weak: [
					"代码",
					"方案",
					"结构",
					"职责"
				]
			},
			explain: {
				strong: [
					"解释代码",
					"执行流程",
					"为什么这样写",
					"设计取舍",
					"扮演的角色"
				],
				weak: [
					"代码",
					"解释",
					"讲解"
				]
			},
			blindspot: {
				strong: [
					"盲区",
					"遗漏",
					"检查清单",
					"关键变量"
				],
				weak: [
					"计划",
					"开始",
					"任务",
					"启动",
					"风险"
				]
			},
			snapshot: {
				strong: [
					"零丢失",
					"快照",
					"出处",
					"逐条核对",
					"可疑遗漏"
				],
				weak: [
					"记录",
					"固化",
					"里程碑",
					"会话"
				]
			},
			kickoff: {
				strong: [
					"任务启动",
					"kickoff",
					"成功标准",
					"澄清",
					"经验水平"
				],
				weak: [
					"任务",
					"开始",
					"目标",
					"启动"
				]
			},
			prototype: {
				strong: [
					"原型",
					"试错",
					"候选方案",
					"快速验证"
				],
				weak: [
					"想法",
					"验证",
					"方案",
					"方向"
				]
			},
			plan: {
				strong: [
					"执行计划",
					"里程碑",
					"验收标准",
					"依赖"
				],
				weak: [
					"计划",
					"目标",
					"安排",
					"步骤"
				]
			},
			deviation: {
				strong: [
					"偏离",
					"记录偏离",
					"关键决定",
					"变更"
				],
				weak: [
					"记录",
					"过程",
					"复盘"
				]
			},
			retro: {
				strong: [
					"复盘",
					"retro",
					"重来一次",
					"可复用经验",
					"实际 vs 计划"
				],
				weak: [
					"回顾",
					"总结",
					"任务",
					"项目"
				]
			},
			quiz: {
				strong: [
					"反向考验",
					"出题",
					"选择题",
					"判断题",
					"盲区"
				],
				weak: [
					"考验",
					"检验",
					"主题",
					"理解"
				]
			}
		};
		/** 命中统计：专属词×2 + 通用词×1（子串匹配，忽略大小写） */
		function scoreDraft(draft, tpl) {
			const words = SMART_WORDS[tpl.id];
			if (!words) return {
				score: 0,
				strong: [],
				weak: []
			};
			const text = draft.toLowerCase();
			const strong = words.strong.filter((w) => text.includes(w.toLowerCase()));
			const weak = words.weak.filter((w) => text.includes(w.toLowerCase()));
			return {
				score: strong.length * 2 + weak.length,
				strong,
				weak
			};
		}
		/**
		* 自定义评分（#32）：自选标签命中按强词 +2，名称/正文命中按弱词 +1（子串匹配，忽略大小写）。
		* 空 / 仅回落“自定义” / 单字标签不参评（0 分，仅 lastUsed 槽可见）。
		* 名称/正文用自身文本匹配（不用 templateHaystack——haystack 含 labels，会重复计分）。
		*/
		function scoreCustomLabels(draft, tpl) {
			const text = draft.toLowerCase();
			const labels = templateLabels(tpl).map((l) => l.trim()).filter((l) => Array.from(l).length >= 2 && l !== "自定义");
			if (labels.length === 0) return {
				score: 0,
				strong: [],
				weak: []
			};
			const strong = labels.filter((l) => text.includes(l.toLowerCase()));
			const weak = [];
			const name = (tpl.name || "").trim();
			if (name && text.includes(name.toLowerCase())) weak.push(name);
			const body = (tpl.body || "").trim();
			if (body && text.includes(body.toLowerCase())) weak.push(body.slice(0, 12) + "…");
			return {
				score: strong.length * 2 + weak.length,
				strong,
				weak
			};
		}
		/** 代码块降权：draft 中 ``` 出现奇数次 → 视为处于代码块内 → 抑制出卡 */
		function insideCodeBlock(draft) {
			let n = 0;
			let i = 0;
			for (;;) {
				i = draft.indexOf("```", i);
				if (i < 0) break;
				n++;
				i += 3;
			}
			return n % 2 === 1;
		}
		/** 智能候选：draft → ≤3 条（top-2 评分 + 1 最近使用），不足不凑
		*  #22 决议：候选集不变（评分链、阈值、top-2 + 最近使用均不动），仅显示顺序改为统一 bottom-up——
		*  评分升序（最相关在底部）→ 用量升序 → 同键置顶更贴底 → 预制原始顺序/自定义创建时间；
		*  最近使用槽（score=0）不做特例，自然落到最顶部（Q4=A）。
		*  #32：自定义经自选标签进入评分（scoreCustomLabels），与预置同池竞争 top-2；
		*  空/回落/单字标签 0 分，仅 lastUsed 槽可见。
		*/
		function smartCandidates(draft) {
			const text = draft.trim().toLowerCase();
			if (!text || text.length < 2) return [];
			if (insideCodeBlock(draft)) return [];
			const usage = loadUsage();
			const scored = [];
			for (const tpl of allTemplates()) {
				const r = tpl.builtin ? scoreDraft(text, tpl) : scoreCustomLabels(text, tpl);
				if (r.score >= 2) scored.push({
					tpl,
					score: r.score,
					strongHits: r.strong,
					weakHits: r.weak
				});
			}
			scored.sort((a, b) => b.score - a.score || (usage[b.tpl.id] || 0) - (usage[a.tpl.id] || 0));
			const top = scored.slice(0, 2);
			const used = new Set(top.map((s) => s.tpl.id));
			const recentId = loadLastUsed();
			if (recentId && !used.has(recentId)) {
				const tpl = getTemplate(recentId);
				if (tpl) top.push({
					tpl,
					score: 0,
					strongHits: [],
					weakHits: []
				});
			}
			const pinned = loadPinned();
			const pinIdx = (id) => pinned.indexOf(id);
			top.sort((a, b) => {
				if (a.score !== b.score) return a.score - b.score;
				const ua = usage[a.tpl.id] || 0, ub = usage[b.tpl.id] || 0;
				if (ua !== ub) return ua - ub;
				const ap = pinIdx(a.tpl.id), bp = pinIdx(b.tpl.id);
				if (ap !== bp) return ap < 0 ? -1 : bp < 0 ? 1 : ap - bp;
				return tieBreakOrder(a.tpl, b.tpl);
			});
			return top;
		}
		/** DEC11 修订：插入后光标定位到第一个字段的冒号后（冒号表单式正文）；无字段 → 正文末尾 */
		function firstFieldCaret(body) {
			const i = body.indexOf("：");
			return i < 0 ? body.length : i + 1;
		}
		//#endregion
		//#region src/client/smart.ts
		/**
		* dsh-prompt — 智能模式悬浮卡（v1.1，shell.overlay root 作用域）
		* #5 定稿：全局单手柄点（点=缩小的卡，卡显示时点消失，互斥）/ 卡从点向右展开 /
		* 自由拖动 + 位置记忆（localStorage）+ 视口 clamp / 仅命中出现 / ≤3 候选（top-2 评分 + 最近使用，不足不凑）/
		* 评分=专属词×2+通用词×1（≥2 出卡）/ #22 bottom-up：评分升序（最相关在底部）→用量升序 / 序号按排名（1=最相关在底部）/ 点击即填入 + 光标定位首字段冒号后（DEC11 修订）/
		* 默认开可配置关闭 / 与面板各管各的；键盘可达（↑↓/Enter/Esc）。
		*/
		const DOT_SIZE = 12;
		const CARD_W = 280;
		const CARD_H_EST = 150;
		function clampPos(p, w, h) {
			const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
			const vh = typeof window !== "undefined" ? window.innerHeight : 800;
			return {
				x: Math.max(8, Math.min(p.x, vw - w - 8)),
				y: Math.max(8, Math.min(p.y, vh - h - 8))
			};
		}
		let bridgeNoticeShown = false;
		/**
		* 读取会话输入框草稿（DOM 真实值优先——与面板插入同源，见 panel.ts insertBody）：
		* - 焦点 textarea / 首个可见 textarea → { found: true, text: 真实值（可为空串） }
		* - 焦点落在面板新增/编辑弹窗内 → { found: true, text: '' }（明确不出卡）
		* - 找不到任何 textarea（焦点在非 textarea 元素、宿主换成富文本输入等）→ { found: false }
		*/
		function probeDraftFromDom() {
			try {
				if (typeof document === "undefined") return {
					found: false,
					text: ""
				};
				const ae = document.activeElement;
				if (ae && ae.tagName === "TEXTAREA") {
					try {
						if (ae.closest && ae.closest("[data-dsh-prompt-modal]")) return {
							found: true,
							text: ""
						};
					} catch (e) {}
					return {
						found: true,
						text: ae.value || ""
					};
				}
				const tas = document.querySelectorAll("textarea");
				for (let i = 0; i < tas.length; i++) {
					const ta = tas[i];
					if (ta.offsetParent !== null) {
						try {
							if (ta.closest && ta.closest("[data-dsh-prompt-modal]")) continue;
						} catch (e) {}
						return {
							found: true,
							text: ta.value || ""
						};
					}
				}
			} catch (e) {}
			return {
				found: false,
				text: ""
			};
		}
		function currentDraftInfo() {
			const p = probeDraftFromDom();
			if (p.found) return {
				text: p.text,
				source: "dom"
			};
			try {
				const d = getSmartInput().draft || "";
				if (d && !bridgeNoticeShown) {
					bridgeNoticeShown = true;
					const facts = domFacts();
					logEvent("smart.draft.fallback", {
						textareas: facts.textareas,
						activeKind: facts.active
					});
				}
				return {
					text: d,
					source: d ? "bridge" : "none"
				};
			} catch (e) {
				return {
					text: "",
					source: "none"
				};
			}
		}
		function currentDraft() {
			return currentDraftInfo().text;
		}
		function domFacts() {
			try {
				if (typeof document === "undefined") return {
					textareas: -1,
					active: "no-document",
					modal: false
				};
				return {
					textareas: document.querySelectorAll("textarea").length,
					active: document.activeElement && document.activeElement.tagName || "none",
					modal: !!(document.querySelector && document.querySelector("[data-dsh-prompt-modal]"))
				};
			} catch (e) {
				return {
					textareas: -1,
					active: "error",
					modal: false
				};
			}
		}
		let lastProbeKey = "";
		/** 现场快照只记一次（同值去重）：草稿长度变了才算新现场，避免每次轮询刷一行。 */
		function probeOnce(source, draftChars, candidates) {
			try {
				const facts = domFacts();
				const key = [
					source,
					facts.textareas,
					facts.active,
					facts.modal,
					candidates,
					draftChars
				].join("|");
				if (key === lastProbeKey) return;
				lastProbeKey = key;
				logEvent("smart.probe", {
					source,
					textareas: facts.textareas,
					activeKind: facts.active,
					modal: facts.modal,
					customs: allTemplates().filter((x) => !x.builtin).length,
					candidates,
					draftChars
				});
			} catch (e) {}
		}
		/** 光标位置：焦点 textarea（value===draft）的 selectionStart，找不到 → 末尾 */
		function caretInDraft(draft) {
			try {
				if (typeof document === "undefined") return draft.length;
				const tas = document.querySelectorAll("textarea");
				for (let i = 0; i < tas.length; i++) {
					const ta = tas[i];
					if (ta.value === draft && typeof ta.selectionStart === "number") return ta.selectionStart;
				}
			} catch (e) {}
			return draft.length;
		}
		/** 智能插入：光标处插入模板正文（不覆盖），光标定位到首字段冒号后；用量+1；抑制卡片重现
		*  草稿源与出卡判定同源（currentDraft）——卡片按哪份草稿出现，就按哪份草稿拼接，绝不覆盖用户已输入内容。 */
		function smartInsert(body, id) {
			const { actions } = getSmartInput();
			if (!actions || typeof actions.setDraft !== "function") return;
			const draft = currentDraft();
			const caret = caretInDraft(draft);
			const newDraft = draft.slice(0, caret) + body + draft.slice(caret);
			actions.setDraft(newDraft);
			const fieldCaret = caret + firstFieldCaret(body);
			setTimeout(() => {
				try {
					if (typeof document === "undefined") return;
					const tas = document.querySelectorAll("textarea");
					for (let i = 0; i < tas.length; i++) {
						const ta = tas[i];
						if (ta.value === newDraft) {
							ta.focus();
							ta.setSelectionRange(fieldCaret, fieldCaret);
							break;
						}
					}
				} catch (e) {}
			}, 0);
			bumpUsage(id);
			logEvent("pick.insert", {
				source: "smart",
				templateKind: allTemplates().find((x) => x.id === id)?.builtin ? "preset" : "custom",
				idHash: id,
				draftChars: draft.length
			});
			suppressCard(newDraft);
		}
		function SmartCardHost(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const [enabled, setEnabled] = react.useState(isSmartEnabled());
			const [input, setInput] = react.useState(getSmartInput());
			const [draft, setDraft] = react.useState(() => currentDraft());
			const [pos, setPos] = react.useState(null);
			const [dismissed, setDismissed] = react.useState(false);
			const [manualOpen, setManualOpen] = react.useState(false);
			const [cardH, setCardH] = react.useState(0);
			const posRef = react.useRef(null);
			const cardRef = react.useRef(null);
			const rowsRef = react.useRef([]);
			const dragMovedRef = react.useRef(false);
			react.useEffect(() => {
				const off1 = onSmartInput(() => setInput(getSmartInput()));
				const off2 = onSmartEnabled((on) => setEnabled(on));
				return () => {
					off1();
					off2();
				};
			}, []);
			react.useEffect(() => {
				const sync = () => {
					const d = currentDraft();
					setDraft((prev) => prev === d ? prev : d);
				};
				sync();
				const timer = setInterval(sync, 350);
				const off = onSmartInput(sync);
				const onFocus = () => sync();
				if (typeof document !== "undefined") document.addEventListener("focusin", onFocus, true);
				return () => {
					clearInterval(timer);
					off();
					if (typeof document !== "undefined") document.removeEventListener("focusin", onFocus, true);
				};
			}, []);
			react.useEffect(() => {
				typeof window !== "undefined" && window.innerWidth;
				const vh = typeof window !== "undefined" ? window.innerHeight : 800;
				const p = clampPos(loadSmartPos() || {
					x: 32,
					y: Math.round(vh * .72)
				}, DOT_SIZE, DOT_SIZE);
				posRef.current = p;
				setPos(p);
			}, []);
			const applyPos = (p) => {
				const c = clampPos(p, DOT_SIZE, DOT_SIZE);
				posRef.current = c;
				setPos(c);
			};
			react.useEffect(() => {
				clearSuppression(draft);
				if (dismissed) setDismissed(false);
				if (manualOpen) setManualOpen(false);
			}, [draft]);
			const lang = getLang();
			const t = (k) => tr(lang, STR[k]);
			const suppressed = isSuppressed(draft);
			const candidates = !enabled || suppressed ? [] : smartCandidates(draft);
			if (enabled) {
				const info = currentDraftInfo();
				probeOnce(info.source, info.text.length, candidates.length);
			}
			const fallbackUsage = loadUsage();
			const fallbackRows = [...allTemplates().slice(0, 3)].sort((a, b) => (fallbackUsage[a.id] || 0) - (fallbackUsage[b.id] || 0) || tieBreakOrder(a, b)).map((tpl) => ({
				tpl,
				score: 0,
				strongHits: [],
				weakHits: []
			}));
			const rows = candidates.length > 0 ? candidates : manualOpen ? fallbackRows : [];
			rowsRef.current = rows;
			const showCard = rows.length > 0 && !dismissed;
			react.useEffect(() => {
				if (showCard) {
					logEvent("smart.card.show", {
						rows: rows.length,
						source: currentDraftInfo().source,
						draftChars: draft.length,
						manual: manualOpen
					});
					return;
				}
				logEvent("smart.card.miss", {
					reason: suppressed ? "suppressed" : dismissed ? "dismissed" : !draft ? "empty-draft" : "no-match",
					draftChars: draft.length
				});
			}, [
				showCard,
				rows.length,
				draft,
				dismissed,
				manualOpen,
				suppressed
			]);
			react.useEffect(() => {
				if (!showCard) return;
				const el = cardRef.current;
				if (!el) return;
				const h = el.offsetHeight || 0;
				if (h > 0 && h !== cardH) setCardH(h);
			}, [showCard, rows.length]);
			const doPick = (c) => {
				smartInsert(c.tpl.body, c.tpl.id);
				setDismissed(true);
				setManualOpen(false);
			};
			const startDrag = (e) => {
				e.preventDefault();
				e.stopPropagation();
				dragMovedRef.current = false;
				const base = posRef.current || {
					x: 0,
					y: 0
				};
				const sx = e.clientX, sy = e.clientY;
				const move = (ev) => {
					dragMovedRef.current = true;
					applyPos({
						x: base.x + (ev.clientX - sx),
						y: base.y + (ev.clientY - sy)
					});
				};
				const up = (ev) => {
					document.removeEventListener("pointermove", move);
					document.removeEventListener("pointerup", up);
					const p = clampPos({
						x: base.x + (ev.clientX - sx),
						y: base.y + (ev.clientY - sy)
					}, DOT_SIZE, DOT_SIZE);
					posRef.current = p;
					setPos(p);
					saveSmartPos(p);
				};
				document.addEventListener("pointermove", move);
				document.addEventListener("pointerup", up);
			};
			const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
			const vh = typeof window !== "undefined" ? window.innerHeight : 800;
			const effectivePos = pos !== null ? pos : {
				x: 32,
				y: Math.round(vh * .72)
			};
			if (!enabled) return null;
			const base = "var(--dsw-alias-label-primary)";
			const muted = "var(--dsw-alias-label-secondary)";
			const dim = "var(--dsw-alias-label-tertiary)";
			const line = "1px solid var(--dsw-alias-border-l1)";
			const dot = h("div", {
				key: "dot",
				style: {
					position: "fixed",
					left: effectivePos.x,
					top: effectivePos.y,
					width: DOT_SIZE,
					height: DOT_SIZE,
					borderRadius: "50%",
					background: "var(--dsw-alias-label-tertiary)",
					opacity: .45,
					boxShadow: "var(--dsw-shadow-lv1)",
					cursor: "grab",
					zIndex: 400,
					pointerEvents: "auto",
					userSelect: "none"
				},
				title: t("smartDot"),
				onPointerDown: startDrag,
				onClick: () => {
					if (dragMovedRef.current) return;
					setManualOpen(true);
					setDismissed(false);
				}
			});
			const dotX = effectivePos.x, dotY = effectivePos.y;
			const cardHeight = cardH > 0 ? cardH : CARD_H_EST;
			const dotCx = dotX + DOT_SIZE / 2, dotCy = dotY + DOT_SIZE / 2;
			let cardX = dotCx;
			if (cardX + CARD_W > vw - 8) cardX = Math.max(8, dotCx - CARD_W);
			cardX = Math.max(8, Math.min(cardX, vw - CARD_W - 8));
			let cardY = dotCy - cardHeight;
			if (cardY < 8) cardY = 8;
			cardY = Math.max(8, Math.min(cardY, vh - cardHeight - 8));
			const cardPos = {
				x: cardX,
				y: cardY
			};
			const cardStyle = {
				position: "fixed",
				left: cardPos.x,
				top: cardPos.y,
				width: CARD_W,
				zIndex: 400,
				pointerEvents: "auto",
				background: "var(--dsw-specific-menu)",
				border: "1px solid var(--dsw-alias-border-inverted)",
				borderRadius: 12,
				boxShadow: "var(--dsw-shadow-lv3)",
				display: "flex",
				flexDirection: "column",
				gap: 6,
				padding: "8px 10px",
				fontFamily: "var(--dsw-font-family)",
				fontSize: "var(--dsw-font-markdown-base-font-size)",
				color: base
			};
			const headStyle = {
				display: "flex",
				alignItems: "center",
				gap: 4,
				padding: "4px 10px",
				borderBottom: line,
				cursor: "grab",
				minWidth: 0
			};
			const rowStyle = {
				display: "flex",
				alignItems: "center",
				gap: 6,
				padding: "3px 7px",
				minWidth: 0,
				background: "var(--dsw-alias-bg-layer-2)",
				border: "1px solid var(--dsw-alias-border-l1)",
				borderRadius: 8,
				cursor: "pointer",
				overflow: "hidden"
			};
			const rowNum = {
				color: dim,
				fontSize: "0.77em",
				flex: "none"
			};
			const rowName = {
				fontWeight: 500,
				fontSize: "0.88em",
				flex: "none",
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis",
				maxWidth: 90
			};
			const rowTag = {
				color: muted,
				flex: "none",
				fontSize: "0.77em"
			};
			const rowHint = {
				color: dim,
				flex: "1 1 auto",
				minWidth: 0,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
				fontSize: "0.77em"
			};
			const fillBtn = {
				flex: "none",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-3)",
				color: base,
				borderRadius: 5,
				padding: "1px 7px",
				cursor: "pointer",
				fontFamily: "var(--dsw-font-family)",
				fontSize: "0.8em",
				fontWeight: 500,
				whiteSpace: "nowrap"
			};
			const rowNodes = rows.map((c, i) => {
				const common = c.score === 0;
				const tagText = labelString(c.tpl) + " " + (common ? "·常用" : "·分" + c.score);
				const hits = common ? t("smartCommon") : c.strongHits.join(" / ") + (c.weakHits.length ? " · " + c.weakHits.join(" / ") : "");
				return h("div", {
					key: c.tpl.id,
					style: rowStyle,
					onClick: () => doPick(c),
					title: t("smartFill")
				}, [
					h("span", { style: rowNum }, String(rows.length - i)),
					h("span", { style: rowName }, c.tpl.name),
					h("span", { style: rowTag }, tagText),
					h("span", { style: rowHint }, hits),
					h("button", {
						style: fillBtn,
						title: t("smartFill"),
						onClick: (e) => {
							e.stopPropagation();
							doPick(c);
						}
					}, t("smartFill"))
				]);
			});
			const diagInfo = manualOpen ? currentDraftInfo() : null;
			const diagSrcLabel = diagInfo ? diagInfo.source === "dom" ? "输入框DOM" : diagInfo.source === "bridge" ? "输入桥" : "读不到" : "";
			const customCount = allTemplates().filter((x) => !x.builtin).length;
			const diagRow = diagInfo ? h("div", { style: {
				borderTop: line,
				paddingTop: 4,
				color: dim,
				fontSize: "0.72em",
				lineHeight: 1.35,
				wordBreak: "break-all"
			} }, "诊断(临时) 草稿=" + JSON.stringify(diagInfo.text).slice(0, 60) + " 来源=" + diagSrcLabel + " 自定义=" + customCount + "条 候选=" + candidates.length) : null;
			const card = h("div", {
				key: "card",
				ref: cardRef,
				style: cardStyle
			}, [
				h("div", {
					style: headStyle,
					onPointerDown: startDrag
				}, [
					h("span", { style: {
						fontWeight: 600,
						fontSize: "0.85em"
					} }, t("smartTitle")),
					h("span", { style: {
						color: dim,
						fontSize: "0.77em"
					} }, t("smartHint")),
					h("div", { style: { flex: 1 } }),
					h("button", {
						style: {
							border: 0,
							background: "transparent",
							color: dim,
							cursor: "pointer",
							fontSize: "0.92em",
							lineHeight: 1,
							padding: "0 2px",
							flex: "none"
						},
						title: t("smartDismiss"),
						onPointerDown: (e) => e.stopPropagation(),
						onClick: (e) => {
							e.stopPropagation();
							setDismissed(true);
							setManualOpen(false);
						}
					}, "×")
				]),
				h("div", { style: {
					maxHeight: 220,
					overflowY: "auto",
					overflowX: "hidden"
				} }, rowNodes),
				diagRow
			]);
			return showCard ? card : dot;
		}
		/** 记一条日志事件。出口只有一个：日志能力装进 globalThis.__dshPromptLog 的那个实例。
		*  走槽而不是 import 的原因：本仓既有回归脚本会把客户端模块逐个转译后单独 require
		*  （scripts/.rt-tmp/*.cjs），而单文件 bundle 里也没有可用的模块内 require——槽是两边都能用的唯一机制。
		*  能力缺席时是空操作，绝不因为记日志失败而影响功能。 */
		function logEvent(event, fields) {
			try {
				const log = globalThis.__dshPromptLog;
				if (log && typeof log.log === "function") log.log(event, fields);
			} catch (e) {}
		}
		//#endregion
		//#region event-list.dsh-prompt.json
		var event_list_dsh_prompt_default = {
			version: 1,
			pluginId: "dsh-prompt",
			counts: {
				"resident": 26,
				"ondemand": 9,
				"selfmon": 5
			},
			valueDomain: {
				"enumPattern": "^[A-Za-z0-9._:\\/-]{0,32}$",
				"enumMaxLength": 32,
				"note": "ENUM 事件字符串值域基线（闸门权威，lib/log/gate.js 执行）。不把取值列全：host.call 等字段值来自更新包自身代码，列全会腐烂且必然误拦真实取值，故只约束标识符形状。桥侧语义白名单（src/update/host/safe-values.ts、lib/index.js）更严，不在表里的值先换成 8 位指纹；指纹仍符合本形状，故两层不漂移。长度 32 与闸门 MAX_FIELD_CHARS 对齐；桥侧旧形状 64 仅为发射点兜底历史值，权威以此 32 为准。形状挡不住纯 ASCII 标识符形状的用户数据（如 my-template-v3），该形状的完全保证只在桥侧四事件的语义表里，其余 ENUM 事件靠固定字面量发射点与调用点扫描兜住（见 test:log 第 11 节）。"
			},
			events: {
				"app.boot": {
					"level": "info",
					"kind": "resident",
					"fields": [
						"hasReact",
						"lang",
						"entryCount"
					],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"store.snapshot.ok": {
					"level": "info",
					"kind": "resident",
					"fields": [
						"customs",
						"pinned",
						"latencyMs"
					],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"store.snapshot.fail": {
					"level": "warn",
					"kind": "resident",
					"fields": ["reason", "latencyMs"],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"store.persist.fail": {
					"level": "warn",
					"kind": "resident",
					"fields": ["route", "errorHash"],
					"codes": ["ENUM", "H_ERR"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"pick.insert": {
					"level": "info",
					"kind": "resident",
					"fields": [
						"source",
						"templateKind",
						"idHash",
						"draftChars"
					],
					"codes": ["ENUM", "H_ID"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"panel.position.fail": {
					"level": "warn",
					"kind": "resident",
					"fields": ["attempts"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"smart.draft.fallback": {
					"level": "info",
					"kind": "resident",
					"fields": ["textareas", "activeKind"],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"settings.smart.toggle": {
					"level": "info",
					"kind": "resident",
					"fields": ["on"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"settings.log.switch": {
					"level": "info",
					"kind": "resident",
					"fields": [
						"on",
						"ok",
						"reason"
					],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"settings.log.export": {
					"level": "info",
					"kind": "resident",
					"fields": [
						"ok",
						"bytes",
						"fallback"
					],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"settings.log.export.fail": {
					"level": "warn",
					"kind": "resident",
					"fields": ["reason", "errorHash"],
					"codes": ["ENUM", "H_ERR"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"settings.log.clear": {
					"level": "info",
					"kind": "resident",
					"fields": ["ok", "removed"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"settings.log.reconcile": {
					"level": "info",
					"kind": "resident",
					"fields": ["ok", "on"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"bridge.call.fail": {
					"level": "warn",
					"kind": "resident",
					"fields": ["phone", "kind"],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.route.fail": {
					"level": "warn",
					"kind": "resident",
					"fields": [
						"route",
						"method",
						"status",
						"errorHash"
					],
					"codes": ["ENUM", "H_ERR"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.store.degraded": {
					"level": "error",
					"kind": "resident",
					"fields": ["reason", "errorHash"],
					"codes": ["ENUM", "H_ERR"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.bridge.reject": {
					"level": "warn",
					"kind": "resident",
					"fields": ["reason"],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.log.export": {
					"level": "info",
					"kind": "resident",
					"fields": [
						"ok",
						"bytes",
						"fallback",
						"date"
					],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.log.clear": {
					"level": "info",
					"kind": "resident",
					"fields": [
						"ok",
						"removed",
						"scope"
					],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.log.switch.set": {
					"level": "info",
					"kind": "resident",
					"fields": ["enabled"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.log.manifest.fail": {
					"level": "warn",
					"kind": "resident",
					"fields": ["reason", "errorHash"],
					"codes": ["ENUM", "H_ERR"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.start": {
					"level": "info",
					"kind": "resident",
					"fields": [
						"pid",
						"startedAt",
						"dir"
					],
					"guard": "日志包内部启动头（包语义冻结）；dir 为包内原文目录，不参与本仓字段白名单过滤",
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"panel.open": {
					"level": "info",
					"kind": "ondemand",
					"fields": ["mode", "rows"],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"panel.host.mount": {
					"level": "debug",
					"kind": "ondemand",
					"fields": [
						"propCount",
						"hasUseInput",
						"hasInputActions"
					],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"pick.probe": {
					"level": "debug",
					"kind": "ondemand",
					"fields": [
						"textareas",
						"activeKind",
						"editables",
						"storeChars",
						"actMask",
						"hasSub"
					],
					"codes": ["ENUM"],
					"guard": "#61 真机仍覆盖的诊断探针：点击瞬间只记 DOM 计数与桥形状，不记任何正文。textareas=0 且 editables>0 → 宿主输入框不是 textarea；storeChars=0 而用户框里有字 → 桥在点击时滞后；actMask=写 API 位图（位0=setDraft，1=insert，2=insertText，3=appendText，4=setValue，5=setText，6=focus，7=clear）",
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"smart.card.show": {
					"level": "info",
					"kind": "ondemand",
					"fields": [
						"rows",
						"source",
						"draftChars",
						"manual"
					],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"smart.card.miss": {
					"level": "debug",
					"kind": "ondemand",
					"fields": ["reason", "draftChars"],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"smart.probe": {
					"level": "debug",
					"kind": "ondemand",
					"fields": [
						"source",
						"textareas",
						"activeKind",
						"modal",
						"customs",
						"candidates",
						"draftChars"
					],
					"codes": ["ENUM"],
					"guard": "同值只记一次（客户端按载荷去重）",
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"settings.log.broadcast": {
					"level": "debug",
					"kind": "ondemand",
					"fields": ["on"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.log.batch": {
					"level": "info",
					"kind": "ondemand",
					"fields": [
						"entries",
						"accepted",
						"dropped"
					],
					"guard": "每 20 批记一次（宿主侧计数器节流）",
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.log.switch.get": {
					"level": "debug",
					"kind": "ondemand",
					"fields": ["enabled"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.call": {
					"level": "info",
					"kind": "resident",
					"fields": [
						"method",
						"latencyMs",
						"ok",
						"kind",
						"pluginId"
					],
					"guard": "更新包的成功轨迹（dist/host.js:203 的三参 emit，本仓宿主半按真实签名转交）。不声明就等于整条被闸门丢掉 —— 装更新成功那次调用会查不到",
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.call.fail": {
					"level": "warn",
					"kind": "selfmon",
					"fields": [
						"method",
						"kind",
						"errorHash",
						"pluginId"
					],
					"guard": "电话调用失败：日志包内部自监控（包语义冻结）与更新包 dist/host.js:207 共用同一形状；pluginId 由更新包与本仓宿主半填，日志包不填。**本仓的桥按 (method, kind) 只在状态首次出现时落一条**（该电话成功一次即清账，恢复后再失败重新落）—— 否则电话持续失败时是每请求一行 warn、绕过日志开关、用户关不掉（#39 复审 D 实测 62 次请求里 host.call.fail 62 行；三轮整改 H2），首条一定落。字段值另过一层值域安全网：不匹配安全字符集（标识符向字符以外，例如正文里的 CJK / 空格 / 标点）就落 8 位指纹，不落原文（#39 三轮整改 H1）",
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"update.install.exec": {
					"level": "warn",
					"kind": "resident",
					"fields": [
						"route",
						"ok",
						"exitCode",
						"durationMs",
						"pluginId"
					],
					"guard": "更新包执行安装那条事件（dist/store.js:273 的三参 log），route 判 cli-process / desktop-service。**route:\"none\" 不是一条真路由**：它表示「没有安装配方」（包 dist/store.js:333 的 catch 用 error?.exitCode ?? exitCode，配方为空时是 undefined），这条路径**根本没有 exitCode 键**（闸门只跳过 undefined、不补 0），所以按 route / exitCode 排障时别把 none 读成一次真实执行（#39 复审 D 的 A3）。级别是 warn 而不是 info：日志开关默认关，info 级在默认配置下不落盘，于是「装更新失败退了几 / 走的 cli 还是 desktop 路由」在默认配置下查不到（#39 复审 V2 实测：开关 off 时本事件落盘 0 行）。安装是低频事件，成功也值得留痕，故按 warn 走恒写通道",
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"update.route.fail": {
					"level": "warn",
					"kind": "resident",
					"fields": [
						"route",
						"reason",
						"errorHash"
					],
					"guard": "更新路由这一层的失败：reason 只记机器码（check-expired / phone-failed / install-failed 之类电话真失败的码，以及建能力时的 dep-load-fail / capability-degraded / capability-build-fail、事件名漂移的 unknown-event），错误原文只以 8 位指纹落盘。**能力缺席 / 降级这类状态型失败按状态落一次**（建能力时那一条），请求级不再落 —— 否则 warn 绕过日志开关，面板按 UPD_POLL=1000 轮询时会刷成 15 MiB/天（#39 复审 V1）。**电话真失败这一支同样按状态落一次**：请求级按 (route, reason) 去重、同一条路由成功一次即清账（恢复后再失败重新落），建能力时的三条也各落一次 —— 否则断网 / check-expired 持续时是每请求一行 warn、用户关不掉（#39 复审 D 实测 62 次请求 124 行 / 20402 B ⇒ 54.2 MiB/天）；首条一定要落，故障不许因去重而看不见（#39 三轮整改 H2）",
					"codes": ["ENUM", "H_ERR"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"log.persist.fail": {
					"level": "warn",
					"kind": "selfmon",
					"fields": [
						"op",
						"reason",
						"dirHash"
					],
					"guard": "日志包内部自监控（包语义冻结）",
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"log.export.fail": {
					"level": "warn",
					"kind": "selfmon",
					"fields": [
						"op",
						"reason",
						"errorHash"
					],
					"guard": "日志包内部自监控（包语义冻结）",
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"log.forward.summary": {
					"level": "warn",
					"kind": "selfmon",
					"fields": [
						"droppedDelta",
						"totalDropped",
						"reason",
						"windowMs"
					],
					"guard": "日志包内部自监控（包语义冻结）",
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"log.switch.watchdog": {
					"level": "warn",
					"kind": "selfmon",
					"fields": [
						"op",
						"timeoutMs",
						"stage"
					],
					"guard": "日志包内部自监控（包语义冻结）",
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"host.batch.refuse": {
					"level": "warn",
					"kind": "resident",
					"fields": ["entries", "refused"],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				}
			}
		};
		//#endregion
		//#region node_modules/dsh-log/dist/config.js
		const CLIENT_BATCH_INTERVAL_MS = 1e3;
		const CLIENT_PACKET_BYTES = 131072;
		const PHONE_ACTIONS = [
			"logBatch",
			"logExport",
			"logClear",
			"logGetSwitch",
			"logSetSwitch"
		];
		const ID_PATTERN = /^[a-z0-9-]{1,32}$/;
		function assertPluginId(value, role) {
			if (typeof value !== "string" || !ID_PATTERN.test(value)) throw new Error("[dsh-log] " + role + " 非法：只能用小写英文字母、数字、中横线，长度 1 到 32（收到 " + JSON.stringify(value) + "）");
			return value;
		}
		function buildPhoneNames(prefix) {
			const checked = assertPluginId(prefix, "电话名前缀 prefix");
			const names = {};
			for (const action of PHONE_ACTIONS) names[action] = checked + "." + action;
			return names;
		}
		const EVENT_LEVELS = [
			"error",
			"warn",
			"info",
			"debug"
		];
		const EVENT_KINDS = [
			"resident",
			"ondemand",
			"selfmon"
		];
		function isNonEmptyString(value) {
			return typeof value === "string" && value.length > 0;
		}
		function assertStringArray(value, what) {
			if (!Array.isArray(value)) throw new Error("[dsh-log] 事件清单 eventList 非法：" + what + " 必须是字符串数组");
			const seen = [];
			for (const item of value) {
				if (!isNonEmptyString(item)) throw new Error("[dsh-log] 事件清单 eventList 非法：" + what + " 里有空字段名");
				if (seen.indexOf(item) >= 0) throw new Error("[dsh-log] 事件清单 eventList 非法：" + what + " 里字段名重复：" + item);
				seen.push(item);
			}
			return seen;
		}
		function parseEventListManifest(value) {
			if (typeof value === "string") throw new Error("[dsh-log] 事件清单 eventList 非法：路径形式请调用方自己读成对象再传入，日志包不读盘");
			if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("[dsh-log] 事件清单 eventList 非法：只收对象形式（空模板见包内的 event-list.template.json）");
			const input = value;
			if (input["version"] !== 1) throw new Error("[dsh-log] 事件清单 eventList 非法：version 现在只认 1（收到 " + JSON.stringify(input["version"]) + "）");
			const pluginId = assertPluginId(input["pluginId"], "事件清单 pluginId");
			const countsRaw = input["counts"];
			if (!countsRaw || typeof countsRaw !== "object" || Array.isArray(countsRaw)) throw new Error("[dsh-log] 事件清单 eventList 非法：counts 必须是含三类计数的对象");
			const countsRecord = countsRaw;
			const counts = {
				resident: 0,
				ondemand: 0,
				selfmon: 0
			};
			for (const kind of EVENT_KINDS) {
				const n = countsRecord[kind];
				if (typeof n !== "number" || !isFinite(n) || Math.floor(n) !== n || n < 0) throw new Error("[dsh-log] 事件清单 eventList 非法：counts." + kind + " 必须是非负整数");
				counts[kind] = n;
			}
			const eventsRaw = input["events"];
			if (!eventsRaw || typeof eventsRaw !== "object" || Array.isArray(eventsRaw)) throw new Error("[dsh-log] 事件清单 eventList 非法：events 必须是事件名到条目的对象");
			const events = {};
			for (const name of Object.keys(eventsRaw)) events[name] = parseEventEntry(name, eventsRaw[name]);
			return {
				version: 1,
				pluginId,
				counts,
				events
			};
		}
		function parseEventEntry(name, value) {
			if (!isNonEmptyString(name)) throw new Error("[dsh-log] 事件清单 eventList 非法：事件名不能为空");
			if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("[dsh-log] 事件清单 eventList 非法：事件 " + name + " 必须是对象");
			const input = value;
			if (EVENT_LEVELS.indexOf(input["level"]) < 0) throw new Error("[dsh-log] 事件清单 eventList 非法：事件 " + name + " 的 level 只许 error、warn、info、debug");
			if (EVENT_KINDS.indexOf(input["kind"]) < 0) throw new Error("[dsh-log] 事件清单 eventList 非法：事件 " + name + " 的 kind 只许 resident、ondemand、selfmon");
			for (const key of Object.keys(input)) if ([
				"level",
				"kind",
				"fields",
				"codes",
				"rules",
				"guard"
			].indexOf(key) < 0) throw new Error("[dsh-log] 事件清单 eventList 非法：事件 " + name + " 有不认识的键 " + key);
			const entry = {
				level: input["level"],
				kind: input["kind"],
				fields: assertStringArray(input["fields"], "事件 " + name + " 的 fields")
			};
			if (input["codes"] !== void 0) entry.codes = assertStringArray(input["codes"], "事件 " + name + " 的 codes");
			if (input["rules"] !== void 0) entry.rules = assertStringArray(input["rules"], "事件 " + name + " 的 rules");
			if (input["guard"] !== void 0) {
				if (typeof input["guard"] !== "string") throw new Error("[dsh-log] 事件清单 eventList 非法：事件 " + name + " 的 guard 必须是字符串");
				entry.guard = input["guard"];
			}
			return entry;
		}
		//#endregion
		//#region node_modules/dsh-log/dist/client.js
		function buildClientPhoneNames(prefix) {
			return buildPhoneNames(prefix);
		}
		function resolveClientLogConfig(input) {
			const raw = input === void 0 || input === null ? {} : input;
			const pluginId = raw.pluginId === void 0 ? "wf" : assertPluginId(raw.pluginId, "插件标识 pluginId");
			const prefix = raw.prefix === void 0 ? pluginId : assertPluginId(raw.prefix, "电话名前缀 prefix");
			const eventList = raw.eventList === void 0 ? null : raw.eventList;
			if (eventList !== null && typeof eventList === "object") parseEventListManifest(eventList);
			return {
				pluginId,
				prefix,
				eventList
			};
		}
		const LOG_DEBUG_KEY = "dsws.debug";
		const LOG_BATCH_MAX = 50;
		const LOG_FLUSH_MS = CLIENT_BATCH_INTERVAL_MS;
		const LOG_PACKET_BYTES = CLIENT_PACKET_BYTES;
		const LOG_QUEUE_MAX = 100;
		const LOG_WATCHDOG_MS = 5e3;
		function createClientLog(deps, configInput) {
			const input = deps || {};
			const host = input.host === void 0 ? null : input.host;
			const timer = input.timer === void 0 ? null : input.timer;
			const storage = input.storage !== void 0 && input.storage !== null ? input.storage : input.localStorage === void 0 ? null : input.localStorage;
			const broadcast = typeof input.broadcastLogSwitch === "function" ? input.broadcastLogSwitch : null;
			const config = resolveClientLogConfig(configInput);
			const phoneNames = buildClientPhoneNames(config.prefix);
			function readLocalDebugSwitch() {
				const fallback = {
					enabled: false,
					sampleRate: 1,
					rev: 1
				};
				try {
					if (!storage || typeof storage.getItem !== "function") return fallback;
					const raw = storage.getItem(LOG_DEBUG_KEY);
					if (!raw) return fallback;
					const saved = JSON.parse(raw);
					if (!saved || typeof saved !== "object") return fallback;
					return {
						enabled: saved.enabled === true,
						sampleRate: typeof saved.sampleRate === "number" && isFinite(saved.sampleRate) ? saved.sampleRate : 1,
						rev: typeof saved.rev === "number" && isFinite(saved.rev) ? saved.rev : 1
					};
				} catch (e) {
					return fallback;
				}
			}
			function persistLocalDebugSwitch(state) {
				try {
					if (!storage || typeof storage.setItem !== "function") return false;
					storage.setItem(LOG_DEBUG_KEY, JSON.stringify({
						enabled: !!(state && state.enabled),
						sampleRate: state && typeof state.sampleRate === "number" && isFinite(state.sampleRate) ? state.sampleRate : 1,
						rev: state && typeof state.rev === "number" && isFinite(state.rev) ? state.rev : 1
					}));
					return true;
				} catch (e) {
					return false;
				}
			}
			const logSwitch = readLocalDebugSwitch();
			const logQueue = [];
			const logDroppedState = { count: 0 };
			const logForwardState = {
				lastSummaryAt: 0,
				lastSummaryDropped: 0,
				lastReason: ""
			};
			const logFlushTimer = { id: null };
			const setLogSwitchGen = { n: 0 };
			function isEnabled(level) {
				if (level === "error" || level === "warn") return true;
				try {
					return logSwitch.enabled === true;
				} catch (e) {
					return false;
				}
			}
			function log(level, event, fields) {
				if (!isEnabled(level)) return;
				if (logQueue.length >= LOG_QUEUE_MAX) {
					logDroppedState.count += 1;
					logForwardState.lastReason = "queue-full";
					return;
				}
				logQueue.push({
					ts: Date.now(),
					level,
					event: String(event || ""),
					fields: fields && typeof fields === "object" ? fields : {}
				});
				if (level === "error" || level === "warn") scheduleLogFlush(true);
				else scheduleLogFlush(false);
			}
			function scheduleLogFlush(immediate) {
				const later = function(fn, ms) {
					try {
						if (timer !== null && timer !== void 0 && typeof timer.timeout === "function") return timer.timeout(fn, ms);
					} catch (e) {}
					return setTimeout(fn, ms);
				};
				if (immediate) {
					if (logFlushTimer.id !== null) {
						try {
							clearTimeout(logFlushTimer.id);
						} catch (e) {}
						logFlushTimer.id = null;
					}
					later(sendLogBatch, 0);
					return;
				}
				if (logFlushTimer.id !== null) return;
				logFlushTimer.id = later(function() {
					logFlushTimer.id = null;
					sendLogBatch();
				}, LOG_FLUSH_MS);
			}
			function estimateBatchBytes(entries) {
				try {
					const text = JSON.stringify(entries);
					const g = globalThis;
					if (typeof g.TextEncoder !== "undefined") return new g.TextEncoder().encode(text).length;
					return String(text).length;
				} catch (e) {
					return 131073;
				}
			}
			function maybeForwardSummary() {
				const delta = logDroppedState.count - logForwardState.lastSummaryDropped;
				if (delta <= 0) return;
				logForwardState.lastSummaryDropped = logDroppedState.count;
				const now = Date.now();
				const windowMs = now - logForwardState.lastSummaryAt;
				logForwardState.lastSummaryAt = now;
				try {
					log("warn", "log.forward.summary", {
						droppedDelta: delta,
						totalDropped: logDroppedState.count,
						reason: logForwardState.lastReason || "send-fail",
						windowMs
					});
				} catch (e) {}
			}
			function hash8(value) {
				try {
					const t = String(value || "");
					let h = 5381;
					for (let i = 0; i < t.length; i++) h = (h << 5) + h + t.charCodeAt(i) >>> 0;
					return ("0000000" + h.toString(16)).slice(-8);
				} catch (e) {
					return "00000000";
				}
			}
			function logExportFail(op, reason, err) {
				try {
					const g = globalThis;
					if (typeof g.dswsLogHash === "function" && typeof g.dswsLogTrunc === "function") {
						const trunc = g.dswsLogTrunc;
						const hash = g.dswsLogHash;
						log("warn", "log.export.fail", {
							op,
							reason,
							errorHash: hash(trunc(err && typeof err === "object" && "message" in err ? String(err.message) : String(err || reason), 120, "error"))
						});
					} else log("warn", "log.export.fail", {
						op,
						reason,
						errorHash: hash8(err && typeof err === "object" && "message" in err ? String(err.message) : String(err || reason))
					});
				} catch (e) {}
			}
			function watchSwitchOp(op, pending) {
				let settled = false;
				try {
					if (pending && typeof pending.then === "function") pending.then(function() {
						settled = true;
					}, function() {
						settled = true;
					});
				} catch (e) {}
				const fire = function() {
					if (!settled) {
						settled = true;
						try {
							log("warn", "log.switch.watchdog", {
								op,
								timeoutMs: LOG_WATCHDOG_MS,
								stage: "waiting-host"
							});
						} catch (e) {}
					}
				};
				try {
					if (timer !== null && timer !== void 0 && typeof timer.timeout === "function") {
						timer.timeout(fire, LOG_WATCHDOG_MS);
						return;
					}
				} catch (e) {}
				try {
					setTimeout(fire, LOG_WATCHDOG_MS);
				} catch (e2) {}
			}
			function sendLogBatch() {
				if (logQueue.length === 0) return Promise.resolve({
					ok: true,
					sent: 0
				});
				const entries = logQueue.splice(0, LOG_BATCH_MAX);
				let trimmed = 0;
				while (entries.length > 1 && estimateBatchBytes(entries) > LOG_PACKET_BYTES) {
					entries.pop();
					trimmed += 1;
				}
				while (logQueue.length > LOG_QUEUE_MAX) {
					logQueue.shift();
					trimmed += 1;
				}
				if (trimmed > 0) {
					logDroppedState.count += trimmed;
					logForwardState.lastReason = "packet-trim";
					try {
						entries[entries.length - 1].truncated = true;
					} catch (e) {}
				}
				const args = {
					entries,
					droppedCount: logDroppedState.count
				};
				const onlySummary = entries.length === 1 && entries[0] && entries[0].event === "log.forward.summary";
				if (!host || typeof host.call !== "function") {
					logDroppedState.count += entries.length;
					logForwardState.lastReason = "send-fail";
					if (!onlySummary) maybeForwardSummary();
					return Promise.resolve({
						ok: false,
						sent: 0
					});
				}
				try {
					return host.call(phoneNames.logBatch, args).then(function(res) {
						const ok = !!res && typeof res === "object" && res.ok === true;
						if (!ok) {
							logDroppedState.count += entries.length;
							logForwardState.lastReason = "host-reject";
						}
						if (ok) maybeForwardSummary();
						else if (!onlySummary) maybeForwardSummary();
						return {
							ok,
							sent: entries.length
						};
					}).catch(function() {
						logDroppedState.count += entries.length;
						logForwardState.lastReason = "send-fail";
						if (!onlySummary) maybeForwardSummary();
						return {
							ok: false,
							sent: 0
						};
					});
				} catch (e) {
					logDroppedState.count += entries.length;
					logForwardState.lastReason = "send-fail";
					if (!onlySummary) maybeForwardSummary();
					return Promise.resolve({
						ok: false,
						sent: 0
					});
				}
			}
			function flush() {
				if (logFlushTimer.id !== null) {
					try {
						clearTimeout(logFlushTimer.id);
					} catch (e) {}
					logFlushTimer.id = null;
				}
				try {
					sendLogBatch();
				} catch (e) {}
				return { ok: true };
			}
			function getDroppedCount() {
				return logDroppedState.count;
			}
			function reconcileLogSwitch() {
				if (!host || typeof host.call !== "function") return Promise.resolve({
					ok: false,
					enabled: logSwitch.enabled,
					sampleRate: logSwitch.sampleRate
				});
				try {
					const pendingGet = host.call(phoneNames.logGetSwitch, {});
					watchSwitchOp("reconcile", pendingGet);
					return pendingGet.then(function(res) {
						const body = res && typeof res === "object" ? res : null;
						if (!body || body.ok !== true) return {
							ok: false,
							enabled: logSwitch.enabled,
							sampleRate: logSwitch.sampleRate
						};
						logSwitch.enabled = body.enabled === true;
						if (typeof body.sampleRate === "number" && isFinite(body.sampleRate)) logSwitch.sampleRate = body.sampleRate;
						persistLocalDebugSwitch(logSwitch);
						try {
							if (broadcast) broadcast();
						} catch (e) {}
						return {
							ok: true,
							enabled: logSwitch.enabled,
							sampleRate: logSwitch.sampleRate
						};
					}).catch(function() {
						return {
							ok: false,
							enabled: logSwitch.enabled,
							sampleRate: logSwitch.sampleRate
						};
					});
				} catch (e) {
					return Promise.resolve({
						ok: false,
						enabled: logSwitch.enabled,
						sampleRate: logSwitch.sampleRate
					});
				}
			}
			const logSwitchSetFail = function(kind, hint) {
				try {
					log("warn", "host.call.fail", {
						method: phoneNames.logSetSwitch,
						kind: "set-switch-" + kind,
						errorHash: hash8(String(hint === void 0 || hint === null ? kind : hint).slice(0, 120))
					});
				} catch (e) {}
			};
			const switchThrowKind = function(e) {
				const msg = String((e && typeof e === "object" && ("code" in e || "message" in e) ? e.code || e.message : e) || "");
				if (/unknown endpoint/i.test(msg)) return "throw-unknown-endpoint";
				if (/connection|host\.call 不可用|unavailable/i.test(msg)) return "throw-connection";
				return "throw";
			};
			const failByThrow = function(e) {
				const kind = switchThrowKind(e);
				logSwitchSetFail(kind, (e && typeof e === "object" && "message" in e ? e.message : void 0) || e);
				return kind;
			};
			function setLogSwitch(enabled, sampleRate) {
				const next = {
					enabled: enabled === true,
					sampleRate: typeof sampleRate === "number" && isFinite(sampleRate) ? sampleRate : logSwitch.sampleRate
				};
				if (!host || typeof host.call !== "function") {
					logSwitchSetFail("host-unavailable", "host-unavailable");
					return Promise.resolve({
						ok: false,
						enabled: logSwitch.enabled,
						error: "host-unavailable"
					});
				}
				try {
					const pendingSet = host.call(phoneNames.logSetSwitch, next);
					watchSwitchOp("set", pendingSet);
					const myGen = setLogSwitchGen.n += 1;
					const timeoutAt = new Promise(function(resolve) {
						const fire = function() {
							resolve({ switchTimedOut: true });
						};
						try {
							if (timer !== null && timer !== void 0 && typeof timer.timeout === "function") {
								timer.timeout(fire, LOG_WATCHDOG_MS);
								return;
							}
						} catch (e) {}
						try {
							setTimeout(fire, LOG_WATCHDOG_MS);
						} catch (e2) {}
					});
					return Promise.race([pendingSet, timeoutAt]).then(function(res) {
						const body = res && typeof res === "object" ? res : null;
						if (body && body["switchTimedOut"] === true) {
							logSwitchSetFail("timeout", "timeout-5000");
							return {
								ok: false,
								enabled: logSwitch.enabled,
								error: "switch-timeout"
							};
						}
						if (myGen !== setLogSwitchGen.n) return {
							ok: false,
							enabled: logSwitch.enabled,
							error: "stale"
						};
						if (!body || body["ok"] !== true) {
							logSwitchSetFail("host-rejected", "host-rejected");
							return {
								ok: false,
								enabled: logSwitch.enabled,
								error: "host-rejected"
							};
						}
						logSwitch.enabled = body["enabled"] === true;
						logSwitch.sampleRate = next.sampleRate;
						persistLocalDebugSwitch(logSwitch);
						try {
							if (broadcast) broadcast();
						} catch (e) {}
						return {
							ok: true,
							enabled: logSwitch.enabled,
							sampleRate: logSwitch.sampleRate
						};
					}).catch(function(e) {
						if (myGen !== setLogSwitchGen.n) return {
							ok: false,
							enabled: logSwitch.enabled,
							error: "stale"
						};
						return {
							ok: false,
							enabled: logSwitch.enabled,
							error: failByThrow(e)
						};
					});
				} catch (e) {
					return Promise.resolve({
						ok: false,
						enabled: logSwitch.enabled,
						error: failByThrow(e)
					});
				}
			}
			return {
				config,
				phoneNames,
				logSwitch,
				logQueue,
				logDroppedState,
				logForwardState,
				logFlushTimer,
				isEnabled,
				log,
				scheduleLogFlush,
				estimateBatchBytes,
				maybeForwardSummary,
				hash8,
				logExportFail,
				watchSwitchOp,
				sendLogBatch,
				flush,
				getDroppedCount,
				readLocalDebugSwitch,
				persistLocalDebugSwitch,
				reconcileLogSwitch,
				setLogSwitch
			};
		}
		const HASH_RE = /^[0-9a-f]{8}$/;
		/** ENUM 值域默认（与清单顶层 valueDomain 同值；清单缺失或非法时回退到此，仍保持防护）。 */
		const ENUM_VALUE_PATTERN_SRC = "^[A-Za-z0-9._:\\/-]{0,32}$";
		const ENUM_VALUE_RE = /^[A-Za-z0-9._:\/-]{0,32}$/;
		/** 清单不可用时仍然放行的唯一事件（自报故障，字段硬编码），否则失败关闭会把告警本身吞掉。 */
		const MANIFEST_FAIL_EVENT = "host.log.manifest.fail";
		const MANIFEST_FAIL_FIELDS = ["reason", "errorHash"];
		/** 第二道网：具名规则命中就把该字段值换成规则名，不记原文。白名单是主防线，这里只兜已知高危形状。 */
		const RULE_TABLE = [
			["R_TOKEN", /(ghp_|gho_|github_pat_|bearer\s|sk-)[A-Za-z0-9_-]{8,}/i],
			["R_WIN_ABS", /(^|[^A-Za-z0-9])[A-Za-z]:[\\/]/],
			["R_HOME_PATH", /(users|home)[\\/][^\\/\s]+/i],
			["R_URL", /https?:\/\//i],
			["R_EMAIL", /[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/]
		];
		/** 与包内 `hash8` 同形（把没散列、或形状不对的值就地散列，只用来判断同一性）。 */
		function hash8(value) {
			try {
				const text = String(value ?? "");
				let h = 5381;
				for (let i = 0; i < text.length; i++) h = (h << 5) + h + text.charCodeAt(i) >>> 0;
				return ("0000000" + h.toString(16)).slice(-8);
			} catch (e) {
				return "00000000";
			}
		}
		/** 清单最小形状自检：version 1、pluginId 是 dsh-prompt、events 里每条都有 fields 数组。 */
		function summarizeManifest(raw, pluginId = "dsh-prompt") {
			try {
				if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {
					ok: false,
					reason: "shape-fail",
					table: null
				};
				if (raw.version !== 1 || raw.pluginId !== pluginId) return {
					ok: false,
					reason: "shape-fail",
					table: null
				};
				if (!raw.events || typeof raw.events !== "object" || Array.isArray(raw.events)) return {
					ok: false,
					reason: "shape-fail",
					table: null
				};
				let enumPattern = ENUM_VALUE_PATTERN_SRC;
				let enumMaxLength = 32;
				try {
					const vd = raw.valueDomain;
					if (vd && typeof vd === "object" && !Array.isArray(vd)) {
						if (typeof vd.enumPattern === "string" && vd.enumPattern.length > 0) {
							new RegExp(vd.enumPattern);
							enumPattern = vd.enumPattern;
						}
						if (typeof vd.enumMaxLength === "number" && Number.isFinite(vd.enumMaxLength) && vd.enumMaxLength >= 0) enumMaxLength = Math.floor(vd.enumMaxLength);
					}
				} catch (e) {}
				const table = /* @__PURE__ */ new Map();
				for (const [name, entry] of Object.entries(raw.events)) {
					if (!entry || typeof entry !== "object" || !Array.isArray(entry.fields)) return {
						ok: false,
						reason: "shape-fail",
						table: null
					};
					const hasEnum = Array.isArray(entry.codes) && entry.codes.indexOf("ENUM") >= 0;
					table.set(name, {
						level: entry.level,
						kind: entry.kind,
						fields: entry.fields,
						hasEnum
					});
				}
				return {
					ok: true,
					reason: "ok",
					table,
					enumPattern,
					enumMaxLength
				};
			} catch (e) {
				return {
					ok: false,
					reason: "shape-fail",
					table: null
				};
			}
		}
		/**
		* 建闸门。`raw` 是清单原对象（不合规即失败关闭）；返回的 `filter` 是唯一写入前关口。
		* `onWarn` 可选，用于把"清单不可用"这件事通知给调用方（宿主往 stderr 说一次，客户端不吭声）。
		*/
		function createEventGate(raw, options = {}) {
			const summary = summarizeManifest(raw, options.pluginId ?? "dsh-prompt");
			const table = summary.table ?? /* @__PURE__ */ new Map();
			const stats = {
				undeclared: 0,
				droppedFields: 0,
				oversize: 0,
				scrubbed: 0
			};
			let warned = false;
			let enumRe = ENUM_VALUE_RE;
			try {
				enumRe = new RegExp(summary.enumPattern ?? "^[A-Za-z0-9._:\\/-]{0,32}$");
			} catch (e) {
				enumRe = ENUM_VALUE_RE;
			}
			const enumMax = typeof summary.enumMaxLength === "number" ? summary.enumMaxLength : 32;
			function coerce(hasEnum, field, value) {
				if (value === void 0 || value === null) return { skip: true };
				if (/Hash$/.test(field)) {
					const text = String(value);
					return { value: HASH_RE.test(text) ? text : hash8(text) };
				}
				if (typeof value === "boolean") return { value };
				if (typeof value === "number") {
					if (!Number.isFinite(value)) return { skip: true };
					return { value: Number.isInteger(value) ? value : Math.round(value) };
				}
				let text = String(value);
				for (const [ruleName, re] of RULE_TABLE) if (re.test(text)) {
					text = ruleName;
					stats.scrubbed += 1;
					break;
				}
				if (hasEnum) {
					if (text.length > enumMax || !enumRe.test(text)) {
						stats.droppedFields += 1;
						return { skip: true };
					}
				}
				return { value: text.length > 32 ? text.slice(0, 32) : text };
			}
			function filter(event, fields) {
				const name = String(event || "");
				const entry = table.get(name);
				const isManifestFail = name === MANIFEST_FAIL_EVENT;
				if (!entry && !isManifestFail) {
					if (table.size > 0) {
						stats.undeclared += 1;
						return {
							ok: false,
							reason: "undeclared-event",
							level: "info",
							fields: {}
						};
					}
					if (!warned) {
						warned = true;
						try {
							options.onWarn?.("事件清单不可用，日志字段已按失败关闭处理（只记事件名与级别）。");
						} catch (e) {}
					}
					stats.undeclared += 1;
					return {
						ok: true,
						reason: "no-manifest",
						level: "info",
						fields: {}
					};
				}
				const declared = entry ? entry.fields : MANIFEST_FAIL_FIELDS;
				const level = entry ? entry.level : "warn";
				const hasEnum = entry ? !!entry.hasEnum : isManifestFail;
				const input = fields && typeof fields === "object" ? fields : {};
				const safe = {};
				for (const [key, value] of Object.entries(input)) {
					if (declared.indexOf(key) < 0) {
						stats.droppedFields += 1;
						continue;
					}
					const out = coerce(hasEnum, key, value);
					if (!out.skip) safe[key] = out.value;
				}
				let line = "";
				try {
					line = JSON.stringify({
						ts: 0,
						level,
						event: name,
						fields: safe
					});
				} catch (e) {
					return {
						ok: false,
						reason: "unserializable",
						level,
						fields: {}
					};
				}
				if (line.length > 1024) {
					stats.oversize += 1;
					return {
						ok: false,
						reason: "oversize",
						level,
						fields: {}
					};
				}
				return {
					ok: true,
					reason: "ok",
					level,
					fields: safe
				};
			}
			return {
				filter,
				stats,
				manifestOk: table.size > 0,
				isDeclared: (event) => table.has(String(event)),
				levelOf: (event) => table.get(String(event))?.level ?? null,
				eventNames: () => [...table.keys()]
			};
		}
		Object.keys(event_list_dsh_prompt_default.events);
		const ENDPOINT_DEFAULT = "/_dsh/dsh-prompt/log";
		let current = null;
		const subscribers = /* @__PURE__ */ new Set();
		/**
		* 默认存储的安全求值（#59）：`typeof localStorage` 在「属性访问就抛」的环境下
		* （隐私模式 / 企业策略拦截）一样会抛 —— `typeof` 只对「未声明变量」安全，
		* 对「getter 一碰就抛」不安全。所以整段求值必须包在 `try` 里，失败回 `null`
		* （日志能力降级，整壳继续起；包内 `dsh-log` 对 `null` 本来就是无存储语义）。
		*
		* 落点取舍（#59 分诊口径 + #53 约束）：只住本文件内部，不新建 `src/client/storage.ts`
		* —— 本仓每个回归脚本都在 `scripts` 下的 `.rt-tmp` 系列目录里手写要转译的模块清单，往被普遍加载的
		* 路径上加一条 import 边会让既有脚本整批红（#53 实测 15 条里红 9 条）。`smartstore.ts` /
		* `updauto.ts` 的 4 处同类访问本来就在 `try` 里（降级值 `false` / `null` / `''` / `false`
		* 保持不变），为避免两套写法漂移刻意不收拢到一处共享封装 —— 本函数只保这一处爆点。
		*/
		function resolveDefaultStorage() {
			try {
				const s = globalThis.localStorage;
				if (typeof s === "undefined" || s === null) return null;
				return s;
			} catch (e) {
				return null;
			}
		}
		function notify() {
			subscribers.forEach((fn) => {
				try {
					fn();
				} catch (e) {}
			});
		}
		/** 建日志能力并登记为当前实例（热重载重跑 apply 时以最后一次为准）。 */
		function startLog(deps = {}) {
			const endpoint = deps.endpoint ?? ENDPOINT_DEFAULT;
			const gate = createEventGate(event_list_dsh_prompt_default);
			let channel = null;
			try {
				if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(deps.channelName ?? "dsh-prompt-log");
			} catch (e) {}
			let clientLog;
			const host = deps.host ?? { async call(name, args) {
				try {
					if (typeof fetch === "undefined") throw new Error("fetch-unavailable");
					const res = await fetch(endpoint, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							name,
							args
						})
					});
					if (!res.ok) throw new Error("http-" + res.status);
					const data = await res.json();
					if (!data || data.ok !== true) return {
						ok: false,
						error: data?.error ?? { code: "bridge-rejected" }
					};
					return data.value;
				} catch (e) {
					facade.log("bridge.call.fail", {
						phone: name,
						kind: typeof e === "object" && e && "message" in e ? String(e.message).slice(0, 32) : "bridge-error"
					});
					throw e;
				}
			} };
			clientLog = createClientLog({
				host,
				timer: deps.timer ?? null,
				storage: deps.storage ?? resolveDefaultStorage(),
				broadcastLogSwitch: channel ? () => {
					try {
						channel.postMessage({ on: clientLog.logSwitch.enabled });
					} catch (e) {}
				} : null
			}, {
				pluginId: "dsh-prompt",
				eventList: event_list_dsh_prompt_default
			});
			if (channel) try {
				channel.addEventListener("message", (ev) => {
					const on = !!(ev && ev.data && ev.data.on);
					clientLog.logSwitch.enabled = on;
					facade.log("settings.log.broadcast", { on });
					notify();
				});
			} catch (e) {}
			const facade = {
				log(event, fields) {
					const res = gate.filter(String(event), fields);
					if (!res.ok) return false;
					try {
						clientLog.log(res.level, String(event), res.fields);
						return true;
					} catch (e) {
						return false;
					}
				},
				isEnabled(event) {
					if (gate.manifestOk && !gate.isDeclared(String(event))) return false;
					try {
						return clientLog.isEnabled(gate.levelOf(String(event)) ?? "info");
					} catch (e) {
						return false;
					}
				},
				status: () => ({
					dropped: clientLog.getDroppedCount(),
					undeclared: gate.stats.undeclared,
					droppedFields: gate.stats.droppedFields,
					oversize: gate.stats.oversize,
					scrubbed: gate.stats.scrubbed,
					manifestOk: gate.manifestOk
				}),
				getSwitch: () => ({
					enabled: clientLog.logSwitch.enabled,
					sampleRate: clientLog.logSwitch.sampleRate
				}),
				async setSwitch(enabled) {
					const res = await clientLog.setLogSwitch(enabled, 1);
					notify();
					return {
						ok: !!res?.ok,
						enabled: !!(res?.enabled ?? clientLog.logSwitch.enabled),
						error: res?.error
					};
				},
				async reconcile() {
					const res = await clientLog.reconcileLogSwitch();
					facade.log("settings.log.reconcile", {
						ok: !!res?.ok,
						on: !!res?.enabled
					});
					notify();
					return {
						ok: !!res?.ok,
						enabled: !!res?.enabled
					};
				},
				async exportLog(date) {
					try {
						const res = await host.call(clientLog.phoneNames.logExport, date ? { date } : {});
						const out = {
							ok: !!res?.ok,
							fileName: res?.fileName,
							bytes: res?.bytes,
							fallback: res?.fallback,
							text: res?.text,
							dir: res?.dir,
							path: res?.path
						};
						if (out.ok) facade.log("settings.log.export", {
							ok: true,
							bytes: out.bytes ?? 0,
							fallback: !!out.fallback
						});
						else {
							out.reason = res?.error?.code ?? "export-failed";
							facade.log("settings.log.export.fail", {
								reason: out.reason,
								errorHash: hash8(out.reason)
							});
						}
						return out;
					} catch (e) {
						const reason = "host-unreachable";
						facade.log("settings.log.export.fail", {
							reason,
							errorHash: hash8(String(e?.message ?? e))
						});
						return {
							ok: false,
							reason
						};
					}
				},
				async clearLog(scope = "all") {
					try {
						const res = await host.call(clientLog.phoneNames.logClear, { date: scope === "day" ? void 0 : "all" });
						const out = {
							ok: !!res?.ok,
							removed: Number(res?.removed ?? 0)
						};
						facade.log("settings.log.clear", out);
						return out;
					} catch (e) {
						facade.log("settings.log.clear", {
							ok: false,
							removed: 0
						});
						return {
							ok: false,
							removed: 0
						};
					}
				},
				flush() {
					try {
						clientLog.flush();
					} catch (e) {}
				},
				subscribe(fn) {
					subscribers.add(fn);
					return () => {
						subscribers.delete(fn);
					};
				},
				raw: () => clientLog
			};
			current = facade;
			try {
				globalThis.__dshPromptLog = facade;
			} catch (e) {}
			return facade;
		}
		/** 取当前实例；没建过就返回空操作实例，调用点不必判空。 */
		function getLog() {
			if (current) return current;
			return {
				log: () => false,
				isEnabled: () => false,
				status: () => ({
					dropped: 0,
					undeclared: 0,
					droppedFields: 0,
					oversize: 0,
					scrubbed: 0,
					manifestOk: false
				}),
				getSwitch: () => ({
					enabled: false,
					sampleRate: 1
				}),
				setSwitch: async (enabled) => ({
					ok: false,
					enabled,
					error: "log-not-started"
				}),
				reconcile: async () => ({
					ok: false,
					enabled: false
				}),
				exportLog: async () => ({
					ok: false,
					reason: "log-not-started"
				}),
				clearLog: async () => ({
					ok: false,
					removed: 0
				}),
				flush: () => void 0,
				subscribe: () => () => void 0,
				raw: () => null
			};
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* dsh-prompt — client 入口（v1 常规模式 + v1.1 智能模式）
		* 装配：input.left 入口按钮 / input.overlay 面板浮层 / settings.section 配置页（直属设置面板）/ inputTriggers /prompt 触发源（#9）/ shell.overlay 智能悬浮卡（#10）
		*/
		/** 记一条调试级事件（先问开关再组装字段：关着开关时连字符串都不拼，包内兜底拦不住调用前的求值）。 */
		function logDebug(event, fields) {
			try {
				const log = getLog();
				if (!log.isEnabled(event)) return;
				log.log(event, fields);
			} catch (e) {}
		}
		const inject = ["slots", "inputTriggers"];
		/**
		* 更新自动检查宿主（#41）：全局单点（shell.overlay）、启动即挂 —— 挂载后自己延迟一把再查，
		* 有新版本才弹 #40 那只弹窗（`auto` 模式只出弹窗、不出设置页那一行）。
		*
		* 为什么放在 shell.overlay 而不是 conversation.input.overlay：会话说白了可以有多个，
		* 而「启动后自动查一次」这件事每台机器只该发生一次（电话与弹窗都不该按会话翻倍）。
		*/
		function UpdateAutoHost() {
			const react = getReact();
			if (!react) return null;
			return react.createElement(UpdateEntry, { auto: true });
		}
		/** 面板浮层（conversation.input.overlay，session 作用域 → 有 useInput/inputActions） */
		function PanelHost(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const openState = react.useState(isPanelOpen());
			const open = openState[0];
			react.useEffect(() => {
				onPanelOpen((v) => openState[1](v));
				logDebug("panel.host.mount", {
					propCount: Object.keys(props || {}).length,
					hasUseInput: !!props.useInput,
					hasInputActions: !!props.inputActions
				});
			}, []);
			react.useEffect(() => {
				const readDraft = () => {
					try {
						const u = props.useInput;
						if (u && typeof u.getState === "function") return u.getState()?.draft || "";
					} catch (e) {}
					try {
						if (typeof document !== "undefined") {
							const ae = document.activeElement;
							if (ae && ae.tagName === "TEXTAREA") {
								try {
									if (ae.closest && ae.closest("[data-dsh-prompt-modal]")) return "";
								} catch (e) {}
								return ae.value || "";
							}
						}
					} catch (e) {}
					return "";
				};
				const push = () => {
					try {
						setSmartInput({
							sessionId: props.sessionId,
							draft: readDraft(),
							useInput: props.useInput,
							actions: props.inputActions
						});
					} catch (e) {}
				};
				push();
				let unsub = null;
				try {
					const u = props.useInput;
					if (u && typeof u.subscribe === "function") unsub = u.subscribe(push);
				} catch (e) {}
				const timer = setInterval(push, 300);
				return () => {
					try {
						if (typeof unsub === "function") unsub();
					} catch (e) {}
					try {
						clearInterval(timer);
					} catch (e) {}
				};
			}, [
				props.sessionId,
				props.useInput,
				props.inputActions
			]);
			react.useEffect(() => {
				const sid = props.sessionId;
				return () => {
					if (sid !== void 0) setSmartInput({ draft: "" });
				};
			}, [props.sessionId]);
			if (!open) return null;
			return h(PanelPortal, null, h(TemplateBrowser, {
				compact: true,
				useInput: props.useInput,
				inputActions: props.inputActions
			}));
		}
		function apply(ctx) {
			const log = startLog();
			log.reconcile().catch(() => void 0);
			log.log("app.boot", {
				hasReact: !!getReact(),
				lang: getLang(),
				entryCount: 6
			});
			ctx.effect(() => {
				ensureLoaded().catch(() => void 0);
			}, "dsh-prompt: store load");
			ctx.effect(() => ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "dsh-prompt-entry",
				order: 10,
				label: () => "dsh-prompt"
			}, (props) => {
				const react = getReact();
				if (!react) return null;
				const h = react.createElement;
				const openState = react.useState(isPanelOpen());
				react.useEffect(() => onPanelOpen((v) => openState[1](v)), []);
				return h(EntryButton, { open: openState[0] });
			})), "dsh-prompt: entry");
			ctx.effect(() => ctx.slots.inject("conversation.input.overlay", () => ctx.slots.register({
				name: "conversation.input.overlay",
				id: "dsh-prompt-panel",
				order: 2,
				label: () => "dsh-prompt panel"
			}, PanelHost)), "dsh-prompt: panel");
			ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-prompt-toolbox",
				priority: 10,
				order: 50,
				label: () => tr(getLang(), STR.sectionName)
			}, SettingsPage)), "dsh-prompt: settings");
			setGoSettingsHandler(() => {
				try {
					if (typeof document === "undefined") return;
					const btns = Array.prototype.slice.call(document.querySelectorAll("button[aria-haspopup=\"dialog\"]"));
					const trig = btns.find((b) => /设置|Settings/.test((b.textContent || "").trim())) || btns[0];
					if (trig) trig.click();
					setTimeout(() => {
						const label = tr(getLang(), STR.sectionName);
						const cell = Array.prototype.slice.call(document.querySelectorAll("button")).find((b) => (b.textContent || "").trim() === label);
						if (cell) cell.click();
					}, 150);
				} catch (e) {}
			});
			if (ctx.inputTriggers && typeof ctx.inputTriggers.registerSource === "function") ctx.effect(() => ctx.inputTriggers.registerSource(buildPromptSource()), "dsh-prompt: /prompt source");
			ctx.effect(() => ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-prompt-smart",
				order: 200,
				label: () => "dsh-prompt smart"
			}, SmartCardHost)), "dsh-prompt: smart card");
			ctx.effect(() => ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-prompt-update-auto",
				order: 210,
				label: () => "dsh-prompt update auto"
			}, UpdateAutoHost)), "dsh-prompt: update auto");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map