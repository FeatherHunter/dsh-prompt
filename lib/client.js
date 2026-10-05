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
		const STORE_URL$1 = "/_dsh/dsh-prompt/store";
		const PUT_URL = "/_dsh/dsh-prompt/customs/put";
		const DELETE_URL = "/_dsh/dsh-prompt/customs/delete";
		const BUMP_URL = "/_dsh/dsh-prompt/usage/bump";
		const PINNED_URL = "/_dsh/dsh-prompt/pinned/set";
		const cache$1 = {
			customs: [],
			usage: {},
			pinned: [],
			lastUsed: null
		};
		let storeLoaded = false;
		let loadPromise$1 = null;
		let loadRetried$1 = false;
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
		async function fetchJSON$1(url, init) {
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
		/** 拉取 host 快照并装入缓存（失败 → 保持内存默认 + 记事件，不读旧 localStorage；#91 起失败补一次 2500ms 延迟重拉，与 remote 同构）。 */
		function ensureLoaded() {
			if (storeLoaded) return Promise.resolve();
			if (loadPromise$1) return loadPromise$1;
			loadPromise$1 = (async () => {
				const startedAt = Date.now();
				const data = await fetchJSON$1(STORE_URL$1);
				if (data && data.ok && data.value) {
					const v = data.value;
					if (Array.isArray(v.customs)) cache$1.customs = v.customs;
					if (v.usage && typeof v.usage === "object") cache$1.usage = v.usage;
					if (Array.isArray(v.pinned)) cache$1.pinned = v.pinned.filter((x) => typeof x === "string");
					cache$1.lastUsed = typeof v.lastUsed === "string" ? v.lastUsed : null;
					logEvent$5("store.snapshot.ok", {
						customs: cache$1.customs.length,
						pinned: cache$1.pinned.length,
						latencyMs: Date.now() - startedAt
					});
				} else {
					logEvent$5("store.snapshot.fail", {
						reason: typeof fetch === "undefined" ? "no-fetch" : "http-or-json-fail",
						latencyMs: Date.now() - startedAt
					});
					if (!loadRetried$1) {
						loadRetried$1 = true;
						try {
							if (typeof setTimeout === "function") {
								const tid = setTimeout(() => {
									loadPromise$1 = null;
									storeLoaded = false;
									ensureLoaded().catch(() => void 0);
								}, 2500);
								try {
									if (tid && typeof tid.unref === "function") tid.unref();
								} catch (e) {}
							}
						} catch (e) {}
					}
				}
				storeLoaded = true;
				notifyStore();
			})().finally(() => {});
			return loadPromise$1;
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
					logEvent$5("store.persist.fail", {
						route: ROUTE_NAMES[url] ?? "unknown",
						errorHash: String(e && e.message || e)
					});
				});
			} catch (e) {}
		}
		function loadUsage() {
			return { ...cache$1.usage };
		}
		function bumpUsage(id) {
			cache$1.usage[id] = (cache$1.usage[id] || 0) + 1;
			cache$1.lastUsed = id;
			notifyStore();
			persist(BUMP_URL, { id });
		}
		/** 最近一次使用的模板 id（智能模式「最近使用」候选；无 → null） */
		function loadLastUsed() {
			return cache$1.lastUsed;
		}
		function loadPinned() {
			return [...cache$1.pinned];
		}
		/** 全部模板（预制 + 自定义） */
		function allTemplates() {
			return [...PRESET_TEMPLATES, ...cache$1.customs];
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
			for (const t of cache$1.customs) templateLabels(t).forEach(push);
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
			const usage = cache$1.usage;
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
			const usage = cache$1.usage;
			const pinned = cache$1.pinned;
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
			const pinned = [...cache$1.pinned];
			const i = pinned.indexOf(id);
			if (i >= 0) pinned.splice(i, 1);
			else if (pinned.length >= MAX_PIN) return {
				pinned,
				ok: false
			};
			else pinned.push(id);
			cache$1.pinned = pinned;
			notifyStore();
			persist(PINNED_URL, { ids: pinned });
			return {
				pinned: [...pinned],
				ok: true
			};
		}
		function isPinned(id) {
			return cache$1.pinned.indexOf(id) >= 0;
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
			cache$1.customs = [...cache$1.customs, t];
			notifyStore();
			persist(PUT_URL, { template: toHostShape(t) });
			return t;
		}
		/** 更新自定义模板（#23：labels 数组或单字符串；兼容旧 patch.tag，折算为单标签） */
		function updateCustom(id, patch) {
			cache$1.customs = cache$1.customs.map((t) => {
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
			const next = cache$1.customs.filter((t) => t.id !== id);
			if (next.length === cache$1.customs.length) return false;
			cache$1.customs = next;
			cache$1.pinned = cache$1.pinned.filter((p) => p !== id);
			notifyStore();
			persist(DELETE_URL, { id });
			persist(PINNED_URL, { ids: cache$1.pinned });
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
		function logEvent$5(event, fields) {
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
		/**
		* #112 hover-click 同手势标记：入口按钮 hover 开窗时打点，click 凭它区分
		* “同手势跟进单击（保持开，防闪关）”与“稳态明确单击（取反，可手动关）”。
		* 读一次消费一次——第二次 click 即走取反；超窗视为稳态（过期不算同手势）；
		* 关窗即手势结束——任何关窗都清点，不留给下一次开窗（code-review Spec c1）。
		*/
		let hoverOpenedAt = 0;
		function noteHoverOpen() {
			hoverOpenedAt = Date.now();
		}
		function takeHoverOpen(graceMs) {
			if (hoverOpenedAt === 0) return false;
			const age = Date.now() - hoverOpenedAt;
			hoverOpenedAt = 0;
			return age <= graceMs;
		}
		function setPanelOpen(v) {
			if (panelOpen !== v) {
				panelOpen = v;
				if (!v) hoverOpenedAt = 0;
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
		//#region src/client/remote.ts
		/** 默认值：总闸默认关（#85 US8）；大小默认 5 档（3x，用户拍板起步即大）；方向偏好默认自动；密度默认 A */
		const REMOTE_DEFAULTS = {
			enabled: false,
			size: 5,
			orientation: "auto",
			density: "a"
		};
		/** 大小校验：1–10 整数（纯函数） */
		function isRemoteSize(v) {
			return typeof v === "number" && isFinite(v) && Math.floor(v) === v && v >= 1 && v <= 10;
		}
		/** 档位校验（纯函数） */
		function isRemoteTier(v) {
			return v === "small" || v === "medium" || v === "large";
		}
		/** 方向偏好校验（纯函数） */
		function isRemoteOrientationPref(v) {
			return v === "auto" || v === "landscape" || v === "portrait";
		}
		/** 密度档校验（纯函数，#90） */
		function isRemoteDensity(v) {
			return v === "a" || v === "b";
		}
		/** 归一化：未知形状一律回默认（纯函数；宿主旧数据/手改坏文件走此；旧三档按 large→2、其余→1 迁入） */
		function normalizeRemotePrefs(input) {
			try {
				const o = input || {};
				let size = REMOTE_DEFAULTS.size;
				if (isRemoteSize(o.size)) size = o.size;
				else if (o.font === "large" || o.control === "large") size = 2;
				else if (isRemoteTier(o.font) || isRemoteTier(o.control)) size = 1;
				return {
					enabled: o.enabled === true,
					size,
					orientation: isRemoteOrientationPref(o.orientation) ? o.orientation : REMOTE_DEFAULTS.orientation,
					density: isRemoteDensity(o.density) ? o.density : REMOTE_DEFAULTS.density
				};
			} catch (e) {
				return { ...REMOTE_DEFAULTS };
			}
		}
		const STORE_URL = "/_dsh/dsh-prompt/store";
		const SET_URL = "/_dsh/dsh-prompt/remote/set";
		const ROUTE_NAME = "remote.set";
		let cache = { ...REMOTE_DEFAULTS };
		let remoteLoaded = false;
		let loadPromise = null;
		let loadRetried = false;
		let persistFailed = false;
		let persistMessage = "";
		const listeners$1 = /* @__PURE__ */ new Set();
		/**
		* 旧版（2026-10-02 那版）把进入前的方向写进 localStorage `__dshPromptPreRemote`，
		* 退出或崩溃重启时据此把方向改回进入值。改判后本键再无消费者，
		* 若不清掉，下次加载仍会命中旧的崩溃恢复分支把用户最后选的方向翻回去——正是本次要治的病。
		* 故启动时无条件删一次（幂等、无网络、失败静默），键名只作字符串常量留档。
		*/
		const LEGACY_PRE_REMOTE_KEY = "__dshPromptPreRemote";
		/** 删掉遗留进入快照键（缺席存储或被禁写时静默 no-op） */
		function purgeLegacySnapshot() {
			try {
				const g = globalThis;
				const s = g && g.localStorage;
				if (s && typeof s.removeItem === "function") s.removeItem(LEGACY_PRE_REMOTE_KEY);
			} catch (e) {}
		}
		/** 缓存的整机方向（null = 未知，走视口回落） */
		let envOrientation = null;
		/** 桥永久缺席（本会话内不再做推测性查询；用户显式锁定不受影响，照调照报） */
		let envUnsupported = false;
		/** 读环境方向缓存（返回拷贝；null 即未知） */
		function getEnvOrientation() {
			return envOrientation ? { ...envOrientation } : null;
		}
		/** 写环境方向缓存（非法输入忽略，不抛；成功写入同时解除缺席标记） */
		function setEnvOrientation(v) {
			try {
				const o = v && v.orientation;
				if (o !== "landscape" && o !== "portrait") return;
				envOrientation = {
					orientation: o,
					source: "system",
					updatedAt: Date.now()
				};
				envUnsupported = false;
			} catch (e) {}
		}
		/** 记桥缺席（本会话跳过推测性查询；已缓存的值一并作废，避免拿 stale 冒充现值） */
		function markEnvUnsupported() {
			envUnsupported = true;
			envOrientation = null;
		}
		/** 预热在途（同刻只发一次；查询期间不重复打桥） */
		let envWarmInFlight = null;
		/**
		* 刷新环境方向缓存（#110 陈旧值修复，2026-10-03）。
		*
		* 为什么必须有这个：缓存是内存态、无 TTL，而唯一的读取方（远程大面板）按设计永不碰桥——
		* 于是「谁负责刷新」全落在外部动作上。原先只有设置页挂载会问一次，于是有两种坏结局：
		* 1. 用户不进设置页就开远程 → `auto` 只能回落视口比例（桌面浏览器视口恒定一个形状，等于没有信号）；
		* 2. 更糟的是沿用上一次缓存下来的旧值——系统后来转过了，插件仍按旧值显示、并把它标成「整机」，
		*    那是**在说谎**，比回落更伤信任（用户原话：「进入远程模式就自动选择的是竖屏，感觉好奇怪」）。
		*
		* 故把刷新钉在两个用户动作上：**开启远程模式**、**插件启动且远程已开**（刷新/崩溃恢复后重进）。
		* 两者都只读不写、零 OS 副作用、不闪屏。
		*
		* query 由调用方注入（与 systemOrientation 的 fetch 注入同体例）：本模块不引依赖，仍是零 import 叶子。
		* 缺席负缓存语义不变——桥确认 unsupported 后本会话不再做推测性查询。
		*/
		function warmEnvOrientation(query) {
			if (envWarmInFlight) return envWarmInFlight;
			if (typeof query !== "function") return Promise.resolve();
			if (envUnsupported) return Promise.resolve();
			envWarmInFlight = (async () => {
				try {
					const r = await query();
					if (r && r.ok === true && (r.orientation === "landscape" || r.orientation === "portrait")) {
						setEnvOrientation({ orientation: r.orientation });
						notifyRemote();
						return;
					}
					if (r && r.error && r.error.code === "unsupported") markEnvUnsupported();
				} catch (e) {}
			})().finally(() => {
				envWarmInFlight = null;
			});
			return envWarmInFlight;
		}
		function notifyRemote() {
			listeners$1.forEach((fn) => {
				try {
					fn();
				} catch (e) {}
			});
		}
		/** 订阅远程偏好变更（React 侧用 effect 订阅；返回取消函数） */
		function subscribeRemote(fn) {
			listeners$1.add(fn);
			return () => {
				listeners$1.delete(fn);
			};
		}
		/** 同步读（内存真相来源；初始默认 = 直接切换语义） */
		function getRemotePrefs() {
			return { ...cache };
		}
		/** 持久化失败状态（当次有效、下次恢复默认并明示 → UI 据此展示明示行） */
		function getRemotePersistState() {
			return {
				failed: persistFailed,
				message: persistMessage
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
		/** 拉取 host 快照并装入缓存（失败 → 恢复默认 + 明示，不读 localStorage，不静默） */
		function ensureRemoteLoaded() {
			if (remoteLoaded) return Promise.resolve();
			if (loadPromise) return loadPromise;
			loadPromise = (async () => {
				const startedAt = Date.now();
				const data = await fetchJSON(STORE_URL);
				if (data && data.ok && data.value) {
					const v = data.value;
					const raw = v.remote !== void 0 ? v.remote : v.global;
					if (raw !== void 0) {
						cache = normalizeRemotePrefs(raw.enabled !== void 0 ? raw : {
							enabled: raw.remoteEnabled,
							font: raw.remoteFont,
							control: raw.remoteControl,
							orientation: raw.remoteOrientation !== void 0 ? raw.remoteOrientation : raw.orientation,
							density: raw.remoteDensity !== void 0 ? raw.remoteDensity : raw.density
						});
						persistFailed = false;
						persistMessage = "";
						purgeLegacySnapshot();
						logEvent$4("store.snapshot.ok", {
							customs: 0,
							pinned: 0,
							latencyMs: Date.now() - startedAt
						});
					} else cache = { ...REMOTE_DEFAULTS };
				} else {
					cache = { ...REMOTE_DEFAULTS };
					persistFailed = true;
					persistMessage = "remote-load-fail";
					logEvent$4("store.snapshot.fail", {
						reason: "remote-unreachable",
						latencyMs: Date.now() - startedAt
					});
					if (!loadRetried) {
						loadRetried = true;
						try {
							if (typeof setTimeout === "function") {
								const tid = setTimeout(() => {
									loadPromise = null;
									remoteLoaded = false;
									ensureRemoteLoaded().catch(() => void 0);
								}, 2500);
								try {
									if (tid && typeof tid.unref === "function") tid.unref();
								} catch (e) {}
							}
						} catch (e) {}
					}
				}
				remoteLoaded = true;
				notifyRemote();
			})().finally(() => {});
			return loadPromise;
		}
		/** fire-and-forget 落盘（失败记事件 + 置明示位，不回滚内存） */
		function persistRemote() {
			try {
				if (typeof fetch === "undefined") {
					persistFailed = true;
					persistMessage = "no-fetch";
					notifyRemote();
					return;
				}
				fetch(SET_URL, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						enabled: cache.enabled,
						size: cache.size,
						orientation: cache.orientation,
						density: cache.density
					})
				}).then(async (res) => {
					if (!res.ok) {
						persistFailed = true;
						persistMessage = "host-" + res.status;
						logEvent$4("store.persist.fail", {
							route: ROUTE_NAME,
							errorHash: "http-" + res.status
						});
						notifyRemote();
						return;
					}
					try {
						const data = await res.json();
						if (!data || data.ok !== true) {
							persistFailed = true;
							persistMessage = "host-rejected";
							logEvent$4("store.persist.fail", {
								route: ROUTE_NAME,
								errorHash: "rejected"
							});
							notifyRemote();
							return;
						}
					} catch (e) {}
					persistFailed = false;
					persistMessage = "";
					notifyRemote();
				}, (e) => {
					persistFailed = true;
					persistMessage = "unreachable";
					logEvent$4("store.persist.fail", {
						route: ROUTE_NAME,
						errorHash: String(e && e.message || e)
					});
					notifyRemote();
				});
			} catch (e) {}
		}
		function applyPatch(patch) {
			const next = normalizeRemotePrefs({
				...cache,
				...patch
			});
			cache = next;
			persistRemote();
			notifyRemote();
			return { ...next };
		}
		/** 总闸：开/关（开=大、关=小；不许大/小直接互切由调用方保证——本函数只做二值切换）
		* #110 改判：进出只翻 enabled 一个键，**不碰方向**。
		* 会话内选的方向（插件偏好与整机屏幕）退出后原样保持，用户锁定的优先级高于「回到进入前」。 */
		function setRemoteEnabled(on) {
			const next = applyPatch({ enabled: !!on });
			logEvent$4("settings.remote.toggle", {
				on: next.enabled,
				size: next.size
			});
			return { ...next };
		}
		/**
		* 跨插件页内 API（#93）：globalThis.__dshPromptSetRemote 的实现本体。
		*
		* - 入参：boolean 或 { enabled: boolean }；其余键一律忽略（只动总闸；
		*   size / orientation / density 请走跨插件 HTTP API：POST /_dsh/dsh-prompt/remote/set）。
		* - 路径：复用 setRemoteEnabled（内为 normalizeRemotePrefs→applyPatch→既有订阅通知），
		*   事件沿用既有 settings.remote.toggle，无新事件名。
		* - 并发：多写 last-write-wins（后写覆盖先写，无锁；与 host 侧 storage-json 双写语义一致）。
		* - 无鉴权立场：UI 偏好低风险，仅靠页内同源 + host 侧同源围栏，不另加 token（见 lib/index.js）。
		*/
		function setRemoteFromExternal(input) {
			let on;
			if (typeof input === "boolean") on = input;
			else if (input && typeof input === "object" && typeof input.enabled === "boolean") on = input.enabled;
			else return { ...cache };
			if (on === void 0) return { ...cache };
			return setRemoteEnabled(on);
		}
		try {
			globalThis.__dshPromptSetRemote = setRemoteFromExternal;
		} catch (e) {}
		/** 统一大小 1–10 档（越界钳制取整；非法输入拒绝） */
		function setRemoteSize(n) {
			const v = typeof n === "number" && isFinite(n) ? Math.min(10, Math.max(1, Math.round(n))) : NaN;
			if (!isRemoteSize(v)) return { ...cache };
			const next = applyPatch({ size: v });
			logEvent$4("settings.remote.size", {
				on: next.enabled,
				size: next.size
			});
			return { ...next };
		}
		/** 方向偏好（自动/横屏锁定/竖屏锁定三档，纯插件，持久化；覆盖视口推导） */
		function setRemoteOrientation(pref) {
			if (!isRemoteOrientationPref(pref)) return { ...cache };
			const next = applyPatch({ orientation: pref });
			logEvent$4("settings.remote.orientation", {
				on: next.enabled,
				orientation: next.orientation
			});
			return { ...next };
		}
		/** 密度档（#90）：两段手动切换，默认 A；非法拒绝（原值不动，不落盘不记事件）；切档页码归零由调用方执行 */
		function setRemoteDensity(d) {
			if (!isRemoteDensity(d)) return { ...cache };
			const next = applyPatch({ density: d });
			logEvent$4("settings.remote.density", {
				on: next.enabled,
				density: next.density
			});
			return { ...next };
		}
		/** 记一条日志事件（槽机制与 store.ts/settings.ts 同构；能力缺席时空操作） */
		function logEvent$4(event, fields) {
			try {
				const log = globalThis.__dshPromptLog;
				if (log && typeof log.log === "function") log.log(event, fields);
			} catch (e) {}
		}
		//#endregion
		//#region src/client/remoteView.ts
		/**
		* 解析有效方向（#110 检测统一，纯函数）：
		* 显式偏好赢；auto 取环境方向缓存（整机桥已知值）；缓存缺席/非法回落视口推导。
		* 调用方传已算好的视口方向（面板侧用监听值、设置页用现算值），本函数只做优先级裁决。
		*/
		function resolveEffectiveOrientation(pref, env, viewport) {
			try {
				if (pref === "landscape" || pref === "portrait") return pref;
				if (env === "landscape" || env === "portrait") return env;
				if (viewport === "landscape" || viewport === "portrait") return viewport;
				return "landscape";
			} catch (e) {
				return "landscape";
			}
		}
		/** 密度归一化：非法/缺键回默认 A（纯函数，不抛） */
		function normalizeRemoteDensity(v) {
			return v === "b" ? "b" : "a";
		}
		/** 密度→每页槽位数：A=12，B=8（纯函数） */
		function remotePageSizeFor(density) {
			return normalizeRemoteDensity(density) === "b" ? 8 : 12;
		}
		/** 横屏列数（A 横 4×3 / 竖 3×4；B 横 4×2 / 竖 2×4；缺省 A 现状值） */
		function remoteColsFor(orientation, density = "a") {
			if (normalizeRemoteDensity(density) === "b") return orientation === "portrait" ? 2 : 4;
			return orientation === "portrait" ? 3 : 4;
		}
		/** 行数（A 横 3 / 竖 4；B 横 2 / 竖 4；缺省 A 现状值） */
		function remoteRowsFor(orientation, density = "a") {
			if (normalizeRemoteDensity(density) === "b") return orientation === "portrait" ? 4 : 2;
			return orientation === "portrait" ? 4 : 3;
		}
		/**
		* 按视口比例自适应切方向（恒开、零宿主依赖）：
		* 宽不小于高即横屏，否则竖屏；非法输入回横屏（调用方兜底，不抛）。
		*/
		function deriveRemoteOrientation(width, height) {
			try {
				const w = typeof width === "number" ? width : NaN;
				const hgt = typeof height === "number" ? height : NaN;
				if (!isFinite(w) || !isFinite(hgt) || w <= 0 || hgt <= 0) return "landscape";
				return w >= hgt ? "landscape" : "portrait";
			} catch (e) {
				return "landscape";
			}
		}
		/**
		* 统一大小倍数表（2026-10-03 用户拍板改步进）：1 档=100%，之后每档 +50%，
		* 即 100 / 150 / 200 / 250 / 300 / 350 / 400 / 450 / 500 / 550，等距步进、档档手感一致。
		* 原为 +25% 步进、上限 325%（2026-09-29 两次调优收敛）；远程诉求是「拿远了也点得中、看得清」，
		* 后半段 25% 的增量在串流画面下与前一段手感几乎无差、顶到 325% 仍不够大，故步进加粗一倍。
		*/
		const REMOTE_SIZE_SCALES = [
			1,
			1.5,
			2,
			2.5,
			3,
			3.5,
			4,
			4.5,
			5,
			5.5
		];
		/** 档位→倍数：非法回默认 5 档（3x） */
		function remoteSizeScale(size) {
			const v = typeof size === "number" && isFinite(size) ? Math.min(10, Math.max(1, Math.round(size))) : NaN;
			return REMOTE_SIZE_SCALES[(v >= 1 && v <= 10 ? v : 5) - 1];
		}
		/** 宿主基准字号变量（缩放根的唯一锚点；各调用方不得另起第二套基准） */
		const BASE_FONT_VAR = "var(--dsw-font-markdown-base-font-size)";
		/**
		* 缩放根收敛点（#116，不计成本的一致性收敛；纯函数，可转译断言）：
		* 开吃全额 calc(宿主基准变量 * 档位倍数)、关回基准变量。各调用方只传开关与档位，
		* 不手写表达式，防多处拷贝漂移。注意：设置页子树内必须用宿主变量基重算，
		* 禁用 `1em` 基——`1em` 在缩放祖先里会复乘（double-scale）。
		*/
		function scaledBaseFontSize(enabled, size) {
			if (enabled !== true) return BASE_FONT_VAR;
			return "calc(var(--dsw-font-markdown-base-font-size) * " + remoteSizeScale(size) + ")";
		}
		/**
		* 控制面倍数（2026-09-29 晚用户拍板去封顶：档位自由变大——入口/齿轮/智能卡跟内容面吃同一全额，
		* 不再另设更小的封顶（2026-10-03 步进加粗后 10 档为 5.5x）；小窗挤爆风险由用户认）。
		*/
		function remoteChromeScale(size) {
			return remoteSizeScale(size);
		}
		/**
		* 宿主内容字 px（#92 野路子，纯函数）：
		* round(remoteSizeScale(size) * 14)，非法（非有限数值）回 14（宿主默认内容字号）。
		* 只返数值、不拼单位、不碰 DOM（落点/单位拼接归 hostfont.ts）。
		*/
		function hostContentFontPx(size) {
			try {
				if (typeof size !== "number" || !isFinite(size)) return 14;
				return Math.round(remoteSizeScale(size) * 14);
			} catch (e) {
				return 14;
			}
		}
		/** 页码归一化（NaN/越界钳制，不抛） */
		function normalizeRemotePage(page, totalPages) {
			const total = typeof totalPages === "number" && isFinite(totalPages) && totalPages > 0 ? Math.floor(totalPages) : 1;
			const p = typeof page === "number" && isFinite(page) ? Math.floor(page) : 0;
			if (p < 0) return 0;
			if (p > total - 1) return total - 1;
			return p;
		}
		/**
		* 十二槽分页（纯函数，bottom-up 首屏语义）：
		* - 每页恒十二槽，不满补空位；页码越界钳制；空输入仍给一页全空位（高度稳定）。
		* - 不减行：行列只由方向决定，与内容多少、视口大小无关。
		* - 首屏即最常用（2026-09-29 用户拍板）：输入为 bottom-up 升序（最常用在末尾），
		*   页码从最重要一端取——page=0 取末尾 per 条，页内保持升序（最重要在该页底部）；
		*   不满页空位补在顶部（内容贴底，高度稳定）。
		*/
		function computeRemoteView(input) {
			const orientation = input.orientation === "portrait" ? "portrait" : "landscape";
			const density = normalizeRemoteDensity(input.density);
			const cols = remoteColsFor(orientation, density);
			const rows = remoteRowsFor(orientation, density);
			const per = remotePageSizeFor(density);
			const ids = Array.isArray(input.ids) ? input.ids.filter((x) => typeof x === "string") : [];
			const total = ids.length;
			const totalPages = Math.max(1, Math.ceil(total / per));
			const page = normalizeRemotePage(input.page, totalPages);
			const end = Math.max(0, total - page * per);
			const start = Math.max(0, end - per);
			const slice = ids.slice(start, end);
			const emptiesCount = per - slice.length;
			const slots = [];
			for (let i = 0; i < per; i++) if (i < emptiesCount) slots.push({
				kind: "empty",
				order: i
			});
			else slots.push({
				kind: "template",
				order: i,
				id: slice[i - emptiesCount]
			});
			const sizeScale = remoteSizeScale(input.enabled ? input.size : 1);
			input.hostCaps;
			return {
				orientation,
				cols,
				rows,
				per,
				total,
				totalPages,
				page,
				slots,
				cards: slice.length,
				empties: per - slice.length,
				bottomBar: {
					hasPrev: page > 0,
					hasNext: page < totalPages - 1,
					pageText: String(page + 1) + "/" + String(totalPages),
					searchOpen: !!input.searchOpen
				},
				fontScale: sizeScale,
				controlScale: sizeScale,
				threshold: {
					masterEnabled: !!input.enabled,
					hostPending: false,
					hostNote: ""
				}
			};
		}
		/**
		* 远程标签域（收敛，不另起第二套筛选）：
		* - 只留 [全部] + 在用动态词单选；预置 / 自定义二分在远程合并（调用方用 matchLabel 单选包含，跨内置自建）。
		* - 在用动态词 = 调用方传入的 allKnownLabels() 经与悬浮云同一套去留过滤；自定义新词天然在内（平权）。
		* - 本函数只做去留与排序（预置行动词首现序 + 自定义追加由调用方保序传入），不做匹配。
		*/
		const REMOTE_TAG_EXCLUDE_LIST = [
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
		/** 远程标签选项：[全部] + 过滤后的在用动态词（保序） */
		function remoteTagOptions(allLabels) {
			const seen = /* @__PURE__ */ new Set();
			const out = [];
			const push = (l) => {
				if (!l || seen.has(l)) return;
				seen.add(l);
				out.push(l);
			};
			for (const l of Array.isArray(allLabels) ? allLabels : []) {
				if (typeof l !== "string" || !l) continue;
				if (REMOTE_TAG_EXCLUDE_LIST.indexOf(l) >= 0) continue;
				push(l);
			}
			return ["全部", ...out];
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
			templatesToggleHint: {
				zh: "点击展开/收起模板列表",
				en: "Click to expand or collapse the template list"
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
				zh: "复制",
				en: "Copy"
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
			labelPicker: {
				zh: "标签选择",
				en: "Pick tags"
			},
			labelDone: {
				zh: "完成",
				en: "Done"
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
			logToggle: {
				zh: "调试日志",
				en: "Debug log"
			},
			logToggleHint: {
				zh: "关闭只停信息与调试两级，错误与告警始终记录。",
				en: "Off stops only info and debug; errors and warnings are always recorded."
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
			remoteGroup: {
				zh: "远程模式-配合网易UU远程等手机App",
				en: "Remote mode"
			},
			remoteToggle: {
				zh: "远程模式-配合网易UU远程等手机App",
				en: "Remote mode"
			},
			remoteSize: {
				zh: "大小",
				en: "Size"
			},
			remoteSizeMin: {
				zh: "1档",
				en: "1"
			},
			remoteSizeMax: {
				zh: "10档",
				en: "10"
			},
			remotePersistFail: {
				zh: "持久化失败：本次选择当次有效，下次恢复默认并请重试。",
				en: "Persist failed: this choice works for now, defaults return next time — please retry."
			},
			remoteOrientation: {
				zh: "方向偏好",
				en: "Orientation"
			},
			remoteOrientationHint: {
				zh: "自动跟整机方向，无桥时跟视口；锁定先切整机方向，失败只锁自家布局。",
				en: "Auto follows the system display, falling back to viewport without a bridge; a lock tries the system display first, falling back to our own layout."
			},
			remoteOrientationAuto: {
				zh: "自动",
				en: "Auto"
			},
			remoteOrientationLandscape: {
				zh: "横屏",
				en: "Landscape"
			},
			remoteOrientationPortrait: {
				zh: "竖屏",
				en: "Portrait"
			},
			remoteOrientationBusy: {
				zh: "正在切换整机方向…",
				en: "Switching system orientation…"
			},
			remoteOrientationOsFail: {
				zh: "整机未改变，已锁定自家布局（原因：{code}）。",
				en: "System display unchanged; own layout locked (reason: {code})."
			},
			remoteNeedOn: {
				zh: "需先开启远程模式",
				en: "Turn on remote mode first"
			},
			remoteEffectiveNow: {
				zh: "当前：{orient}（{source}）",
				en: "Now: {orient} ({source})"
			},
			remoteSourceSystem: {
				zh: "整机",
				en: "system display"
			},
			remoteSourceViewport: {
				zh: "视口",
				en: "viewport"
			},
			remoteLockedOrientation: {
				zh: "锁定为{orient}",
				en: "Locked to {orient}"
			},
			remoteDensity: {
				zh: "宫格密度",
				en: "Grid density"
			},
			remoteDensityA: {
				zh: "12宫格",
				en: "12"
			},
			remoteDensityB: {
				zh: "8宫格",
				en: "8 large"
			},
			remoteHostPending: {
				zh: "整机待宿主",
				en: "Waiting on host"
			},
			remoteSystemOrientation: {
				zh: "整机跟手转（需宿主 H1）",
				en: "Rotate whole system (needs host H1)"
			},
			remoteSystemOrientationHint: {
				zh: "宿主支持时一键切外部系统横竖屏；缺席只灰这一行，总闸照常可用。",
				en: "One tap rotates the outside system when the host supports it; when absent only this row is greyed and the master switch still works."
			},
			remoteSystemFont: {
				zh: "整机字号跟随（需宿主 H2）",
				en: "System font follow (needs host H2)"
			},
			remoteSystemFontHint: {
				zh: "宿主支持时整机字号一起走；缺席先放大自家面并明示。",
				en: "The whole system follows when the host supports it; when absent our own surface still enlarges."
			},
			remoteConfigKey: {
				zh: "远程设置",
				en: "Remote settings"
			},
			remoteConfigKeyFallbackHint: {
				zh: "打开设置页远程段",
				en: "Opens the settings remote section"
			},
			sidebarExpand: {
				zh: "展开右侧边栏",
				en: "Expand right sidebar"
			},
			sidebarCollapse: {
				zh: "折叠右侧边栏",
				en: "Collapse right sidebar"
			},
			dockCollapse: {
				zh: "收起工具条",
				en: "Collapse toolbar"
			},
			dockExpand: {
				zh: "展开工具条",
				en: "Expand toolbar"
			},
			workspaceLeftExpand: {
				zh: "展开左侧工作区",
				en: "Expand left workspace"
			},
			workspaceLeftCollapse: {
				zh: "折叠左侧工作区",
				en: "Collapse left workspace"
			},
			workspacePicker: {
				zh: "选择会话",
				en: "Pick session"
			},
			pickerSearch: {
				zh: "搜索：标题 + 工作区名…",
				en: "Search: title + workspace…"
			},
			pickerLoading: {
				zh: "加载中…",
				en: "Loading…"
			},
			pickerCancel: {
				zh: "取消等待",
				en: "Cancel"
			},
			pickerRetry: {
				zh: "整面重试",
				en: "Retry"
			},
			pickerEmpty: {
				zh: "真无会话：当前没有任何可用会话",
				en: "No sessions available"
			},
			pickerEmptySearch: {
				zh: "搜无结果：换个关键词（不回退全量）",
				en: "No matches — try another keyword"
			},
			pickerProbeFail: {
				zh: "探测缺席：宿主机会面不可用，原地重试",
				en: "Host surface unavailable — retry here"
			},
			pickerSwitchFail: {
				zh: "切换失败：留屏，可原地重试",
				en: "Switch failed — retry here"
			},
			pickerSwitchFailBadge: {
				zh: "切换失败",
				en: "Failed"
			},
			pickerSwitching: {
				zh: "正在切换",
				en: "Switching"
			},
			pickerCurrent: {
				zh: "当前",
				en: "Current"
			},
			pickerBlank: {
				zh: "空白",
				en: "Blank"
			},
			pickerUntitled: {
				zh: "（空白会话）",
				en: "(Blank session)"
			},
			pickerUngrouped: {
				zh: "未归属",
				en: "Ungrouped"
			},
			pickerUnassignedShort: {
				zh: "散",
				en: "misc"
			},
			pickerWorkspaces: {
				zh: "工作区",
				en: "Workspaces"
			},
			pickerSessions: {
				zh: "会话",
				en: "Sessions"
			},
			pickerPrev: {
				zh: "上一页",
				en: "Previous"
			},
			pickerNext: {
				zh: "下一页",
				en: "Next"
			},
			pickerOpBar: {
				zh: "翻页与关闭",
				en: "Paging and close"
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
		/** #76：挂输入区事件监听（focusin 记最后摸过的框、selectionchange 采落点）。
		*  插件启动即调用一次 —— 采样必须早于用户打字。 */
		function armInputFocusTrack() {
			try {
				const doc = typeof document !== "undefined" ? document : null;
				if (focusTrackArmed && armedDoc === doc) return;
				focusTrackArmed = true;
				armedDoc = doc;
				if (doc && typeof doc.addEventListener === "function") {
					doc.addEventListener("focusin", (e) => {
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
							sampleCaret();
						} catch (err) {}
					}, true);
					doc.addEventListener("selectionchange", () => {
						sampleCaret();
					});
				}
				sampleCaret();
			} catch (err) {}
		}
		let caretSample = null;
		/** 作曲家是否持有焦点（根自身或根内元素是 activeElement）。 */
		function composerFocused(root) {
			try {
				if (typeof document === "undefined" || !root) return false;
				const ae = document.activeElement;
				if (!ae) return false;
				if (ae === root) return true;
				try {
					return !!(root.contains && root.contains(ae));
				} catch (e) {
					return false;
				}
			} catch (e) {
				return false;
			}
		}
		/** 采样一次落点。只在作曲家持有焦点时写 —— 失焦后选择可能已被归一化，
		*  那种值不是"用户意图"，不能覆盖编辑期的采样。
		*  先做 O(1) 预检再查 DOM：selectionchange 是全页级的，页面里任何输入框动光标都会触发，
		*  热点路径上不能每次都去 querySelectorAll。 */
		function sampleCaret() {
			try {
				if (typeof document === "undefined") return;
				const ae = document.activeElement;
				if (!ae) return;
				let editable = false;
				try {
					editable = ae.isContentEditable === true;
				} catch (e) {
					editable = false;
				}
				if (!editable) try {
					editable = !!(ae.getAttribute && ae.getAttribute("contenteditable") === "true");
				} catch (e) {
					editable = false;
				}
				if (!editable) return;
				for (const r of composerRoots()) {
					if (!composerFocused(r)) continue;
					const read = readEditable(r);
					caretSample = {
						root: r,
						text: read.text,
						caret: read.caret
					};
					return;
				}
			} catch (e) {}
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
		/** 把 caret（from 里的下标）映射到 to 里的同义位置。
		*  两份草稿的可见字符完全一致（调用方已保证），差异只在换行 —— 落点靠两件事定位：
		*  1) 光标前有多少个可见字符（唯一的锚点）；
		*  2) 光标相对换行的侧向：紧跟着一个可见字符 ⇒ 落点属于"那一行"，目标处整段跨过换行，
		*     别停在空行上；否则（光标后面是换行/文末）⇒ 只按左侧已有的换行数跨，保住"行尾"语义。
		*  from === to 时是恒等映射。 */
		function mapCaret(from, caret, to) {
			const end = Math.max(0, Math.min(caret, from.length));
			let visible = 0;
			let newlinesBefore = 0;
			for (let i = 0; i < end; i++) if (from.charCodeAt(i) === 10) newlinesBefore++;
			else {
				visible++;
				newlinesBefore = 0;
			}
			const beforeVisible = end < from.length && from.charCodeAt(end) !== 10;
			let j = 0;
			let seen = 0;
			while (j < to.length && seen < visible) if (to.charCodeAt(j) === 10) j++;
			else {
				seen++;
				j++;
			}
			let run = 0;
			while (j + run < to.length && to.charCodeAt(j + run) === 10) run++;
			return Math.max(0, Math.min(j + (beforeVisible ? run : Math.min(newlinesBefore, run)), to.length));
		}
		/** 读一个可编辑根的纯文本与活光标（同一套块映射，文本与光标同源，绝不错位）。
		* 文本≈宿主 clipboardText（段落↔\n，空段落即空行）；光标=当前 selection 锚点，无选择即末尾。
		* 元素锚点按宿主自己的规则解：offset 是该元素子节点下标 —— 越过末子节点 → 元素末尾，
		* 否则 → 该子节点的起点（#76；旧实现"取首个 run 的起或末"会把块边界的落点翻到上一行）。 */
		function readEditable(root) {
			let text = "";
			try {
				const runs = [];
				const bounds = /* @__PURE__ */ new Map();
				const childStart = /* @__PURE__ */ new Map();
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
				const elementKids = (el) => {
					try {
						return el && el.childNodes ? Array.prototype.slice.call(el.childNodes) : [];
					} catch (e) {
						return [];
					}
				};
				if (!kids.some((k) => k && k.nodeType === 1)) pushRun(root.textContent || "", null);
				else {
					const sep = () => {
						if (text.length === 0) return;
						if (text.charCodeAt(text.length - 1) !== 10) text += "\n";
					};
					const forceBreak = () => {
						if (text.length === 0) return;
						text += "\n";
					};
					/** 走一个元素节点：记 bounds 与 childStart，再递归其子节点。 */
					const walkElement = (el) => {
						const tag = String(el && el.tagName || "").toUpperCase();
						const ch = elementKids(el);
						if (BLOCK_TAGS[tag] === 1) {
							sep();
							const start = text.length;
							childStart.set(el, start);
							for (const c of ch) walkNode(c);
							bounds.set(el, {
								start,
								end: text.length
							});
							if (text.length === start) forceBreak();
						} else if (ch.length === 0) try {
							pushRun(el.textContent || "", el);
						} catch (e) {}
						else {
							childStart.set(el, text.length);
							for (const c of ch) walkNode(c);
						}
					};
					const walkNode = (k) => {
						if (!k) return;
						if (k.nodeType === 3) {
							childStart.set(k, text.length);
							pushRun(k.nodeValue || "", k);
							return;
						}
						if (k.nodeType !== 1) return;
						if (String(k.tagName || "").toUpperCase() === "BR") {
							childStart.set(k, text.length);
							forceBreak();
							return;
						}
						walkElement(k);
					};
					for (const c of kids) walkNode(c);
					bounds.set(root, {
						start: 0,
						end: text.length
					});
					text = text.replace(/\n+$/, "");
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
							const hit = anchorToOffset(an, sel && typeof sel.anchorOffset === "number" ? sel.anchorOffset : 0);
							if (typeof hit === "number" && hit >= 0) caret = hit;
						}
					}
					function anchorToOffset(an, ao) {
						if (an && an.nodeType === 3) {
							for (const r of runs) if (r.node === an) return r.start + Math.max(0, Math.min(ao, r.len));
							return -1;
						}
						const b = bounds.get(an);
						if (b) {
							const ch = elementKids(an);
							if (ao >= ch.length) return b.end;
							const cs = childStart.get(ch[ao]);
							if (typeof cs === "number" && cs >= 0) return cs;
							return b.end;
						}
						for (const r of runs) if (r.node === an) return ao > 0 ? r.start + r.len : r.start;
						for (const r of runs) try {
							if (an && an.contains && an.contains(r.node)) return ao > 0 ? r.start + r.len : r.start;
						} catch (e) {}
						return -1;
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
			sampleCaret();
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
		/** 决议当前草稿与插入点（#61 真修复 + #76 落点与换行保真）。
		*  H=宿主模型草稿（render 内订阅，宿主自己的 clipboard 投影），D=点击瞬间的 DOM 活读。
		*  文本：#76 —— 可见字符一致、只有换行形态有别时，信 H。理由在宿主源码里：setDraft 按 \n
		*  切段、段间补一个 \n，模型才是行结构的真值；DOM 只是渲染表象（空块、装饰器、末尾 BR
		*  都可能凭空多出或吞掉换行）。真机日志实证过 H 与 D 长度分歧（D 少 1–9 字符）。
		*  落点：作曲家持焦点 → 活读（看得见的）；已失焦 → 编辑期采样（selectionchange 留下）；
		*  都没有 → 活读兜底。真机实证失焦后选择会被归一化到上一行末尾，字就插错了行。 */
		function resolveDraft() {
			const norm = (s) => (s || "").replace(/\r\n?/g, "\n");
			const H = norm(tapDraft);
			const root = pickEditable();
			if (root) {
				let d = "";
				let live = -1;
				try {
					const r = readEditable(root);
					d = norm(r.text);
					live = Math.max(0, Math.min(r.caret, d.length));
				} catch (e) {}
				let caret = live;
				let caretSrc = composerFocused(root) ? "live" : "live-blur";
				if (live < 0) {
					caret = d.length;
					caretSrc = "end";
				}
				if (!composerFocused(root) && caretSample && caretSample.root === root) {
					caret = mapCaret(norm(caretSample.text), caretSample.caret, d || norm(caretSample.text));
					caretSrc = "sample";
				}
				if (!d) {
					if (H) return {
						text: H,
						caret: H.length,
						caretSrc: "end"
					};
					return {
						text: "",
						caret: 0,
						caretSrc
					};
				}
				if (!H) return {
					text: d,
					caret,
					caretSrc
				};
				if (H === d) return {
					text: H,
					caret,
					caretSrc
				};
				if (CHIP_RE.test(H)) return {
					text: H,
					caret: H.length,
					caretSrc: "end"
				};
				if (H.replace(/\n/g, "") === d.replace(/\n/g, "")) return {
					text: H,
					caret: mapCaret(d, caret, H),
					caretSrc
				};
				return {
					text: d,
					caret,
					caretSrc
				};
			}
			if (H) return {
				text: H,
				caret: H.length,
				caretSrc: "end"
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
								caret: p,
								caretSrc: "legacy"
							};
						}
					}
				}
			} catch (e) {}
			return {
				text: "",
				caret: 0,
				caretSrc: "none"
			};
		}
		/** 上一次决议的落点诊断（只记数字与来源枚举，不记正文）：供 pick.insert 落盘。
		*  模块级暂存是刻意的诊断槽（同文件 tapDraft / lastFocusEl 同款）—— insertBody 的返回值
		*  被既有调用点与回归当作"插入前草稿长度"用，不能改签名去顺带回传这份诊断。 */
		let lastInsertProbe = {
			caret: 0,
			caretSrc: "none",
			draftLines: 0
		};
		/** 插入正文到当前草稿（光标处优先，否则末尾；不覆盖；自动聚焦）。返回插入前的草稿长度，供调用点记日志。
		* 注意：宿主 setDraft 语义是全文替换且光标置尾（无光标级写入 API），中部插入后光标回尾是宿主行为，
		* 不是本函数能定的；验收“光标在插入文本后”在尾插时精确成立。
		* useInput 只为兼容旧签名保留：真正的桥订阅在 render 内的 DraftTap，事件回调里不再碰它（Q3）。 */
		function insertBody(useInput, inputActions, body) {
			armInputFocusTrack();
			const r = resolveDraft();
			const draft = r.text;
			const pos = Math.max(0, Math.min(r.caret, draft.length));
			lastInsertProbe = {
				caret: pos,
				caretSrc: r.caretSrc,
				draftLines: draft.length === 0 ? 0 : draft.split("\n").length
			};
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
		* #61：无写入能力（设置页纯管理面不传输入桥）时直接返回 —— 不插入、不涨用量、不记事件。
		* #76：多记落点与落点来源（纯数字与枚举），真机再报错位时能一眼看出是活读、采样还是兜底。 */
		function onPick(t, useInput, inputActions) {
			if (!inputActions || typeof inputActions.setDraft !== "function") return;
			pickProbe(useInput, inputActions);
			const draftChars = insertBody(useInput, inputActions, t.body);
			logEvent$3("pick.insert", {
				source: "panel",
				templateKind: t.builtin ? "preset" : "custom",
				idHash: t.id,
				draftChars,
				caret: lastInsertProbe.caret,
				caretSrc: lastInsertProbe.caretSrc,
				draftLines: lastInsertProbe.draftLines
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
			background: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
			backgroundColor: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
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
			const uiScale = remoteSizeScale(getRemotePrefs().enabled ? getRemotePrefs().size : 1);
			const cardStyleScaled = {
				...modalCardStyle,
				fontSize: "calc(1em * " + uiScale + ")"
			};
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
			const labelGridOn = getRemotePrefs().enabled;
			const labelPickerState = react.useState(false);
			const labelPickerOpen = labelPickerState[0];
			const labelGridStyle = {
				display: "grid",
				gridTemplateColumns: "repeat(auto-fill, minmax(4.5em, 1fr))",
				gap: "0.5em",
				marginTop: "0.75em"
			};
			const labelCellStyle = (on) => ({
				aspectRatio: "1 / 1",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				textAlign: "center",
				padding: "0.25em",
				borderRadius: "0.6em",
				cursor: "pointer",
				border: "thin solid var(--dsw-alias-border-l1)",
				overflow: "hidden",
				background: on ? "var(--dsw-specific-accent,#f0a45c)" : "transparent",
				color: on ? "#1a1a1e" : "var(--dsw-alias-label-primary)",
				fontFamily: "var(--dsw-font-family)",
				fontSize: "0.85em",
				fontWeight: on ? 700 : 500,
				lineHeight: 1.25,
				overflowWrap: "break-word"
			});
			const toggleGridLabel = (w) => {
				if (labels.indexOf(w) >= 0) setLabels(labels.filter((x) => x !== w));
				else setLabels(normalizeLabels([...labels, w]));
			};
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
			}, [h("div", { style: {
				...cardStyleScaled,
				width: labelGridOn ? "min(1440px, 96vw)" : "min(640px, 94vw)",
				maxHeight: labelGridOn ? "90vh" : "92vh",
				overflowY: "auto"
			} }, [
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
					list: labelGridOn ? void 0 : "dsh-prompt-labels"
				}),
				labelGridOn ? null : h("datalist", { id: "dsh-prompt-labels" }, known.map((w) => h("option", {
					key: w,
					value: w
				}))),
				labelGridOn ? h("button", {
					key: "label-picker",
					type: "button",
					style: {
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						width: "100%",
						marginTop: "0.5em",
						padding: "0.6em 0.75em",
						borderRadius: "0.6em",
						border: "thin solid var(--dsw-alias-border-l1)",
						background: "var(--dsw-alias-bg-layer-3)",
						color: "var(--dsw-alias-label-primary)",
						cursor: "pointer",
						fontFamily: "var(--dsw-font-family)",
						fontSize: "1em"
					},
					"data-dsh-prompt-label-picker": "1",
					"aria-haspopup": "true",
					"aria-expanded": labelPickerOpen ? "true" : "false",
					onClick: () => labelPickerState[1](true)
				}, [h("span", { key: "t" }, "🏷 " + props.t("labelPicker") + (labels.length > 0 ? " · " + labels.length : "")), h("span", {
					key: "c",
					style: { color: "var(--dsw-alias-label-tertiary)" }
				}, "▾")]) : null,
				labelGridOn && labelPickerOpen ? h(ModalPortal, { key: "label-grid-overlay" }, [h("div", {
					key: "label-grid-mask",
					style: {
						position: "fixed",
						inset: 0,
						background: "rgba(0,0,0,0.45)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						zIndex: MODAL_Z
					},
					"data-dsh-prompt-label-grid-mask": "1",
					onClick: (e) => {
						if (e.target === e.currentTarget) labelPickerState[1](false);
					}
				}, [h("div", {
					key: "label-grid-card",
					style: {
						width: "min(520px, 92vw)",
						maxHeight: "80vh",
						overflowY: "auto",
						background: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
						backgroundColor: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
						border: "1px solid var(--dsw-alias-border-inverted)",
						borderRadius: 12,
						padding: "0.9em",
						fontFamily: "var(--dsw-font-family)",
						color: "var(--dsw-alias-label-primary)"
					}
				}, [h("div", {
					key: "head",
					style: {
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: "0.5em"
					}
				}, [h("span", {
					key: "t",
					style: {
						fontSize: "1em",
						fontWeight: 700
					}
				}, "🏷 " + props.t("labelPicker")), h("span", {
					key: "btns",
					style: {
						display: "flex",
						gap: "0.5em"
					}
				}, [h("button", {
					key: "done",
					type: "button",
					style: modalBtn(true),
					onClick: () => labelPickerState[1](false)
				}, props.t("labelDone")), h("button", {
					key: "x",
					type: "button",
					style: modalBtn(),
					onClick: () => labelPickerState[1](false)
				}, "×")])]), h("div", {
					key: "grid",
					style: labelGridStyle,
					"data-dsh-prompt-label-grid": "1"
				}, known.map((w) => {
					const on = labels.indexOf(w) >= 0;
					return h("button", {
						key: w,
						type: "button",
						style: labelCellStyle(on),
						"data-dsh-prompt-label-cell": "1",
						"aria-pressed": on ? "true" : "false",
						title: w,
						onClick: () => toggleGridLabel(w)
					}, w);
				}))])])]) : null,
				h("div", { style: {
					fontSize: "0.85em",
					color: "var(--dsw-alias-label-tertiary)"
				} }, props.t("labelsHint")),
				h("textarea", {
					style: {
						...modalFieldStyle,
						height: labelGridOn ? 400 : 200,
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
			const uiScale = remoteSizeScale(getRemotePrefs().enabled ? getRemotePrefs().size : 1);
			const cardStyleScaled = {
				...modalCardStyle,
				fontSize: "calc(1em * " + uiScale + ")"
			};
			return h("div", {
				style: modalMaskStyle,
				"data-dsh-prompt-modal": "",
				onClick: (e) => {
					if (e.target === e.currentTarget) props.onCancel();
				}
			}, [h("div", { style: cardStyleScaled }, [
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
			/**
			* #77 设置页折叠（默认收起）：只渲染头行，列表整块不挂载。
			* 只认「compact 为假 + 调用方显式给了 collapsible」——悬浮面板永远是展开的，
			* 不传这个 prop 的挂载（含全部既有回归脚本）行为一字不动。
			*/
			const collapsible = !compact && !!props.collapsible;
			const listOpenState = react.useState(false);
			const listOpen = listOpenState[0];
			const showList = !collapsible || listOpen;
			const posState = react.useState(null);
			const pos = posState[0];
			const rootRef = react.useRef(null);
			const listRef = react.useRef(null);
			const highlightState = react.useState(null);
			const highlightId = highlightState[0];
			const hoverState = react.useState(null);
			const hoverId = hoverState[0];
			const pressedState = react.useState(null);
			const pressedId = pressedState[0];
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
			const remoteSelState = react.useState(null);
			const remoteSelected = remoteSelState[0];
			const remoteQState = react.useState("");
			const remoteQ = remoteQState[0];
			const remotePageState = react.useState(0);
			const remotePage = remotePageState[0];
			const remoteSearchState = react.useState(false);
			const remoteSearchOpen = remoteSearchState[0];
			const remoteFocusState = react.useState(false);
			const remoteSearchFocused = remoteFocusState[0];
			const remoteCompState = react.useState(false);
			const remoteComposing = remoteCompState[0];
			const orientState = react.useState("landscape");
			const remoteOrient = orientState[0];
			const remoteTickState = react.useState(0);
			remoteTickState[0];
			react.useEffect(() => {
				logEvent$3("panel.open", {
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
						logEvent$3("panel.position.fail", { attempts: tries });
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
				if (modal || searchFocused || composing || remoteSearchFocused || remoteComposing) setHoverCloseSuppressed(true);
				else setHoverCloseSuppressed(false);
				return () => {
					setHoverCloseSuppressed(false);
				};
			}, [
				compact,
				!!modal,
				searchFocused,
				composing,
				remoteSearchFocused,
				remoteComposing
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
			react.useEffect(() => {
				let on = true;
				try {
					ensureRemoteLoaded().then(() => {
						if (on) remoteTickState[1]((n) => n + 1);
					}, () => void 0);
				} catch (e) {}
				let off = null;
				try {
					off = subscribeRemote(() => {
						if (on) remoteTickState[1]((n) => n + 1);
					});
				} catch (e) {}
				return () => {
					on = false;
					try {
						if (off) off();
					} catch (e) {}
				};
			}, []);
			react.useEffect(() => {
				if (!compact) return;
				const update = () => {
					try {
						const w = globalThis.window;
						const iw = w && typeof w.innerWidth === "number" ? w.innerWidth : typeof window !== "undefined" ? window.innerWidth : void 0;
						const ih = w && typeof w.innerHeight === "number" ? w.innerHeight : typeof window !== "undefined" ? window.innerHeight : void 0;
						if (typeof iw === "number" && typeof ih === "number") orientState[1](deriveRemoteOrientation(iw, ih));
					} catch (e) {}
				};
				update();
				try {
					const w = globalThis.window;
					if (w && typeof w.addEventListener === "function") {
						w.addEventListener("resize", update);
						return () => {
							try {
								w.removeEventListener("resize", update);
							} catch (e) {}
						};
					}
					if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
						window.addEventListener("resize", update);
						return () => {
							try {
								window.removeEventListener("resize", update);
							} catch (e) {}
						};
					}
				} catch (e) {}
				return () => void 0;
			}, [compact]);
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
			const remotePrefs = getRemotePrefs();
			const isRemoteBig = compact && !!remotePrefs.enabled;
			const remoteOptions = remoteTagOptions(allKnownLabels());
			const remoteListBase = allTemplates().filter((x) => {
				if (remoteSelected === null) return true;
				return matchLabel(x, remoteSelected);
			});
			const remoteQl = remoteQ.trim().toLowerCase();
			const remoteSorted = sortedTemplatesBottomUp(remoteQl ? remoteListBase.filter((x) => templateHaystack(x).indexOf(remoteQl) >= 0) : remoteListBase);
			const remotePref = remotePrefs.orientation || "auto";
			let remoteEnv = null;
			try {
				const e = getEnvOrientation();
				remoteEnv = e ? e.orientation : null;
			} catch (err) {
				remoteEnv = null;
			}
			const remoteFinalOrient = resolveEffectiveOrientation(remotePref, remoteEnv, remoteOrient);
			const remoteView = computeRemoteView({
				ids: remoteSorted.map((x) => x.id),
				page: remotePage,
				orientation: remoteFinalOrient,
				enabled: !!remotePrefs.enabled,
				size: remotePrefs.size,
				hostCaps: {
					hasSystemOrientation: false,
					hasSystemFont: false,
					hasStableOpen: false
				},
				searchOpen: remoteSearchOpen,
				density: remotePrefs.density
			});
			const remoteDensity = normalizeRemoteDensity(remotePrefs.density);
			react.useEffect(() => {
				remotePageState[1](0);
			}, [remoteDensity]);
			const remoteById = new Map(remoteSorted.map((x) => [x.id, x]));
			const remoteUsage = loadUsage();
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
			const uiFontScale = remoteSizeScale(remotePrefs.enabled ? remotePrefs.size : 1);
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
				background: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
				backgroundColor: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
				border: "1px solid var(--dsw-alias-border-inverted)",
				borderRadius: 12,
				boxShadow: "var(--dsw-shadow-lv3)",
				overflow: "hidden",
				fontFamily: "var(--dsw-font-family)",
				fontSize: "calc(var(--dsw-font-markdown-base-font-size) * " + uiFontScale + ")",
				color: base
			} : {
				display: "flex",
				flexDirection: "column",
				gap: 6,
				padding: "6px 8px",
				fontFamily: "var(--dsw-font-family)",
				fontSize: scaledBaseFontSize(remotePrefs.enabled, remotePrefs.size),
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
				padding: compact ? "3px 6px" : "4px 2px",
				transition: "background-color .12s ease"
			};
			const ROW_HOVER_BG = "var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2, rgba(255,255,255,.06)))";
			const ROW_PRESSED_BG = "var(--dsw-alias-interactive-bg-active, var(--dsw-alias-bg-layer-3))";
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
			if (isRemoteBig) {
				const remoteCols = remoteView.cols;
				const remoteRows = remoteView.rows;
				const remoteFontScale = remoteView.fontScale;
				remoteView.controlScale;
				const remoteThin = "thin solid var(--dsw-alias-border-l1)";
				const remotePanelStyle = {
					position: "fixed",
					left: "1%",
					right: "1%",
					top: "1%",
					bottom: pos && typeof pos.bottom === "number" ? pos.bottom : "1%",
					zIndex: PANEL_Z,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
					background: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
					backgroundColor: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
					border: remoteThin,
					borderRadius: "0.75em",
					fontFamily: "var(--dsw-font-family)",
					fontSize: "calc(1em * " + remoteFontScale + ")",
					color: base
				};
				const remoteMetaStyle = {
					fontSize: "0.85em",
					color: dim,
					whiteSpace: "nowrap"
				};
				const remoteCloseStyle = {
					marginLeft: "auto",
					flex: "none",
					width: "2.5em",
					height: "2.5em",
					borderRadius: "50%",
					border: remoteThin,
					background: "transparent",
					color: dim,
					fontSize: "1em",
					lineHeight: 1,
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					justifyContent: "center"
				};
				const remoteGridStyle = {
					flex: "1 1 auto",
					minHeight: "0",
					minWidth: "0",
					display: "grid",
					gridTemplateColumns: "repeat(" + remoteCols + ", minmax(0, 1fr))",
					gridTemplateRows: "repeat(" + remoteRows + ", minmax(0, 1fr))",
					gap: "0.5rem",
					padding: "0.5rem",
					overflow: "hidden",
					alignContent: "stretch"
				};
				const remoteCardStyle = (custom, pinned, hover, pressed) => ({
					minWidth: "0",
					minHeight: "0",
					overflow: "hidden",
					position: "relative",
					display: "flex",
					flexDirection: "column",
					justifyContent: "flex-start",
					gap: "0.25rem",
					padding: "0.5rem",
					borderRadius: "0.75em",
					border: pinned ? "0.14em solid var(--dsw-specific-accent,#f0a45c)" : custom ? "0.07em solid var(--dsw-specific-accent,#f0a45c)" : remoteThin,
					background: pressed ? ROW_PRESSED_BG : hover ? ROW_HOVER_BG : custom ? "var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-3))" : "var(--dsw-alias-bg-layer-3)",
					outline: pressed ? "0.07em solid var(--dsw-alias-border-l1)" : void 0,
					color: base,
					cursor: "pointer",
					fontFamily: "var(--dsw-font-family)",
					textAlign: "left",
					fontSize: "1em",
					lineHeight: 1.3,
					transition: "background-color .12s ease, transform .08s ease, filter .08s ease",
					transform: pressed ? "scale(.98)" : void 0
				});
				const remoteCardTitle = {
					fontSize: "1.02em",
					fontWeight: 700,
					color: base,
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
					flex: "none"
				};
				const remoteCardIntro = {
					fontSize: "0.85em",
					color: muted,
					whiteSpace: "normal",
					overflow: "hidden",
					overflowWrap: "break-word",
					flex: "1 1 auto",
					minHeight: 0,
					lineHeight: 1.4
				};
				const remoteCardUse = (pinnedCard) => ({
					fontSize: "0.8em",
					color: "var(--dsw-specific-danger,#e06c75)",
					flex: "none",
					fontVariantNumeric: "tabular-nums",
					whiteSpace: "nowrap",
					fontWeight: 700
				});
				const remoteCardMeta = {
					display: "flex",
					flexDirection: "column",
					alignItems: "stretch",
					gap: "0.25rem",
					flex: "1 1 auto",
					minHeight: 0,
					minWidth: "0"
				};
				const remoteCardFoot = {
					position: "absolute",
					right: "0.5rem",
					bottom: "0.5rem",
					zIndex: 1,
					display: "flex",
					alignItems: "center",
					gap: "0.3rem",
					padding: "0.2rem 0.2rem 0.2rem 0.5rem",
					borderRadius: 999,
					border: remoteThin,
					background: "var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-3))",
					whiteSpace: "nowrap"
				};
				const remoteCardAct = {
					flex: "none",
					alignSelf: "center",
					padding: "0.15rem 0.5rem",
					minHeight: "1.6rem",
					borderRadius: 999,
					border: "0.07em solid var(--dsw-alias-border-l2)",
					background: "transparent",
					color: muted,
					cursor: "pointer",
					fontSize: "0.78em",
					fontWeight: 600,
					lineHeight: 1.4,
					whiteSpace: "nowrap"
				};
				const remoteEmptyStyle = {
					minWidth: "0",
					minHeight: "0",
					border: "thin dashed var(--dsw-alias-border-l2)",
					borderRadius: "0.75em",
					background: "transparent"
				};
				const remoteSearchRowStyle = {
					display: "flex",
					gap: "0.5rem",
					padding: "0 0.5rem 0.5rem",
					flex: "none"
				};
				const remoteSearchInputStyle = {
					flex: "1 1 auto",
					minWidth: "0",
					padding: "0.5rem 0.6rem",
					borderRadius: "0.6em",
					border: remoteThin,
					background: "var(--dsw-alias-bg-layer-3)",
					color: base,
					fontFamily: "var(--dsw-font-family)",
					fontSize: "1em",
					outline: "none"
				};
				const remoteBarStyle = {
					display: "flex",
					flexDirection: "row",
					gap: "0.5rem",
					alignItems: "stretch",
					padding: "0.5rem",
					borderTop: remoteThin,
					flex: "none",
					flexWrap: "nowrap",
					overflowX: "auto",
					minWidth: "0"
				};
				const remoteActionsStyle = {
					display: "flex",
					gap: "0.5rem",
					alignItems: "stretch",
					flex: "none",
					alignSelf: "stretch"
				};
				const remoteBtnStyle = (enabledBtn) => ({
					flex: "none",
					alignSelf: "stretch",
					minWidth: "2.8em",
					padding: "0 0.6em",
					borderRadius: "0.6em",
					border: remoteThin,
					background: enabledBtn ? "var(--dsw-alias-bg-layer-3)" : "transparent",
					color: enabledBtn ? base : dim,
					cursor: enabledBtn ? "pointer" : "default",
					opacity: enabledBtn ? 1 : .45,
					fontFamily: "var(--dsw-font-family)",
					fontSize: "1em",
					fontWeight: 700,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					whiteSpace: "nowrap",
					overflow: "hidden"
				});
				const remoteTagsWrap = {
					flex: "1 1 auto",
					minWidth: "0",
					display: "grid",
					gridTemplateRows: "repeat(2, auto)",
					gridAutoFlow: "column",
					gridAutoColumns: "minmax(4em, auto)",
					gap: "0.35rem",
					overflowX: "auto",
					overflowY: "hidden",
					alignContent: "center",
					padding: "0.15rem"
				};
				const remoteTagBtn = (on) => ({
					minWidth: "0",
					padding: "0.35rem 0.5rem",
					borderRadius: "0.4em",
					border: remoteThin,
					background: on ? "var(--dsw-specific-accent,#f0a45c)" : "transparent",
					color: on ? "#1a1a1e" : muted,
					cursor: "pointer",
					fontFamily: "var(--dsw-font-family)",
					fontSize: "0.9em",
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis"
				});
				const remoteHover = compact ? {
					onMouseEnter: () => cancelPanelClose(),
					onMouseLeave: () => {
						if (modal || remoteSearchFocused || remoteComposing) return;
						schedulePanelClose(150);
					}
				} : null;
				const remoteSlots = remoteView.slots.map((s) => {
					if (s.kind === "empty") return h("div", {
						key: "empty-" + s.order,
						style: remoteEmptyStyle,
						"data-dsh-prompt-remote-empty": "1",
						"aria-hidden": "true"
					});
					const tpl = remoteById.get(s.id);
					if (!tpl) return h("div", {
						key: "empty-" + s.order,
						style: remoteEmptyStyle,
						"data-dsh-prompt-remote-empty": "1",
						"aria-hidden": "true"
					});
					const intro = (tpl.body || "").split(/\s+/).filter((x) => !!x).join(" ");
					const usageN = remoteUsage[tpl.id] || 0;
					const pinned = isPinned(tpl.id);
					const custom = !tpl.builtin;
					const cardHover = hoverId === tpl.id;
					const cardPressed = pressedId === tpl.id;
					return h("div", {
						key: tpl.id,
						style: remoteCardStyle(custom, pinned, cardHover, cardPressed),
						role: "button",
						tabIndex: 0,
						"data-dsh-prompt-remote-card": "1",
						"data-dsh-prompt-id": tpl.id,
						title: labelString(tpl),
						onClick: () => {
							pressedState[1](null);
							handlePick(tpl);
						},
						onKeyDown: (e) => {
							try {
								if (e && (e.key === "Enter" || e.key === " ")) {
									if (typeof e.preventDefault === "function") e.preventDefault();
									pressedState[1](null);
									handlePick(tpl);
								}
							} catch (err) {}
						},
						onMouseEnter: () => hoverState[1](tpl.id),
						onMouseLeave: () => {
							hoverState[1](null);
							pressedState[1]((cur) => cur === tpl.id ? null : cur);
						},
						onMouseDown: (e) => {
							keepComposerFocus(e);
							pressedState[1](tpl.id);
						},
						onMouseUp: () => pressedState[1](null),
						onPointerDown: () => pressedState[1](tpl.id),
						onPointerUp: () => pressedState[1](null),
						onPointerCancel: () => pressedState[1](null),
						onFocus: () => hoverState[1](tpl.id),
						onBlur: () => hoverState[1](null)
					}, [h("span", { style: remoteCardMeta }, [h("span", { style: {
						...remoteCardTitle,
						flex: "none",
						minWidth: 0
					} }, tpl.name), h("span", { style: remoteCardIntro }, intro)]), h("span", { style: remoteCardFoot }, [h("span", {
						style: remoteCardUse(pinned),
						"data-dsh-prompt-remote-use": "1"
					}, String(usageN) + (pinned ? " ★" : "")), h("button", {
						type: "button",
						style: {
							...remoteCardAct,
							border: "0",
							background: "transparent"
						},
						title: custom ? t("edit") : t("copy"),
						"aria-label": custom ? t("edit") : t("copy"),
						"data-dsh-prompt-remote-act": custom ? "edit" : "copy",
						onMouseDown: keepComposerFocus,
						onClick: (e) => {
							if (custom) handleEdit(e, tpl);
							else handleCopy(e, tpl.id);
						}
					}, custom ? t("edit") : t("copy"))])]);
				});
				const remoteTagNodes = remoteOptions.map((label) => {
					const on = remoteSelected === null && label === "全部" || remoteSelected === label;
					return h("button", {
						key: label,
						style: remoteTagBtn(on),
						"aria-pressed": on ? "true" : "false",
						onMouseDown: keepComposerFocus,
						onClick: () => {
							const next = on ? null : label === "全部" ? null : label;
							remoteSelState[1](next);
							remotePageState[1](0);
							refresh();
						}
					}, label);
				});
				const remoteSearchToggle = () => {
					const next = !remoteSearchOpen;
					remoteSearchState[1](next);
					if (!next) {
						remoteQState[1]("");
						remotePageState[1](0);
					}
					refresh();
				};
				return h("div", {
					ref: rootRef,
					style: remotePanelStyle,
					...remoteHover,
					"data-dsh-prompt-remote-panel": "1",
					"data-dsh-prompt-remote-orient": remoteView.orientation,
					"data-dsh-prompt-remote-size": String(remotePrefs.size),
					"data-dsh-prompt-remote-orientation-pref": String(remotePref)
				}, [
					useInput ? h(DraftTap, {
						key: "dsh-prompt-draft-tap",
						useInput
					}) : null,
					h("div", {
						style: remoteGridStyle,
						"data-dsh-prompt-remote-grid": "1"
					}, remoteSlots),
					remoteSearchOpen ? h("div", { style: remoteSearchRowStyle }, [h("input", {
						style: remoteSearchInputStyle,
						placeholder: t("searchPh"),
						value: remoteQ,
						"data-dsh-prompt-remote-search-input": "1",
						onChange: (e) => {
							remoteQState[1](e.target.value);
							remotePageState[1](0);
							refresh();
						},
						onFocus: () => {
							remoteFocusState[1](true);
							if (compact) setHoverCloseSuppressed(true);
						},
						onBlur: () => {
							remoteFocusState[1](false);
							if (compact && !remoteComposing && !modal) setHoverCloseSuppressed(false);
						},
						onCompositionStart: () => {
							remoteCompState[1](true);
							if (compact) setHoverCloseSuppressed(true);
						},
						onCompositionEnd: (e) => {
							remoteCompState[1](false);
							try {
								const v = e && e.target && typeof e.target.value === "string" ? e.target.value : null;
								if (v !== null) {
									remoteQState[1](v);
									remotePageState[1](0);
								}
							} catch (err) {}
							if (compact && !modal && !remoteSearchFocused) setHoverCloseSuppressed(false);
						}
					})]) : null,
					h("div", { style: remoteBarStyle }, [h("div", {
						style: remoteTagsWrap,
						"data-dsh-prompt-remote-tags": "1"
					}, remoteTagNodes), h("div", { style: remoteActionsStyle }, [
						h("button", {
							style: remoteBtnStyle(true),
							"data-dsh-prompt-remote-search": "1",
							"aria-pressed": remoteSearchOpen ? "true" : "false",
							title: t("searchPh"),
							"aria-label": t("searchPh"),
							onMouseDown: keepComposerFocus,
							onClick: remoteSearchToggle
						}, h("svg", {
							width: "1.25em",
							height: "1.25em",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: 2,
							strokeLinecap: "round",
							"aria-hidden": "true",
							style: {
								flex: "none",
								display: "block"
							}
						}, [h("circle", {
							key: "c",
							cx: 11,
							cy: 11,
							r: 6
						}), h("line", {
							key: "l",
							x1: 15.5,
							y1: 15.5,
							x2: 20,
							y2: 20
						})])),
						h("button", {
							style: remoteBtnStyle(remoteView.bottomBar.hasPrev),
							disabled: !remoteView.bottomBar.hasPrev,
							"data-dsh-prompt-remote-prev": "1",
							title: "上一页",
							"aria-label": "上一页",
							onMouseDown: keepComposerFocus,
							onClick: () => {
								if (remoteView.bottomBar.hasPrev) {
									remotePageState[1](remoteView.page - 1);
									refresh();
								}
							}
						}, h("svg", {
							width: "1.25em",
							height: "1.25em",
							viewBox: "0 0 24 24",
							fill: "currentColor",
							"aria-hidden": "true",
							style: {
								flex: "none",
								display: "block"
							}
						}, [h("polygon", {
							key: "p",
							points: "16,4 6,12 16,20"
						})])),
						h("button", {
							style: remoteBtnStyle(remoteView.bottomBar.hasNext),
							disabled: !remoteView.bottomBar.hasNext,
							"data-dsh-prompt-remote-next": "1",
							title: "下一页",
							"aria-label": "下一页",
							onMouseDown: keepComposerFocus,
							onClick: () => {
								if (remoteView.bottomBar.hasNext) {
									remotePageState[1](remoteView.page + 1);
									refresh();
								}
							}
						}, h("svg", {
							width: "1.25em",
							height: "1.25em",
							viewBox: "0 0 24 24",
							fill: "currentColor",
							"aria-hidden": "true",
							style: {
								flex: "none",
								display: "block"
							}
						}, [h("polygon", {
							key: "p",
							points: "8,4 18,12 8,20"
						})])),
						h("span", {
							style: {
								...remoteMetaStyle,
								alignSelf: "center",
								flex: "none"
							},
							"data-dsh-prompt-remote-page": "1"
						}, remoteView.bottomBar.pageText),
						h("button", {
							style: {
								...remoteCloseStyle,
								alignSelf: "center"
							},
							title: t("close"),
							"data-dsh-prompt-remote-close": "1",
							onMouseDown: keepComposerFocus,
							onClick: () => setPanelOpen(false)
						}, "×")
					])]),
					modalNode
				]);
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
				const isPressed = pressedId === x.id;
				const isHover = hoverId === x.id;
				const itemBg = isPressed ? ROW_PRESSED_BG : isHover ? ROW_HOVER_BG : highlightId === x.id ? ROW_HOVER_BG : void 0;
				const itemOutline = isPressed ? "1px solid var(--dsw-alias-border-l1)" : void 0;
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
					const rowInteract = {
						onMouseEnter: () => hoverState[1](x.id),
						onMouseLeave: () => {
							hoverState[1](null);
							pressedState[1]((cur) => cur === x.id ? null : cur);
						},
						onMouseDown: (e) => {
							keepComposerFocus(e);
							pressedState[1](x.id);
						},
						onMouseUp: () => pressedState[1](null),
						onPointerDown: () => pressedState[1](x.id),
						onPointerUp: () => pressedState[1](null),
						onPointerCancel: () => pressedState[1](null),
						onFocus: () => hoverState[1](x.id),
						onBlur: () => hoverState[1](null)
					};
					return h("div", {
						key: x.id,
						style: {
							...itemStyle,
							background: itemBg,
							outline: itemOutline,
							minWidth: 0
						},
						"data-dsh-prompt-id": x.id,
						...rowInteract,
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
				]) : h("div", {
					style: collapsible ? {
						...headStyle,
						cursor: "pointer",
						borderBottom: showList ? line : "none"
					} : headStyle,
					...collapsible ? {
						role: "button",
						tabIndex: 0,
						"aria-expanded": showList ? "true" : "false",
						title: t("templatesToggleHint"),
						"data-dsh-prompt-templates-toggle": "",
						onClick: () => listOpenState[1](!listOpen),
						onKeyDown: (e) => {
							if (!e) return;
							if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
								if (typeof e.preventDefault === "function") e.preventDefault();
								listOpenState[1](!listOpen);
							}
						}
					} : null
				}, [
					h(PromptMark, { size: 15 }),
					h("span", { style: titleStyle }, t("panelTitle")),
					h("span", { style: {
						fontSize: "0.85em",
						color: dim,
						marginLeft: 6
					} }, t("presetCount") + " " + presetCount + " · " + t("customCount") + " " + customCount),
					h("div", { style: { flex: 1 } }),
					h("button", {
						style: {
							...addBtn,
							width: "auto",
							padding: "0 12px",
							fontSize: "0.92em"
						},
						title: t("add"),
						onClick: (e) => {
							if (e && typeof e.stopPropagation === "function") e.stopPropagation();
							modalState[1]({ kind: "add" });
						}
					}, "＋ " + t("addShort")),
					collapsible ? h("span", {
						key: "caret",
						"aria-hidden": "true",
						style: {
							fontSize: "1em",
							color: dim,
							marginLeft: 8,
							flex: "none",
							display: "inline-block",
							transform: showList ? "rotate(90deg)" : "none"
						}
					}, "›") : null
				]),
				showList ? cloudNodes : null,
				showList ? h("input", {
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
				}) : null,
				showList ? listNode : null,
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
				logEvent$3("pick.probe", {
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
		function logEvent$3(event, fields) {
			try {
				const log = globalThis.__dshPromptLog;
				if (log && typeof log.log === "function") log.log(event, fields);
			} catch (e) {}
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
			margin: "12px 0 4px",
			padding: "10px 14px",
			border: "1px solid var(--dsw-alias-border-l1)",
			borderRadius: 12,
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
		* 顶部头行：左边插件标志与页面名，右边「入口位（调用方给了就渲染）+ 两个图标按钮」。
		*
		* #127 自研更新入口已删：`entry` 仍由 settings.ts 交进来（#128 接新整组件时再定形态），
		* 本文件不持有更新引用。`entry` 缺席时这一行与 #37 一致。
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
		//#region node_modules/dsh-plugin-update/dist/config.js
		const DEFAULT_PANEL_POLL_MS = 1e3;
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
		//#endregion
		//#region node_modules/dsh-plugin-update/dist/service.js
		function updateError(code) {
			return Object.assign(new Error(code), { code });
		}
		function validVersion(v) {
			return typeof v === "string" && /^\d+\.\d+\.\d+$/.test(v);
		}
		function validPrereleaseIds(ids) {
			if (typeof ids !== "string" || !ids) return false;
			const parts = ids.split(".");
			if (parts.length === 0) return false;
			for (const p of parts) {
				if (!p || !/^[0-9A-Za-z-]+$/.test(p)) return false;
				if (/^\d+$/.test(p) && p.length > 1 && p.startsWith("0")) return false;
			}
			return true;
		}
		function validReleaseVersion(v) {
			if (typeof v !== "string" || !v) return false;
			const dash = v.indexOf("-");
			if (dash < 0) return validVersion(v);
			const core = v.slice(0, dash);
			const ids = v.slice(dash + 1);
			if (!validVersion(core) || !validPrereleaseIds(ids)) return false;
			if (ids.includes("+")) return false;
			return true;
		}
		function parseTriple(v) {
			const parts = String(v).split(".");
			if (parts.length > 3) return null;
			const nums = [];
			for (const p of parts) {
				if (!/^\d+$/.test(p)) return null;
				const n = Number(p);
				if (!Number.isSafeInteger(n)) return null;
				nums.push(n);
			}
			while (nums.length < 3) nums.push(0);
			return [
				nums[0],
				nums[1],
				nums[2]
			];
		}
		function compareVersions(a, b) {
			const pa = parseTriple(a);
			const pb = parseTriple(b);
			if (!pa || !pb) throw updateError("invalid-release");
			for (let i = 0; i < 3; i++) {
				if (pa[i] < pb[i]) return -1;
				if (pa[i] > pb[i]) return 1;
			}
			return 0;
		}
		function parseReleaseIds(ids) {
			return ids.split(".").map((p) => /^\d+$/.test(p) ? Number(p) : p);
		}
		function compareReleaseVersions(a, b) {
			if (!validReleaseVersion(a) || !validReleaseVersion(b)) throw updateError("invalid-release");
			const dashA = String(a).indexOf("-");
			const dashB = String(b).indexOf("-");
			const order = compareVersions(dashA < 0 ? String(a) : String(a).slice(0, dashA), dashB < 0 ? String(b) : String(b).slice(0, dashB));
			if (order !== 0) return order;
			const preA = dashA < 0 ? null : parseReleaseIds(String(a).slice(dashA + 1));
			const preB = dashB < 0 ? null : parseReleaseIds(String(b).slice(dashB + 1));
			if (preA === null && preB === null) return 0;
			if (preA === null) return 1;
			if (preB === null) return -1;
			const width = Math.max(preA.length, preB.length);
			for (let i = 0; i < width; i++) {
				const x = preA[i];
				const y = preB[i];
				if (x === void 0) return -1;
				if (y === void 0) return 1;
				if (typeof x === "number" && typeof y === "number") {
					if (x < y) return -1;
					if (x > y) return 1;
					continue;
				}
				if (typeof x === "number") return -1;
				if (typeof y === "number") return 1;
				if (x < y) return -1;
				if (x > y) return 1;
			}
			return 0;
		}
		//#endregion
		//#region node_modules/dsh-plugin-update/dist/changelog.js
		const CHANGELOG_NEUTRAL_LINE = "作者未提供更新说明，安装不受影响。";
		const CHANGELOG_MAX_CHARS = 65536;
		const CHANGELOG_ALL_CATEGORIES = [
			"Added",
			"Fixed",
			"Changed",
			"Deprecated",
			"Removed",
			"Security"
		];
		const CHANGELOG_MUST_SHOW = [
			"Added",
			"Fixed",
			"Changed"
		];
		const CHANGELOG_FOLDED = [
			"Deprecated",
			"Removed",
			"Security"
		];
		const CHANGELOG_CATEGORY_ZH = {
			Added: "新增",
			Fixed: "修复",
			Changed: "变更",
			Deprecated: "弃用预告",
			Removed: "移除",
			Security: "安全"
		};
		function emptySections() {
			return {
				Added: [],
				Fixed: [],
				Changed: [],
				Deprecated: [],
				Removed: [],
				Security: []
			};
		}
		function isCategoryName(v) {
			return CHANGELOG_ALL_CATEGORIES.includes(v);
		}
		function normalizeCategory(raw) {
			const t = String(raw || "").trim().toLowerCase();
			if (t === "added") return "Added";
			if (t === "fixed") return "Fixed";
			if (t === "changed") return "Changed";
			if (t === "deprecated") return "Deprecated";
			if (t === "removed") return "Removed";
			if (t === "security") return "Security";
			return null;
		}
		function isUnreleasedVersion(v) {
			return typeof v === "string" && v.trim().toLowerCase() === "unreleased";
		}
		function extractVersionDateAndYanked(title) {
			const t = String(title || "").trim();
			if (!t) return {
				version: null,
				date: null,
				yanked: false
			};
			const yanked = /\[YANKED\]/i.test(t);
			if (/unreleased/i.test(t)) return {
				version: "Unreleased",
				date: null,
				yanked
			};
			const vm = t.match(/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/);
			if (!vm) return {
				version: null,
				date: null,
				yanked: false
			};
			const dm = t.match(/(\d{4}-\d{2}-\d{2})/);
			return {
				version: vm[1],
				date: dm ? dm[1] : null,
				yanked
			};
		}
		function truncateBullet(text) {
			const t = String(text || "").replace(/\s+/g, " ").trim();
			if (!t) return "";
			if (t.length <= 500) return t;
			return `${t.slice(0, 499)}\u2026`;
		}
		function parseChangelog(markdown) {
			try {
				if (typeof markdown !== "string" || !markdown.trim()) return [];
				let text = markdown.replace(/\r\n/g, "\n");
				if (text.length > 65536) text = text.slice(0, CHANGELOG_MAX_CHARS);
				const lines = text.split("\n");
				const entries = [];
				let cur = null;
				let curCat = null;
				let inFence = false;
				const pushCurrent = () => {
					if (!cur) return;
					if (!CHANGELOG_ALL_CATEGORIES.some((c) => cur.sections[c].length > 0)) return;
					for (const c of CHANGELOG_ALL_CATEGORIES) {
						const list = cur.sections[c];
						if (list.length > 200) cur.sections[c] = list.slice(0, 200);
					}
					entries.push(cur);
				};
				for (const rawLine of lines) {
					const line = String(rawLine ?? "");
					if (/^\s*(```|~~~)/.test(line)) {
						inFence = !inFence;
						continue;
					}
					if (inFence) continue;
					const versionHeading = line.match(/^##(?!#)\s*(.+?)\s*$/);
					if (versionHeading) {
						pushCurrent();
						cur = null;
						curCat = null;
						const { version, date, yanked } = extractVersionDateAndYanked((versionHeading[1] ?? "").trim());
						if (!version) continue;
						cur = {
							version,
							date,
							yanked,
							sections: emptySections()
						};
						continue;
					}
					const catMatch = line.match(/^###\s*(.+?)\s*$/);
					if (catMatch) {
						const cat = normalizeCategory(catMatch[1] ?? "");
						curCat = cur && cat && isCategoryName(cat) ? cat : null;
						continue;
					}
					const bullet = line.match(/^\s*[-*+]\s+(.+?)\s*$/);
					if (bullet && cur && curCat) {
						const item = truncateBullet(bullet[1] ?? "");
						if (item) cur.sections[curCat].push(item);
						continue;
					}
					const trimmed = line.trim();
					if (trimmed && !trimmed.startsWith("#") && /^\s/.test(line) && cur && curCat) {
						const list = cur.sections[curCat];
						if (list.length > 0) {
							const merged = truncateBullet(`${list[list.length - 1]} ${trimmed}`);
							if (merged) list[list.length - 1] = merged;
						}
						continue;
					}
				}
				pushCurrent();
				return entries.slice(0, 100);
			} catch {
				return [];
			}
		}
		function hasVisibleSections(entry) {
			if (!entry || typeof entry !== "object") return false;
			try {
				return CHANGELOG_ALL_CATEGORIES.some((c) => Array.isArray(entry.sections?.[c]) && entry.sections[c].length > 0);
			} catch {
				return false;
			}
		}
		function compareReleaseSafe(a, b) {
			try {
				return compareReleaseVersions(a, b);
			} catch {
				return null;
			}
		}
		function selectChangelogEntries(entries, fromExclusive, toInclusive) {
			try {
				if (!Array.isArray(entries) || entries.length === 0) return [];
				const to = typeof toInclusive === "string" ? toInclusive.trim() : "";
				if (!to || !validReleaseVersion(to)) return [];
				const from = typeof fromExclusive === "string" ? fromExclusive.trim() : "";
				const fromValid = from && validReleaseVersion(from) ? from : null;
				const out = [];
				for (const e of entries) {
					if (!e || typeof e !== "object") continue;
					const v = typeof e.version === "string" ? String(e.version) : "";
					if (!v || isUnreleasedVersion(v) || !validReleaseVersion(v)) continue;
					if (!hasVisibleSections(e)) continue;
					const leTo = compareReleaseSafe(v, to);
					if (leTo === null || leTo > 0) continue;
					if (fromValid) {
						const gtFrom = compareReleaseSafe(v, fromValid);
						if (gtFrom === null || gtFrom <= 0) continue;
					}
					out.push(e);
				}
				return out;
			} catch {
				return [];
			}
		}
		function changelogForUpdate(entries, runningVersion, latestVersion, installedVersion) {
			try {
				const to = typeof latestVersion === "string" ? latestVersion.trim() : "";
				if (!to || !validReleaseVersion(to)) return [];
				const run = typeof runningVersion === "string" ? runningVersion.trim() : "";
				const inst = typeof installedVersion === "string" ? installedVersion.trim() : "";
				const from = run && validReleaseVersion(run) ? run : inst && validReleaseVersion(inst) ? inst : "";
				if (!from) return [];
				const order = compareReleaseSafe(to, from);
				if (order === null || order <= 0) return [];
				return selectChangelogEntries(entries, from, to);
			} catch {
				return [];
			}
		}
		function escapeChangelogHtml(text) {
			return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		}
		function renderChangelogSection(entry) {
			try {
				if (!entry || typeof entry !== "object") return "";
				const version = String(entry.version ?? "").trim();
				if (!version || isUnreleasedVersion(version)) return "";
				if (!hasVisibleSections(entry)) return "";
				const date = typeof entry.date === "string" ? String(entry.date) : "";
				const yankedSuffix = entry.yanked === true ? " · 已撤回" : "";
				const title = (date ? `${version} \xB7 ${date}` : version) + yankedSuffix;
				const parts = [];
				parts.push(`<div class="dsh-upd-changelog-version" data-version="${escapeChangelogHtml(version)}">`);
				parts.push(`<div class="dsh-upd-changelog-title">${escapeChangelogHtml(title)}</div>`);
				for (const cat of CHANGELOG_MUST_SHOW) {
					const items = Array.isArray(entry.sections?.[cat]) ? entry.sections[cat] : [];
					if (items.length === 0) continue;
					const label = `${cat} \xB7 ${CHANGELOG_CATEGORY_ZH[cat]}`;
					parts.push(`<div class="dsh-upd-changelog-cat" data-cat="${cat}">`);
					parts.push(`<div class="dsh-upd-changelog-catname">${escapeChangelogHtml(label)}</div>`);
					parts.push("<ul>");
					for (const item of items) {
						if (!item) continue;
						parts.push(`<li>${escapeChangelogHtml(item)}</li>`);
					}
					parts.push("</ul></div>");
				}
				for (const cat of CHANGELOG_FOLDED) {
					const items = Array.isArray(entry.sections?.[cat]) ? entry.sections[cat] : [];
					if (items.length === 0) continue;
					const label = `${cat} \xB7 ${CHANGELOG_CATEGORY_ZH[cat]}\uFF08${items.length}\uFF09`;
					parts.push(`<details class="dsh-upd-changelog-fold" data-cat="${cat}">`);
					parts.push(`<summary>${escapeChangelogHtml(label)}</summary>`);
					parts.push("<ul>");
					for (const item of items) {
						if (!item) continue;
						parts.push(`<li>${escapeChangelogHtml(item)}</li>`);
					}
					parts.push("</ul></details>");
				}
				parts.push("</div>");
				return parts.join("\n");
			} catch {
				return "";
			}
		}
		function renderChangelogNeutral() {
			return `<div class="dsh-upd-changelog-neutral">${escapeChangelogHtml(CHANGELOG_NEUTRAL_LINE)}</div>`;
		}
		function renderChangelogHTML(entries, opts) {
			try {
				if (!Array.isArray(entries) || entries.length === 0) return renderChangelogNeutral();
				const from = opts && typeof opts.from === "string" ? opts.from : null;
				const to = opts && typeof opts.to === "string" ? opts.to : null;
				let ranged;
				if (from !== null || to !== null) ranged = selectChangelogEntries(entries, from, to);
				else ranged = entries.filter((e) => {
					try {
						const v = String(e.version ?? "");
						return !!v && !isUnreleasedVersion(v) && hasVisibleSections(e);
					} catch {
						return false;
					}
				});
				if (ranged.length === 0) return renderChangelogNeutral();
				const blocks = ranged.map((e) => renderChangelogSection(e)).filter((s) => !!s);
				if (blocks.length === 0) return renderChangelogNeutral();
				return `<div class="dsh-upd-changelog">
${blocks.join("\n")}
</div>`;
			} catch {
				return renderChangelogNeutral();
			}
		}
		const COPY_BUDGET_CHARS = 1500;
		const REDACTED_PATH = "<路径>";
		const REDACTED_SECRET = "<脱敏>";
		const ABSOLUTE_PATH_RE = /[A-Za-z]:\\[^\s"']*|\\\\[^\s"'()\[\];]+|(^|[\s"'(\[=,])\/\/[^\s"'()\[\];]+|(^|[\s"'(\[=:,])\/(?!\/)[^\s"'()\[\];]+/g;
		const URL_USERINFO_RE = /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s/]*@/;
		const NPM_TOKEN_RE = /\bnpm_[A-Za-z0-9_-]{8,}/g;
		const GITHUB_TOKEN_RE = /\b(?:gh[pousr]_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{10,})/g;
		const SK_TOKEN_RE = /\bsk-[A-Za-z0-9_-]{6,}/g;
		const BEARER_TOKEN_RE = /(\bbearer\s+)[A-Za-z0-9._~+/-=]{6,}/gi;
		const CRED_PAIR_RE = /(\b(?:token|password|passwd|pwd|api[_-]?key|access[_-]?key|auth[_-]?token|secret|cookie)\s*[:=]\s*)("[^"]+"|'[^']+'|[^\s'";,)\]]+)/gi;
		const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
		function flattenWhitespace(text) {
			return String(text ?? "").replace(/\s+/g, " ").trim();
		}
		function applyPathRule(text) {
			ABSOLUTE_PATH_RE.lastIndex = 0;
			return text.replace(ABSOLUTE_PATH_RE, (_whole, g1, g2) => {
				return `${g1 ?? g2 ?? ""}${REDACTED_PATH}`;
			});
		}
		function applyTokenRule(text) {
			NPM_TOKEN_RE.lastIndex = 0;
			GITHUB_TOKEN_RE.lastIndex = 0;
			SK_TOKEN_RE.lastIndex = 0;
			BEARER_TOKEN_RE.lastIndex = 0;
			return text.replace(NPM_TOKEN_RE, REDACTED_SECRET).replace(GITHUB_TOKEN_RE, REDACTED_SECRET).replace(SK_TOKEN_RE, REDACTED_SECRET).replace(BEARER_TOKEN_RE, (_whole, prefix) => `${prefix}${REDACTED_SECRET}`);
		}
		function applyCredPairRule(text) {
			CRED_PAIR_RE.lastIndex = 0;
			return text.replace(CRED_PAIR_RE, (_whole, head) => `${head}${REDACTED_SECRET}`);
		}
		function applyEmailRule(text) {
			EMAIL_RE.lastIndex = 0;
			return text.replace(EMAIL_RE, REDACTED_SECRET);
		}
		function hasUserinfo(text) {
			URL_USERINFO_RE.lastIndex = 0;
			return URL_USERINFO_RE.test(text);
		}
		function truncateToWordBoundary(text, max) {
			const input = String(text ?? "");
			if (input.length <= max) return input;
			const slice = input.slice(0, max);
			const lastSpace = slice.lastIndexOf(" ");
			let cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
			const lastOpen = cut.lastIndexOf("<");
			if (lastOpen > cut.lastIndexOf(">")) cut = cut.slice(0, lastOpen).trimEnd();
			if (!cut) cut = slice;
			return `${cut}\u2026`;
		}
		function truncateDetail(text) {
			return truncateToWordBoundary(text, 300);
		}
		function truncateForCopy(text) {
			return truncateToWordBoundary(text, COPY_BUDGET_CHARS);
		}
		function scrubWithoutBudget(text) {
			return applyEmailRule(applyCredPairRule(applyTokenRule(applyPathRule(text))));
		}
		function sanitizeDetail(text) {
			const flat = flattenWhitespace(text);
			if (!flat) return "";
			if (hasUserinfo(flat)) return "";
			return truncateDetail(scrubWithoutBudget(flat));
		}
		function sanitizeForCopy(text) {
			const flat = flattenWhitespace(String(text ?? ""));
			if (!flat) return "";
			if (hasUserinfo(flat)) return "";
			return truncateForCopy(scrubWithoutBudget(flat));
		}
		const DIAG_KEYS = Object.keys({
			v: "number",
			stage: "string",
			route: "string",
			method: "string",
			httpStatus: "number",
			exitCode: "number",
			latencyMs: "number",
			detail: "string",
			targetPackageName: "string",
			runningVersion: "string",
			latestVersion: "string",
			environmentKind: "string",
			requestId: "string",
			checkId: "string",
			registryHost: "string",
			action: "string"
		});
		//#endregion
		//#region node_modules/dsh-plugin-update/dist/panel.js
		const BLOCKED_COPY = {
			"unknown-profile": {
				title: "使用范围或插件位置认不出",
				action: "重开宿主再查一次；一直这样就把版本号与日志交给插件作者；这种情形不给手工命令"
			},
			"source-install": {
				title: "当前是从源码装的，不是按版本号装的",
				action: "这种情形不给手工命令；想走更新先按版本号重装一次"
			},
			"invalid-installation": {
				title: "已装的包不完整（名字对不上、版本非法、入口文件缺失）",
				action: "重装当前版本，修好已装目录再查更新"
			},
			"installation-changed": {
				title: "安装位置在使用中途变了（换了目录或换了包）",
				action: "重新打开宿主再查一次；还出现就重装"
			},
			"pending-restart": {
				title: "新版已装到磁盘，正在跑的还是旧版",
				action: "重启宿主，让新版跑起来；这是正常终态，不是失败"
			},
			"registry-conflict": {
				title: "本地声明的版本与磁盘实际版本互相矛盾",
				action: "打开使用范围的清单文件，把目标包名那一行改成版本号再试"
			},
			"incompatible-node": {
				title: "新版要求的 Node 与当前运行的对不上",
				action: "先升级 Node 到 22 或更高，再查更新"
			},
			"recovery-required": {
				title: "上次安装被打断，留下一个半截任务",
				action: "重新点一次安装；一直出现就按第 6 节排错"
			}
		};
		function blockedCopy(reason) {
			if (reason === null || reason === void 0) return null;
			return BLOCKED_COPY[reason] ?? null;
		}
		const PHONE_FAILURE_COPY = {
			"check-failed": {
				zh: "查新版没成功（联网、源、限流都可能）",
				act: "过一会儿再查一次；一直失败就把复制诊断交给插件作者"
			},
			"invalid-release": {
				zh: "拿到的发布信息不合法（版本号非法或内容对不上）",
				act: "检查清单文件里的包名与版本写法，再查一次"
			},
			"check-expired": {
				zh: "凭证过期了，安装请求被拒",
				act: "重新查一次新版再点安装，不要重试旧编号"
			},
			"update-busy": {
				zh: "同一使用范围正在装另一个",
				act: "等当前任务离开 installing/verifying 再点；排队中去查状态看位置"
			},
			"install-failed": {
				zh: "装不上（详见诊断摘要）",
				act: "先看复制诊断；官方桌面版把这段交给插件作者"
			},
			internal: {
				zh: "出了点问题，认不出具体原因",
				act: "先重试一次；一直这样就把复制诊断交给插件作者"
			}
		};
		const UNKNOWN_FAILURE_COPY = {
			zh: "出了点问题，认不出具体原因",
			act: "先重试一次；一直这样就把复制诊断交给插件作者（带上你看到的码）"
		};
		function failureCopy(code) {
			if (typeof code !== "string") return null;
			const c = code.trim();
			if (!c) return null;
			const blocked = BLOCKED_COPY[c];
			if (blocked) return {
				zh: blocked.title,
				act: blocked.action
			};
			const phone = PHONE_FAILURE_COPY[c];
			if (phone) return phone;
			return UNKNOWN_FAILURE_COPY;
		}
		function failureCodeOf(reply, fallback) {
			const kind = reply && typeof reply.errorKind === "string" ? reply.errorKind.trim() : "";
			if (kind) return kind;
			const err = reply && typeof reply.error === "string" ? reply.error.trim() : "";
			if (err) return err;
			if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
			return "internal";
		}
		function redactForCopy(text) {
			return sanitizeForCopy(text);
		}
		const DIAG_KNOWN_TYPES = {
			v: "number",
			stage: "string",
			route: "string",
			method: "string",
			httpStatus: "number",
			exitCode: "number",
			latencyMs: "number",
			detail: "string",
			targetPackageName: "string",
			runningVersion: "string",
			latestVersion: "string",
			environmentKind: "string",
			requestId: "string",
			checkId: "string",
			registryHost: "string",
			action: "string"
		};
		function readDiagTolerant(diag) {
			const empty = {
				stage: null,
				route: null,
				method: null,
				httpStatus: null,
				exitCode: null,
				latencyMs: null,
				detail: null,
				targetPackageName: null,
				runningVersion: null,
				latestVersion: null,
				environmentKind: null,
				requestId: null,
				checkId: null,
				registryHost: null,
				action: null,
				unknownKeys: []
			};
			if (!diag || typeof diag !== "object" || Array.isArray(diag)) return empty;
			const raw = diag;
			const out = {
				...empty,
				unknownKeys: []
			};
			for (const key of Object.keys(DIAG_KNOWN_TYPES)) {
				if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
				const v = raw[key];
				if (v === void 0 || v === null) continue;
				if (typeof v !== DIAG_KNOWN_TYPES[key]) continue;
				out[key] = v;
			}
			for (const key of Object.keys(raw)) if (!Object.prototype.hasOwnProperty.call(DIAG_KNOWN_TYPES, key)) out.unknownKeys.push(key);
			return out;
		}
		function pickText(value, fallback) {
			if (typeof value === "string" && value.trim()) return value.trim();
			return fallback;
		}
		function queueTextOf(queuePosition, _diagQueuePos) {
			const pos = typeof queuePosition === "number" ? queuePosition : null;
			if (pos === 0) return "正在安装";
			if (typeof pos === "number") return `\u6392\u961F\u7B2C ${pos} \u4F4D`;
			return "不在队列里";
		}
		function buildUpdateDiagCopy(input) {
			const rawCode = String(input.code ?? "").trim() || "internal";
			const copy = failureCopy(rawCode) ?? UNKNOWN_FAILURE_COPY;
			const diag = readDiagTolerant(input.diag);
			const detail = redactForCopy(diag.detail ?? input.detail ?? "") || "（本回包没有带诊断摘要，等电话侧 diag 落定后补齐）";
			const pluginName = pickText(diag.targetPackageName ?? input.pluginId, "(未知包)");
			const runVer = pickText(diag.runningVersion ?? input.runningVersion, "?");
			const instVer = pickText(input.installedVersion ?? diag.latestVersion, "?");
			const host = pickText(diag.environmentKind ?? input.hostKind, "未知");
			const routeRaw = diag.route ?? input.route;
			const requestRaw = diag.requestId ?? input.requestId;
			const checkRaw = diag.checkId ?? input.checkId;
			const queue = queueTextOf(input.queuePosition ?? null);
			const prov = [
				`\u63D2\u4EF6=${pluginName}`,
				`\u7248\u672C=${runVer}\u2192${instVer}`,
				`\u5BBF\u4E3B=${host}`
			];
			if (typeof routeRaw === "string" && routeRaw.trim()) prov.push(`\u8DEF\u7531=${routeRaw.trim()}`);
			if (diag.stage) prov.push(`\u9636\u6BB5=${diag.stage}`);
			if (diag.method) prov.push(`\u65B9\u6CD5=${diag.method}`);
			if (typeof diag.httpStatus === "number") prov.push(`HTTP=${diag.httpStatus}`);
			if (typeof diag.exitCode === "number") prov.push(`exit=${diag.exitCode}`);
			if (typeof diag.latencyMs === "number") prov.push(`\u8017\u65F6=${diag.latencyMs}ms`);
			if (diag.registryHost) prov.push(`\u6E90=${diag.registryHost}`);
			else prov.push("源=未知（非官方源时省略本身即信息）");
			if (diag.action) prov.push(`\u5EFA\u8BAE=${diag.action}`);
			if (typeof requestRaw === "string" && requestRaw.trim()) prov.push(`\u8BF7\u6C42=${requestRaw.trim()}`);
			if (typeof checkRaw === "string" && checkRaw.trim()) prov.push(`\u68C0\u67E5=${checkRaw.trim()}`);
			prov.push(`\u961F\u5217=${queue}`);
			const format = input.format === "line" ? "line" : "block";
			const provLine = redactForCopy(prov.join(" · "));
			if (format === "line") return redactForCopy(`[update-diag] code=${rawCode} \xB7 ${copy.zh} \xB7 \u6458\u8981=${detail} \xB7 ${provLine} \xB7 \u600E\u4E48\u529E=${copy.act}`);
			return [
				`[update-diag] ${rawCode} \u2014 ${copy.zh}`,
				`  \u6458\u8981\uFF1A${detail}`,
				`  \u6765\u6E90\uFF1A${provLine}`,
				`  \u600E\u4E48\u529E\uFF1A${copy.act}`
			].join("\n");
		}
		const PANEL_SKIPPED_MAX = 50;
		function panelSkipKey(pluginId) {
			return `dsh-upd-skipped/${String(pluginId)}`;
		}
		function normalizePanelSkipped(raw) {
			if (!raw || typeof raw !== "object") return [];
			const list = raw.skipped;
			if (!Array.isArray(list)) return [];
			const seen = /* @__PURE__ */ new Set();
			const out = [];
			for (const item of list) {
				if (!item || typeof item !== "object") continue;
				const version = item.version;
				if (!validReleaseVersion(version) || seen.has(version)) continue;
				seen.add(version);
				const at = item.skippedAt;
				out.push({
					version,
					skippedAt: typeof at === "number" && Number.isFinite(at) ? at : 0
				});
			}
			return out.slice(0, PANEL_SKIPPED_MAX);
		}
		function createMemorySkipStore(now = Date.now) {
			let skipped = [];
			function assertVersion(version) {
				if (!validReleaseVersion(version)) throw new Error(`[dsh-plugin-update] \u8DF3\u8FC7\u7248\u672C\u53F7\u975E\u6CD5\uFF1A\u987B\u4E3A\u53D1\u884C\u7248\u672C\u53F7\uFF08\u6536\u5230 ${JSON.stringify(version)}\uFF09`);
				return version;
			}
			return {
				list: () => skipped.map((e) => e.version),
				has: (version) => validReleaseVersion(version) ? skipped.some((e) => e.version === version) : false,
				skip: (version) => {
					const v = assertVersion(version);
					const at = now();
					skipped = [{
						version: v,
						skippedAt: typeof at === "number" && Number.isFinite(at) ? at : 0
					}].concat(skipped.filter((e) => e.version !== v)).slice(0, PANEL_SKIPPED_MAX);
				},
				reset: (version) => {
					if (version === void 0) skipped = [];
					else skipped = skipped.filter((e) => e.version !== version);
				}
			};
		}
		function probeStorage(candidate) {
			try {
				if (!candidate || typeof candidate !== "object") return null;
				const s = candidate;
				if (typeof s.getItem !== "function" || typeof s.setItem !== "function" || typeof s.removeItem !== "function") return null;
				return s;
			} catch {
				return null;
			}
		}
		function createBrowserSkipStore(pluginId, storage, now = Date.now) {
			const memory = createMemorySkipStore(now);
			const store = probeStorage(storage) ?? probeStorage(globalThis["localStorage"] ?? null) ?? null;
			if (!store) return memory;
			const active = store;
			const key = panelSkipKey(pluginId);
			function read() {
				try {
					const raw = active.getItem(key);
					if (!raw) return [];
					return normalizePanelSkipped(JSON.parse(raw));
				} catch {
					return [];
				}
			}
			function write(entries) {
				try {
					active.setItem(key, JSON.stringify({ skipped: entries }));
				} catch {}
			}
			try {
				for (const e of read()) memory.skip(e.version);
			} catch {}
			return {
				list: () => memory.list(),
				has: (version) => memory.has(version),
				skip: (version) => {
					memory.skip(version);
					write(normalizePanelSkipped({ skipped: memory.list().map((v) => ({
						version: v,
						skippedAt: now()
					})) }));
				},
				reset: (version) => {
					memory.reset(version);
					if (version === void 0) try {
						active.removeItem(key);
					} catch {}
					else write(normalizePanelSkipped({ skipped: memory.list().map((v) => ({
						version: v,
						skippedAt: now()
					})) }));
				}
			};
		}
		const SEAL_BY_KIND = {
			loading: {
				text: "待查",
				mini: "查",
				tone: "ink"
			},
			idle: {
				text: "待查",
				mini: "查",
				tone: "ink"
			},
			update: {
				text: "可装",
				mini: "装",
				tone: "green"
			},
			busy: {
				text: "安装中",
				mini: "装",
				tone: "yellow"
			},
			restart: {
				text: "待重启",
				mini: "启",
				tone: "yellow"
			},
			blocked: {
				text: "受阻",
				mini: "阻",
				tone: "red"
			},
			failed: {
				text: "受阻",
				mini: "阻",
				tone: "red"
			},
			done: {
				text: "已最新",
				mini: "定",
				tone: "green"
			}
		};
		function messageCodeOf(message) {
			if (typeof message !== "string" || !message) return "";
			const at = message.indexOf(":");
			return (at < 0 ? message : message.slice(0, at)).trim();
		}
		function panelViewModel(input) {
			const view = panelViewModelCore(input);
			return {
				...view,
				seal: SEAL_BY_KIND[view.banner.kind] ?? SEAL_BY_KIND.idle
			};
		}
		function panelViewModelCore(input) {
			const { snapshot, manual, queue, skippedLatest, lastError } = input;
			const errorKind = input.errorKind;
			if (!snapshot) {
				const earlyCode = typeof errorKind === "string" && errorKind.trim() || lastError || "";
				if (earlyCode) {
					const copy = failureCopy(earlyCode);
					return {
						banner: {
							kind: "failed",
							title: `\u66F4\u65B0\u5931\u8D25\uFF08${earlyCode}\uFF09\uFF1A${copy?.zh ?? earlyCode}\u3002`,
							action: copy?.act || "复制诊断发给插件作者；深挖看日志通道。"
						},
						installEnabled: false,
						installLabel: "重试安装",
						skippedLatest: false,
						showManual: manual ? true : false,
						showReset: false,
						queueNote: null
					};
				}
				return {
					banner: {
						kind: "loading",
						title: "正在读取更新状态…",
						action: ""
					},
					installEnabled: false,
					installLabel: "安装更新",
					skippedLatest: false,
					showManual: false,
					showReset: false,
					queueNote: null
				};
			}
			const job = snapshot.job ?? null;
			const jobState = job?.state ?? null;
			const queueNote = queue && queue.busy ? queue.position === 0 ? "正在安装（本插件在装）。" : typeof queue.position === "number" ? `\u524D\u65B9\u6709\u5B89\u88C5\u5728\u8FDB\u884C\uFF0C\u672C\u63D2\u4EF6\u6392\u7B2C ${queue.position} \u4F4D\uFF0C\u5230\u961F\u9996\u518D\u70B9\u5B89\u88C5\u3002` : "前方有其他插件在安装，稍后重试。" : null;
			if (skippedLatest && snapshot.latestVersion) return {
				banner: {
					kind: "idle",
					title: `\u5DF2\u8DF3\u8FC7 ${snapshot.latestVersion}`,
					action: "点“恢复”可重新提醒该版本；有更新的新版本会照常提醒。"
				},
				installEnabled: false,
				installLabel: "安装更新",
				skippedLatest: true,
				showManual: false,
				showReset: true,
				queueNote
			};
			if (snapshot.blockedReason === "pending-restart") return {
				banner: {
					kind: "restart",
					title: `\u65B0\u7248 ${snapshot.latestVersion ?? snapshot.installedVersion ?? ""} \u5DF2\u5B89\u88C5\uFF0C\u91CD\u542F\u5BBF\u4E3B\u540E\u751F\u6548\u3002`,
					action: BLOCKED_COPY["pending-restart"].action
				},
				installEnabled: false,
				installLabel: "安装更新",
				skippedLatest: false,
				showManual: manual ? true : false,
				showReset: false,
				queueNote
			};
			if (jobState === "installing" || jobState === "verifying") return {
				banner: {
					kind: "busy",
					title: `\u6B63\u5728\u5B89\u88C5${job?.targetVersion ? ` ${job.targetVersion}` : ""}\u2026\u5173\u95ED\u9762\u677F\u4E0D\u4F1A\u4E2D\u65AD\u3002`,
					action: "进度按轮询自动刷新；重开面板 1 秒内恢复显示。"
				},
				installEnabled: false,
				installLabel: "安装中…",
				skippedLatest: false,
				showManual: false,
				showReset: false,
				queueNote
			};
			const jobCode = jobState === "failed" ? messageCodeOf(job?.message) || "install-failed" : "";
			const failedCode = typeof errorKind === "string" && errorKind.trim() || lastError || jobCode || "";
			if (failedCode || jobState === "failed" || jobState === "interrupted") {
				const code = failedCode || "install-failed";
				const copy = failureCopy(code);
				return {
					banner: {
						kind: "failed",
						title: `\u66F4\u65B0\u5931\u8D25\uFF08${code}\uFF09\uFF1A${copy?.zh ?? code}\u3002`,
						action: copy?.act || "复制诊断发给插件作者；深挖看日志通道。"
					},
					installEnabled: snapshot.canInstall,
					installLabel: "重试安装",
					skippedLatest: false,
					showManual: manual ? true : false,
					showReset: false,
					queueNote
				};
			}
			if (snapshot.blockedReason) {
				const copy = blockedCopy(snapshot.blockedReason);
				return {
					banner: {
						kind: "blocked",
						title: copy ? `${copy.title}\u3002` : `${snapshot.blockedReason}\u3002`,
						action: copy?.action || ""
					},
					installEnabled: false,
					installLabel: "安装更新",
					skippedLatest: false,
					showManual: manual ? true : false,
					showReset: false,
					queueNote
				};
			}
			if (snapshot.canInstall && snapshot.latestVersion) return {
				banner: {
					kind: "update",
					title: `\u6709\u65B0\u7248 ${snapshot.latestVersion} \u53EF\u88C5\uFF08\u5F53\u524D ${snapshot.runningVersion}\uFF09\u3002`,
					action: "点安装即走精确版本安装；同一使用范围同时只装一个。"
				},
				installEnabled: true,
				installLabel: `\u5B89\u88C5 ${snapshot.latestVersion}`,
				skippedLatest: false,
				showManual: manual ? true : false,
				showReset: false,
				queueNote
			};
			return {
				banner: {
					kind: "done",
					title: "已是最新，无需更新。",
					action: ""
				},
				installEnabled: false,
				installLabel: "安装更新",
				skippedLatest: false,
				showManual: false,
				showReset: false,
				queueNote
			};
		}
		const UPDATE_PANEL_CSS = [
			".dsh-upd{font:14px/1.6 system-ui,\"Microsoft YaHei\",sans-serif;color:var(--dsh-upd-fg,#1f2937);",
			"background:var(--dsh-upd-bg,#ffffff);border:1px solid var(--dsh-upd-line,#e5e7eb);border-radius:8px;padding:12px 14px;max-width:560px;",
			"--dsh-upd-ok-bg:#ecfdf5;--dsh-upd-ok-line:#059669;--dsh-upd-warn-bg:#fffbeb;--dsh-upd-warn-line:#d97706;",
			"--dsh-upd-bad-bg:#fef2f2;--dsh-upd-bad-line:#dc2626;--dsh-upd-busy-bg:#eff6ff;--dsh-upd-busy-line:#2563eb}",
			".dsh-upd *{box-sizing:border-box}",
			".dsh-upd button{font:inherit;border:1px solid var(--dsh-upd-line,#d1d5db);border-radius:6px;background:var(--dsh-upd-btn,#f9fafb);",
			"color:inherit;padding:4px 12px;cursor:pointer;margin:2px 6px 2px 0}",
			".dsh-upd button:disabled{opacity:.45;cursor:not-allowed}",
			".dsh-upd button:focus-visible{outline:2px solid var(--dsh-upd-focus,#2563eb);outline-offset:1px}",
			".dsh-upd button[data-primary=\"1\"]{background:var(--dsh-upd-primary,#2563eb);border-color:var(--dsh-upd-primary,#2563eb);color:#fff}",
			".dsh-upd-banner{border-left:4px solid var(--dsh-upd-line,#9ca3af);padding:6px 10px;margin:0 0 8px;background:var(--dsh-upd-soft,#f3f4f6)}",
			".dsh-upd-banner[data-kind=\"restart\"]{border-color:var(--dsh-upd-warn-line);background:var(--dsh-upd-warn-bg)}",
			".dsh-upd-banner[data-kind=\"failed\"],.dsh-upd-banner[data-kind=\"blocked\"]{border-color:var(--dsh-upd-bad-line);background:var(--dsh-upd-bad-bg)}",
			".dsh-upd-banner[data-kind=\"update\"]{border-color:var(--dsh-upd-ok-line);background:var(--dsh-upd-ok-bg)}",
			".dsh-upd-banner[data-kind=\"busy\"]{border-color:var(--dsh-upd-busy-line);background:var(--dsh-upd-busy-bg)}",
			".dsh-upd code{font-family:Consolas,Menlo,monospace;font-size:12px;word-break:break-all}",
			".dsh-upd-manual,.dsh-upd-queue,.dsh-upd-log{margin:8px 0;font-size:13px}",
			".dsh-upd-changelog-wrap{margin:8px 0;font-size:13px;border-top:1px solid var(--dsh-upd-line,#e5e7eb);padding-top:8px}",
			".dsh-upd-changelog-title{font-weight:700;margin:0 0 4px}",
			".dsh-upd-changelog-version{margin:6px 0}",
			".dsh-upd-changelog-catname{font-weight:600;margin:6px 0 2px}",
			".dsh-upd-changelog ul{margin:2px 0 6px 20px;padding:0}",
			".dsh-upd-changelog li{margin:2px 0}",
			".dsh-upd-changelog-fold{margin:4px 0}",
			".dsh-upd-changelog-fold>summary{cursor:pointer}",
			".dsh-upd-changelog-neutral{color:inherit;opacity:.8}",
			".dsh-upd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999}",
			".dsh-upd-overlay .dsh-upd{background:var(--dsh-upd-bg,#ffffff);max-height:85vh;overflow:auto}",
			".dsh-upd-head{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}",
			".dsh-upd-masthead{display:none}",
			".dsh-upd-name{font-weight:700}",
			".dsh-upd-meta{font-size:12.5px;opacity:.75}",
			".dsh-upd-proftag{font-family:Consolas,Menlo,monospace;font-size:11px;border:1px solid var(--dsh-upd-line,#d1d5db);border-radius:3px;padding:0 5px;margin-left:6px;letter-spacing:.06em}",
			".dsh-upd-strip{display:flex;flex-wrap:wrap;margin:8px 0 0;border:1px solid var(--dsh-upd-line,#e5e7eb);border-radius:4px;overflow:hidden;font-size:12.5px}",
			".dsh-upd-strip>div{flex:1 1 110px;padding:6px 10px;border-left:1px solid var(--dsh-upd-line,#e5e7eb)}",
			".dsh-upd-strip>div:first-child{border-left:0}",
			".dsh-upd-strip-k{display:block;font-size:11px;letter-spacing:.14em;opacity:.7}",
			".dsh-upd-strip-v{font-family:Consolas,Menlo,monospace;font-size:12.5px}",
			".dsh-upd-chapter{margin-top:14px;padding-top:10px;border-top:1px solid var(--dsh-upd-line,#e5e7eb)}",
			".dsh-upd-chap-head{display:flex;align-items:baseline;gap:10px;margin-bottom:6px}",
			".dsh-upd-chap-no{font-size:13px;font-style:italic;opacity:.6}",
			".dsh-upd-chap-title{font-size:14px;margin:0}",
			".dsh-upd-chap-rule{flex:1;border-top:1px solid var(--dsh-upd-line,#e5e7eb);transform:translateY(-3px)}",
			".dsh-upd-chap-note{flex:none;font-size:12px;opacity:.75}",
			".dsh-upd-chap-note button{margin:0}",
			".dsh-upd-qrow{display:flex;align-items:baseline;gap:10px;padding:6px 0}",
			".dsh-upd-qrow+.dsh-upd-qrow{border-top:1px solid var(--dsh-upd-line,#e5e7eb)}",
			".dsh-upd-qdot{width:8px;height:8px;border-radius:50%;flex:none;align-self:center;background:currentColor;opacity:.5}",
			".dsh-upd-qdot[data-tone=\"busy\"]{background:var(--dsh-upd-warn-line,#d97706);opacity:1}",
			".dsh-upd-qdot[data-tone=\"you\"]{background:var(--dsh-upd-primary,#2563eb);opacity:1}",
			".dsh-upd-qk{flex:none;width:5.5em;font-size:12px;opacity:.7}",
			".dsh-upd-qv{font-weight:600}",
			".dsh-upd-qn{margin-left:auto;font-size:12px;opacity:.7}",
			".dsh-upd-qseq{font-family:Consolas,Menlo,monospace;font-size:12px;word-break:break-all}",
			".dsh-upd-prog{height:8px;background:var(--dsh-upd-line,#e5e7eb);border-radius:4px;overflow:hidden;margin:10px 0 4px}",
			".dsh-upd-prog-bar{display:block;height:100%;background:var(--dsh-upd-primary,#2563eb);transition:width .3s}",
			".dsh-upd-progtxt{font-size:12.5px;opacity:.75}",
			".dsh-upd-skipline{font-size:13px;margin-top:8px}",
			".dsh-upd-tag{display:inline-block;border:1px dashed currentColor;border-radius:3px;padding:1px 8px;margin-right:8px;font-family:Consolas,Menlo,monospace;font-size:12px}",
			".dsh-upd-err{font-size:13px;margin:0 0 6px}",
			"@media (prefers-color-scheme: dark){.dsh-upd{--dsh-upd-fg:#e5e7eb;--dsh-upd-bg:#111827;--dsh-upd-line:#374151;",
			"--dsh-upd-btn:#1f2937;--dsh-upd-soft:#1f2937;--dsh-upd-primary:#3b82f6;--dsh-upd-focus:#93c5fd;",
			"--dsh-upd-ok-bg:rgba(16,185,129,.14);--dsh-upd-ok-line:#34d399;",
			"--dsh-upd-warn-bg:rgba(245,158,11,.16);--dsh-upd-warn-line:#fbbf24;",
			"--dsh-upd-bad-bg:rgba(239,68,68,.16);--dsh-upd-bad-line:#f87171;",
			"--dsh-upd-busy-bg:rgba(59,130,246,.16);--dsh-upd-busy-line:#60a5fa}}"
		].join("\n");
		const UPDATE_PANEL_D5_CSS = [
			"/* D5 档案卷可选主题：只换颜色/字体/间距；内核 DOM 顺序一字不动，不断复制诊断。 */",
			".dsh-upd[data-theme=\"d5-paper\"]{--d5-bg:#f7f3ea;--d5-card:#fffdf6;--d5-ink:#1a1a1a;--d5-muted:#6f675a;",
			"--d5-line:#e3d9c4;--d5-line-strong:#c4b896;--d5-accent:#c8402a;--d5-accent-deep:#9c2e1d;",
			"--d5-ok:#1a7f37;--d5-ok-bg:#e9f4ea;--d5-warn:#8a5a00;--d5-warn-bg:#fbf0d0;",
			"--d5-bad:#b3261e;--d5-bad-bg:#fbe9e5;",
			"--d5-serif:Georgia,\"Songti SC\",\"STSong\",\"SimSun\",\"Noto Serif CJK SC\",\"Source Han Serif SC\",serif;",
			"--d5-sans:system-ui,\"PingFang SC\",\"Hiragino Sans GB\",\"Microsoft YaHei\",sans-serif;",
			"--d5-mono:ui-monospace,\"SF Mono\",SFMono-Regular,Consolas,\"Noto Sans Mono\",monospace;",
			"--d5-shadow:0 1px 2px rgba(60,40,20,.08),0 12px 32px rgba(60,40,20,.10);",
			"font-family:var(--d5-sans);color:var(--d5-ink);background:var(--d5-card);",
			"border:1px solid var(--d5-line-strong);border-radius:4px;box-shadow:var(--d5-shadow)}",
			".dsh-upd[data-theme=\"d5-paper\"] button{border-color:var(--d5-line-strong);background:transparent;color:var(--d5-ink);border-radius:3px;font-family:var(--d5-sans)}",
			".dsh-upd[data-theme=\"d5-paper\"] button:hover:not(:disabled){border-color:var(--d5-accent);color:var(--d5-accent)}",
			".dsh-upd[data-theme=\"d5-paper\"] button[data-primary=\"1\"]{background:var(--d5-accent);border-color:var(--d5-accent);color:#fff}",
			".dsh-upd[data-theme=\"d5-paper\"] button[data-primary=\"1\"]:hover:not(:disabled){background:var(--d5-accent-deep);color:#fff}",
			".dsh-upd[data-theme=\"d5-paper\"] button:focus-visible{outline:2px solid var(--d5-accent);outline-offset:2px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner{background:var(--d5-bg);border-color:var(--d5-line-strong)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"update\"]{border-color:var(--d5-ok);background:var(--d5-ok-bg)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"busy\"]{border-color:var(--d5-warn);background:var(--d5-warn-bg)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"restart\"]{border-color:var(--d5-warn);background:var(--d5-warn-bg);font-family:var(--d5-serif);border-width:2px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"failed\"],.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"blocked\"]{border-color:var(--d5-bad);background:var(--d5-bad-bg)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"done\"]{border-color:var(--d5-ok);background:var(--d5-ok-bg)}",
			".dsh-upd[data-theme=\"d5-paper\"]{position:relative;padding:22px 26px 20px}",
			".dsh-upd[data-theme=\"d5-paper\"]::before{content:attr(data-seal);position:absolute;top:20px;right:24px;width:88px;height:88px;",
			"display:flex;align-items:center;justify-content:center;text-align:center;letter-spacing:.18em;text-indent:.18em;line-height:1.35;",
			"border:3px solid currentColor;border-radius:14px;transform:rotate(-7deg);font-family:var(--d5-serif);font-weight:700;font-size:21px;",
			"background:color-mix(in srgb,currentColor 8%,transparent);user-select:none;pointer-events:none;",
			"box-shadow:inset 0 0 0 5px var(--d5-card),inset 0 0 0 6px currentColor,0 2px 6px rgba(0,0,0,.12)}",
			".dsh-upd[data-theme=\"d5-paper\"][data-seal-tone=\"ink\"]::before{color:var(--d5-muted)}",
			".dsh-upd[data-theme=\"d5-paper\"][data-seal-tone=\"green\"]::before{color:var(--d5-ok)}",
			".dsh-upd[data-theme=\"d5-paper\"][data-seal-tone=\"yellow\"]::before{color:var(--d5-warn)}",
			".dsh-upd[data-theme=\"d5-paper\"][data-seal-tone=\"red\"]::before{color:var(--d5-bad)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-masthead{display:block;padding:0 0 10px;margin:0 0 12px;border-bottom:1px solid var(--d5-line)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-masthead-kicker{display:block;font-size:11px;letter-spacing:.35em;color:var(--d5-muted);margin-bottom:3px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-masthead-title{font-family:var(--d5-serif);font-size:26px;font-weight:700;line-height:1.2}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-masthead-title i{color:var(--d5-accent);font-style:normal}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-qrow{padding:8px 0}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-qk{width:66px;letter-spacing:.18em}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-qv{font-family:var(--d5-serif);font-size:16px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-qn{font-family:var(--d5-mono);font-size:11.5px;color:var(--d5-muted)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-qseq{color:var(--d5-muted)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-chap-note{color:var(--d5-muted)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"loading\"]::before,.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"idle\"]::before,",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"update\"]::before,.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"busy\"]::before,",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"blocked\"]::before,.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"failed\"]::before,",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"done\"]::before{content:attr(data-mini);display:inline-flex;align-items:center;justify-content:center;",
			"width:30px;height:30px;margin-right:10px;vertical-align:middle;border:2px solid currentColor;border-radius:7px;",
			"font-family:var(--d5-serif);font-weight:700;font-size:16px;line-height:26px;transform:rotate(-5deg);flex:none;color:var(--d5-muted)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"update\"]::before{color:var(--d5-ok)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"busy\"]::before{color:var(--d5-warn)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"blocked\"]::before,.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"failed\"]::before{color:var(--d5-bad)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"done\"]::before{color:var(--d5-ok)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-log code{font-family:var(--d5-mono);font-size:11px;color:var(--d5-muted);border:1px solid var(--d5-line-strong);border-radius:3px;padding:0 6px;letter-spacing:.06em}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-manual code{display:block;background:var(--d5-ink);color:var(--d5-bg);font-family:var(--d5-mono);font-size:12.5px;padding:12px 14px;border-radius:4px;white-space:pre-wrap;word-break:break-all}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"restart\"]>div:first-child{display:flex;gap:10px;align-items:flex-start}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"restart\"]>div:first-child::before{content:\"\";flex:none;width:20px;height:20px;margin-top:3px;",
			"background:url(\"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2720%27 height=%2720%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%238a5a00%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z%27/%3E%3Cline x1=%2712%27 y1=%279%27 x2=%2712%27 y2=%2713%27/%3E%3Cline x1=%2712%27 y1=%2717%27 x2=%2712.01%27 y2=%2717%27/%3E%3C/svg%3E\") no-repeat center/20px 20px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner>div:first-child{overflow:hidden;text-overflow:ellipsis}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-actions{flex-wrap:wrap}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-head{display:flex;gap:16px;align-items:baseline;flex-wrap:wrap;padding-right:120px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-name{font-family:var(--d5-serif);font-size:22px;font-weight:700}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-meta{width:100%;font-size:12.5px;color:var(--d5-muted)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-meta b{color:var(--d5-ink);font-weight:600}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-proftag{font-family:var(--d5-mono);font-size:11px;color:var(--d5-muted);border:1px solid var(--d5-line-strong);border-radius:3px;padding:0 6px;margin-left:8px;letter-spacing:.06em}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-strip{display:flex;flex-wrap:wrap;margin:10px 0 0;border:1px solid var(--d5-line);border-radius:4px;overflow:hidden;font-size:12.5px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-strip>div{flex:1 1 120px;padding:8px 12px;border-left:1px solid var(--d5-line)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-strip>div:first-child{border-left:0}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-strip-k{display:block;font-size:11px;letter-spacing:.2em;color:var(--d5-muted)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-strip-v{font-family:var(--d5-mono);font-size:13px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-chapter{margin-top:26px;padding-top:16px;border-top:1px solid var(--d5-line)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-chap-head{display:flex;align-items:baseline;gap:12px;margin-bottom:10px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-chap-no{font-family:var(--d5-serif);font-style:italic;font-size:15px;color:var(--d5-muted)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-chap-title{font-family:var(--d5-serif);font-size:17px;margin:0;letter-spacing:.1em}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-chap-rule{flex:1;border-top:1px solid var(--d5-line);transform:translateY(-4px)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner{border:2px solid var(--d5-line-strong);border-radius:4px;padding:12px 16px;font-size:14.5px;font-family:var(--d5-serif);display:flex;gap:10px;align-items:center;flex-wrap:wrap}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner>div:first-child{flex:1 1 auto;min-width:0}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner>div:first-child strong{font-family:var(--d5-serif);font-size:27px;font-weight:700;line-height:1.35}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-prog{height:8px;background:var(--d5-line);border-radius:4px;overflow:hidden;margin:10px 0 4px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-prog-bar{display:block;height:100%;background:var(--d5-accent);transition:width .3s}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-progtxt{font-size:12.5px;color:var(--d5-muted)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-skipline{font-size:13px;margin-top:8px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-tag{display:inline-block;border:1px dashed var(--d5-line-strong);border-radius:3px;padding:1px 8px;margin-right:8px;font-family:var(--d5-mono);font-size:12px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-err{font-size:13px;margin:0 0 6px;color:var(--d5-muted)}",
			"@media (max-width:640px){.dsh-upd[data-theme=\"d5-paper\"]{padding:10px 12px}.dsh-upd[data-theme=\"d5-paper\"]::before{top:12px;right:12px;width:56px;height:56px;font-size:15px;box-shadow:inset 0 0 0 4px var(--d5-card),inset 0 0 0 5px currentColor}.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-masthead-title{font-size:19px}.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner{padding-right:16px}.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner::before{width:24px;height:24px;font-size:14px;line-height:20px;flex:none}.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner>div:first-child{white-space:normal}}",
			"@media (prefers-color-scheme: dark){.dsh-upd[data-theme=\"d5-paper\"]{--d5-bg:#141210;--d5-card:#1e1a15;--d5-ink:#ece5d3;--d5-muted:#a89c83;",
			"--d5-line:#3a3226;--d5-line-strong:#5c4e3b;--d5-accent:#e0684e;--d5-accent-deep:#f0866b;",
			"--d5-ok:#8fd6a4;--d5-ok-bg:rgba(80,180,120,.12);--d5-warn:#e8c15a;--d5-warn-bg:rgba(232,193,90,.12);",
			"--d5-bad:#ef8a7d;--d5-bad-bg:rgba(239,138,125,.12);--d5-shadow:0 1px 2px rgba(0,0,0,.4),0 12px 32px rgba(0,0,0,.45)}}",
			"@media (prefers-color-scheme: dark){.dsh-upd[data-theme=\"d5-paper\"] button[data-primary=\"1\"]{color:#141210}.dsh-upd[data-theme=\"d5-paper\"] button:focus-visible{outline-color:var(--d5-accent-deep)}}",
			"@media (prefers-color-scheme: dark){.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"restart\"]>div:first-child::before{background-image:url(\"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2720%27 height=%2720%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23e8c15a%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z%27/%3E%3Cline x1=%2712%27 y1=%279%27 x2=%2712%27 y2=%2713%27/%3E%3Cline x1=%2712%27 y1=%2717%27 x2=%2712.01%27 y2=%2717%27/%3E%3C/svg%3E\")}}",
			"@media (forced-colors: active){.dsh-upd[data-theme=\"d5-paper\"]{box-shadow:none}.dsh-upd[data-theme=\"d5-paper\"]::before{background:none;box-shadow:none;border-color:CanvasText;color:CanvasText}.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner{border:1px solid CanvasText}.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner::before{border-color:CanvasText;color:CanvasText;background:Canvas}.dsh-upd[data-theme=\"d5-paper\"] button{border:1px solid ButtonText}.dsh-upd[data-theme=\"d5-paper\"] button[data-primary=\"1\"]{background:ButtonFace;color:ButtonText;border-color:ButtonText}.dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-banner[data-kind=\"restart\"]>div:first-child::before{background-image:none;content:\"⚠\"}}",
			"@media (prefers-reduced-motion: reduce){.dsh-upd[data-theme=\"d5-paper\"] *{transition:none !important;animation:none !important}}"
		].join("\n");
		function escapeHtml$1(text) {
			return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		}
		const CHAPTER_TITLES = [
			"检查与安装",
			"更新日志",
			"更新队列",
			"错误信息",
			"手工命令"
		];
		function chapterOf(index, inner, note = "") {
			const no = String(index).padStart(2, "0");
			const title = CHAPTER_TITLES[index - 1];
			return `<section class="dsh-upd-chapter" data-chapter="${no}"><div class="dsh-upd-chap-head"><span class="dsh-upd-chap-no">${no}</span><h3 class="dsh-upd-chap-title">${escapeHtml$1(title)}</h3><span class="dsh-upd-chap-rule"></span>${note}</div>${inner}</section>`;
		}
		function versionStrip(snapshot) {
			const cell = (k, v) => `<div><span class="dsh-upd-strip-k">${escapeHtml$1(k)}</span><span class="dsh-upd-strip-v">${escapeHtml$1(v ?? "未知")}</span></div>`;
			if (!snapshot) return "";
			return `<div class="dsh-upd-strip">` + cell("运行", snapshot.runningVersion) + cell("磁盘", snapshot.installedVersion) + cell("远端", snapshot.latestVersion) + `</div>`;
		}
		function progressBar(snapshot) {
			const job = snapshot?.job;
			if (!job) return "";
			const state = String(job.state);
			if (state !== "installing" && state !== "verifying") return "";
			const width = state === "installing" ? 60 : 90;
			return `<div class="dsh-upd-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${width}"><i class="dsh-upd-prog-bar" style="width:${width}%"></i></div><div class="dsh-upd-progtxt">${escapeHtml$1(state === "installing" ? "正在安装新版…" : "正在校验安装结果…")}</div>`;
		}
		function renderUpdatePanelKernel(input, view) {
			const { snapshot, manual, queue, mode, showOthers, pluginId, copyNotice } = input;
			const changelogMarkdown = input.changelogMarkdown ?? null;
			const profileName = typeof input.profileName === "string" && input.profileName ? input.profileName : null;
			const b = view.banner;
			const seal = view.seal;
			const parts = [];
			parts.push("<div class=\"dsh-upd-masthead\"><span class=\"dsh-upd-masthead-kicker\">插件更新</span><span class=\"dsh-upd-masthead-title\">更新档案 <i>卷</i></span></div>");
			parts.push(`<div class="dsh-upd-head"><span class="dsh-upd-name">${escapeHtml$1(pluginId)}</span><span class="dsh-upd-meta">\u4F7F\u7528\u8303\u56F4 <b>${escapeHtml$1(profileName ?? "未知")}</b><span class="dsh-upd-proftag">profile</span></span></div>`);
			parts.push(`<div class="dsh-upd-banner" data-kind="${b.kind}" data-mini="${escapeHtml$1(seal.mini)}" role="status" aria-live="polite">`);
			parts.push(`<div><strong>${escapeHtml$1(b.title)}</strong></div>`);
			if (b.action) parts.push(`<div>${escapeHtml$1(b.action)}</div>`);
			parts.push("</div>");
			parts.push(versionStrip(snapshot));
			const showActions = input.actions !== "none";
			const actions = [];
			if (showActions) {
				actions.push("<div class=\"dsh-upd-actions\">");
				actions.push(`<button type="button" data-action="check">\u67E5\u65B0\u7248</button><button type="button" data-action="install" data-primary="1"${view.installEnabled ? "" : " disabled"}>${escapeHtml$1(view.installLabel)}</button>`);
				if (snapshot?.latestVersion && !view.skippedLatest && view.banner.kind === "update") actions.push(`<button type="button" data-action="skip">\u8DF3\u8FC7\u8BE5\u7248\u672C</button>`);
				if (view.showReset && snapshot?.latestVersion) actions.push(`<button type="button" data-action="reset-skip">\u6062\u590D\uFF08${escapeHtml$1(snapshot.latestVersion)}\uFF09</button>`);
				if (view.showManual && manual) actions.push(`<button type="button" data-action="copy-manual">\u590D\u5236\u624B\u5DE5\u547D\u4EE4</button>`);
				if (b.kind === "restart") actions.push(`<button type="button" data-action="restart-hint" data-primary="1">\u91CD\u542F\u5BBF\u4E3B</button>`);
				if (snapshot) actions.push(`<button type="button" data-action="copy-diag">\u590D\u5236\u8BCA\u65AD</button>`);
				if (mode === "dialog") actions.push(`<button type="button" data-action="close-view">\u5173\u95ED</button>`);
				actions.push("</div>");
			}
			actions.push(progressBar(snapshot));
			if (view.skippedLatest && snapshot?.latestVersion) actions.push(`<div class="dsh-upd-skipline"><span class="dsh-upd-tag">\u5DF2\u8DF3\u8FC7 ${escapeHtml$1(snapshot.latestVersion)}</span>\u70B9\u300C\u6062\u590D\u300D\u53EF\u64A4\u9500\uFF0C\u4E4B\u540E\u8FD9\u4E00\u7248\u8FD8\u4F1A\u518D\u63D0\u9192\u3002</div>`);
			parts.push(chapterOf(1, actions.join("")));
			{
				let inner = "";
				if (snapshot && snapshot.latestVersion) try {
					const changelogHTML = renderChangelogHTML(changelogForUpdate(parseChangelog(typeof changelogMarkdown === "string" ? changelogMarkdown : ""), snapshot.runningVersion, snapshot.latestVersion, snapshot.installedVersion));
					const fromText = String(snapshot.runningVersion ?? "");
					const toText = String(snapshot.latestVersion ?? "");
					inner = `<div class="dsh-upd-changelog-wrap"><div>${escapeHtml$1(fromText && toText ? `\u66F4\u65B0\u8BF4\u660E\uFF08${fromText} \u2192 ${toText}\uFF09\uFF1A` : "更新说明：")}</div>
${changelogHTML}
</div>`;
				} catch {
					inner = "";
				}
				if (!inner) inner = `<div class="dsh-upd-changelog-wrap"><div class="dsh-upd-changelog-neutral">${escapeHtml$1(snapshot && snapshot.latestVersion ? "日志读不出来，安装不受影响。" : "还没查到新版；查到后再显示日志。")}</div></div>`;
				parts.push(chapterOf(2, inner));
			}
			if (!!queue && (queue.busy || queue.waiting.length > 0) && queue) {
				const busy = queue.busy;
				const ownerRaw = queue.owner;
				const named = ownerRaw && "pluginId" in ownerRaw && ownerRaw.pluginId ? String(ownerRaw.pluginId) : null;
				const version = ownerRaw && "targetVersion" in ownerRaw && ownerRaw.targetVersion ? `@${String(ownerRaw.targetVersion)}` : "";
				const aboutSelf = named !== null && named === pluginId;
				const reveal = showOthers === true;
				const ownerShown = !busy ? "空闲" : named === null ? "其他插件" : aboutSelf ? "本插件" : reveal ? named : "其他插件";
				const ownerVer = busy && named !== null && (aboutSelf || reveal) ? version : "";
				const pos = typeof queue.position === "number" ? queue.position : null;
				const posText = pos === null ? "未排队" : `\u7B2C ${pos} \u4F4D`;
				const posNote = pos === null ? "" : pos === 1 ? "下一个就是你" : `\u524D\u65B9 ${pos - 1} \u4E2A`;
				const rows = [`<div class="dsh-upd-qrow"><span class="dsh-upd-qdot" data-tone="${busy ? "busy" : "idle"}"></span><span class="dsh-upd-qk">\u6B63\u5728\u5B89\u88C5</span><span class="dsh-upd-qv">${escapeHtml$1(ownerShown + ownerVer)}</span><span class="dsh-upd-qn">${busy ? "装完自动轮到你" : "同一使用范围一次只装一个"}</span></div>`, `<div class="dsh-upd-qrow"><span class="dsh-upd-qdot" data-tone="you"></span><span class="dsh-upd-qk">\u4F60\u7684\u987A\u4F4D</span><span class="dsh-upd-qv">${escapeHtml$1(posText)}</span><span class="dsh-upd-qn">${escapeHtml$1(posNote)}</span></div>`];
				if (reveal && queue.waiting.length > 0) {
					const seq = queue.waiting.map((e) => `${e.pluginId}${e.targetVersion ? `@${e.targetVersion}` : ""}`).join(" → ");
					rows.push(`<div class="dsh-upd-qrow"><span class="dsh-upd-qdot"></span><span class="dsh-upd-qk">\u6392\u961F\u987A\u5E8F</span><span class="dsh-upd-qseq">${escapeHtml$1(seq)}</span></div>`);
				}
				const note = showActions ? `<span class="dsh-upd-chap-note"><button type="button" data-action="toggle-queue">${reveal ? "隐藏他人明细" : "显示其他插件"}</button></span>` : "";
				parts.push(chapterOf(3, `<div class="dsh-upd-queue">${rows.join("")}</div>`, note));
			} else parts.push(chapterOf(3, `<div class="dsh-upd-queue"><div class="dsh-upd-changelog-neutral">${escapeHtml$1(view.queueNote ?? "当前没有排队任务，同一使用范围一次只装一个。")}</div></div>`));
			{
				const errLines = [];
				if (b.kind === "failed" || b.kind === "blocked") errLines.push(`<div class="dsh-upd-err">\u7A33\u5B9A\u7801 <code>${escapeHtml$1(String(b.kind === "blocked" ? snapshot?.blockedReason ?? b.kind : "install-failed"))}</code>\uFF1A\u4E0A\u4E00\u6761\u4E2D\u6587\u8BF4\u660E\u5C31\u662F\u8981\u7528\u6237\u505A\u7684\u4E8B\uFF1B\u8981\u5F80\u4E0A\u6E38\u62A5\uFF0C\u7528\u300C\u590D\u5236\u8BCA\u65AD\u300D\u6574\u6BB5\u7C98\uFF08\u5DF2\u8131\u654F\uFF09\u3002</div>`);
				errLines.push(`<div class="dsh-upd-log">\u6DF1\u6316\u770B\u65E5\u5FD7\uFF1A\u6309\u63D2\u4EF6\u6807\u8BC6 <code>${escapeHtml$1(pluginId)}</code> \u8FC7\u6EE4 <code>host.call</code>\u3001<code>host.call.fail</code>\u3001<code>update.install.exec</code> \u4E09\u4E2A\u4E8B\u4EF6\u3002</div>`);
				if (copyNotice) errLines.push(`<div class="dsh-upd-copy" role="status">${escapeHtml$1(copyNotice)}</div>`);
				parts.push(chapterOf(4, errLines.join("")));
			}
			parts.push(chapterOf(5, view.showManual && manual ? `<div class="dsh-upd-manual"><div>\u624B\u5DE5\u515C\u5E95\u547D\u4EE4\uFF08\u590D\u5236\u6574\u884C\u6267\u884C\uFF09\uFF1A</div><code>${escapeHtml$1(manual)}</code></div>` : `<div class="dsh-upd-manual"><div class="dsh-upd-changelog-neutral">\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u624B\u5DE5\u547D\u4EE4\uFF08\u8BA4\u4E0D\u51FA\u4F7F\u7528\u8303\u56F4\u6216\u5C5E\u6E90\u7801\u5B89\u88C5\u65F6\u4E0D\u7ED9\uFF09\u3002</div></div>`));
			return parts.join("\n");
		}
		function renderUpdatePanelHTML(input) {
			const view = panelViewModel(input);
			const kernel = renderUpdatePanelKernel(input, view);
			const d5 = input.theme === "d5-paper";
			const attr = d5 ? " data-theme=\"d5-paper\"" : "";
			const sealAttr = ` data-seal="${escapeHtml$1(view.seal.text)}" data-seal-tone="${view.seal.tone}"`;
			const body = input.mode === "dialog" ? `<div class="dsh-upd-overlay" data-mode="dialog"><div class="dsh-upd" data-mode="dialog" data-plugin="${escapeHtml$1(input.pluginId)}"${sealAttr}${attr}>
${kernel}
</div></div>` : `<div class="dsh-upd" data-mode="embedded" data-plugin="${escapeHtml$1(input.pluginId)}"${sealAttr}${attr}>
${kernel}
</div>`;
			return `<style>${d5 ? `${UPDATE_PANEL_CSS}
${UPDATE_PANEL_D5_CSS}` : UPDATE_PANEL_CSS}</style>
${body}`;
		}
		function isObject$1(value) {
			return !!value && typeof value === "object" && !Array.isArray(value);
		}
		function asSnapshot$1(value) {
			if (!isObject$1(value)) return null;
			const s = value;
			if (typeof s["runningVersion"] !== "string") return null;
			if (typeof s["canInstall"] !== "boolean") return null;
			return value;
		}
		function asQueue(value) {
			if (!isObject$1(value) || typeof value["busy"] !== "boolean") return null;
			return value;
		}
		function randomRequestId() {
			try {
				const rand = Math.floor(Math.random() * 16777215).toString(36);
				return `r${Date.now().toString(36)}${rand}`.slice(0, 64);
			} catch {
				return `r${Date.now()}`;
			}
		}
		function getTimer() {
			const g = globalThis;
			const set = g["setInterval"];
			const clear = g["clearInterval"];
			if (typeof set === "function" && typeof clear === "function") return {
				set: (fn, ms) => set(fn, ms),
				clear: (h) => clear(h)
			};
			const setT = g["setTimeout"];
			const clearT = g["clearTimeout"];
			return {
				set: (fn, ms) => setT(fn, ms),
				clear: (h) => clearT(h)
			};
		}
		async function defaultCopyText(text) {
			try {
				const clip = globalThis["navigator"]?.clipboard;
				const write = clip?.writeText;
				if (clip && typeof write === "function") {
					await write.call(clip, text);
					return;
				}
			} catch {}
		}
		function mountUpdatePanel(container, options) {
			if (!container || typeof container.innerHTML !== "string") throw new Error("[dsh-plugin-update] 挂载面板需要一个有 innerHTML 的容器");
			if (!options || typeof options !== "object") throw new Error("[dsh-plugin-update] 挂载面板缺少配置：插件标识 pluginId 必填");
			const pluginId = options.pluginId;
			if (typeof pluginId !== "string" || !pluginId) throw new Error(`[dsh-plugin-update] \u63D2\u4EF6\u6807\u8BC6 pluginId \u5FC5\u586B\uFF1A\u987B\u4E3A\u975E\u7A7A\u5B57\u7B26\u4E32\uFF08\u6536\u5230 ${JSON.stringify(pluginId)}\uFF09`);
			if (typeof options.call !== "function") throw new Error("[dsh-plugin-update] 挂载面板需要传输函数 call（面板调宿主电话的唯一接触面）");
			const phoneNames = buildPhoneNames$1(options.prefix === void 0 ? "wf" : options.prefix);
			const pollMs = options.pollMs === void 0 ? DEFAULT_PANEL_POLL_MS : options.pollMs;
			if (typeof pollMs !== "number" || !Number.isFinite(pollMs) || pollMs < 250) throw new Error(`[dsh-plugin-update] \u9762\u677F\u8F6E\u8BE2\u95F4\u9694\u975E\u6CD5\uFF1A\u4E0D\u5F97\u5C0F\u4E8E 250 \u6BEB\u79D2\uFF08\u6536\u5230 ${JSON.stringify(options.pollMs)}\uFF09`);
			let mode = options.mode ?? "embedded";
			if (mode !== "embedded" && mode !== "dialog") throw new Error(`[dsh-plugin-update] \u6446\u653E\u5F62\u6001\u975E\u6CD5\uFF1A\u53EA\u6536 embedded \u6216 dialog\uFF08\u6536\u5230 ${JSON.stringify(options.mode)}\uFF09`);
			let theme = options.theme ?? "default";
			if (theme !== "default" && theme !== "d5-paper") throw new Error(`[dsh-plugin-update] \u4E3B\u9898\u975E\u6CD5\uFF1A\u53EA\u6536 default \u6216 d5-paper\uFF08\u6536\u5230 ${JSON.stringify(options.theme)}\uFF09`);
			let showOthers = options.showOthers === true;
			const call = options.call;
			const onRestartRequested = options.onRestartRequested;
			const copyText = options.copyText ?? defaultCopyText;
			const skipStore = options.skipStore ?? createBrowserSkipStore(pluginId);
			const hostKind = typeof options.hostKind === "string" && options.hostKind ? options.hostKind : null;
			const profileNameOption = typeof options.profileName === "string" && options.profileName ? options.profileName : null;
			const diagCopyFormat = options.diagCopyFormat === "line" ? "line" : "block";
			let changelogMarkdown = typeof options.changelogMarkdown === "string" ? options.changelogMarkdown : null;
			let snapshot = null;
			let manual = null;
			let queue = null;
			let receipt = null;
			let requestId = null;
			let lastError = null;
			let lastErrorKind = null;
			let lastDiag = null;
			let copyNotice = null;
			let mounted = true;
			let envProfileName = null;
			let envHostKind = null;
			function queueArgs() {
				return {
					includeQueue: true,
					includeEnv: true,
					showOthers,
					...requestId ? { requestId } : {}
				};
			}
			function render() {
				if (!mounted) return;
				const latest = snapshot?.latestVersion ?? null;
				const skippedLatest = !!latest && validReleaseVersion(latest) && skipStore.has(latest);
				container.innerHTML = renderUpdatePanelHTML({
					snapshot,
					manual,
					queue,
					skippedLatest,
					lastError,
					errorKind: lastErrorKind,
					changelogMarkdown,
					mode,
					showOthers,
					pluginId,
					copyNotice,
					theme,
					profileName: profileNameOption ?? envProfileName,
					hostKind: hostKind ?? envHostKind
				});
			}
			function applyStatusReply(reply) {
				if (!isObject$1(reply)) return;
				if (reply["ok"] === true) {
					const s = asSnapshot$1(reply["snapshot"]);
					if (s) snapshot = s;
					manual = typeof reply["manual"] === "string" ? reply["manual"] : null;
					if (reply["receipt"] && isObject$1(reply["receipt"]) && typeof reply["receipt"]["checkId"] === "string") receipt = { checkId: reply["receipt"]["checkId"] };
					const q = asQueue(reply["queue"]);
					if (q) queue = q;
					const env = reply["env"];
					if (isObject$1(env)) {
						const pn = env["profileName"];
						const hk = env["environmentKind"];
						if (typeof pn === "string" && pn) envProfileName = pn;
						if (typeof hk === "string" && hk) envHostKind = hk;
					}
					lastError = null;
					lastErrorKind = null;
					lastDiag = Object.prototype.hasOwnProperty.call(reply, "diag") ? reply["diag"] : null;
				} else {
					lastError = typeof reply["error"] === "string" ? reply["error"] : "check-failed";
					lastErrorKind = typeof reply["errorKind"] === "string" && reply["errorKind"].trim() ? reply["errorKind"].trim() : null;
					lastDiag = Object.prototype.hasOwnProperty.call(reply, "diag") ? reply["diag"] : null;
				}
			}
			async function refresh() {
				if (!mounted) return;
				try {
					const reply = await call(phoneNames.updateStatus, queueArgs());
					if (!mounted) return;
					applyStatusReply(reply);
				} catch {
					if (!mounted) return;
					lastError = "check-failed";
					lastErrorKind = null;
					lastDiag = null;
				}
				render();
			}
			async function act(kind, arg) {
				if (!mounted) return;
				copyNotice = null;
				switch (kind) {
					case "check":
						try {
							const reply = await call(phoneNames.updateCheck, queueArgs());
							if (!mounted) return;
							applyStatusReply(reply);
						} catch {
							if (!mounted) return;
							lastError = "check-failed";
							lastErrorKind = null;
							lastDiag = null;
						}
						render();
						return;
					case "install":
						try {
							if (!receipt) {
								const checked = await call(phoneNames.updateCheck, queueArgs());
								if (!mounted) return;
								applyStatusReply(checked);
							}
							if (!mounted) return;
							if (!receipt) {
								lastError = "check-expired";
								lastErrorKind = "check-expired";
								lastDiag = null;
								render();
								return;
							}
							requestId = randomRequestId();
							const reply = await call(phoneNames.updateInstall, {
								checkId: receipt.checkId,
								requestId,
								...queueArgs()
							});
							if (!mounted) return;
							applyStatusReply(reply);
						} catch {
							if (!mounted) return;
							lastError = "check-failed";
							lastErrorKind = null;
							lastDiag = null;
						}
						render();
						return;
					case "skip": {
						const v = snapshot?.latestVersion ?? null;
						if (v && validReleaseVersion(v)) try {
							skipStore.skip(v);
						} catch {}
						render();
						return;
					}
					case "reset-skip":
						try {
							skipStore.reset(arg ?? snapshot?.latestVersion ?? void 0);
						} catch {}
						await refresh();
						return;
					case "copy-manual":
						if (manual) try {
							await copyText(manual);
							copyNotice = "手工命令已复制，粘到终端整行执行即可。";
						} catch {
							copyNotice = "复制失败，请手动选中上面的命令。";
						}
						render();
						return;
					case "copy-diag": {
						const jobCode = snapshot?.job?.state === "failed" ? messageCodeOf(snapshot.job.message) || "install-failed" : "";
						const code = failureCodeOf({
							error: lastError,
							errorKind: lastErrorKind
						}, jobCode || snapshot?.blockedReason || "check-failed");
						const detail = snapshot?.job?.message && snapshot.job.message.includes(":") ? snapshot.job.message.slice(snapshot.job.message.indexOf(":") + 1) : snapshot?.job?.message;
						const text = buildUpdateDiagCopy({
							pluginId,
							code,
							detail,
							runningVersion: snapshot?.runningVersion ?? null,
							installedVersion: snapshot?.installedVersion ?? null,
							latestVersion: snapshot?.latestVersion ?? null,
							hostKind,
							queuePosition: queue?.position ?? null,
							requestId,
							checkId: receipt?.checkId ?? null,
							route: null,
							diag: lastDiag,
							manual,
							format: diagCopyFormat
						});
						try {
							await copyText(text);
							copyNotice = "诊断已复制，直接粘给插件作者即可（已脱敏）。";
						} catch {
							copyNotice = "复制失败，请手动选中上面的信息。";
						}
						render();
						return;
					}
					case "toggle-queue":
						showOthers = !showOthers;
						await refresh();
						return;
					case "restart-hint":
						try {
							if (typeof onRestartRequested === "function") {
								await onRestartRequested();
								copyNotice = "已按调用方的重启流程处理；重启后新版生效。";
							} else copyNotice = "本宿主未提供重启入口：请手动重启宿主，重启后新版生效。";
						} catch {
							copyNotice = "重启入口调用失败：请手动重启宿主，重启后新版生效。";
						}
						render();
						return;
					case "close-view":
						if (mode === "dialog") unmount();
						return;
				}
			}
			async function setMode(next) {
				if (next !== "embedded" && next !== "dialog") throw new Error(`[dsh-plugin-update] \u6446\u653E\u5F62\u6001\u975E\u6CD5\uFF1A\u53EA\u6536 embedded \u6216 dialog\uFF08\u6536\u5230 ${JSON.stringify(next)}\uFF09`);
				mode = next;
				render();
			}
			async function setTheme(next) {
				if (next !== "default" && next !== "d5-paper") throw new Error(`[dsh-plugin-update] \u4E3B\u9898\u975E\u6CD5\uFF1A\u53EA\u6536 default \u6216 d5-paper\uFF08\u6536\u5230 ${JSON.stringify(next)}\uFF09`);
				theme = next;
				render();
			}
			async function setShowOthers(show) {
				showOthers = show === true;
				await refresh();
			}
			function onClick(ev) {
				try {
					const t = ev;
					const btn = t?.target && typeof t.target.closest === "function" ? t.target.closest("[data-action]") : null;
					const kind = btn?.getAttribute ? btn.getAttribute("data-action") : null;
					if (!kind) return;
					act(kind);
				} catch {}
			}
			function setChangelogMarkdown(markdown) {
				changelogMarkdown = typeof markdown === "string" ? markdown : null;
				render();
			}
			function unmount() {
				if (!mounted) return;
				mounted = false;
				try {
					timer.clear(handle);
				} catch {}
				try {
					container.removeEventListener?.("click", onClick);
				} catch {}
			}
			render();
			try {
				container.addEventListener?.("click", onClick);
			} catch {}
			const timer = getTimer();
			const handle = timer.set(() => {
				refresh();
			}, pollMs);
			try {
				const h = handle;
				if (h && typeof h.unref === "function") h.unref();
			} catch {}
			refresh();
			return {
				refresh,
				act,
				setMode,
				setTheme,
				setShowOthers,
				setChangelogMarkdown,
				unmount
			};
		}
		//#endregion
		//#region node_modules/dsh-plugin-update/dist/entry.js
		const LABEL_IDLE = "检查更新";
		const LABEL_FAILED = "更新失败，点此查看";
		const LABEL_BUSY = "正在安装…";
		const LABEL_RESTART = "待重启";
		function hasUpdateOf(snapshot) {
			if (!snapshot) return false;
			const latest = snapshot.latestVersion;
			if (typeof latest !== "string" || !latest.trim()) return false;
			return latest.trim() !== snapshot.runningVersion;
		}
		function entryStateKind(state) {
			const snapshot = state?.snapshot ?? null;
			const job = snapshot?.job ?? null;
			if (job && (job.state === "installing" || job.state === "verifying")) return "busy";
			if (snapshot && (snapshot.blockedReason === "pending-restart" || job?.state === "restart-required")) return "restart";
			if (state && state.error || job && (job.state === "failed" || job.state === "interrupted")) return "failed";
			if (hasUpdateOf(snapshot)) return "update";
			return "idle";
		}
		function entryLabelFor(state) {
			switch (entryStateKind(state)) {
				case "busy": return LABEL_BUSY;
				case "restart": return LABEL_RESTART;
				case "failed": return LABEL_FAILED;
				case "update": {
					const latest = state?.snapshot?.latestVersion;
					return typeof latest === "string" && latest.trim() ? `\u6709\u65B0\u7248 ${latest.trim()}` : LABEL_IDLE;
				}
				default: return LABEL_IDLE;
			}
		}
		const UPDATE_ENTRY_CSS = [
			".dsh-upd-entry{display:inline-flex;align-items:center;gap:8px;font:13px/1.6 system-ui,\"Microsoft YaHei\",sans-serif;color:var(--dsh-upd-fg,#1f2937)}",
			".dsh-upd-entry-btn{font:inherit;border:1px solid var(--dsh-upd-line,#d1d5db);border-radius:6px;",
			"background:var(--dsh-upd-btn,#f9fafb);color:inherit;padding:4px 12px;cursor:pointer}",
			".dsh-upd-entry-btn:hover{border-color:var(--dsh-upd-primary,#2563eb)}",
			".dsh-upd-entry-btn:focus-visible,.dsh-upd-entry-dot:focus-visible{outline:2px solid var(--dsh-upd-focus,#2563eb);outline-offset:1px}",
			".dsh-upd-entry[data-state=\"update\"] .dsh-upd-entry-btn{border-color:var(--dsh-upd-ok-line,#059669);color:var(--dsh-upd-ok-line,#059669)}",
			".dsh-upd-entry[data-state=\"restart\"] .dsh-upd-entry-btn{border-color:var(--dsh-upd-warn-line,#d97706);color:var(--dsh-upd-warn-line,#d97706)}",
			".dsh-upd-entry[data-state=\"failed\"] .dsh-upd-entry-btn{border-color:var(--dsh-upd-bad-line,#dc2626);color:var(--dsh-upd-bad-line,#dc2626)}",
			".dsh-upd-entry-dot{width:10px;height:10px;padding:0;border:0;border-radius:50%;background:var(--dsh-upd-line,#9ca3af);cursor:pointer}",
			".dsh-upd-entry[data-state=\"update\"] .dsh-upd-entry-dot{background:var(--dsh-upd-ok-line,#059669)}",
			".dsh-upd-entry[data-state=\"busy\"] .dsh-upd-entry-dot,.dsh-upd-entry[data-state=\"restart\"] .dsh-upd-entry-dot{background:var(--dsh-upd-warn-line,#d97706)}",
			".dsh-upd-entry[data-state=\"failed\"] .dsh-upd-entry-dot{background:var(--dsh-upd-bad-line,#dc2626)}",
			".dsh-upd-entry-note{font-size:12.5px;opacity:.75}",
			".dsh-upd-entry[data-theme=\"d5-paper\"]{font-family:Georgia,\"Songti SC\",\"STSong\",\"SimSun\",serif;color:#1a1a1a}",
			".dsh-upd-entry[data-theme=\"d5-paper\"] .dsh-upd-entry-btn{border-color:#c4b896;background:transparent;border-radius:3px}",
			".dsh-upd-entry[data-theme=\"d5-paper\"] .dsh-upd-entry-btn:hover{border-color:#c8402a;color:#c8402a}",
			"@media (prefers-color-scheme: dark){.dsh-upd-entry{color:#e5e7eb}",
			".dsh-upd-entry-btn{--dsh-upd-btn:#1f2937;--dsh-upd-line:#374151}}"
		].join("\n");
		const ENTRY_ATTR = "data-dsh-upd-entry";
		const ENTRY_SELECTOR = "[data-dsh-upd-entry]";
		function isObject(value) {
			return !!value && typeof value === "object" && !Array.isArray(value);
		}
		function asSnapshot(value) {
			if (!isObject(value)) return null;
			if (typeof value["runningVersion"] !== "string") return null;
			if (typeof value["canInstall"] !== "boolean") return null;
			return value;
		}
		function escapeHtml(value) {
			return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		}
		function mountUpdateEntry(container, options) {
			if (!container || typeof container.innerHTML !== "string") throw new Error("[dsh-plugin-update] 挂更新入口件需要一个有 innerHTML 的容器");
			if (!options || typeof options !== "object") throw new Error("[dsh-plugin-update] 挂更新入口件缺少配置：插件标识 pluginId 必填");
			const pluginId = options.pluginId;
			if (typeof pluginId !== "string" || !pluginId) throw new Error(`[dsh-plugin-update] \u63D2\u4EF6\u6807\u8BC6 pluginId \u5FC5\u586B\uFF1A\u987B\u4E3A\u975E\u7A7A\u5B57\u7B26\u4E32\uFF08\u6536\u5230 ${JSON.stringify(pluginId)}\uFF09`);
			if (typeof options.call !== "function") throw new Error("[dsh-plugin-update] 挂更新入口件需要传输函数 call（入口件调宿主电话的唯一接触面）");
			const rawPrefix = options.prefix;
			const prefix = rawPrefix === void 0 ? "wf" : rawPrefix;
			const phoneNames = buildPhoneNames$1(prefix);
			const variant = options.variant ?? "button";
			if (variant !== "button" && variant !== "badge" && variant !== "inline") throw new Error(`[dsh-plugin-update] \u5165\u53E3\u4EF6\u5F62\u6001\u975E\u6CD5\uFF1A\u53EA\u6536 button / badge / inline\uFF08\u6536\u5230 ${JSON.stringify(options.variant)}\uFF09`);
			const autoCheck = options.autoCheck ?? "mount";
			if (autoCheck !== "mount" && autoCheck !== "never") throw new Error(`[dsh-plugin-update] \u81EA\u52A8\u68C0\u67E5\u65F6\u673A\u975E\u6CD5\uFF1A\u53EA\u6536 mount \u6216 never\uFF08\u6536\u5230 ${JSON.stringify(options.autoCheck)}\uFF09`);
			const openOn = options.openOn ?? "has-update";
			if (openOn !== "has-update" && openOn !== "always" && openOn !== "manual") throw new Error(`[dsh-plugin-update] \u70B9\u51FB\u53BB\u5411\u975E\u6CD5\uFF1A\u53EA\u6536 has-update / always / manual\uFF08\u6536\u5230 ${JSON.stringify(options.openOn)}\uFF09`);
			let theme = options.theme ?? "default";
			if (theme !== "default" && theme !== "d5-paper") throw new Error(`[dsh-plugin-update] \u4E3B\u9898\u975E\u6CD5\uFF1A\u53EA\u6536 default \u6216 d5-paper\uFF08\u6536\u5230 ${JSON.stringify(options.theme)}\uFF09`);
			const pollMs = options.pollMs;
			if (pollMs !== void 0 && (typeof pollMs !== "number" || !Number.isFinite(pollMs) || pollMs < 250)) throw new Error(`[dsh-plugin-update] \u9762\u677F\u8F6E\u8BE2\u95F4\u9694\u975E\u6CD5\uFF1A\u4E0D\u5F97\u5C0F\u4E8E 250 \u6BEB\u79D2\uFF08\u6536\u5230 ${JSON.stringify(options.pollMs)}\uFF09`);
			const labelOverride = typeof options.label === "string" && options.label ? options.label : null;
			const profileName = typeof options.profileName === "string" && options.profileName ? options.profileName : null;
			const onActivate = typeof options.onActivate === "function" ? options.onActivate : null;
			const call = options.call;
			let snapshot = null;
			let error = null;
			let note = null;
			let mounted = true;
			let panel = null;
			let panelMode = null;
			const panelHost = {
				get innerHTML() {
					return container.innerHTML;
				},
				set innerHTML(value) {
					container.innerHTML = value;
				},
				addEventListener(type, listener) {
					container.addEventListener?.(type, listener);
				},
				removeEventListener(type, listener) {
					container.removeEventListener?.(type, listener);
				}
			};
			async function panelCall(name, args) {
				const reply = await call(name, args);
				return isObject(reply) ? reply : {};
			}
			function stateOf() {
				return {
					snapshot,
					error
				};
			}
			function currentLabel() {
				return labelOverride ?? entryLabelFor(stateOf());
			}
			function hasUpdate() {
				return hasUpdateOf(snapshot);
			}
			function phoneArgs() {
				return {};
			}
			function entryHTML() {
				const kind = entryStateKind(stateOf());
				const text = currentLabel();
				const themeAttr = theme === "d5-paper" ? " data-theme=\"d5-paper\"" : "";
				const control = variant === "badge" ? `<button type="button" class="dsh-upd-entry-dot" ${ENTRY_ATTR}="activate" title="${escapeHtml(text)}" aria-label="${escapeHtml(text)}"></button>` : `<button type="button" class="dsh-upd-entry-btn" ${ENTRY_ATTR}="activate">${escapeHtml(text)}</button>`;
				const noteHTML = note ? `<span class="dsh-upd-entry-note" data-dsh-upd-note="1">${escapeHtml(note)}</span>` : "";
				return `<style>${UPDATE_ENTRY_CSS}</style>
<span class="dsh-upd-entry" data-variant="${variant}" data-state="${kind}"${themeAttr}>${control}${noteHTML}</span>`;
			}
			function render() {
				if (!mounted) return;
				if (panelMode !== null) return;
				container.innerHTML = entryHTML();
			}
			function applyReply(reply) {
				if (!isObject(reply) || reply["ok"] !== true) {
					error = failureCodeOf(isObject(reply) ? reply : null, "check-failed");
					return;
				}
				const next = asSnapshot(reply["snapshot"]);
				if (next) snapshot = next;
				error = null;
			}
			async function refresh() {
				if (!mounted) return;
				try {
					const reply = await call(phoneNames.updateStatus, phoneArgs());
					if (!mounted) return;
					applyReply(reply);
				} catch {
					if (!mounted) return;
					error = "check-failed";
				}
				render();
			}
			async function checkNow() {
				try {
					const reply = await call(phoneNames.updateCheck, phoneArgs());
					if (!mounted) return;
					applyReply(reply);
				} catch {
					if (!mounted) return;
					error = "check-failed";
				}
			}
			function mountPanel(mode) {
				if (!mounted || panelMode !== null) return;
				panel = mountUpdatePanel(panelHost, {
					pluginId,
					prefix,
					mode,
					theme,
					pollMs,
					profileName,
					call: panelCall
				});
				panelMode = mode;
			}
			function openDialog() {
				mountPanel("dialog");
			}
			function open() {
				if (!mounted || panelMode !== null) return;
				if (variant === "inline") return;
				openDialog();
			}
			function close() {
				if (!mounted || panelMode !== "dialog" || !panel) return;
				const opened = panel;
				panel = null;
				panelMode = null;
				try {
					opened.unmount();
				} catch {}
				render();
				refresh();
			}
			async function activate() {
				if (!mounted || panelMode !== null) return;
				note = null;
				render();
				await checkNow();
				if (!mounted) return;
				if (variant === "badge" || openOn === "manual") {
					if (onActivate) onActivate({
						hasUpdate: hasUpdate(),
						latestVersion: snapshot?.latestVersion ?? null
					});
					else openDialog();
					render();
					return;
				}
				if (openOn === "always" || hasUpdate() || !snapshot || error) {
					openDialog();
					return;
				}
				note = `\u5DF2\u662F\u6700\u65B0 ${snapshot.runningVersion}`;
				render();
			}
			function setTheme(next) {
				if (next !== "default" && next !== "d5-paper") throw new Error(`[dsh-plugin-update] \u4E3B\u9898\u975E\u6CD5\uFF1A\u53EA\u6536 default \u6216 d5-paper\uFF08\u6536\u5230 ${JSON.stringify(next)}\uFF09`);
				theme = next;
				if (panel) panel.setTheme(next);
				else render();
			}
			function onClick(ev) {
				if (!mounted) return;
				try {
					const target = ev?.target;
					const closest = target && typeof target.closest === "function" ? target.closest.bind(target) : null;
					if (!closest) return;
					if (closest(ENTRY_SELECTOR)) {
						activate();
						return;
					}
					if (panelMode === "dialog" && closest("[data-action=\"close-view\"]")) close();
				} catch {}
			}
			function unmount() {
				if (!mounted) return;
				mounted = false;
				const opened = panel;
				panel = null;
				panelMode = null;
				try {
					opened?.unmount();
				} catch {}
				try {
					container.removeEventListener?.("click", onClick);
				} catch {}
			}
			try {
				container.addEventListener?.("click", onClick);
			} catch {}
			if (variant === "inline") mountPanel("embedded");
			else render();
			if (autoCheck === "mount") refresh();
			return {
				refresh,
				open,
				close,
				label: currentLabel,
				setTheme,
				unmount
			};
		}
		[
			"/* 批量面板（#25）：类名沿用 dsh-upd-* 前缀；默认（最小）主题，D5 皮肤见 UPDATE_BATCH_PANEL_D5_CSS。 */",
			".dsh-upd-batch-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}",
			".dsh-upd-batch-title{font-weight:700;font-size:15px;letter-spacing:.06em}",
			".dsh-upd-batch-title i{font-style:normal;color:var(--dsh-upd-primary,#2563eb)}",
			".dsh-upd-batch-macros{flex:none}",
			".dsh-upd-batch-sum{margin:4px 0 8px;font-size:13.5px}",
			".dsh-upd-btable{margin-top:2px}",
			".dsh-upd-brow-set{border-top:1px solid var(--dsh-upd-line,#e5e7eb)}",
			".dsh-upd-brow-set:first-child{border-top:0}",
			".dsh-upd-brow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0}",
			".dsh-upd .dsh-upd-brow-main{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1 1 260px;min-width:0;",
			"text-align:left;cursor:pointer;color:inherit;font:inherit;background:transparent;border:0;padding:2px 0;margin:0}",
			".dsh-upd .dsh-upd-brow-main:hover{color:var(--dsh-upd-primary,#2563eb)}",
			".dsh-upd-brow-actions{flex:none;margin-left:auto}",
			".dsh-upd-brow-actions button{font-size:12.5px}",
			".dsh-upd-updot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsh-upd-line,#9ca3af);opacity:.55}",
			".dsh-upd-updot[data-tone=\"todo\"]{background:var(--dsh-upd-ok-line,#059669);opacity:1}",
			".dsh-upd-updot[data-tone=\"ok\"]{background:var(--dsh-upd-ok-line,#059669);opacity:1}",
			".dsh-upd-updot[data-tone=\"busy\"]{background:var(--dsh-upd-busy-line,#2563eb);opacity:1}",
			".dsh-upd-updot[data-tone=\"warn\"]{background:var(--dsh-upd-warn-line,#d97706);opacity:1}",
			".dsh-upd-updot[data-tone=\"bad\"]{background:var(--dsh-upd-bad-line,#dc2626);opacity:1}",
			".dsh-upd-bname{font-weight:700;flex:none}",
			".dsh-upd-bver{font-family:Consolas,Menlo,monospace;font-size:12px;opacity:.8;flex:none}",
			".dsh-upd-bstat{font-size:12.5px;opacity:.9}",
			".dsh-upd-bfail{flex:1 1 100%;display:block;font-size:12.5px;color:var(--dsh-upd-bad-line,#dc2626)}",
			".dsh-upd-blist{font-size:12.5px;margin-top:2px}",
			".dsh-upd-batch-ledger{margin:8px 0 0;font-size:13px;opacity:.85}",
			".dsh-upd-batch-more{margin-top:6px}",
			".dsh-upd-batch-more button{font-size:12px}",
			".dsh-upd-batch-notice{margin-top:6px;font-size:12.5px;opacity:.85}",
			".dsh-upd-bdetail-actions{margin:0 0 6px}",
			".dsh-upd .dsh-upd-bdetail-actions button{font-size:12.5px}",
			".dsh-upd-bdetail-notice{margin:0 0 6px;font-size:12.5px;opacity:.85}",
			"/* 详情复用单插件内核：不许嵌套滚动——中性化 overlay 的 max-height/overflow，自身也不给 overflow。 */",
			".dsh-upd-bdetail{margin:2px 0 10px;overflow:visible}",
			".dsh-upd .dsh-upd-bdetail .dsh-upd{max-width:none}",
			".dsh-upd-overlay .dsh-upd-bdetail .dsh-upd{max-height:none;overflow:visible}",
			"@media (prefers-color-scheme: dark){.dsh-upd-batch-title i{color:var(--dsh-upd-focus,#93c5fd)}}",
			"@media (prefers-reduced-motion: reduce){.dsh-upd-batch *{transition:none !important;animation:none !important}}"
		].join(String.fromCharCode(10));
		[
			"/* 批量面板的 D5 皮肤：只换颜色/字体/间距；根上的大印章由 UPDATE_PANEL_D5_CSS 负责。 */",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-batch-head{padding-right:120px}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-batch-title{font-family:var(--d5-serif);font-size:21px;letter-spacing:.04em}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-batch-title i{color:var(--d5-accent)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-brow-main{background:transparent;border:0;color:var(--d5-ink)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-brow-main:hover{color:var(--d5-accent)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-bname{font-family:var(--d5-serif)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-bver{font-family:var(--d5-mono);color:var(--d5-muted)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-batch-ledger{color:var(--d5-muted)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-batch-sum{color:var(--d5-ink)}",
			".dsh-upd[data-theme=\"d5-paper\"] .dsh-upd-brow-set{border-top-color:var(--d5-line)}"
		].join(String.fromCharCode(10));
		//#endregion
		//#region node_modules/dsh-plugin-update/dist/http.js
		const HTTP_TRANSPORT_FAILED = "http-transport-failed";
		const DEFAULT_HTTP_CHECK_TIMEOUT_MS = 15e3;
		const DEFAULT_HTTP_INSTALL_TIMEOUT_MS = 96e4;
		const DEFAULT_HTTP_STATUS_TIMEOUT_MS = 15e3;
		const HTTP_PHONE_ACTIONS = [
			"updateStatus",
			"updateCheck",
			"updateInstall"
		];
		const HTTP_BATCH_ACTIONS = [
			"batchStatus",
			"batchCheck",
			"batchInstall",
			"batchResume",
			"batchCancel"
		];
		function isAbsoluteUrl(value) {
			return /^https?:\/\//i.test(value);
		}
		function stripRightSlash(value) {
			return String(value ?? "").replace(/\/+$/, "");
		}
		function joinBase(baseUrl, rel) {
			const b = stripRightSlash(baseUrl);
			let r = String(rel ?? "");
			if (!r) return b;
			if (!r.startsWith("/")) r = "/" + r;
			return b + r;
		}
		function shortActionOf(phoneName) {
			const name = String(phoneName ?? "");
			const at = name.lastIndexOf(".");
			return at >= 0 ? name.slice(at + 1) : name;
		}
		function allowedRouteKeys(prefix, batchPrefix) {
			const out = /* @__PURE__ */ new Set();
			for (const a of HTTP_PHONE_ACTIONS) {
				out.add(a);
				out.add(prefix + "." + a);
			}
			if (batchPrefix) for (const a of HTTP_BATCH_ACTIONS) {
				out.add(a);
				out.add(batchPrefix + "." + a);
			}
			return out;
		}
		function assertHttpRoutes(routes, prefix, batchPrefix) {
			if (!routes) return;
			const allowed = allowedRouteKeys(prefix, batchPrefix);
			for (const key of Object.keys(routes)) {
				if (!allowed.has(key)) throw new Error("[dsh-plugin-update] routes 未知键拒绝：" + JSON.stringify(key));
				const value = routes[key];
				if (typeof value !== "string" || !value) throw new Error("[dsh-plugin-update] routes 值非法：" + JSON.stringify(key));
			}
		}
		function resolveHttpPath(options, phoneName) {
			if (typeof phoneName !== "string" || !phoneName) throw new Error("[dsh-plugin-update] 电话名非法：须为非空字符串");
			const routes = options.routes ?? {};
			assertHttpRoutes(routes, options.prefix, options.batchPrefix);
			const short = shortActionOf(phoneName);
			const hit = routes[phoneName] ?? routes[short];
			if (hit !== void 0) {
				if (isAbsoluteUrl(hit)) return hit;
				return joinBase(options.baseUrl, hit);
			}
			return joinBase(options.baseUrl, phoneName);
		}
		function httpTransportFailed(reason, detail) {
			const clean = sanitizeDetail(String(detail ?? reason ?? ""));
			const err = /* @__PURE__ */ new Error("[dsh-plugin-update] http-transport-failed: " + reason);
			err.code = HTTP_TRANSPORT_FAILED;
			err.detail = clean;
			return err;
		}
		function isRecord(value) {
			return !!value && typeof value === "object" && !Array.isArray(value);
		}
		function pickHttpDiag(raw) {
			if (!isRecord(raw)) return void 0;
			const out = {};
			let kept = 0;
			for (const key of DIAG_KEYS) {
				const value = raw[key];
				if (typeof value === "string" || typeof value === "number") {
					out[key] = key === "detail" ? sanitizeDetail(String(value)) : value;
					kept++;
				}
			}
			return kept > 0 ? out : void 0;
		}
		function shapeHttpReply(parsed) {
			if (!isRecord(parsed)) throw httpTransportFailed("回包形状非法", String(parsed).slice(0, 120));
			const out = { ...parsed };
			if ("diagnostic" in out) delete out["diagnostic"];
			if ("diag" in out) {
				const kept = pickHttpDiag(out["diag"]);
				if (kept) out["diag"] = kept;
				else delete out["diag"];
			}
			if (Array.isArray(out["rows"])) out["rows"] = out["rows"].map((row) => {
				if (!isRecord(row)) return row;
				const copy = { ...row };
				if ("diagnostic" in copy) delete copy["diagnostic"];
				if ("diag" in copy) {
					const kept = pickHttpDiag(copy["diag"]);
					if (kept) copy["diag"] = kept;
					else delete copy["diag"];
				}
				return copy;
			});
			return out;
		}
		function timeoutForPhone(phoneName, timeout) {
			if (typeof timeout === "number" && Number.isFinite(timeout) && timeout > 0) return timeout;
			const t = timeout ?? {};
			if (phoneName.endsWith(".updateInstall") || phoneName.endsWith(".batchInstall")) {
				if (typeof t.installMs === "number" && Number.isFinite(t.installMs) && t.installMs > 0) return t.installMs;
				return DEFAULT_HTTP_INSTALL_TIMEOUT_MS;
			}
			if (phoneName.endsWith(".updateCheck") || phoneName.endsWith(".batchCheck")) {
				if (typeof t.checkMs === "number" && Number.isFinite(t.checkMs) && t.checkMs > 0) return t.checkMs;
				return DEFAULT_HTTP_CHECK_TIMEOUT_MS;
			}
			if (typeof t.statusMs === "number" && Number.isFinite(t.statusMs) && t.statusMs > 0) return t.statusMs;
			if (typeof t.checkMs === "number" && Number.isFinite(t.checkMs) && t.checkMs > 0) return t.checkMs;
			return DEFAULT_HTTP_STATUS_TIMEOUT_MS;
		}
		function resolveFetchImpl(options) {
			const impl = options.fetch ?? options.fetchImpl ?? globalThis.fetch;
			if (typeof impl !== "function") throw new Error("[dsh-plugin-update] HTTP 传输缺少抓取函数：请传 fetch 或在有 globalThis.fetch 的环境运行");
			return impl;
		}
		function createHttpCall(options) {
			if (!options || typeof options !== "object") throw new Error("[dsh-plugin-update] 建 HTTP 传输缺少配置：前缀 prefix 与网关根 baseUrl 必填");
			const prefix = options.prefix;
			if (typeof prefix !== "string" || !prefix) throw new Error("[dsh-plugin-update] 电话名前缀 prefix 非法：须为非空字符串");
			if (prefix.includes(".") || prefix.includes("/") || prefix.includes("\\") || /\s/.test(prefix)) throw new Error("[dsh-plugin-update] 电话名前缀 prefix 非法：不得含有点、路径分隔符或空白");
			const baseUrl = options.baseUrl;
			if (typeof baseUrl !== "string" || !baseUrl.trim()) throw new Error("[dsh-plugin-update] 网关根 baseUrl 必填：须为非空字符串");
			const routes = options.routes ?? {};
			assertHttpRoutes(routes, prefix, options.batchPrefix);
			const fetchImpl = resolveFetchImpl(options);
			const timeout = options.timeout ?? options.timeoutMs;
			return async function httpCall(phoneName, args) {
				if (typeof phoneName !== "string" || !phoneName) throw new Error("[dsh-plugin-update] 电话名非法：须为非空字符串");
				const url = resolveHttpPath({
					prefix,
					batchPrefix: options.batchPrefix,
					baseUrl,
					routes
				}, phoneName);
				const safeArgs = args && typeof args === "object" ? args : {};
				const timeoutMs = timeoutForPhone(phoneName, timeout);
				const body = JSON.stringify(stripSignal(safeArgs));
				const AbortCtor = globalThis.AbortController;
				const controller = typeof AbortCtor === "function" ? new AbortCtor() : null;
				const callerSignal = safeArgs["signal"];
				const onCallerAbort = () => {
					try {
						controller?.abort();
					} catch {}
				};
				if (callerSignal && typeof callerSignal.addEventListener === "function") try {
					callerSignal.addEventListener.call(callerSignal, "abort", onCallerAbort, { once: true });
				} catch {}
				let res;
				const fetchPromise = fetchImpl(url, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body,
					...controller ? { signal: controller.signal } : {}
				});
				let timeoutTimer = null;
				fetchPromise.catch(() => {});
				try {
					res = await Promise.race([fetchPromise, new Promise((_, reject) => {
						timeoutTimer = setTimeout(() => {
							try {
								controller?.abort();
							} catch {}
							reject(httpTransportFailed("超时", "抓取超时（" + String(timeoutMs) + "ms）：" + phoneName));
						}, timeoutMs);
					})]);
				} catch (e) {
					if (timeoutTimer) clearTimeout(timeoutTimer);
					if (e && typeof e === "object" && e.code === "http-transport-failed") throw e;
					throw httpTransportFailed(isAbortError(e) ? "超时或取消" : "断网或抓取失败", e instanceof Error ? e.message : String(e));
				}
				if (timeoutTimer) clearTimeout(timeoutTimer);
				if (!(res.ok === true)) {
					const status = res.status;
					const text2 = await readReplyText(res).catch(() => "");
					throw httpTransportFailed("非 2xx（" + String(status ?? "unknown") + "）", "HTTP " + String(status ?? "?") + ": " + String(text2).slice(0, 120));
				}
				const text = await readReplyText(res);
				let parsed;
				try {
					parsed = JSON.parse(text);
				} catch {
					throw httpTransportFailed("JSON 非法", String(text).slice(0, 120));
				}
				return shapeHttpReply(parsed);
			};
		}
		function stripSignal(args) {
			if (!("signal" in args)) return args;
			const out = { ...args };
			delete out["signal"];
			return out;
		}
		function isAbortError(e) {
			const name = e.name;
			return name === "AbortError" || name === "TimeoutError";
		}
		async function readReplyText(res) {
			const textFn = res.text;
			if (typeof textFn === "function") return String(await textFn.call(res));
			const jsonFn = res.json;
			if (typeof jsonFn === "function") return JSON.stringify(await jsonFn.call(res));
			throw httpTransportFailed("回包形状非法", "抓取回包既无 text() 也无 json()");
		}
		function mountUpdatePanelHttp(container, options) {
			if (!options || typeof options !== "object") throw new Error("[dsh-plugin-update] 挂 HTTP 面板缺少配置：插件标识 pluginId 与网关根 baseUrl 必填");
			const prefix = options.prefix ?? "wf";
			const call = createHttpCall({
				prefix,
				baseUrl: options.baseUrl,
				routes: options.routes,
				fetch: options.fetch,
				fetchImpl: options.fetchImpl,
				timeout: options.timeout,
				timeoutMs: options.timeoutMs
			});
			const { baseUrl: _b, routes: _r, fetch: _f, fetchImpl: _fi, timeout: _t, timeoutMs: _tm, prefix: _p, ...panelRest } = options;
			return mountUpdatePanel(container, {
				...panelRest,
				pluginId: options.pluginId,
				prefix,
				call
			});
		}
		function mountUpdateEntryHttp(container, options) {
			if (!options || typeof options !== "object") throw new Error("[dsh-plugin-update] 挂 HTTP 入口件缺少配置：插件标识 pluginId 与网关根 baseUrl 必填");
			const prefix = options.prefix ?? "wf";
			const rawCall = createHttpCall({
				prefix,
				baseUrl: options.baseUrl,
				routes: options.routes,
				fetch: options.fetch,
				fetchImpl: options.fetchImpl,
				timeout: options.timeout,
				timeoutMs: options.timeoutMs
			});
			const guarded = async (name, args) => {
				if (shortActionOf(name) === "updateInstall") throw new Error("[dsh-plugin-update] 入口件只允许只读电话，updateInstall 禁止（源码级）");
				return rawCall(name, args);
			};
			const { baseUrl: _b, routes: _r, fetch: _f, fetchImpl: _fi, timeout: _t, timeoutMs: _tm, prefix: _p, ...entryRest } = options;
			return mountUpdateEntry(container, {
				...entryRest,
				pluginId: options.pluginId,
				prefix,
				call: guarded
			});
		}
		//#endregion
		//#region src/client/update-http.ts
		/**
		* dsh-prompt — 更新整组件 HTTP 接线（#128）
		*
		* 0.3.1 万能插头：mountUpdateEntryHttp(button) + mountUpdatePanelHttp(embedded,默认主题)。
		* 三要素与网关同值：pluginId dsh-prompt、prefix prompt、baseUrl /_dsh/dsh-prompt/update，
		* routes { updateStatus:status, updateCheck:check, updateInstall:install } 落到宿主三条路由
		* （src/update/host/paths.ts）。宿主网关已改裸回包（方案A），http helper 取回即整形透传。
		*
		* 只查不开自动装：入口 autoCheck mount（只读查一次）+ openOn has-update（有新版才开面板），
		* 入口源码级禁 install（包内 guarded，调即抛）；面板挂载即 refresh 查一次，安装只走用户点击。
		* 失败 fail-soft：挂载抛错（无 fetch / 网关不可达）时留空容器，不挡设置页其余卡。
		*/
		/** 与宿主三条路由同值（baseUrl + 短动作覆写拼出 status/check/install，不写电话名字面量）。 */
		const UPDATE_PLUGIN_ID = "dsh-prompt";
		const UPDATE_PREFIX = "prompt";
		const UPDATE_BASE_URL = "/_dsh/dsh-prompt/update";
		const UPDATE_ROUTES = {
			updateStatus: "status",
			updateCheck: "check",
			updateInstall: "install"
		};
		/** 头行入口按钮（settings 头行 🌟/💬 之前，与 #60 旧落位一致）。 */
		function UpdateEntryButton(_props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const ref = react.useRef(null);
			react.useEffect(() => {
				const el = ref.current;
				if (!el) return void 0;
				let ctrl = null;
				try {
					ctrl = mountUpdateEntryHttp(el, {
						pluginId: UPDATE_PLUGIN_ID,
						prefix: UPDATE_PREFIX,
						baseUrl: UPDATE_BASE_URL,
						routes: { ...UPDATE_ROUTES },
						variant: "button",
						theme: "default",
						autoCheck: "mount",
						openOn: "has-update"
					});
				} catch (e) {
					return;
				}
				return () => {
					try {
						if (ctrl && typeof ctrl.unmount === "function") ctrl.unmount();
					} catch (e) {}
				};
			}, []);
			return h("span", {
				ref,
				style: {
					display: "inline-flex",
					alignItems: "center"
				},
				"data-dsh-prompt-update-entry": ""
			});
		}
		/** 设置页内嵌面板（embedded + 默认主题，挂载即查一次，安装走用户点击）。 */
		function UpdatePanelEmbedded(_props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const ref = react.useRef(null);
			react.useEffect(() => {
				const el = ref.current;
				if (!el) return void 0;
				let ctrl = null;
				try {
					ctrl = mountUpdatePanelHttp(el, {
						pluginId: UPDATE_PLUGIN_ID,
						prefix: UPDATE_PREFIX,
						baseUrl: UPDATE_BASE_URL,
						routes: { ...UPDATE_ROUTES },
						mode: "embedded",
						theme: "default"
					});
				} catch (e) {
					return;
				}
				return () => {
					try {
						if (ctrl && typeof ctrl.unmount === "function") ctrl.unmount();
					} catch (e) {}
				};
			}, []);
			return h("div", {
				ref,
				"data-dsh-prompt-update-panel": ""
			});
		}
		//#endregion
		//#region src/client/systemOrientation.ts
		const ORIENT_URL = "/_dsh/dsh-prompt/system/orientation";
		/** OS 方向校验（纯函数；`auto` 不合法——它不进 OS） */
		function isSystemOrientation(v) {
			return v === "landscape" || v === "portrait";
		}
		/** 错误码归一化（纯函数；码表封闭四码，外来码一律落 unknown） */
		function normalizeOrientCode(v) {
			return v === "unsupported" || v === "busy" || v === "denied" || v === "unknown" ? v : "unknown";
		}
		/** 归一化对端回包（纯函数；宿主旧版本/手造坏包走此，不抛） */
		function normalizeSystemOrientResponse(data) {
			try {
				const o = data || {};
				if (o && o.ok === true && isSystemOrientation(o.orientation)) {
					const out = {
						ok: true,
						orientation: o.orientation
					};
					if (o.source === "live" || o.source === "cached") out.source = o.source;
					if (typeof o.changed === "boolean") out.changed = o.changed;
					return out;
				}
				const err = o && o.error || {};
				return {
					ok: false,
					error: {
						code: normalizeOrientCode(err.code),
						message: typeof err.message === "string" && err.message ? err.message : "orientation-unknown"
					}
				};
			} catch (e) {
				return {
					ok: false,
					error: {
						code: "unknown",
						message: "orientation-normalize-failed"
					}
				};
			}
		}
		function defaultFetch() {
			try {
				if (typeof fetch === "undefined") return null;
				return fetch.bind(globalThis);
			} catch (e) {
				return null;
			}
		}
		async function callOrient(method, body, fetchImpl, timeoutMs) {
			const f = fetchImpl === void 0 ? defaultFetch() : fetchImpl;
			if (!f) return {
				ok: false,
				error: {
					code: "unsupported",
					message: "orientation-no-bridge"
				}
			};
			let timer = null;
			try {
				const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
				if (ctrl) timer = setTimeout(() => {
					try {
						ctrl.abort();
					} catch (e) {}
				}, timeoutMs);
				const res = await f(ORIENT_URL, {
					method,
					headers: { "content-type": "application/json" },
					body: body === void 0 ? void 0 : JSON.stringify(body),
					signal: ctrl ? ctrl.signal : void 0
				});
				if (!res || res.ok !== true) return {
					ok: false,
					error: {
						code: "unknown",
						message: "orientation-http-" + (res && res.status ? res.status : "unreachable")
					}
				};
				return normalizeSystemOrientResponse(await res.json().catch(() => null));
			} catch (e) {
				return {
					ok: false,
					error: {
						code: "unknown",
						message: "orientation-" + String(e && e.name || "failed")
					}
				};
			} finally {
				try {
					if (timer) clearTimeout(timer);
				} catch (e) {}
			}
		}
		/** 查询 OS 真值（主屏；失败由调用方回落，不抛） */
		function getSystemOrientation(fetchImpl, timeoutMs = 12e3) {
			return callOrient("GET", void 0, fetchImpl, timeoutMs).then((r) => {
				if (r.ok) logEvent$2("system.orientation.get", {
					ok: true,
					orientation: r.orientation
				});
				else logEvent$2("system.orientation.get", {
					ok: false,
					code: r.error.code
				});
				return r;
			});
		}
		/**
		* 真切 OS（只接受 landscape/portrait；非法输入不出网，直接回 unknown，
		* 与 host 码表封闭约定一致）。
		*/
		function setSystemOrientation(target, fetchImpl, timeoutMs = 12e3) {
			if (!isSystemOrientation(target)) {
				const r = {
					ok: false,
					error: {
						code: "unknown",
						message: "orientation-invalid-target"
					}
				};
				logEvent$2("system.orientation.set", {
					ok: false,
					code: r.error.code
				});
				return Promise.resolve(r);
			}
			return callOrient("POST", { orientation: target }, fetchImpl, timeoutMs).then((r) => {
				if (r.ok) logEvent$2("system.orientation.set", {
					ok: true,
					orientation: r.orientation
				});
				else logEvent$2("system.orientation.set", {
					ok: false,
					code: r.error.code
				});
				return r;
			});
		}
		/** 记一条日志事件（槽机制与 remote.ts 同构；能力缺席时空操作） */
		function logEvent$2(event, fields) {
			try {
				const log = globalThis.__dshPromptLog;
				if (log && typeof log.log === "function") log.log(event, fields);
			} catch (e) {}
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
		/** 一行：标签在左、控件在右，说明占满行宽正常流排（此前 maxWidth:520 在宽弹窗里半屏换行）。 */
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
					fontSize: "0.93em",
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
					fontSize: "0.86em",
					lineHeight: 1.65,
					color: TOK.labelTertiary
				}
			}, props.description));
			return h("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 6,
				padding: "10px 0"
			} }, kids);
		}
		/**
		* 组卡片外壳：边框 + 圆角 + 组外边距。**一处定义**，SettingGroup 与「模板列表」那张卡共用
		* （#77 收尾：模板区此前是一条裸行，夹在两张有壳的卡片之间显得格格不入 —— 现在它也是卡片）。
		* `pad` 可覆盖内边距：内嵌自带 padding 的组件时用更小的值把内容左轨配平到 14px。
		*/
		const cardStyle = (pad) => ({
			border: "1px solid " + TOK.border,
			borderRadius: 12,
			padding: pad,
			margin: "14px 0 4px",
			display: "flex",
			flexDirection: "column",
			fontFamily: TOK.font
		});
		/** 一组：卡片 + 组标题，组内元素由调用方给，间距由这里统一。 */
		function SettingGroup(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			return h("section", { style: cardStyle(props.pad || "2px 14px 12px") }, [props.title ? h("div", {
				key: "title",
				style: {
					fontSize: "0.86em",
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
				fontSize: "0.89em",
				padding: "6px 12px",
				borderRadius: 8,
				cursor: "pointer",
				transition: "background-color .12s ease, color .12s ease, border-color .12s ease"
			};
			const style = tone === "ghost" ? {
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
			};
			const extra = {};
			try {
				if (props.title !== void 0) extra.title = props.title;
				if (props.disabled !== void 0) extra.disabled = props.disabled;
				for (const k of Object.keys(props || {})) if (k.indexOf("data-") === 0 || k.indexOf("aria-") === 0) extra[k] = props[k];
			} catch (e) {}
			return h("button", {
				type: "button",
				style: props.disabled ? {
					...style,
					cursor: "not-allowed",
					opacity: .6
				} : style,
				onMouseEnter: () => hoverState[1](true),
				onMouseLeave: () => hoverState[1](false),
				onClick: props.onClick,
				...extra
			}, props.children);
		}
		/** 复选框：宿主风格的圆角小方框（accent-color 跟随主题），不再是自己画一个控件。
		* 尺寸走 em 吃设置页根 scale（远程开大档一起变大）；flex:none 保命中区不小于框体。
		* 原生 input 不继承 font-size（UA 样式自带字号），em 会锚死在默认字号上跟档无感，
		* 故显式 fontSize:inherit 把父级（已随档缩放的根）字号接进来；关=根回基准，原样。 */
		function Check(props) {
			const react = getReact();
			if (!react) return null;
			return react.createElement("input", {
				type: "checkbox",
				checked: props.checked,
				disabled: props.disabled,
				style: {
					width: "1.15em",
					height: "1.15em",
					flex: "none",
					fontSize: "inherit",
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
			const remoteState = react.useState(getRemotePrefs());
			const remote = remoteState[0];
			const persistState = react.useState(getRemotePersistState());
			const remotePersist = persistState[0];
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
			react.useEffect(() => {
				try {
					ensureRemoteLoaded().catch(() => void 0);
				} catch (e) {}
				return subscribeRemote(() => {
					try {
						remoteState[1](getRemotePrefs());
						persistState[1](getRemotePersistState());
					} catch (e) {}
				});
			}, []);
			react.useEffect(() => {
				try {
					warmEnvOrientation(() => getSystemOrientation()).then(() => {
						try {
							remoteState[1](getRemotePrefs());
						} catch (e) {}
					});
				} catch (e) {}
			}, []);
			react.useEffect(() => {
				let mine = null;
				try {
					const g = globalThis;
					mine = () => {
						try {
							const go = g.__dshPromptGoSettings;
							if (typeof go === "function") go();
						} catch (e) {}
						setTimeout(() => {
							try {
								if (typeof document === "undefined") return;
								const el = document.querySelector("[data-dsh-prompt-remote-section]");
								if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "start" });
							} catch (e) {}
						}, 300);
					};
					g.__dshPromptGoRemoteSettings = mine;
				} catch (e) {}
				return () => {
					try {
						const g = globalThis;
						if (mine && g.__dshPromptGoRemoteSettings === mine) delete g.__dshPromptGoRemoteSettings;
					} catch (e) {}
				};
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
				fontSize: "0.86em",
				lineHeight: 1.65,
				color: TOK.labelTertiary,
				paddingTop: 8
			};
			const orientationControl = (current, onPick, busy, remoteOff) => {
				const opts = [
					"auto",
					"landscape",
					"portrait"
				];
				const labelOf = (v) => v === "auto" ? t("remoteOrientationAuto") : v === "landscape" ? t("remoteOrientationLandscape") : t("remoteOrientationPortrait");
				const dis = !!busy || !!remoteOff;
				return h("div", {
					style: {
						display: "flex",
						gap: 6
					},
					"data-dsh-prompt-remote-orientation": "1"
				}, opts.map((v) => h("button", {
					key: v,
					type: "button",
					disabled: dis,
					"data-dsh-prompt-orientation": v,
					"aria-pressed": current === v ? "true" : "false",
					"aria-disabled": dis ? "true" : "false",
					title: dis ? t("remoteNeedOn") : void 0,
					style: dis ? {
						flex: 1,
						textAlign: "center",
						fontFamily: TOK.font,
						fontSize: "0.86em",
						padding: "5px 12px",
						borderRadius: 8,
						cursor: "not-allowed",
						border: "1px solid " + TOK.border,
						background: "transparent",
						color: TOK.labelTertiary,
						opacity: 1
					} : {
						flex: 1,
						textAlign: "center",
						fontFamily: TOK.font,
						fontSize: "0.86em",
						padding: "5px 12px",
						borderRadius: 8,
						cursor: "pointer",
						border: "1px solid " + TOK.border,
						background: current === v ? TOK.accent : "transparent",
						color: current === v ? "#fff" : TOK.labelPrimary,
						opacity: 1
					},
					onClick: () => {
						if (!dis) onPick(v);
					}
				}, labelOf(v))));
			};
			const densityControl = (current, onPick, remoteOff) => {
				const opts = ["a", "b"];
				const labelOf = (v) => v === "a" ? t("remoteDensityA") : t("remoteDensityB");
				return h("div", {
					style: {
						display: "flex",
						gap: 6
					},
					"data-dsh-prompt-remote-density": "1"
				}, opts.map((v) => h("button", {
					key: v,
					type: "button",
					disabled: !!remoteOff,
					"data-dsh-prompt-density": v,
					"aria-pressed": current === v ? "true" : "false",
					"aria-disabled": remoteOff ? "true" : "false",
					title: remoteOff ? t("remoteNeedOn") : void 0,
					style: remoteOff ? {
						flex: 1,
						textAlign: "center",
						whiteSpace: "nowrap",
						fontFamily: TOK.font,
						fontSize: "0.86em",
						padding: "5px 12px",
						borderRadius: 8,
						cursor: "not-allowed",
						border: "1px solid " + TOK.border,
						background: "transparent",
						color: TOK.labelTertiary,
						opacity: 1
					} : {
						flex: 1,
						textAlign: "center",
						whiteSpace: "nowrap",
						fontFamily: TOK.font,
						fontSize: "0.86em",
						padding: "5px 12px",
						borderRadius: 8,
						cursor: "pointer",
						border: "1px solid " + TOK.border,
						background: current === v ? TOK.accent : "transparent",
						color: current === v ? "#fff" : TOK.labelPrimary,
						opacity: 1
					},
					onClick: () => {
						if (!remoteOff) onPick(v);
					}
				}, labelOf(v))));
			};
			const orientBusyState = react.useState(false);
			const orientBusy = orientBusyState[0];
			const orientNoteState = react.useState("");
			const orientNote = orientNoteState[0];
			const landOrientation = (v, note) => {
				const next = setRemoteOrientation(v);
				remoteState[1]({ ...next });
				persistState[1](getRemotePersistState());
				orientNoteState[1](note);
				orientBusyState[1](false);
			};
			const onPickOrientation = (v) => {
				if (v === "auto" || orientBusy) {
					if (v === "auto" && !orientBusy) landOrientation("auto", "");
					return;
				}
				if (!isSystemOrientation(v)) return;
				orientBusyState[1](true);
				orientNoteState[1](t("remoteOrientationBusy"));
				(async () => {
					let r;
					try {
						r = await setSystemOrientation(v);
					} catch (e) {
						r = {
							ok: false,
							error: {
								code: "unknown",
								message: "orientation-failed"
							}
						};
					}
					if (r && r.ok) {
						try {
							setEnvOrientation({ orientation: v });
						} catch (e) {}
						landOrientation(v, "");
					} else {
						const code = r && r.error && r.error.code || "unknown";
						landOrientation(v, t("remoteOrientationOsFail").replace("{code}", code));
					}
				})().catch(() => void 0);
			};
			const hairline = (key) => h("div", {
				key,
				style: { borderTop: "1px solid " + TOK.border }
			});
			const orientPref = remote.orientation || "auto";
			let viewportOrient = null;
			try {
				if (typeof window !== "undefined" && typeof window.innerWidth === "number" && typeof window.innerHeight === "number") viewportOrient = deriveRemoteOrientation(window.innerWidth, window.innerHeight);
			} catch (e) {
				viewportOrient = null;
			}
			let envOrient = null;
			try {
				const e = getEnvOrientation();
				envOrient = e ? e.orientation : null;
			} catch (err) {
				envOrient = null;
			}
			const orientLabel = resolveEffectiveOrientation(orientPref, envOrient, viewportOrient) === "landscape" ? t("remoteOrientationLandscape") : t("remoteOrientationPortrait");
			const effectiveCaption = orientPref === "landscape" || orientPref === "portrait" ? t("remoteLockedOrientation").replace("{orient}", orientLabel) : t("remoteEffectiveNow").replace("{orient}", orientLabel).replace("{source}", t(envOrient ? "remoteSourceSystem" : "remoteSourceViewport"));
			const remoteGroup = h("section", {
				key: "remote",
				style: cardStyle("2px 14px 12px"),
				"data-dsh-prompt-remote-section": "1"
			}, [
				h(SettingRow, {
					key: "remote-switch",
					label: t("remoteToggle"),
					control: h(Check, {
						checked: !!remote.enabled,
						"data-dsh-prompt-remote-toggle": "1",
						onChange: (e) => {
							const on = !!e.target.checked;
							const entering = on === true && remote.enabled !== true;
							const next = setRemoteEnabled(on);
							remoteState[1]({ ...next });
							persistState[1](getRemotePersistState());
							if (entering) try {
								warmEnvOrientation(() => getSystemOrientation()).catch(() => void 0);
							} catch (e) {}
						}
					})
				}),
				hairline("sep-switch-size"),
				h("div", {
					key: "remote-size",
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 6,
						padding: "10px 0"
					}
				}, [h("div", {
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
						fontSize: "0.93em",
						color: TOK.labelPrimary
					}
				}, t("remoteSize")), h("span", {
					key: "val",
					style: {
						fontFamily: TOK.font,
						fontSize: "0.86em",
						color: TOK.labelPrimary,
						padding: "2px 10px",
						border: "1px solid " + TOK.border,
						borderRadius: 999,
						fontVariantNumeric: "tabular-nums",
						whiteSpace: "nowrap",
						flex: "none"
					},
					"data-dsh-prompt-size-value": "1"
				}, remote.size + "档·" + Math.round(remoteSizeScale(remote.size) * 100) + "%")]), h("div", {
					key: "slider-row",
					style: {
						display: "flex",
						alignItems: "center",
						gap: 8
					}
				}, [
					h("span", {
						key: "min",
						style: {
							fontFamily: TOK.font,
							fontSize: "0.82em",
							color: TOK.labelTertiary,
							flex: "none"
						}
					}, t("remoteSizeMin")),
					h("input", {
						key: "slider",
						type: "range",
						min: 1,
						max: 10,
						step: 1,
						value: remote.size,
						disabled: !remote.enabled,
						"data-dsh-prompt-size-slider": "1",
						"aria-label": t("remoteSize"),
						style: {
							flex: 1,
							minWidth: 0,
							accentColor: TOK.accent,
							cursor: !remote.enabled ? "not-allowed" : "pointer",
							margin: 0,
							transform: remote.enabled ? "scale(1, " + remoteSizeScale(remote.size) + ")" : "none",
							transformOrigin: "left center",
							opacity: !remote.enabled ? .6 : 1
						},
						onChange: (e) => {
							const next = setRemoteSize(Number(e.target.value));
							remoteState[1]({ ...next });
							persistState[1](getRemotePersistState());
						}
					}),
					h("span", {
						key: "max",
						style: {
							fontFamily: TOK.font,
							fontSize: "0.82em",
							color: TOK.labelTertiary,
							flex: "none"
						}
					}, t("remoteSizeMax"))
				])]),
				hairline("sep-size-orient"),
				h(SettingRow, {
					key: "remote-orientation",
					label: t("remoteOrientation"),
					description: t("remoteOrientationHint"),
					control: orientationControl(orientPref, onPickOrientation, orientBusy, !remote.enabled)
				}),
				h("div", {
					key: "remote-orientation-effective",
					style: {
						...noteStyle,
						paddingTop: 0,
						paddingBottom: 8
					},
					"data-dsh-prompt-orientation-effective": "1"
				}, effectiveCaption),
				hairline("sep-orient-density"),
				h(SettingRow, {
					key: "remote-density",
					label: t("remoteDensity"),
					control: densityControl(remote.density || "a", (v) => {
						const next = setRemoteDensity(v);
						remoteState[1]({ ...next });
						persistState[1](getRemotePersistState());
					}, !remote.enabled)
				}),
				orientNote ? h("div", {
					key: "remote-orientation-note",
					style: noteStyle,
					"data-dsh-prompt-orientation-note": "1"
				}, orientNote) : null,
				remotePersist.failed ? h("div", {
					key: "remote-persist-note",
					style: noteStyle
				}, t("remotePersistFail")) : null
			]);
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
						fontSize: "0.82em",
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
						fontSize: "0.82em",
						color: TOK.labelTertiary
					}
				}, t("logDropped") + " " + dropped) : null])
			]);
			if (note) logGroup.props.children.push(h("div", {
				key: "log-note",
				style: noteStyle
			}, note));
			const updateGroup = h(SettingGroup, {
				key: "update",
				title: "更新"
			}, [h(UpdatePanelEmbedded, { key: "panel" })]);
			return h("div", { style: {
				padding: 4,
				display: "flex",
				flexDirection: "column",
				fontSize: scaledBaseFontSize(remote.enabled, remote.size)
			} }, [
				h(SettingsHeaderLinks, {
					key: "links",
					lang,
					entry: h(UpdateEntryButton, { key: "update" })
				}),
				h(SettingGroup, {
					key: "list",
					pad: "4px 6px 8px"
				}, [h(TemplateBrowser, {
					key: "browser",
					compact: false,
					collapsible: true
				})]),
				updateGroup,
				remoteGroup,
				logGroup,
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
		function asString(v) {
			return typeof v === "string" ? v : "";
		}
		/** 容错读会话归属 id：workspaceId / workspace_id / workspace / groupId / wsId，只认非空 string */
		function sessionWorkspaceIdOf(raw) {
			try {
				if (!raw || typeof raw !== "object") return null;
				const cands = [
					raw.workspaceId,
					raw.workspace_id,
					raw.workspace,
					raw.groupId,
					raw.wsId
				];
				for (const c of cands) {
					if (typeof c === "string" && c.trim() !== "") return c;
					if (c && typeof c === "object" && typeof c.id === "string" && c.id.trim() !== "") return c.id;
				}
				return null;
			} catch (e) {
				return null;
			}
		}
		function sessionTitleOf(raw, fallbackId) {
			try {
				const cands = [
					raw.title,
					raw.name,
					raw.label
				];
				for (const c of cands) if (typeof c === "string" && c.trim() !== "") return c;
				return fallbackId;
			} catch (e) {
				return fallbackId;
			}
		}
		function sessionCwdOf(raw) {
			try {
				const cands = [
					raw.cwd,
					raw.path,
					raw.dir,
					raw.workdir,
					raw.workspacePath
				];
				for (const c of cands) if (typeof c === "string" && c !== "") return c;
				if (raw && raw.meta && typeof raw.meta === "object") {
					const m = raw.meta.cwd;
					if (typeof m === "string" && m !== "") return m;
				}
				if (raw && raw.header && typeof raw.header === "object") {
					const h = raw.header.cwd;
					if (typeof h === "string" && h !== "") return h;
				}
				return "";
			} catch (e) {
				return "";
			}
		}
		function sessionTimeOf(raw) {
			try {
				const cands = [
					raw.updatedAt,
					raw.updated_at,
					raw.mtime,
					raw.lastOpenedAt,
					raw.lastActiveAt
				];
				for (const c of cands) {
					const n = Number(c);
					if (isFinite(n) && n > 0) return n < 0xe8d4a51000 ? n * 1e3 : n;
				}
				return 0;
			} catch (e) {
				return 0;
			}
		}
		function sessionBlankOf(raw, title) {
			try {
				if (raw.blank === true) return true;
				if (raw.isBlank === true) return true;
				if (/空白/.test(title)) return true;
				if (title.trim() === "") return true;
				return false;
			} catch (e) {
				return false;
			}
		}
		/** 单条归一（fail-soft：无 id 回 null，调用方过滤）。
		*  归属优先取 `index`（工作区登记反查，见 buildWorkspaceIndex）；查不到才退回会话自身字段探测。 */
		function normalizeSession(raw, workspaceNames, index) {
			try {
				if (!raw || typeof raw !== "object") return null;
				const id = asString(raw.id || raw.sid || raw.sessionId);
				if (id === "") return null;
				let hit = null;
				try {
					hit = index && typeof index.get === "function" ? index.get(id) || null : null;
				} catch (e) {
					hit = null;
				}
				const wsId = hit ? hit.workspaceId : sessionWorkspaceIdOf(raw);
				let wsName = hit ? hit.workspaceName : "";
				try {
					if (workspaceNames instanceof Map) wsName = wsName || workspaceNames.get(wsId || "") || "";
					else if (workspaceNames && typeof workspaceNames === "object") wsName = wsName || workspaceNames[wsId || ""] || "";
				} catch (e) {}
				if (!wsName && raw && typeof raw === "object") {
					const cands = [
						raw.workspaceName,
						raw.workspace_name,
						raw.groupName
					];
					for (const c of cands) if (typeof c === "string" && c.trim() !== "") {
						wsName = c;
						break;
					}
				}
				const title = sessionTitleOf(raw, id);
				const ownCwd = sessionCwdOf(raw);
				return {
					id,
					title,
					workspaceId: wsId,
					workspaceName: wsName || wsId || "",
					cwd: ownCwd || (hit ? hit.path : ""),
					updatedAt: sessionTimeOf(raw),
					blank: sessionBlankOf(raw, title)
				};
			} catch (e) {
				return null;
			}
		}
		/** 从多态快照里捞出原始条目数组（数组 / {items} / {sessions} / {byId}，其余回 []，不抛） */
		function rawSessionItems(input) {
			try {
				if (!input) return [];
				if (Array.isArray(input)) return input;
				const o = input;
				if (Array.isArray(o.items)) return o.items;
				if (Array.isArray(o.sessions)) return o.sessions;
				if (Array.isArray(o.list)) return o.list;
				if (o.byId && typeof o.byId === "object") try {
					return Object.keys(o.byId).map((k) => o.byId[k]);
				} catch (e) {
					return [];
				}
				if (typeof o === "object") {
					if (typeof o.id === "string" && o.id !== "") return [o];
				}
				return [];
			} catch (e) {
				return [];
			}
		}
		/** 批量归一（去重保首见序，无 id 行丢弃，不抛） */
		function normalizeSessions(input, workspaceNames, index) {
			try {
				const raws = rawSessionItems(input);
				const out = [];
				const seen = /* @__PURE__ */ new Set();
				for (const r of raws) {
					const s = normalizeSession(r, workspaceNames, index);
					if (!s || seen.has(s.id)) continue;
					seen.add(s.id);
					out.push(s);
				}
				return out;
			} catch (e) {
				return [];
			}
		}
		/**
		* 从多态工作区登记里捞出原始登记数组（数组 / {items} / {workspaces} / {list} / {byId} / 单体，不抛）。
		* 名字表与反查索引共用这一条形态解析，两处不再各认一份形状。
		*/
		function rawWorkspaceItems(input) {
			try {
				if (!input) return [];
				if (Array.isArray(input)) return input;
				const o = input;
				if (Array.isArray(o.items)) return o.items;
				if (Array.isArray(o.workspaces)) return o.workspaces;
				if (Array.isArray(o.list)) return o.list;
				if (o.byId && typeof o.byId === "object") try {
					return Object.keys(o.byId).map((k) => {
						const r = o.byId[k];
						if (r && typeof r === "object" && typeof r.id === "string") return r;
						if (typeof r === "string") return {
							id: k,
							name: r
						};
						return {
							id: k,
							name: ""
						};
					});
				} catch (e) {
					return [];
				}
				if (typeof o === "object" && typeof o.id === "string" && o.id !== "") return [o];
				return [];
			} catch (e) {
				return [];
			}
		}
		/** 从多态工作区登记里捞出 id→名（数组 / {items} / {byId} / 单体，不抛） */
		function normalizeWorkspaceNames(input) {
			const out = /* @__PURE__ */ new Map();
			try {
				const pushOne = (r) => {
					try {
						if (!r || typeof r !== "object") return;
						const id = asString(r.id || r.workspaceId || r.key);
						if (id === "") return;
						const name = asString(r.name || r.title || r.label) || id;
						if (!out.has(id)) out.set(id, name);
					} catch (e) {}
				};
				for (const r of rawWorkspaceItems(input)) pushOne(r);
				return out;
			} catch (e) {
				return out;
			}
		}
		/**
		* 工作区登记 → `sessionId → 归属` 反查索引（**归属的权威来源**）。
		*
		* 宿主的归属关系存在**工作区这一侧**：`workspaceView` 的形状是
		* `{ workspaceId, path, title, sessionIds: string[], createdAt, updatedAt }`，
		* 会话对象自身**不带任何 workspaceId 字段**。所以归属只能从工作区登记反查——
		* 去会话身上找字段那条路恒为 null，会让所有会话塌进未归属桶、分组整面失效。
		* 登记里没有的会话保持无归属（调用方归未归属桶），不猜、不按 path 兜底。
		*/
		function buildWorkspaceIndex(input) {
			const out = /* @__PURE__ */ new Map();
			try {
				for (const r of rawWorkspaceItems(input)) {
					if (!r || typeof r !== "object") continue;
					const workspaceId = asString(r.workspaceId || r.id || r.key);
					if (workspaceId === "") continue;
					const workspaceName = asString(r.title || r.name || r.label) || workspaceId;
					const path = asString(r.path);
					const ids = Array.isArray(r.sessionIds) ? r.sessionIds : [];
					for (const sid of ids) {
						const id = asString(sid);
						if (id === "" || out.has(id)) continue;
						out.set(id, {
							workspaceId,
							workspaceName,
							path
						});
					}
				}
			} catch (e) {
				return out;
			}
			return out;
		}
		/**
		* 纯视图分组（#107 Q3 / #111 US8–US11）：
		* - 按 workspaceId 分组，无归属（null/''）进未归属桶；
		* - 未归属桶置底；其余组按组内最新倒序；
		* - 组内按 updatedAt 倒序；组头名 = 登记名 || workspaceId || 未归属；
		* - 同标题行打 collision=true（全局统计：跨组同名恰是真消歧场景；原型按组统计，此处故意 diverged，见审查结论 #9）；
		* - 不读存储不碰界面，纯函数。
		*/
		function groupWorkspaceSessions(sessions, workspaceNames, ungroupedName) {
			try {
				const list = Array.isArray(sessions) ? sessions.slice() : [];
				const unName = typeof ungroupedName === "string" && ungroupedName !== "" ? ungroupedName : "未归属";
				const nameOf = (wsId) => {
					try {
						if (!wsId) return unName;
						if (workspaceNames instanceof Map) return workspaceNames.get(wsId) || wsId;
						if (workspaceNames && typeof workspaceNames[wsId] === "string") return workspaceNames[wsId] || wsId;
						return wsId;
					} catch (e) {
						return wsId || unName;
					}
				};
				const withNames = list.map((s) => {
					if (s.workspaceName && s.workspaceName !== "") return s;
					if (!s.workspaceId) return {
						...s,
						workspaceName: unName
					};
					return {
						...s,
						workspaceName: nameOf(s.workspaceId)
					};
				});
				const titleCount = /* @__PURE__ */ new Map();
				for (const s of withNames) titleCount.set(s.title, (titleCount.get(s.title) || 0) + 1);
				const marked = withNames.map((s) => ({
					...s,
					collision: (titleCount.get(s.title) || 0) > 1
				}));
				const map = /* @__PURE__ */ new Map();
				const order = [];
				for (const s of marked) {
					const k = s.workspaceId || "__ungrouped";
					let g = map.get(k);
					if (!g) {
						g = {
							key: k,
							workspaceId: s.workspaceId,
							name: s.workspaceId ? nameOf(s.workspaceId) : unName,
							items: [],
							latest: 0,
							ungrouped: !s.workspaceId
						};
						map.set(k, g);
						order.push(k);
					}
					g.items.push(s);
					if (s.updatedAt > g.latest) g.latest = s.updatedAt;
				}
				const groups = order.map((k) => map.get(k));
				for (const g of groups) g.items.sort((a, b) => b.updatedAt - a.updatedAt);
				groups.sort((a, b) => {
					if (a.ungrouped && !b.ungrouped) return 1;
					if (!a.ungrouped && b.ungrouped) return -1;
					return b.latest - a.latest;
				});
				return groups;
			} catch (e) {
				return [];
			}
		}
		/** 搜索 haystack（标题 + 工作区名，未归属行用展示名回填，保证搜“未归属”可达；拼音/cwd 全文首版不做，留缝） */
		function sessionHaystack(s, ungroupedName) {
			try {
				const wn = (s.workspaceName || "") !== "" ? s.workspaceName : asString(ungroupedName) || "";
				return ((s.title || "") + " " + wn).toLowerCase();
			} catch (e) {
				return "";
			}
		}
		/** 搜索过滤（#107 Q4 / #111 US12–US14：大小写不敏感子串；空查询回全量；无结果回 [] 由调用方进空态，不回退） */
		function filterWorkspaceSessions(sessions, query, ungroupedName) {
			try {
				const list = Array.isArray(sessions) ? sessions : [];
				const q = String(query || "").trim().toLowerCase();
				if (q === "") return list.slice();
				return list.filter((s) => sessionHaystack(s, ungroupedName).indexOf(q) >= 0);
			} catch (e) {
				return [];
			}
		}
		/** 紧凑相对时间（v7 口径中文：刚刚/5分/3时/2天；英文：now/5m/3h/2d；悬停看绝对，不抛） */
		function relativeWorkspaceTime(ts, now, lang) {
			try {
				const en = lang === "en";
				const t = Number(ts);
				if (!isFinite(t) || t <= 0) return "";
				const d = (typeof now === "number" && isFinite(now) ? now : Date.now()) - t;
				if (d < 0) return en ? "now" : "刚刚";
				const m = Math.floor(d / 6e4);
				if (m < 1) return en ? "now" : "刚刚";
				if (m < 60) return en ? m + "m" : m + "分";
				const h = Math.floor(m / 60);
				if (h < 24) return en ? h + "h" : h + "时";
				return en ? Math.floor(h / 24) + "d" : Math.floor(h / 24) + "天";
			} catch (e) {
				return "";
			}
		}
		/** 绝对时间（title 悬停用，失败回 String(ts)，不抛） */
		function absoluteWorkspaceTime(ts) {
			try {
				const t = Number(ts);
				if (!isFinite(t) || t <= 0) return "";
				try {
					return new Date(t).toLocaleString();
				} catch (e) {
					return String(ts);
				}
			} catch (e) {
				return "";
			}
		}
		/** 工作区配色（v7 色点通道：按 workspaceId 稳定哈希进固定调色盘，null 进未归属位；只定可辨，不定具体色） */
		const WORKSPACE_DOT_COLORS = [
			"#f0a45c",
			"#7fd08a",
			"#b388ff",
			"#6cb8e0",
			"#e06c75",
			"#8ad0c8"
		];
		function workspaceColor(wsId) {
			try {
				const s = typeof wsId === "string" && wsId !== "" ? wsId : "__ungrouped";
				let acc = 0;
				for (let i = 0; i < s.length; i++) acc = acc * 31 + s.charCodeAt(i) >>> 0;
				return WORKSPACE_DOT_COLORS[acc % WORKSPACE_DOT_COLORS.length];
			} catch (e) {
				return WORKSPACE_DOT_COLORS[0];
			}
		}
		/**
		* 工作区短码（v7 短码通道的数据驱动版：取归属名按分隔符切分的末段前 4 字；
		* 如 dsh-prompt→prom、dsh-opencode-palette→pale；空归属回 '' 由调用方按双语回退。
		* 原型 SHORT 表是演示数据硬编码（prompt/配色/散），生产不定死表。）
		*/
		function workspaceShortCode(name, wsId) {
			try {
				const raw = asString(name) || asString(wsId);
				if (raw === "") return "";
				const parts = raw.split(/[-_\/\\:.]+/).filter((p) => p !== "");
				return (parts.length > 1 ? parts[parts.length - 1] : raw).slice(0, 4);
			} catch (e) {
				return "";
			}
		}
		/** 路径尾段（… + 尾段，空回 ''，不抛；v7 只给冲突行显） */
		function tailSegment(cwd) {
			try {
				const s = asString(cwd);
				if (s === "") return "";
				const parts = s.split("/");
				return parts[parts.length - 1] || s;
			} catch (e) {
				return "";
			}
		}
		/** 安全读左展开态：true=展开、false=折叠、null=未知（缺席/未实现/异常，不抛） */
		function readWorkspaceLeftExpanded(ctl) {
			try {
				const f = ctl && ctl.isExpanded;
				if (typeof f !== "function") return null;
				const v = f.call(ctl);
				return v === true ? true : v === false ? false : null;
			} catch (e) {
				return null;
			}
		}
		/** 只切左栏：调宿主 toggleExpanded，不碰本插件任何 state、不记日志；返回是否真调到宿主面 */
		function toggleWorkspaceLeft(ctl) {
			try {
				const f = ctl && ctl.toggleExpanded;
				if (typeof f !== "function") return false;
				f.call(ctl);
				return true;
			} catch (e) {
				return false;
			}
		}
		/** 左键门控：有切换面即有资格渲染（今天恒为 false → 休眠隐藏；宿主补面后自动出现） */
		function canShowWorkspaceLeft(ctl) {
			try {
				return !!ctl && typeof ctl.toggleExpanded === "function";
			} catch (e) {
				return false;
			}
		}
		/** 同步双门控（#111 US27–US28 / #113 US6：可枚举且可切换双满足才出现；半残隐藏；探测中由调用方另置 pending） */
		function probeWorkspaceGates(faces) {
			try {
				if (!faces || typeof faces !== "object") return {
					enumerable: false,
					switchable: false
				};
				const sessions = faces.sessions;
				const ui = faces.uiWorkspace;
				let enumerable = false;
				try {
					if (sessions) {
						if (Array.isArray(sessions) && sessions.length >= 0) enumerable = true;
						else if (typeof sessions === "object") {
							const lst = sessions.list;
							if (lst && typeof lst.getSnapshot === "function") enumerable = true;
							else if (typeof sessions.getSnapshot === "function") enumerable = true;
							else if (Array.isArray(sessions.items)) enumerable = true;
							else if (Array.isArray(sessions.sessions)) enumerable = true;
							else if (sessions.byId && typeof sessions.byId === "object") enumerable = true;
						}
					}
				} catch (e) {
					enumerable = false;
				}
				let switchable = false;
				try {
					if (ui && typeof ui.openSession === "function") switchable = true;
					else if (sessions && typeof sessions.open === "function") switchable = true;
				} catch (e) {
					switchable = false;
				}
				return {
					enumerable,
					switchable
				};
			} catch (e) {
				return {
					enumerable: false,
					switchable: false
				};
			}
		}
		/** 双满足才出现（门控唯一出口，调用方据此隐藏入口键） */
		function canShowWorkspacePicker(faces) {
			try {
				const g = probeWorkspaceGates(faces);
				return g.enumerable === true && g.switchable === true;
			} catch (e) {
				return false;
			}
		}
		function callMaybeFn(v) {
			try {
				if (typeof v === "function") return v();
				return v;
			} catch (e) {
				return;
			}
		}
		async function awaitMaybe(v) {
			try {
				if (v && typeof v.then === "function") return await v;
				return v;
			} catch (e) {
				throw e;
			}
		}
		/** 从 sessions 机会面捞快照（多态容错：list.getSnapshot / getSnapshot / items / 数组 / get，异步全捕获） */
		async function resolveSessionRaws(sessions) {
			const tries = [];
			try {
				if (!sessions) return [];
				if (Array.isArray(sessions)) return sessions;
				if (typeof sessions === "object") {
					const lst = sessions.list;
					if (lst && typeof lst.getSnapshot === "function") tries.push(() => lst.getSnapshot());
					if (typeof sessions.getSnapshot === "function") tries.push(() => sessions.getSnapshot());
					if (typeof sessions.getSnapshots === "function") tries.push(() => sessions.getSnapshots());
					for (const t of tries) try {
						const items = rawSessionItems(await awaitMaybe(callMaybeFn(t())));
						if (items.length > 0) return items;
					} catch (e) {}
					if (Array.isArray(sessions.items)) return sessions.items;
					if (Array.isArray(sessions.sessions)) return sessions.sessions;
					if (sessions.byId && typeof sessions.byId === "object") return rawSessionItems(sessions);
				}
				return [];
			} catch (e) {
				return [];
			}
		}
		/** 从 workspaces 机会面捞登记（多态容错：list.getSnapshot / getSnapshot / getCurrent / list / getAll / 数组，异步全捕获） */
		async function resolveWorkspaceRaws(workspaces) {
			try {
				if (!workspaces) return [];
				if (Array.isArray(workspaces)) return workspaces;
				if (typeof workspaces === "object") {
					const fns = [];
					try {
						const lst = workspaces.list;
						if (lst && typeof lst.getSnapshot === "function") fns.push(() => lst.getSnapshot());
						if (typeof workspaces.getSnapshot === "function") fns.push(() => workspaces.getSnapshot());
						if (typeof workspaces.getCurrent === "function") fns.push(() => workspaces.getCurrent());
						if (typeof workspaces.list === "function") fns.push(() => workspaces.list());
						if (typeof workspaces.getAll === "function") fns.push(() => workspaces.getAll());
					} catch (e) {}
					for (const f of fns) try {
						const v = await awaitMaybe(callMaybeFn(f));
						if (Array.isArray(v) && v.length > 0) return v;
						if (v && typeof v === "object") {
							const items = rawSessionItems(v);
							if (items.length > 0) {
								if (items.length === 1 && v.id && items[0].id === v.id) return items;
								return items;
							}
							if (v.id) return [v];
						}
					} catch (e) {}
					if (Array.isArray(workspaces.items)) return workspaces.items;
					if (workspaces.byId) try {
						const keys = Object.keys(workspaces.byId);
						if (keys.length > 0) return keys.map((k) => workspaces.byId[k]);
					} catch (e) {}
				}
				return [];
			} catch (e) {
				return [];
			}
		}
		/**
		* 从 workspaces 面捞归档会话 id 集（快照 `archivedSessionIds` / 面直挂同名属性，多态容错，不抛）。
		* 归档 = 用户主动收起的会话，挑选器默认不列（否则快速切换列表会被历史垃圾淹没）。
		*/
		async function resolveArchivedSessionIds(workspaces) {
			const out = /* @__PURE__ */ new Set();
			const eat = (v) => {
				if (!Array.isArray(v)) return;
				for (const x of v) {
					const s = asString(x);
					if (s !== "") out.add(s);
				}
			};
			const eatSnapshot = (snap) => {
				if (snap && typeof snap === "object") eat(snap.archivedSessionIds);
			};
			try {
				if (!workspaces || typeof workspaces !== "object") return out;
				try {
					const lst = workspaces.list;
					if (lst && typeof lst.getSnapshot === "function") eatSnapshot(await awaitMaybe(callMaybeFn(lst.getSnapshot())));
				} catch (e) {}
				try {
					if (typeof workspaces.getSnapshot === "function") eatSnapshot(await awaitMaybe(callMaybeFn(workspaces.getSnapshot())));
				} catch (e) {}
				try {
					eat(workspaces.archivedSessionIds);
				} catch (e) {}
			} catch (e) {}
			return out;
		}
		/**
		* 枚举（每次打开重探，抄 sidebarCtl 晚到模式）：
		* - 成功回 {sessions, names, archived}（空数组即真无，由调用方进空态，不是失败）；
		* - 双面全空（连一个条目都捞不到且同步门控本就不满足）抛错，由调用方进失败/探测缺席；
		* - 全程异步全捕获，不抛宿主原生错以外的错。
		*/
		async function enumerateWorkspaceSessions(faces) {
			try {
				if (!faces || typeof faces !== "object") throw new Error("probe-absent");
				const gates = probeWorkspaceGates(faces);
				const [sRaws, wRaws, archived] = await Promise.all([
					resolveSessionRaws(faces.sessions),
					resolveWorkspaceRaws(faces.workspaces),
					resolveArchivedSessionIds(faces.workspaces)
				]);
				const names = normalizeWorkspaceNames(wRaws);
				const filled = normalizeSessions(sRaws, names, buildWorkspaceIndex(wRaws)).filter((s) => !archived.has(s.id)).map((s) => {
					if (s.workspaceName && s.workspaceName !== "") return s;
					if (!s.workspaceId) return {
						...s,
						workspaceName: ""
					};
					return {
						...s,
						workspaceName: names.get(s.workspaceId) || s.workspaceId
					};
				});
				if (filled.length === 0 && !gates.enumerable) throw new Error("probe-absent");
				return {
					sessions: filled,
					names,
					archived
				};
			} catch (e) {
				throw e instanceof Error ? e : /* @__PURE__ */ new Error("probe-absent");
			}
		}
		/**
		* 切换（机会链：uiWorkspace.openSession 优先、sessions.open 回退，异步全捕获）：
		* - 成功回 true（调用方关挑选器）；
		* - 失败抛错（调用方留屏重试，不注入错误会话，沿 #739）；
		* - 只接 thenable 才等，非 thenable 视为同步成功；
		* - 不读写任何草稿。
		*/
		async function switchWorkspaceSession(faces, sid) {
			try {
				const id = typeof sid === "string" ? sid : String(sid || "");
				if (id === "") throw new Error("switch-failed");
				if (!faces || typeof faces !== "object") throw new Error("switch-failed");
				const ui = faces.uiWorkspace;
				const sessions = faces.sessions;
				if (ui && typeof ui.openSession === "function") try {
					const r = ui.openSession(id);
					if (r && typeof r.then === "function") await r;
					return true;
				} catch (e) {}
				if (sessions && typeof sessions.open === "function") try {
					const r = sessions.open(id);
					if (r && typeof r.then === "function") await r;
					return true;
				} catch (e) {}
				throw new Error("switch-failed");
			} catch (e) {
				throw e instanceof Error ? e : /* @__PURE__ */ new Error("switch-failed");
			}
		}
		/** 总页数：0 项 → 0 页；perPage 非法 → 按 1 算 */
		function pageCount(total, perPage) {
			const t = typeof total === "number" && isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
			let p = typeof perPage === "number" && isFinite(perPage) ? Math.floor(perPage) : NaN;
			if (!(p >= 1)) p = 1;
			if (t === 0) return 0;
			return Math.ceil(t / p);
		}
		/** 页钳制：total=0 恒回 0；否则钳进 [0, pageCount-1]；页非法回 0 */
		function clampPage(page, total, perPage) {
			const n = pageCount(total, perPage);
			if (n <= 0) return 0;
			const v = typeof page === "number" && isFinite(page) ? Math.floor(page) : 0;
			if (v < 0) return 0;
			if (v > n - 1) return n - 1;
			return v;
		}
		/** 项所在页（均匀项）：index 非法 → 0；perPage 非法 → 按 1 算 */
		function pageOf(index, perPage) {
			let p = typeof perPage === "number" && isFinite(perPage) ? Math.floor(perPage) : NaN;
			if (!(p >= 1)) p = 1;
			const i = typeof index === "number" && isFinite(index) ? Math.floor(index) : 0;
			if (i < 0) return 0;
			return Math.floor(i / p);
		}
		/** 按量出像素算每页项数：floor(容器宽÷项宽)，至少 1；量不到回 fallback（测试/无 DOM 环境） */
		function perPageFromMeasure(containerPx, itemPx, fallback) {
			const fb = typeof fallback === "number" && isFinite(fallback) && Math.floor(fallback) >= 1 ? Math.floor(fallback) : 3;
			const c = typeof containerPx === "number" && isFinite(containerPx) ? containerPx : NaN;
			const it = typeof itemPx === "number" && isFinite(itemPx) ? itemPx : NaN;
			if (!(c > 0) || !(it > 0)) return fb;
			const n = Math.floor(c / it);
			return n >= 1 ? n : 1;
		}
		//#endregion
		//#region src/client/picker.ts
		/**
		* dsh-prompt — 全屏挑选器本体（#104 MAP，视觉以 #108 v7 定稿为准，语义以 #111 为准）
		*
		* 定稿 v7 = C 手风琴 + 标题全显换行第一优先 + 时间尾随 + 徽标行内 + 一级卡只留名与计数
		* + 自适应抽屉（内容定高、上限 88% 内滚、禁大片空白）。
		* #115（用户 2026-10-05 拍板，architect 版）：近全屏内缩面板（内容定高、天花板近满屏）
		* + 竖屏会话在上、tab 条中、底部操作栏［工‹｜会‹｜会›｜工›］…［×］（层色边框＋点击脉冲）
		* + 真分页纯模型（pager.ts）+ × 跟字号放大；#124 横竖统一（rail 退役）；整体压紧多装。
		* 状态机（#107 Q1/#111）：关闭→探测→加载→就绪/空/失败→切换中→关闭或留屏；
		* 成功才关，其余留屏；失败不自动关；取消只取消等待。
		* 约束：不进持久化、不记新日志、不读写草稿（沿 #111）。
		*/
		/** 加载条动画（v7 loadbar 有 1s 无限 slide；inline style 写不出 keyframes，走自家 style 注入惯例） */
		const PICKER_ANIM_STYLE_ID = "dsh-prompt-picker-anim";
		const PICKER_ANIM_CSS = [
			"@keyframes dsh-prompt-picker-slide { from { margin-left: -40%; } to { margin-left: 100%; } }",
			".dsh-prompt-picker-load-i { height: 100%; width: 40%; border-radius: 99px; background: var(--dsw-specific-accent,#f0a45c); animation: dsh-prompt-picker-slide 1s infinite linear; }",
			"@keyframes dsh-prompt-pager-pulse { 0% { transform: scale(1); } 35% { transform: scale(1.25); } 100% { transform: scale(1); } }"
		].join("\n");
		let pickerAnimReady = false;
		function ensurePickerAnimStyle() {
			if (pickerAnimReady) return;
			try {
				const doc = globalThis.document;
				if (!doc || !doc.head || typeof doc.createElement !== "function") return;
				if (typeof doc.querySelector === "function" && doc.querySelector("style[data-dsh-prompt-style=\"dsh-prompt-picker-anim\"]")) {
					pickerAnimReady = true;
					return;
				}
				const tag = doc.createElement("style");
				tag.setAttribute("data-dsh-prompt-style", PICKER_ANIM_STYLE_ID);
				tag.textContent = PICKER_ANIM_CSS;
				doc.head.appendChild(tag);
				pickerAnimReady = true;
			} catch (e) {}
		}
		/** 会话卡片（v7 行内徽标 + 标题全显 + 时间尾随 + 元信息行按需渲染） */
		function SessionCard(props) {
			const { h, s, lang, ungroupedName, fallbackShort, current, failed, withShort, onPick } = props;
			const trail = relativeWorkspaceTime(s.updatedAt, void 0, lang);
			const abs = absoluteWorkspaceTime(s.updatedAt);
			const displayName = (s.workspaceName || "") !== "" ? s.workspaceName : ungroupedName;
			const badges = [];
			if (s.blank) badges.push(h("span", {
				key: "blank",
				style: {
					display: "inline-block",
					verticalAlign: "middle",
					margin: "0 0.55em 0 0",
					fontSize: "0.72em",
					fontWeight: 700,
					borderRadius: 999,
					padding: "1px 8px",
					lineHeight: 1.6,
					border: "1px solid var(--dsw-specific-accent,#f0a45c)",
					color: "var(--dsw-specific-accent,#f0a45c)",
					whiteSpace: "nowrap"
				},
				"data-dsh-prompt-picker-badge-blank": "1"
			}, tr(lang, STR.pickerBlank)));
			if (current) badges.push(h("span", {
				key: "cur",
				style: {
					display: "inline-block",
					verticalAlign: "middle",
					margin: "0 0.55em 0 0",
					fontSize: "0.72em",
					fontWeight: 700,
					borderRadius: 999,
					padding: "1px 8px",
					lineHeight: 1.6,
					background: "#7fd08a",
					border: "1px solid #7fd08a",
					color: "#0e1016",
					whiteSpace: "nowrap"
				},
				"data-dsh-prompt-picker-badge-cur": "1"
			}, tr(lang, STR.pickerCurrent)));
			if (failed) badges.push(h("span", {
				key: "fail",
				style: {
					display: "inline-block",
					verticalAlign: "middle",
					margin: "0 0.55em 0 0",
					fontSize: "0.72em",
					fontWeight: 700,
					borderRadius: 999,
					padding: "1px 8px",
					lineHeight: 1.6,
					border: "1px solid var(--dsw-specific-danger,#e06c75)",
					color: "var(--dsw-specific-danger,#e06c75)",
					whiteSpace: "nowrap"
				},
				"data-dsh-prompt-picker-badge-fail": "1"
			}, tr(lang, STR.pickerSwitchFailBadge)));
			const meta = [];
			if (withShort) {
				meta.push(h("span", {
					key: "dot",
					"data-dsh-prompt-picker-dot": "1",
					style: {
						flex: "none",
						width: 10,
						height: 10,
						borderRadius: "50%",
						background: workspaceColor(s.workspaceId)
					}
				}));
				const short = s.workspaceId ? workspaceShortCode(s.workspaceName, s.workspaceId) || fallbackShort : fallbackShort;
				meta.push(h("span", {
					key: "short",
					style: {
						flex: "none",
						fontSize: "0.75em",
						color: "var(--dsw-alias-label-tertiary)",
						background: "var(--dsw-alias-bg-layer-3)",
						border: "1px solid var(--dsw-alias-border-l1)",
						borderRadius: 6,
						padding: "1px 6px",
						whiteSpace: "nowrap"
					}
				}, short));
			}
			if (s.collision && s.cwd) meta.push(h("span", {
				key: "tail",
				title: s.cwd,
				style: {
					flex: "none",
					fontSize: "0.72em",
					color: "var(--dsw-alias-label-tertiary)",
					background: "var(--dsw-alias-bg-layer-3)",
					border: "1px solid var(--dsw-alias-border-l1)",
					borderRadius: 6,
					padding: "1px 6px",
					maxWidth: 130,
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis"
				},
				"data-dsh-prompt-picker-tail": "1"
			}, "…" + tailSegment(s.cwd)));
			return h("button", {
				type: "button",
				title: s.title + "\n" + abs + "\n" + displayName + (s.cwd ? " · " + s.cwd : ""),
				"data-dsh-prompt-picker-row": s.id,
				"aria-current": current ? "true" : void 0,
				onMouseDown: keepComposerFocus,
				onClick: () => onPick(s.id),
				style: {
					display: "flex",
					flexDirection: "column",
					alignItems: "stretch",
					width: "100%",
					minHeight: "4.5em",
					textAlign: "left",
					cursor: "pointer",
					background: "var(--dsw-alias-bg-layer-3)",
					border: "1px solid " + (current ? "#7fd08a" : "var(--dsw-alias-border-l1)"),
					boxShadow: current ? "inset 0 0 0 1px #7fd08a" : "none",
					color: "var(--dsw-alias-label-primary)",
					borderRadius: 12,
					padding: "0.6em 0.75em",
					fontSize: "0.92em",
					minWidth: 0,
					fontFamily: "var(--dsw-font-family)"
				},
				"data-dsh-prompt-picker-card": "1"
			}, [h("div", {
				key: "ct",
				style: {
					fontWeight: 700,
					lineHeight: 1.45,
					wordBreak: "break-word"
				}
			}, [
				...badges,
				h("span", { key: "t" }, s.title === "" ? tr(lang, STR.pickerUntitled) : s.title),
				trail === "" ? null : h("span", {
					key: "trail",
					title: abs,
					style: {
						float: "right",
						fontSize: "0.82em",
						color: "var(--dsw-alias-label-tertiary)",
						whiteSpace: "nowrap",
						margin: "0.22em 0 0.1em 0.7em",
						fontVariantNumeric: "tabular-nums",
						fontWeight: 400
					},
					"data-dsh-prompt-picker-time": "1"
				}, [trail + " ", h("span", {
					key: "go",
					"aria-hidden": "true"
				}, "›")]),
				h("div", {
					key: "clear",
					style: { clear: "both" }
				})
			]), meta.length === 0 ? null : h("div", {
				key: "cm",
				style: {
					display: "flex",
					alignItems: "center",
					gap: 6,
					marginTop: 6
				}
			}, meta)]);
		}
		function WorkspacePicker(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const lang = getLang();
			const ungroupedName = tr(lang, STR.pickerUngrouped);
			const fallbackShort = tr(lang, STR.pickerUnassignedShort);
			const faces = props.faces;
			const currentId = typeof props.currentId === "string" ? props.currentId : "";
			const size = typeof props.remoteSize === "number" ? props.remoteSize : 5;
			let wideAuto = false;
			try {
				if (typeof window !== "undefined" && window.innerWidth > window.innerHeight) wideAuto = true;
			} catch (e) {
				wideAuto = false;
			}
			const gridCols = (typeof props.wide === "boolean" ? props.wide : wideAuto) ? 3 : 2;
			const gridStyle = {
				display: "grid",
				gridTemplateColumns: "repeat(" + gridCols + ", minmax(0, 1fr))",
				gap: "0.4em",
				alignItems: "stretch"
			};
			const TAB_W = "9em";
			const PAGER_BOX = "2.5em";
			const tabRowStyle = {
				display: "flex",
				flexDirection: "row",
				gap: "0.4em",
				alignItems: "stretch"
			};
			ensurePickerAnimStyle();
			const phaseState = react.useState("probing");
			const phase = phaseState[0];
			const setPhase = phaseState[1];
			const queryState = react.useState("");
			const query = queryState[0];
			const setQuery = queryState[1];
			const sessionsState = react.useState([]);
			const sessions = sessionsState[0];
			const setSessions = sessionsState[1];
			const namesState = react.useState(/* @__PURE__ */ new Map());
			const names = namesState[0];
			const setNames = namesState[1];
			const switchingState = react.useState(null);
			const switchingId = switchingState[0];
			const setSwitchingId = switchingState[1];
			const failRowState = react.useState(null);
			const failRowId = failRowState[0];
			const setFailRowId = failRowState[1];
			const failKindState = react.useState(null);
			const failKind = failKindState[0];
			const setFailKind = failKindState[1];
			const emptyKindState = react.useState(null);
			const emptyKind = emptyKindState[0];
			const setEmptyKind = emptyKindState[1];
			const openGroupState = react.useState(null);
			const openGroup = openGroupState[0];
			const setOpenGroup = openGroupState[1];
			const tabPageState = react.useState(0);
			const tabPage = tabPageState[0];
			const setTabPage = tabPageState[1];
			const tabPerPageState = react.useState(3);
			const tabPerPage = tabPerPageState[0];
			const setTabPerPage = tabPerPageState[1];
			const ssPageState = react.useState(0);
			const ssPage = ssPageState[0];
			const setSsPage = ssPageState[1];
			const ssPerPageState = react.useState(3);
			const ssPerPage = ssPerPageState[0];
			const setSsPerPage = ssPerPageState[1];
			const wsFlashState = react.useState(0);
			const wsFlash = wsFlashState[0];
			const setWsFlash = wsFlashState[1];
			const ssFlashState = react.useState(0);
			const ssFlash = ssFlashState[0];
			const setSsFlash = ssFlashState[1];
			const pagerRefs = react.useRef({});
			react.useEffect(() => {
				let alive = true;
				let loadingTimer = null;
				setQuery("");
				setSwitchingId(null);
				setFailRowId(null);
				setFailKind(null);
				setEmptyKind(null);
				setPhase("probing");
				(async () => {
					try {
						const snap = await enumerateWorkspaceSessions(faces);
						if (!alive) return;
						if (snap.sessions.length === 0) {
							setSessions([]);
							setNames(snap.names);
							setEmptyKind("true-none");
							setPhase("empty");
							return;
						}
						setSessions(snap.sessions);
						setNames(snap.names);
						try {
							const gs = groupWorkspaceSessions(snap.sessions, snap.names, ungroupedName);
							if (!alive) return;
							if (gs.length > 0) setOpenGroup(gs[0].key);
						} catch (e) {}
						setPhase("loading");
						loadingTimer = setTimeout(() => {
							if (!alive) return;
							setPhase("ready");
						}, 150);
					} catch (e) {
						if (!alive) return;
						setFailKind("probe");
						setPhase("failed");
					}
				})().catch(() => {
					try {
						if (alive) {
							setFailKind("probe");
							setPhase("failed");
						}
					} catch (err) {}
				});
				return () => {
					alive = false;
					try {
						if (loadingTimer !== null) clearTimeout(loadingTimer);
					} catch (e) {}
				};
			}, []);
			const filtered = filterWorkspaceSessions(sessions, query, ungroupedName);
			const hasQuery = query.trim() !== "";
			let groups = [];
			try {
				groups = groupWorkspaceSessions(filtered, names, ungroupedName);
			} catch (e) {
				groups = [];
			}
			react.useEffect(() => {
				let alive = true;
				const fontPxOf = (el) => {
					try {
						const g = globalThis.getComputedStyle;
						if (typeof g !== "function" || !el) return NaN;
						const v = parseFloat(g(el).fontSize);
						return isFinite(v) && v > 0 ? v : NaN;
					} catch (e) {
						return NaN;
					}
				};
				const recompute = () => {
					if (!alive) return;
					try {
						const R = pagerRefs.current || {};
						const ws = R.ws;
						if (ws && typeof ws.clientWidth === "number" && ws.clientWidth > 0) {
							let tabW = NaN;
							try {
								const first = ws.querySelector ? ws.querySelector("[data-dsh-prompt-picker-groupcard]") : null;
								if (first && typeof first.offsetWidth === "number" && first.offsetWidth > 0) tabW = first.offsetWidth;
							} catch (e) {}
							const fp = fontPxOf(ws);
							const gap = isFinite(fp) ? fp * .5 : 8;
							const pitch = isFinite(tabW) && tabW > 0 ? tabW + gap : NaN;
							if (isFinite(pitch) && pitch > 0) R.wsPitch = pitch;
							const per = perPageFromMeasure(ws.clientWidth, isFinite(pitch) ? pitch : NaN, 3);
							try {
								setTabPerPage(per);
							} catch (e) {}
							try {
								setTabPage((p) => clampPage(p, groups.length, per));
							} catch (e) {}
						}
						const ss = R.ss;
						if (ss && typeof ss.clientHeight === "number" && ss.clientHeight > 0) {
							let cardH = NaN;
							try {
								const first = ss.querySelector ? ss.querySelector("[data-dsh-prompt-picker-card]") : null;
								if (first && typeof first.offsetHeight === "number" && first.offsetHeight > 0) cardH = first.offsetHeight;
							} catch (e) {}
							const fp = fontPxOf(ss);
							const gap = isFinite(fp) ? fp * .5 : 8;
							const rows = isFinite(cardH) && cardH > 0 ? Math.max(1, Math.floor((ss.clientHeight + gap) / (cardH + gap))) : 2;
							const per = Math.max(1, gridCols * rows);
							try {
								setSsPerPage(per);
							} catch (e) {}
							const key = openGroup || (groups.length > 0 ? groups[0].key : "__none");
							const og = groups.find((g) => g.key === key) || null;
							const total = hasQuery ? filtered.length : og ? og.items.length : 0;
							try {
								setSsPage((p) => clampPage(p, total, per));
							} catch (e) {}
						}
					} catch (e) {}
				};
				recompute();
				let ro = null;
				try {
					const RO = globalThis.ResizeObserver;
					const R = pagerRefs.current || {};
					if (typeof RO === "function" && (R.ws || R.ss)) {
						ro = new RO(() => {
							try {
								recompute();
							} catch (e) {}
						});
						try {
							if (R.ws && typeof R.ws.clientWidth === "number") ro.observe(R.ws);
						} catch (e) {}
						try {
							if (R.ss && typeof R.ss.clientHeight === "number") ro.observe(R.ss);
						} catch (e) {}
					}
				} catch (e) {}
				return () => {
					alive = false;
					try {
						if (ro && typeof ro.disconnect === "function") ro.disconnect();
					} catch (e) {}
				};
			}, [
				groups.length,
				filtered.length,
				gridCols
			]);
			const showTrueEmpty = phase === "empty" && emptyKind === "true-none";
			const doPick = (id) => {
				if (id === currentId) {
					try {
						props.onClose(currentId);
					} catch (e) {}
					return;
				}
				setFailRowId(null);
				setPhase("switching");
				setSwitchingId(id);
				(async () => {
					try {
						await switchWorkspaceSession(faces, id);
						try {
							props.onClose(id);
						} catch (e) {}
					} catch (e) {
						setSwitchingId(null);
						setFailRowId(id);
						setFailKind("switch");
						setPhase("failed");
					}
				})().catch(() => {
					try {
						setSwitchingId(null);
						setFailRowId(id);
						setFailKind("switch");
						setPhase("failed");
					} catch (err) {}
				});
			};
			const retryAll = () => {
				if (failKind === "probe") {
					setPhase("probing");
					setFailKind(null);
					setFailRowId(null);
					(async () => {
						try {
							const snap = await enumerateWorkspaceSessions(faces);
							setSessions(snap.sessions);
							setNames(snap.names);
							if (snap.sessions.length === 0) {
								setEmptyKind("true-none");
								setPhase("empty");
								return;
							}
							try {
								const gs = groupWorkspaceSessions(snap.sessions, snap.names, ungroupedName);
								if (gs.length > 0) setOpenGroup(gs[0].key);
							} catch (e) {}
							setPhase("ready");
						} catch (e) {
							setFailKind("probe");
							setPhase("failed");
						}
					})().catch(() => {
						try {
							setFailKind("probe");
							setPhase("failed");
						} catch (err) {}
					});
					return;
				}
				const id = failRowId;
				if (id) doPick(id);
			};
			const cancelWait = () => {
				try {
					props.onClose();
				} catch (e) {}
			};
			const uiScale = remoteSizeScale(size);
			const rootStyle = {
				position: "fixed",
				inset: 0,
				zIndex: MODAL_Z,
				fontSize: "calc(1em * " + uiScale + ")"
			};
			const maskStyle = {
				position: "absolute",
				inset: 0,
				background: "rgba(0,0,0,0.55)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "0.5em",
				boxSizing: "border-box"
			};
			const sheetStyle = {
				position: "relative",
				width: "100%",
				height: "auto",
				maxHeight: "100%",
				margin: 0,
				background: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
				backgroundColor: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
				borderRadius: 14,
				border: "1px solid var(--dsw-alias-border-l1)",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				fontSize: "1em",
				fontFamily: "var(--dsw-font-family)",
				color: "var(--dsw-alias-label-primary)"
			};
			const headStyle = {
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "0.3em 0.5em 0.05em",
				flex: "none"
			};
			const xStyle = {
				marginLeft: "auto",
				flex: "none",
				width: "3em",
				height: "3em",
				minWidth: "3em",
				borderRadius: "50%",
				cursor: "pointer",
				border: "1px solid var(--dsw-alias-border-l1)",
				background: "var(--dsw-alias-bg-layer-3)",
				color: "var(--dsw-alias-label-primary)",
				fontSize: "1em",
				lineHeight: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "center"
			};
			const xGlyphStyle = {
				fontSize: "1.4em",
				lineHeight: 1
			};
			const searchStyle = {
				margin: "0.2em 0.4em 0",
				padding: "0.5em 0.75em",
				borderRadius: 9,
				minHeight: "2.5em",
				border: "1px solid var(--dsw-alias-border-l1)",
				background: "var(--dsw-alias-bg-layer-3)",
				color: "var(--dsw-alias-label-primary)",
				fontSize: "0.9em",
				width: "calc(100% - 1em)",
				flex: "none",
				boxSizing: "border-box",
				fontFamily: "var(--dsw-font-family)",
				outline: "none"
			};
			const bodyStyle = {
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				padding: "0.25em 0.4em 0.4em",
				minHeight: 0,
				minWidth: 0,
				flex: "1 1 auto"
			};
			const ssPaneStyle = {
				flex: "1 1 auto",
				minHeight: 0,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				position: "relative"
			};
			const ssScrollStyle = {
				flex: "1 1 auto",
				minHeight: 0,
				overflowY: "auto",
				padding: "0.1em 0.1em 0.4em"
			};
			const wsPaneStyle = {
				flex: "none",
				display: "flex",
				flexDirection: "row",
				alignItems: "center",
				gap: "0.4em",
				marginTop: "0.35em",
				minHeight: 0
			};
			const wsScrollStyle = {
				flex: "1 1 auto",
				minWidth: 0,
				display: "flex",
				flexDirection: "row",
				gap: "0.4em",
				overflowX: "auto",
				overflowY: "hidden",
				padding: "0.1em"
			};
			const LAYER_WS = "var(--dsw-specific-accent,#f0a45c)";
			const LAYER_SS = "#7fd08a";
			const opBarStyle = {
				flex: "none",
				display: "flex",
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "flex-end",
				gap: "0.5em",
				marginTop: "0.35em",
				paddingTop: "0.35em",
				borderTop: "1px solid var(--dsw-alias-border-l1)"
			};
			const pagerBtnStyle = (disabled, accent, radius) => ({
				flex: "none",
				width: PAGER_BOX,
				height: PAGER_BOX,
				minWidth: PAGER_BOX,
				borderRadius: radius,
				cursor: disabled ? "not-allowed" : "pointer",
				border: "1px solid " + accent,
				background: "var(--dsw-alias-bg-layer-3)",
				color: "var(--dsw-alias-label-primary)",
				fontSize: "1em",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				opacity: disabled ? .38 : 1
			});
			const pagerGlyphStyle = (flash) => ({
				fontSize: "1.2em",
				lineHeight: 1,
				display: "inline-block",
				animation: flash > 0 ? "dsh-prompt-pager-pulse 0.35s ease-out" : void 0
			});
			const sectionTitleStyle = {
				flex: "none",
				fontSize: "0.78em",
				fontWeight: 700,
				color: "var(--dsw-alias-label-tertiary)",
				letterSpacing: "0.02em",
				padding: "0.2em 0.2em 0.2em"
			};
			const renderCard = (s, withShort) => h(SessionCard, {
				key: s.id,
				h,
				s,
				lang,
				ungroupedName,
				fallbackShort,
				current: s.id === currentId,
				failed: s.id === failRowId,
				withShort,
				onPick: doPick
			});
			const renderWcard = (g, isOpen, allowCollapse, asTab, tabIdx) => h("button", {
				key: (asTab ? "tab:" : "head:") + g.key,
				type: "button",
				"data-dsh-prompt-picker-group": g.key,
				role: asTab ? "tab" : void 0,
				"aria-selected": asTab ? isOpen ? "true" : "false" : void 0,
				"aria-pressed": asTab ? void 0 : isOpen ? "true" : "false",
				onMouseDown: keepComposerFocus,
				onClick: () => {
					try {
						setOpenGroup(allowCollapse && isOpen ? "__none" : g.key);
					} catch (e) {}
					if (asTab && typeof tabIdx === "number") ensureTabPage(tabIdx);
				},
				title: g.name,
				style: {
					display: "flex",
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					width: asTab ? TAB_W : "100%",
					flex: asTab ? "none" : void 0,
					minHeight: "2.6em",
					minWidth: 0,
					textAlign: "left",
					cursor: "pointer",
					background: "var(--dsw-alias-bg-layer-3)",
					border: "1px solid " + (isOpen ? "var(--dsw-specific-accent,#f0a45c)" : "var(--dsw-alias-border-l1)"),
					boxShadow: isOpen ? "inset 0 0 0 1px var(--dsw-specific-accent,#f0a45c)" : "none",
					color: "var(--dsw-alias-label-primary)",
					borderRadius: 12,
					padding: "0.5em 0.75em",
					fontSize: "0.92em",
					fontFamily: "var(--dsw-font-family)"
				},
				"data-dsh-prompt-picker-groupcard": "1"
			}, [
				h("span", {
					key: "dot",
					"data-dsh-prompt-picker-dot": "1",
					style: {
						flex: "none",
						width: 10,
						height: 10,
						borderRadius: "50%",
						background: workspaceColor(g.workspaceId)
					}
				}),
				h("span", {
					key: "nm",
					style: {
						flex: "1 1 auto",
						minWidth: 0,
						fontWeight: 700,
						lineHeight: 1.4,
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis"
					}
				}, g.name),
				h("span", {
					key: "cnt",
					"data-dsh-prompt-picker-count": String(g.items.length),
					style: {
						flex: "none",
						fontSize: "0.75em",
						color: "var(--dsw-alias-label-tertiary)",
						background: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
						border: "1px solid var(--dsw-alias-border-l1)",
						borderRadius: 999,
						padding: "0 9px",
						fontWeight: 400
					}
				}, String(g.items.length))
			]);
			const openKey = openGroup || (groups.length > 0 ? groups[0].key : "__none");
			const wsScrollToPage = (n, per) => {
				try {
					const R = pagerRefs.current || {};
					const el = R.ws;
					if (!el || typeof el.scrollTo !== "function") return;
					const pitch = R.wsPitch;
					const x = typeof pitch === "number" && pitch > 0 ? n * per * pitch : n * (typeof el.clientWidth === "number" && el.clientWidth > 0 ? el.clientWidth : 0);
					try {
						el.scrollTo({
							left: x,
							behavior: "smooth"
						});
					} catch (e2) {
						try {
							el.scrollTo(x, 0);
						} catch (e3) {
							try {
								el.scrollLeft = x;
							} catch (e4) {}
						}
					}
				} catch (e) {}
			};
			const ssScrollToPage = (n) => {
				try {
					const el = (pagerRefs.current || {}).ss;
					if (!el || typeof el.scrollTo !== "function") return;
					const y = n * (typeof el.clientHeight === "number" && el.clientHeight > 0 ? el.clientHeight : 0);
					try {
						el.scrollTo({
							top: y,
							behavior: "smooth"
						});
					} catch (e2) {
						try {
							el.scrollTo(0, y);
						} catch (e3) {
							try {
								el.scrollTop = y;
							} catch (e4) {}
						}
					}
				} catch (e) {}
			};
			const ssTotalOf = () => {
				try {
					const key = openGroup || (groups.length > 0 ? groups[0].key : "__none");
					const og = groups.find((g) => g.key === key) || null;
					return og ? og.items.length : 0;
				} catch (e) {
					return 0;
				}
			};
			const tabGo = (dir) => {
				const n = clampPage(tabPage + dir, groups.length, tabPerPage);
				setTabPage(n);
				try {
					setWsFlash((f) => f + 1);
				} catch (e) {}
				wsScrollToPage(n, tabPerPage);
			};
			const ssGo = (dir) => {
				const total = ssTotalOf();
				const n = clampPage(ssPage + dir, total, ssPerPage);
				setSsPage(n);
				try {
					setSsFlash((f) => f + 1);
				} catch (e) {}
				ssScrollToPage(n);
			};
			const ensureTabPage = (idx) => {
				try {
					const n = clampPage(pageOf(idx, tabPerPage), groups.length, tabPerPage);
					setTabPage(n);
					wsScrollToPage(n, tabPerPage);
				} catch (e) {}
			};
			const onWsScroll = (e) => {
				try {
					const el = e && e.target || null;
					if (!el || typeof el.scrollLeft !== "number") return;
					const cw = typeof el.clientWidth === "number" && el.clientWidth > 0 ? el.clientWidth : 1;
					const pitch = (pagerRefs.current || {}).wsPitch;
					const pageW = typeof pitch === "number" && pitch > 0 ? tabPerPage * pitch : cw;
					const w = pageW > 0 ? pageW : 1;
					setTabPage(clampPage(Math.round(el.scrollLeft / w), groups.length, tabPerPage));
				} catch (e) {}
			};
			const onSsScroll = (e) => {
				try {
					const el = e && e.target || null;
					if (!el || typeof el.scrollTop !== "number") return;
					const h = typeof el.clientHeight === "number" && el.clientHeight > 0 ? el.clientHeight : 1;
					setSsPage(clampPage(Math.round(el.scrollTop / h), ssTotalOf(), ssPerPage));
				} catch (e) {}
			};
			const pagerBtn = (kind, layerLabel, dirLabel, disabled, accent, flash, go) => h("button", {
				key: kind,
				type: "button",
				"data-dsh-prompt-picker-pager": kind,
				disabled: disabled ? true : void 0,
				"aria-disabled": disabled ? "true" : "false",
				"aria-label": tr(lang, layerLabel) + tr(lang, dirLabel),
				title: tr(lang, layerLabel) + tr(lang, dirLabel),
				onMouseDown: keepComposerFocus,
				onClick: () => {
					if (!disabled) try {
						go();
					} catch (e) {}
				},
				style: pagerBtnStyle(disabled, accent, kind === "ws-prev" || kind === "ws-next" ? "50%" : 9)
			}, h("span", {
				key: "g" + flash,
				style: pagerGlyphStyle(flash),
				"aria-hidden": "true"
			}, kind === "ws-prev" || kind === "ss-prev" ? "‹" : "›"));
			const switchingNote = phase === "switching" && switchingId ? h("div", {
				key: "switching",
				"data-dsh-prompt-picker-switching": switchingId,
				style: {
					fontSize: "0.78em",
					color: "var(--dsw-alias-label-tertiary)",
					padding: "6px 0 0",
					flex: "none"
				}
			}, tr(lang, STR.pickerSwitching) + "…") : null;
			let listContent = null;
			if (hasQuery) {
				const flat = filtered.slice().sort((a, b) => b.updatedAt - a.updatedAt);
				listContent = h("div", {
					key: "flat",
					"data-dsh-prompt-picker-flat": "query",
					style: {
						display: "flex",
						flexDirection: "column",
						minHeight: 0,
						flex: "1 1 auto",
						overflow: "hidden"
					}
				}, [switchingNote, h("div", {
					key: "ssscroll",
					"data-dsh-prompt-picker-ssscroll": "1",
					style: ssScrollStyle
				}, [h("div", {
					key: "list",
					"data-dsh-prompt-picker-grid": String(gridCols),
					style: gridStyle
				}, flat.map((s) => renderCard(s, hasQuery)))])]);
			} else {
				const openG = groups.find((g) => g.key === openKey) || null;
				const openItems = openG ? openG.items : [];
				const tabPages = pageCount(groups.length, tabPerPage);
				const tabPrevOff = tabPage <= 0;
				const tabNextOff = tabPage >= tabPages - 1;
				const ssPages = pageCount(openItems.length, ssPerPage);
				const ssPrevOff = ssPage <= 0;
				const ssNextOff = ssPage >= ssPages - 1;
				listContent = h("div", {
					key: "acc",
					style: {
						display: "flex",
						flexDirection: "column",
						minHeight: 0,
						flex: "1 1 auto",
						overflow: "hidden"
					}
				}, [
					switchingNote,
					h("div", {
						key: "sspane",
						"data-dsh-prompt-picker-sspane": "1",
						style: ssPaneStyle
					}, [h("div", {
						key: "sst",
						"data-dsh-prompt-picker-sstitle": "1",
						style: sectionTitleStyle
					}, tr(lang, STR.pickerSessions)), h("div", {
						key: "ssscroll",
						"data-dsh-prompt-picker-ssscroll": "1",
						style: ssScrollStyle,
						ref: (el) => {
							try {
								pagerRefs.current.ss = el;
							} catch (e) {}
						},
						onScroll: onSsScroll
					}, [openG ? h("div", {
						key: "gitems",
						"data-dsh-prompt-picker-grid": String(gridCols),
						style: gridStyle
					}, openG.items.map((s) => renderCard(s, false))) : null])]),
					h("div", {
						key: "wspane",
						"data-dsh-prompt-picker-wspane": "1",
						role: "tablist",
						"aria-label": tr(lang, STR.pickerWorkspaces),
						style: wsPaneStyle
					}, [h("div", {
						key: "wsscroll",
						"data-dsh-prompt-picker-wsscroll": "1",
						style: wsScrollStyle,
						ref: (el) => {
							try {
								pagerRefs.current.ws = el;
							} catch (e) {}
						},
						onScroll: onWsScroll
					}, [h("div", {
						key: "tabrow",
						"data-dsh-prompt-picker-tabrow": String(tabPerPage),
						style: tabRowStyle
					}, groups.map((g, idx) => renderWcard(g, openKey === g.key, true, true, idx)))])]),
					h("div", {
						key: "opbar",
						"data-dsh-prompt-picker-opbar": "1",
						role: "toolbar",
						"aria-label": tr(lang, STR.pickerOpBar),
						style: opBarStyle
					}, [
						pagerBtn("ws-prev", STR.pickerWorkspaces, STR.pickerPrev, tabPrevOff, LAYER_WS, wsFlash, () => tabGo(-1)),
						pagerBtn("ss-prev", STR.pickerSessions, STR.pickerPrev, ssPrevOff, LAYER_SS, ssFlash, () => ssGo(-1)),
						pagerBtn("ss-next", STR.pickerSessions, STR.pickerNext, ssNextOff, LAYER_SS, ssFlash, () => ssGo(1)),
						pagerBtn("ws-next", STR.pickerWorkspaces, STR.pickerNext, tabNextOff, LAYER_WS, wsFlash, () => tabGo(1)),
						h("button", {
							key: "opclose",
							type: "button",
							"data-dsh-prompt-picker-closebar": "1",
							"aria-label": tr(lang, STR.close),
							title: tr(lang, STR.close),
							onMouseDown: keepComposerFocus,
							onClick: () => {
								try {
									props.onClose();
								} catch (e) {}
							},
							style: {
								flex: "none",
								width: "3em",
								height: "3em",
								minWidth: "3em",
								borderRadius: "50%",
								cursor: "pointer",
								border: "1px solid var(--dsw-alias-border-l1)",
								background: "var(--dsw-alias-bg-layer-3)",
								color: "var(--dsw-alias-label-primary)",
								fontSize: "1em",
								lineHeight: 1,
								display: "flex",
								alignItems: "center",
								justifyContent: "center"
							}
						}, h("span", {
							key: "ocg",
							style: xGlyphStyle,
							"aria-hidden": "true"
						}, "×"))
					])
				]);
			}
			const loadingBox = h("div", {
				key: "loading",
				"data-dsh-prompt-picker-loading": "1"
			}, [h("div", {
				key: "bar",
				style: {
					height: 4,
					borderRadius: 99,
					background: "var(--dsw-alias-bg-layer-3)",
					overflow: "hidden",
					margin: "10px 12px 0",
					flex: "none"
				}
			}, [h("div", {
				key: "i",
				className: "dsh-prompt-picker-load-i"
			})]), h("div", {
				key: "row",
				style: {
					display: "flex",
					alignItems: "center",
					gap: 10,
					padding: "8px 12px 12px",
					fontSize: "0.82em",
					color: "var(--dsw-alias-label-tertiary)"
				}
			}, [h("span", { key: "t" }, tr(lang, STR.pickerLoading)), h("button", {
				key: "cancel",
				type: "button",
				"data-dsh-prompt-picker-cancel": "1",
				onMouseDown: keepComposerFocus,
				onClick: cancelWait,
				style: {
					border: "1px solid var(--dsw-alias-border-l1)",
					background: "transparent",
					color: "var(--dsw-alias-label-tertiary)",
					borderRadius: 8,
					padding: "6px 14px",
					fontSize: "0.9em",
					cursor: "pointer",
					minHeight: 40,
					fontFamily: "var(--dsw-font-family)"
				}
			}, tr(lang, STR.pickerCancel))])]);
			const emptyBox = (kind) => h("div", {
				key: "empty:" + kind,
				"data-dsh-prompt-picker-empty": kind,
				style: {
					margin: "6px 0 12px",
					padding: "8px 12px",
					border: "1px dashed var(--dsw-alias-border-l1)",
					borderRadius: 10,
					fontSize: "0.85em",
					color: "var(--dsw-alias-label-tertiary)",
					display: "flex",
					gap: 10,
					alignItems: "center",
					lineHeight: 1.5
				}
			}, kind === "search" ? tr(lang, STR.pickerEmptySearch) : tr(lang, STR.pickerEmpty));
			const retryBox = (kind) => h("div", {
				key: "failed:" + kind,
				"data-dsh-prompt-picker-failed": kind
			}, [h("div", {
				key: "box",
				style: {
					margin: "6px 0 12px",
					padding: "8px 12px",
					border: "1px solid var(--dsw-specific-danger,#e06c75)",
					borderRadius: 10,
					fontSize: "0.85em",
					color: "var(--dsw-alias-label-primary)",
					display: "flex",
					gap: 10,
					alignItems: "center",
					lineHeight: 1.5
				}
			}, [h("span", { key: "m" }, kind === "probe" ? tr(lang, STR.pickerProbeFail) : tr(lang, STR.pickerSwitchFail)), h("button", {
				key: "retry",
				type: "button",
				"data-dsh-prompt-picker-retry": "1",
				onMouseDown: keepComposerFocus,
				onClick: retryAll,
				style: {
					flex: "none",
					minHeight: 44,
					padding: "6px 18px",
					fontSize: "0.95em",
					borderRadius: 9,
					cursor: "pointer",
					border: "1px solid var(--dsw-specific-accent,#f0a45c)",
					background: "var(--dsw-specific-accent,#f0a45c)",
					color: "#1a1a1e",
					fontWeight: 700,
					fontFamily: "var(--dsw-font-family)"
				}
			}, tr(lang, STR.pickerRetry))])]);
			const queryEmpty = hasQuery && filtered.length === 0;
			let bodyNode = null;
			if (phase === "probing" || phase === "loading") bodyNode = loadingBox;
			else if (phase === "failed" && failKind === "probe") bodyNode = retryBox("probe");
			else if (showTrueEmpty) bodyNode = emptyBox("true-none");
			else if (queryEmpty) bodyNode = phase === "failed" ? h("div", { key: "sfr" }, [retryBox("switch"), emptyBox("search")]) : emptyBox("search");
			else if (phase === "failed") bodyNode = h("div", { key: "sfl" }, [retryBox("switch"), listContent]);
			else bodyNode = listContent;
			return h("div", {
				"data-dsh-prompt-picker-root": "1",
				style: rootStyle
			}, [h("div", {
				key: "mask",
				style: maskStyle,
				"data-dsh-prompt-picker-mask": "1",
				onClick: (e) => {
					if (e.target === e.currentTarget) try {
						props.onClose();
					} catch (err) {}
				}
			}), h("div", {
				key: "sheet",
				role: "dialog",
				"aria-modal": "true",
				"aria-label": tr(lang, STR.workspacePicker),
				"data-dsh-prompt-picker-sheet": "1",
				style: sheetStyle
			}, [
				h("div", {
					key: "head",
					style: headStyle
				}, [h("h2", {
					key: "t",
					style: {
						margin: 0,
						fontSize: "0.95em",
						flex: "none"
					}
				}, tr(lang, STR.workspacePicker)), h("button", {
					key: "x",
					type: "button",
					style: xStyle,
					title: tr(lang, STR.close),
					"aria-label": tr(lang, STR.close),
					"data-dsh-prompt-picker-close": "1",
					onMouseDown: keepComposerFocus,
					onClick: () => {
						try {
							props.onClose();
						} catch (e) {}
					}
				}, h("span", {
					key: "xg",
					style: xGlyphStyle,
					"aria-hidden": "true"
				}, "×"))]),
				h("input", {
					key: "q",
					"data-dsh-prompt-picker-search": "1",
					placeholder: tr(lang, STR.pickerSearch),
					value: query,
					onChange: (e) => {
						try {
							setQuery(e.target.value || "");
						} catch (err) {}
					},
					style: searchStyle
				}),
				h("div", {
					key: "body",
					style: bodyStyle
				}, [bodyNode])
			])]);
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
		/**
		* 远程按钮按压反馈样式（2026-09-29 用户拍板：任何可点都要有视觉反馈）。
		* 纯 CSS :hover/:active——鼠标悬停提亮、按下/触屏长按压暗+微缩（长按即保持 :active，无需计时器）；
		* 只用 filter/transform，不碰主题色，与 palette 共存；disabled 排除。
		* 挂在入口按钮处注入（入口常驻，即使面板关闭齿轮也在，保证齿轮一定有反馈）。
		* #104 改域选择器：从逐键枚举改为触控栏域选择器，新键自动继承悬停/按下反馈。
		*/
		const REMOTE_FB_STYLE_ID = "dsh-prompt-remote-feedback";
		const REMOTE_FB_CSS = [
			"[data-dsh-prompt-dock] button:hover, [data-dsh-prompt-dock-pill]:hover, [data-dsh-prompt-remote-panel] button:hover, [data-dsh-prompt-settings-modal] button:hover, [data-dsh-prompt-picker-sheet] button:hover { filter: brightness(1.1); }",
			"[data-dsh-prompt-dock] button:active, [data-dsh-prompt-dock-pill]:active, [data-dsh-prompt-remote-panel] button:active, [data-dsh-prompt-settings-modal] button:active, [data-dsh-prompt-picker-sheet] button:active { filter: brightness(.9); transform: scale(.97); }",
			"[data-dsh-prompt-remote-panel] button:disabled:hover, [data-dsh-prompt-remote-panel] button:disabled:active, [data-dsh-prompt-picker-sheet] button:disabled:hover, [data-dsh-prompt-picker-sheet] button:disabled:active { filter: none; transform: none; }",
			"[data-dsh-prompt-remote-panel] button, [data-dsh-prompt-settings-modal] button, [data-dsh-prompt-dock] button, [data-dsh-prompt-picker-sheet] button { transition: filter .08s ease, transform .08s ease; }"
		].join("\n");
		let remoteFbReady = false;
		function ensureRemoteFeedbackStyle() {
			if (remoteFbReady) return;
			try {
				const doc = globalThis.document;
				if (!doc || !doc.head || typeof doc.createElement !== "function") return;
				if (typeof doc.querySelector === "function" && doc.querySelector("style[data-dsh-prompt-style=\"dsh-prompt-remote-feedback\"]")) {
					remoteFbReady = true;
					return;
				}
				const tag = doc.createElement("style");
				tag.setAttribute("data-dsh-prompt-style", REMOTE_FB_STYLE_ID);
				tag.textContent = REMOTE_FB_CSS;
				doc.head.appendChild(tag);
				remoteFbReady = true;
			} catch (e) {}
		}
		/** 安全读展开态：true=展开、false=折叠、null=未知（宿主缺席/未实现/异常，不抛） */
		function readSidebarExpanded(ctl) {
			try {
				const f = ctl && ctl.isExpanded;
				if (typeof f !== "function") return null;
				const v = f.call(ctl);
				return v === true ? true : v === false ? false : null;
			} catch (e) {
				return null;
			}
		}
		/**
		* 只切侧栏：调宿主 toggleExpanded，不碰本插件任何 state、不记日志事件。
		* 返回是否真调到宿主面（调用层断言只断到这里，不刺探宿主内部）。
		*/
		function toggleSidebar(ctl) {
			try {
				const f = ctl && ctl.toggleExpanded;
				if (typeof f !== "function") return false;
				f.call(ctl);
				return true;
			} catch (e) {
				return false;
			}
		}
		/**
		* #95 远程 Dock：远程下入口三键（入口/齿轮/折栏）离对话框，聚为一体钉 DSH 窗口底部。
		* - 横向容器：fixed 底、左右下留边（DOCK_MARGIN）、DOCK_Z=8000 低于远程面板 PANEL_Z=9999
		*   （panel.ts:551），高于页面内容与智能卡（400）；经 PanelPortal 挂 body 逃离 slot 层叠上下文。
		* - 高随档：Dock 自身不定高，内边距走 em（以 fontSize 12*entryFontScale 为锚），内键 px/em 体系不动，
		*   档位放大时内容撑高即自动跟，无需第二套尺寸 math。
		* - 内容 actions 注册式：dockActions 数组 append 续加，后续新键只管 push。
		* - 收展内存态（useState，默认展）：收起键在行内末尾，收起后折成底部中间小 pill（与 Dock 同底边距），点展；
		*   不进 remote 持久化、不记日志。
		*/
		const DOCK_Z = 8e3;
		const DOCK_MARGIN = 12;
		const settingsMaskStyle = {
			position: "fixed",
			inset: 0,
			background: "rgba(0,0,0,0.55)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			zIndex: MODAL_Z
		};
		const settingsModalCardStyle = {
			width: "min(1200px, 96vw)",
			maxHeight: "86vh",
			display: "flex",
			flexDirection: "column",
			background: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
			backgroundColor: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
			border: "1px solid var(--dsw-alias-border-inverted)",
			borderRadius: 12,
			overflow: "hidden",
			fontFamily: "var(--dsw-font-family)",
			color: "var(--dsw-alias-label-primary)"
		};
		const settingsModalHeadStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			padding: "10px 14px",
			borderBottom: "1px solid var(--dsw-alias-border-l1)",
			flex: "none"
		};
		const settingsModalTitleStyle = {
			fontSize: "1em",
			fontWeight: 700
		};
		const settingsModalCloseStyle = {
			width: "2em",
			height: "2em",
			borderRadius: "50%",
			border: "1px solid var(--dsw-alias-border-l1)",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: "1em",
			lineHeight: 1,
			cursor: "pointer",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			flex: "none"
		};
		const settingsModalBodyStyle = {
			overflowY: "auto",
			padding: "0 14px 14px",
			minHeight: 0
		};
		/**
		* #112 同手势宽限：hover 开窗后多久内的跟进单击仍算“同一手势”（保持开）。
		* 鼠标 hover→click 同手势通常 <500ms，取 1000ms 宽容；超窗的单击视为稳态意图（取反，可手动关）。
		*/
		const HOVER_CLICK_GRACE_MS = 1e3;
		function EntryButton(props) {
			const react = getReact();
			if (!react) return null;
			const h = react.createElement;
			const open = props.open ?? false;
			const lang = getLang();
			const label = tr(lang, STR.entryBtn);
			const remoteState = react.useState(getRemotePrefs());
			const remote = remoteState[0];
			react.useEffect(() => {
				try {
					ensureRemoteLoaded().catch(() => void 0);
				} catch (e) {}
				return subscribeRemote(() => {
					try {
						remoteState[1](getRemotePrefs());
					} catch (e) {}
				});
			}, []);
			ensureNarrowStyle();
			ensureRemoteFeedbackStyle();
			const entryFontScale = remoteChromeScale(remote.enabled ? remote.size : 1);
			const entryControlScale = remoteChromeScale(remote.enabled ? remote.size : 1);
			const gearModalState = react.useState(false);
			const gearModalOpen = gearModalState[0];
			const closeGearModal = () => {
				try {
					gearModalState[1](false);
				} catch (e) {}
			};
			const sbState = react.useState(readSidebarExpanded(props.sidebarCtl));
			const dockState = react.useState(true);
			const leftState = react.useState(readWorkspaceLeftExpanded(props.sidebarLeftCtl));
			const pickerGateState = react.useState("pending");
			const pickerOpenState = react.useState(false);
			const pickerOpen = pickerOpenState[0];
			const pickerOpenerRef = react.useRef ? react.useRef(null) : { current: null };
			const openPicker = () => {
				try {
					gearModalState[1](false);
				} catch (e) {}
				try {
					pickerOpenState[1](true);
				} catch (err) {}
			};
			const closePicker = () => {
				try {
					pickerOpenState[1](false);
				} catch (e) {}
				try {
					const el = pickerOpenerRef && pickerOpenerRef.current;
					if (el && typeof el.focus === "function") el.focus();
				} catch (err) {}
			};
			const openGearModal = () => {
				try {
					pickerOpenState[1](false);
				} catch (e) {}
				try {
					gearModalState[1](true);
				} catch (err) {}
			};
			react.useEffect(() => {
				if (!pickerOpen && !gearModalOpen) return void 0;
				const onKey = (e) => {
					try {
						if (!e || e.key !== "Escape") return;
						if (pickerOpenState[0] === true || pickerOpen) {
							e.stopPropagation();
							closePicker();
						} else closeGearModal();
					} catch (err) {}
				};
				try {
					const doc = globalThis.document;
					if (doc && typeof doc.addEventListener === "function") {
						doc.addEventListener("keydown", onKey, true);
						return () => {
							try {
								doc.removeEventListener("keydown", onKey, true);
							} catch (err) {}
						};
					}
				} catch (err) {}
			}, [pickerOpen, gearModalOpen]);
			const wsFaces = {
				sessions: props.workspaceSessions,
				workspaces: props.workspaceList,
				uiWorkspace: props.workspaceUI
			};
			const pickerGate = pickerGateState[0];
			react.useEffect(() => {
				let alive = true;
				try {
					const g = probeWorkspaceGates({
						sessions: props.workspaceSessions,
						workspaces: props.workspaceList,
						uiWorkspace: props.workspaceUI
					});
					if (!alive) return;
					pickerGateState[1](g.enumerable && g.switchable ? "ready" : "absent");
				} catch (e) {
					try {
						if (alive) pickerGateState[1]("absent");
					} catch (err) {}
				}
				return () => {
					alive = false;
				};
			}, [
				props.workspaceSessions,
				props.workspaceList,
				props.workspaceUI
			]);
			const gearMaskStyle = remote.enabled ? {
				...settingsMaskStyle,
				alignItems: "flex-start",
				padding: "2vh 2vw 0"
			} : settingsMaskStyle;
			const gearCardStyle = remote.enabled ? {
				...settingsModalCardStyle,
				width: "fit-content",
				minWidth: "min(480px, 94vw)",
				maxWidth: "96vw",
				height: "calc(96vh - 3.5rem)",
				maxHeight: "calc(96vh - 3.5rem)",
				margin: 0,
				borderRadius: 12,
				fontSize: "calc(var(--dsw-font-markdown-base-font-size) * " + remoteSizeScale(remote.size) + ")"
			} : settingsModalCardStyle;
			const gearHeadStyle = remote.enabled ? {
				...settingsModalHeadStyle,
				position: "sticky",
				top: 0,
				zIndex: 1,
				background: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
				backgroundColor: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))"
			} : settingsModalHeadStyle;
			const gearModalNode = !gearModalOpen ? null : h(ModalPortal, { key: "dsh-prompt-settings-modal" }, h("div", {
				style: gearMaskStyle,
				"data-dsh-prompt-settings-modal": "1",
				onClick: (e) => {
					if (e.target === e.currentTarget) closeGearModal();
				}
			}, [h("div", { style: gearCardStyle }, [h("div", { style: gearHeadStyle }, [h("span", { style: settingsModalTitleStyle }, tr(lang, STR.remoteConfigKey)), h("button", {
				type: "button",
				style: settingsModalCloseStyle,
				title: tr(lang, STR.close),
				"data-dsh-prompt-settings-modal-close": "1",
				onClick: closeGearModal
			}, "×")]), h("div", { style: settingsModalBodyStyle }, [h(SettingsPage, { key: "gear-settings-page" })])])]));
			const entryBtn = h("button", {
				key: "entry",
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
					padding: 5 * entryControlScale + "px " + 10 * entryControlScale + "px",
					borderRadius: 8,
					background: "var(--dsw-alias-bg-layer-3)",
					border: "1px solid var(--dsw-alias-border-l1)",
					color: open ? "var(--dsw-specific-accent,#f0a45c)" : "var(--dsw-alias-label-primary)",
					cursor: "pointer",
					fontSize: 12 * entryFontScale,
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
					if (!isPanelOpen()) {
						setPanelOpen(true);
						noteHoverOpen();
					}
				},
				onMouseLeave: () => {
					schedulePanelClose(150);
				},
				onClick: () => {
					cancelPanelClose();
					if (isPanelOpen() && takeHoverOpen(HOVER_CLICK_GRACE_MS)) return;
					setPanelOpen(!isPanelOpen());
				}
			}, [h("svg", {
				width: 14 * entryFontScale,
				height: 14 * entryFontScale,
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
			if (!remote.enabled) return gearModalNode ? h("span", { style: {
				display: "inline-flex",
				alignItems: "center"
			} }, [entryBtn, gearModalNode]) : entryBtn;
			const gearTitle = tr(lang, STR.remoteConfigKey);
			const gearBox = 26 * entryControlScale;
			const gear = h("button", {
				key: "gear",
				type: "button",
				style: {
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					width: gearBox,
					height: gearBox,
					borderRadius: 8,
					marginLeft: 6,
					background: "var(--dsw-alias-bg-layer-3)",
					border: "1px solid var(--dsw-alias-border-l1)",
					color: "var(--dsw-alias-label-primary)",
					cursor: "pointer",
					fontSize: 14 * entryFontScale,
					flex: "none"
				},
				title: gearTitle,
				"aria-label": gearTitle,
				"data-dsh-prompt-remote-gear": "1",
				onMouseDown: keepComposerFocus,
				onClick: openGearModal
			}, "⚙");
			const sidebarLeftCtl = props.sidebarLeftCtl;
			const canLeft = canShowWorkspaceLeft(sidebarLeftCtl);
			const leftExpanded = leftState[0] === true;
			const leftTitle = tr(lang, leftExpanded ? STR.workspaceLeftCollapse : STR.workspaceLeftExpand);
			const leftKey = !canLeft ? null : h("button", {
				key: "workspace-left",
				type: "button",
				style: {
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					width: gearBox,
					height: gearBox,
					borderRadius: 8,
					marginLeft: 6,
					background: "var(--dsw-alias-bg-layer-3)",
					border: "1px solid var(--dsw-alias-border-l1)",
					color: "var(--dsw-alias-label-primary)",
					cursor: "pointer",
					fontSize: 14 * entryFontScale,
					flex: "none",
					opacity: leftExpanded ? 1 : .75
				},
				title: leftTitle,
				"aria-label": leftTitle,
				"aria-pressed": leftExpanded,
				"data-dsh-prompt-workspace-left": "1",
				onMouseDown: keepComposerFocus,
				onClick: () => {
					toggleWorkspaceLeft(sidebarLeftCtl);
					try {
						const v = readWorkspaceLeftExpanded(sidebarLeftCtl);
						leftState[1](v === null ? !leftExpanded : v);
					} catch (e) {}
				}
			}, [h("svg", {
				width: "1.2em",
				height: "1.2em",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				style: { flex: "none" }
			}, leftExpanded ? [
				h("rect", {
					x: 3,
					y: 4,
					width: 18,
					height: 16,
					rx: 2
				}),
				h("path", { d: "M9 4v16" }),
				h("path", { d: "M13.5 9l-3 3 3 3" })
			] : [
				h("rect", {
					x: 3,
					y: 4,
					width: 18,
					height: 16,
					rx: 2
				}),
				h("path", { d: "M15 4v16" }),
				h("path", { d: "M10.5 9l3 3-3 3" })
			])]);
			const sidebarCtl = props.sidebarCtl;
			const canSidebar = !!sidebarCtl && typeof sidebarCtl.toggleExpanded === "function";
			const sbExpanded = sbState[0] === true;
			const sbTitle = tr(lang, sbExpanded ? STR.sidebarCollapse : STR.sidebarExpand);
			const sidebarKey = !canSidebar ? null : h("button", {
				key: "sidebar",
				type: "button",
				style: {
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					width: gearBox,
					height: gearBox,
					borderRadius: 8,
					marginLeft: 6,
					background: "var(--dsw-alias-bg-layer-3)",
					border: "1px solid var(--dsw-alias-border-l1)",
					color: "var(--dsw-alias-label-primary)",
					cursor: "pointer",
					fontSize: 14 * entryFontScale,
					flex: "none",
					opacity: sbExpanded ? 1 : .75
				},
				title: sbTitle,
				"aria-label": sbTitle,
				"aria-pressed": sbExpanded,
				"data-dsh-prompt-sidebar-toggle": "1",
				onMouseDown: keepComposerFocus,
				onClick: () => {
					toggleSidebar(sidebarCtl);
					try {
						const v = readSidebarExpanded(sidebarCtl);
						sbState[1](v === null ? !sbExpanded : v);
					} catch (e) {}
				}
			}, [h("svg", {
				width: "1.2em",
				height: "1.2em",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				style: { flex: "none" }
			}, sbExpanded ? [
				h("rect", {
					x: 3,
					y: 4,
					width: 18,
					height: 16,
					rx: 2
				}),
				h("path", { d: "M15 4v16" }),
				h("path", { d: "M10.5 9l-3 3 3 3" })
			] : [
				h("rect", {
					x: 3,
					y: 4,
					width: 18,
					height: 16,
					rx: 2
				}),
				h("path", { d: "M9 4v16" }),
				h("path", { d: "M13.5 9l3 3-3 3" })
			])]);
			const canPicker = pickerGate === "ready" && canShowWorkspacePicker(wsFaces);
			const pickerTitle = tr(lang, STR.workspacePicker);
			const pickerKey = !canPicker ? null : h("button", {
				key: "workspace-picker",
				type: "button",
				ref: (el) => {
					try {
						if (pickerOpenerRef) pickerOpenerRef.current = el;
					} catch (e) {}
				},
				style: {
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					width: gearBox,
					height: gearBox,
					borderRadius: 8,
					marginLeft: 6,
					background: "var(--dsw-alias-bg-layer-3)",
					border: "1px solid " + (pickerOpen ? "var(--dsw-specific-accent,#f0a45c)" : "var(--dsw-alias-border-l1)"),
					color: "var(--dsw-alias-label-primary)",
					cursor: "pointer",
					fontSize: 14 * entryFontScale,
					flex: "none"
				},
				title: pickerTitle,
				"aria-label": pickerTitle,
				"aria-expanded": pickerOpen ? "true" : "false",
				"aria-haspopup": "dialog",
				"data-dsh-prompt-workspace-picker": "1",
				onMouseDown: keepComposerFocus,
				onClick: () => {
					if (pickerOpen) closePicker();
					else openPicker();
				}
			}, [h("svg", {
				width: "1.2em",
				height: "1.2em",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				style: { flex: "none" }
			}, [
				h("rect", {
					x: 3,
					y: 4,
					width: 18,
					height: 16,
					rx: 2
				}),
				h("path", { d: "M7 10h9" }),
				h("path", { d: "M14.5 13.5l3 3-3 3" })
			])]);
			let pickerSessionId = void 0;
			try {
				const a = props.sessionId;
				if (typeof a === "string" && a !== "") pickerSessionId = a;
				else {
					const b = getSmartInput().sessionId;
					if (typeof b === "string" && b !== "") pickerSessionId = b;
				}
			} catch (e) {
				pickerSessionId = void 0;
			}
			const pickerModalNode = !pickerOpen ? null : h(ModalPortal, { key: "dsh-prompt-workspace-picker" }, h(WorkspacePicker, {
				faces: wsFaces,
				currentId: pickerSessionId,
				remoteSize: remote.size,
				onClose: () => {
					closePicker();
				}
			}));
			const dockActions = [];
			dockActions.push(entryBtn);
			dockActions.push(gear);
			if (leftKey) dockActions.push(leftKey);
			if (sidebarKey) dockActions.push(sidebarKey);
			if (pickerKey) dockActions.push(pickerKey);
			const dockCollapseTitle = tr(lang, STR.dockCollapse);
			dockActions.push(h("button", {
				key: "dock-collapse",
				type: "button",
				style: {
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					width: gearBox,
					height: gearBox,
					borderRadius: 8,
					marginLeft: 6,
					background: "transparent",
					border: "1px solid var(--dsw-alias-border-l1)",
					color: "var(--dsw-alias-label-tertiary)",
					cursor: "pointer",
					fontSize: 14 * entryFontScale,
					flex: "none"
				},
				title: dockCollapseTitle,
				"aria-label": dockCollapseTitle,
				"data-dsh-prompt-dock-collapse": "1",
				onMouseDown: keepComposerFocus,
				onClick: () => {
					dockState[1](false);
				}
			}, "▾"));
			const dockBarStyle = {
				position: "fixed",
				left: DOCK_MARGIN,
				right: DOCK_MARGIN,
				bottom: DOCK_MARGIN,
				display: "flex",
				justifyContent: "center",
				zIndex: DOCK_Z,
				pointerEvents: "none",
				fontSize: 12 * entryFontScale
			};
			const dockPillStyle = {
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				padding: "0.5em 0.75em",
				borderRadius: 12,
				background: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
				border: "1px solid var(--dsw-alias-border-l1)",
				color: "var(--dsw-alias-label-primary)",
				fontFamily: "var(--dsw-font-family)",
				pointerEvents: "auto",
				maxWidth: "96vw",
				overflowX: "auto",
				whiteSpace: "nowrap"
			};
			if (!dockState[0]) {
				const dockExpandTitle = tr(lang, STR.dockExpand);
				return h("span", { style: {
					display: "inline-flex",
					alignItems: "center"
				} }, [
					h(PanelPortal, { key: "dsh-prompt-dock-pill" }, h("div", { style: {
						position: "fixed",
						left: "50%",
						transform: "translateX(-50%)",
						bottom: DOCK_MARGIN,
						zIndex: DOCK_Z,
						pointerEvents: "none"
					} }, [h("button", {
						type: "button",
						style: {
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							padding: "0.4em 0.7em",
							borderRadius: 999,
							background: "var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))",
							border: "1px solid var(--dsw-alias-border-l1)",
							color: "var(--dsw-alias-label-primary)",
							cursor: "pointer",
							fontSize: 12 * entryFontScale,
							fontFamily: "var(--dsw-font-family)",
							pointerEvents: "auto"
						},
						title: dockExpandTitle,
						"aria-label": dockExpandTitle,
						"data-dsh-prompt-dock-pill": "1",
						onMouseDown: keepComposerFocus,
						onClick: () => {
							dockState[1](true);
						}
					}, "▴")])),
					gearModalNode,
					pickerModalNode
				]);
			}
			return h("span", { style: {
				display: "inline-flex",
				alignItems: "center"
			} }, [
				h(PanelPortal, { key: "dsh-prompt-dock" }, h("div", {
					style: dockBarStyle,
					"data-dsh-prompt-dock": "1"
				}, [h("div", { style: dockPillStyle }, dockActions)])),
				gearModalNode,
				pickerModalNode
			]);
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
			const remoteTickState = react.useState(0);
			react.useEffect(() => {
				let on = true;
				try {
					return subscribeRemote(() => {
						if (on) remoteTickState[1]((n) => n + 1);
					});
				} catch (e) {}
				return () => {
					on = false;
				};
			}, []);
			const smartFontScale = remoteChromeScale(getRemotePrefs().enabled ? getRemotePrefs().size : 1);
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
				fontSize: "calc(var(--dsw-font-markdown-base-font-size) * " + smartFontScale + ")",
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
		//#region src/client/hostfont.ts
		/**
		* dsh-prompt — 宿主内容字桥（#92 野路子，用户拍板已知局限：px 定死区不跟随；
		* #103 野路子三期：主会话 AI 定死区改 targeted zoom 覆盖，局限关闭）。
		*
		* - 开远程后 DSH 宿主内容字按档位等比动（hostContentFontPx），关远程恢复原样（两边 removeProperty）。
		* - 落点 documentElement + body 双写：body 行内即时赢下 cascade（派生链定义在 body 上，
		*   行内优先级最高）；documentElement（:root）写入不被 theme/change 重放 смыв，
		*   作 body 行内被重放覆盖时的兜底与恢复语义的对称点。关即两边 removeProperty 回宿主真相。
		* - 本文件是唯一的 DOM 接触点；remoteView.ts 保持纯函数（禁 DOM/宿主调用）。
		* - 全程守卫 + try/catch fail-soft，不抛（单测无 DOM 时静默 no-op）。
		*/
		const HOST_CONTENT_FONT_VAR = "--dsh-content-font-size";
		/** 工作区列表跟随样式钩（D-targeted，自家 style 注入惯例见 button.ts 窄屏/反馈样式） */
		const ROWS_STYLE_ID = "dsh-prompt-remote-rows";
		/** 主会话 AI 跟随样式钩（#103：与 ROWS 同体例的第三条桥） */
		const ASSISTANT_STYLE_ID = "dsh-prompt-remote-assistant";
		function collectStyleTargets() {
			const out = [];
			try {
				const g = globalThis;
				const doc = g && g.document;
				if (!doc) return out;
				try {
					if (doc.documentElement && doc.documentElement.style) out.push(doc.documentElement.style);
				} catch (e) {}
				try {
					if (doc.body && doc.body.style) out.push(doc.body.style);
				} catch (e) {}
			} catch (e) {}
			return out;
		}
		/**
		* 同步宿主内容字（fail-soft，不抛）：
		* - enabled=true → 双写变量为 hostContentFontPx(size) + 'px'；
		* - 其它（含关/非法）→ 两边 removeProperty（恢复宿主原样）。
		* 无 DOM（typeof document 缺席 / element 缺席）时静默 no-op。
		*/
		function syncHostFont(enabled, size) {
			try {
				if (typeof document === "undefined") try {
					const g = globalThis;
					if (!g || !g.document) return;
				} catch (e) {
					return;
				}
				const targets = collectStyleTargets();
				if (targets.length === 0) return;
				if (enabled !== true) {
					for (const st of targets) try {
						if (st && typeof st.removeProperty === "function") st.removeProperty(HOST_CONTENT_FONT_VAR);
					} catch (e) {}
					return;
				}
				let px = "14px";
				try {
					px = hostContentFontPx(size) + "px";
				} catch (e) {
					px = "14px";
				}
				for (const st of targets) try {
					if (st && typeof st.setProperty === "function") st.setProperty(HOST_CONTENT_FONT_VAR, px);
				} catch (e) {}
			} catch (e) {}
		}
		/**
		* 工作区列表跟随（D-targeted，野路子二期，用户拍板）：
		* - 工作区会话列表走 C 类硬编码（faucet 零引用），变量桥够不着，只能 targeted 覆盖；
		* - rem/px 体系下唯一能动硬编码 px 文字的纯 CSS 手段是 zoom（Chromium/Electron 支持），
		*   zoom 缩行整体（含命中区，触控正好），因子取档位全额 remoteSizeScale；
		* - 开→注入/更新自家 <style>（幂等：先查后建），关/非法→摘掉恢复原样；
		* - 全程守卫 + try/catch fail-soft，不抛，无新日志事件（沿用 setRemoteEnabled/Size 已有事件）。
		*/
		function syncRemoteRows(enabled, size) {
			try {
				const g = globalThis;
				const doc = g && g.document;
				if (!doc || typeof doc.createElement !== "function" || !doc.head) return;
				const sel = "style[data-dsh-prompt-style=\"dsh-prompt-remote-rows\"]";
				const find = () => {
					try {
						return typeof doc.querySelector === "function" ? doc.querySelector(sel) : null;
					} catch (e) {
						return null;
					}
				};
				const remove = () => {
					try {
						const el = find();
						if (!el) return;
						if (el.parentNode && typeof el.parentNode.removeChild === "function") el.parentNode.removeChild(el);
						else if (typeof el.remove === "function") el.remove();
					} catch (e) {}
				};
				if (enabled !== true) {
					remove();
					return;
				}
				let scale = 1;
				try {
					scale = remoteSizeScale(size);
				} catch (e) {
					scale = NaN;
				}
				if (typeof scale !== "number" || !isFinite(scale) || scale <= 0) {
					remove();
					return;
				}
				const css = "[data-row-key^=\"session:\"],[data-row-key^=\"workspace:\"]{zoom:" + scale + ";}";
				try {
					const prev = find();
					if (prev) {
						try {
							prev.textContent = css;
						} catch (e) {}
						return;
					}
				} catch (e) {}
				try {
					const tag = doc.createElement("style");
					if (!tag || typeof tag.setAttribute !== "function") return;
					tag.setAttribute("data-dsh-prompt-style", ROWS_STYLE_ID);
					try {
						tag.textContent = css;
					} catch (e) {}
					doc.head.appendChild(tag);
				} catch (e) {}
			} catch (e) {}
		}
		/**
		* 主会话 AI 跟随（#103，野路子三期，用户拍板突破整机政策）：
		* - 0.2.0-rc.2 起主会话 AI 正文走定死 --dsw-font-xs-13（13px）+ 标题/code 定死 px，
		*   变量桥（--dsh-content-font-size）够不着，只能 targeted 覆盖；
		* - 与 syncRemoteRows 同理：rem/px 体系下唯一能动硬编码 px 文字的纯 CSS 手段是 zoom，
		*   zoom 缩响应组整体（含命中区，触控正好），因子取档位全额 remoteSizeScale；
		* - 开→注入/更新自家 <style>（幂等：先查后建），关/非法→摘掉恢复原样；
		* - 选择器只走稳定 data-chat-group-part="response"（AI 响应组；用户组另标，不在内），
		*   哈希类名一律不写；旧宿主无此属性时自然 no-op（选择器命中空，变量桥仍覆盖旧链路）；
		* - 全程守卫 + try/catch fail-soft，不抛，无新日志事件（沿用 setRemoteEnabled/Size 已有事件）。
		*/
		function syncAssistantZoom(enabled, size) {
			try {
				const g = globalThis;
				const doc = g && g.document;
				if (!doc || typeof doc.createElement !== "function" || !doc.head) return;
				const sel = "style[data-dsh-prompt-style=\"dsh-prompt-remote-assistant\"]";
				const find = () => {
					try {
						return typeof doc.querySelector === "function" ? doc.querySelector(sel) : null;
					} catch (e) {
						return null;
					}
				};
				const remove = () => {
					try {
						const el = find();
						if (!el) return;
						if (el.parentNode && typeof el.parentNode.removeChild === "function") el.parentNode.removeChild(el);
						else if (typeof el.remove === "function") el.remove();
					} catch (e) {}
				};
				if (enabled !== true) {
					remove();
					return;
				}
				let scale = 1;
				try {
					scale = remoteSizeScale(size);
				} catch (e) {
					scale = NaN;
				}
				if (typeof scale !== "number" || !isFinite(scale) || scale <= 0) {
					remove();
					return;
				}
				const css = "[data-chat-group-part=\"response\"]{zoom:" + scale + ";}";
				try {
					const prev = find();
					if (prev) {
						try {
							prev.textContent = css;
						} catch (e) {}
						return;
					}
				} catch (e) {}
				try {
					const tag = doc.createElement("style");
					if (!tag || typeof tag.setAttribute !== "function") return;
					tag.setAttribute("data-dsh-prompt-style", ASSISTANT_STYLE_ID);
					try {
						tag.textContent = css;
					} catch (e) {}
					doc.head.appendChild(tag);
				} catch (e) {}
			} catch (e) {}
		}
		//#endregion
		//#region event-list.dsh-prompt.json
		var event_list_dsh_prompt_default = {
			version: 1,
			pluginId: "dsh-prompt",
			counts: {
				"resident": 33,
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
						"draftChars",
						"caret",
						"caretSrc",
						"draftLines"
					],
					"codes": ["ENUM", "H_ID"],
					"guard": "#76 追加落点诊断：caret=实际插入点下标、draftLines=插入前草稿行数、caretSrc=落点来源。全都不是正文（数字与短枚举），真机再报错位时一眼看出是活读(live)、编辑期采样(sample)、兜底末尾(end/none)还是史前 textarea(legacy)",
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
				"settings.remote.toggle": {
					"level": "info",
					"kind": "resident",
					"fields": ["on", "size"],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"settings.remote.size": {
					"level": "info",
					"kind": "resident",
					"fields": ["on", "size"],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"settings.remote.orientation": {
					"level": "info",
					"kind": "resident",
					"fields": ["on", "orientation"],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"settings.remote.density": {
					"level": "info",
					"kind": "resident",
					"fields": ["on", "density"],
					"codes": ["ENUM"],
					"rules": [
						"R_TOKEN",
						"R_WIN_ABS",
						"R_HOME_PATH",
						"R_URL",
						"R_EMAIL"
					]
				},
				"system.orientation.get": {
					"level": "info",
					"kind": "resident",
					"fields": [
						"ok",
						"orientation",
						"source",
						"code"
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
				"system.orientation.set": {
					"level": "info",
					"kind": "resident",
					"fields": [
						"ok",
						"orientation",
						"code"
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
				"remote.direct.open": {
					"level": "info",
					"kind": "resident",
					"fields": ["method", "ok"],
					"codes": ["ENUM"],
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
		* 的同类访问本来就在 `try` 里（#127 `updauto.ts` 已删；降级值 `false` / `null` / `''` / `false`
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
				entryCount: 7
			});
			ctx.effect(() => {
				ensureLoaded().catch(() => void 0);
			}, "dsh-prompt: store load");
			ctx.effect(() => {
				ensureRemoteLoaded().then(() => {
					try {
						if (getRemotePrefs().enabled !== true) return;
						warmEnvOrientation(() => getSystemOrientation()).catch(() => void 0);
					} catch (e) {}
				}).catch(() => void 0);
			}, "dsh-prompt: remote load");
			ctx.effect(() => {
				const sync = () => {
					try {
						const p = getRemotePrefs();
						syncHostFont(p.enabled, p.size);
						syncRemoteRows(p.enabled, p.size);
						syncAssistantZoom(p.enabled, p.size);
					} catch (e) {}
				};
				try {
					sync();
				} catch (e) {}
				try {
					return subscribeRemote(sync);
				} catch (e) {
					return;
				}
			}, "dsh-prompt: host font sync");
			armInputFocusTrack();
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
				let sidebarCtl = void 0;
				let sidebarLeftCtl = void 0;
				let workspaceSessions = void 0;
				let workspaceList = void 0;
				let workspaceUI = void 0;
				try {
					sidebarCtl = ctx.get ? ctx.get("sidebarRight") : void 0;
				} catch (e) {
					sidebarCtl = void 0;
				}
				try {
					sidebarLeftCtl = ctx.get ? ctx.get("sidebarLeft") : void 0;
				} catch (e) {
					sidebarLeftCtl = void 0;
				}
				try {
					workspaceSessions = ctx.get ? ctx.get("sessions") : void 0;
				} catch (e) {
					workspaceSessions = void 0;
				}
				try {
					workspaceList = ctx.get ? ctx.get("workspaces") : void 0;
				} catch (e) {
					workspaceList = void 0;
				}
				try {
					workspaceUI = ctx.get ? ctx.get("uiWorkspace") : void 0;
				} catch (e) {
					workspaceUI = void 0;
				}
				return h(EntryButton, {
					open: openState[0],
					sidebarCtl,
					sidebarLeftCtl,
					workspaceSessions,
					workspaceList,
					workspaceUI,
					sessionId: props.sessionId
				});
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
			const goSettings = () => {
				try {
					if (typeof document === "undefined") return;
					const label = tr(getLang(), STR.sectionName);
					const clickCell = () => {
						try {
							const cell = Array.prototype.slice.call(document.querySelectorAll("button")).find((b) => (b.textContent || "").trim() === label);
							if (cell) {
								cell.click();
								let tries = 0;
								const scroller = setInterval(() => {
									try {
										const el = document.querySelector("[data-dsh-prompt-remote-section]");
										if (el && typeof el.scrollIntoView === "function") {
											el.scrollIntoView({ block: "start" });
											clearInterval(scroller);
										} else if (++tries > 10) clearInterval(scroller);
									} catch (e) {
										clearInterval(scroller);
									}
								}, 200);
								return true;
							}
						} catch (e) {}
						return false;
					};
					if (clickCell()) return;
					const trig = Array.prototype.slice.call(document.querySelectorAll("button[aria-haspopup=\"dialog\"]")).find((b) => /设置|Settings/.test((b.textContent || "").trim())) || Array.prototype.slice.call(document.querySelectorAll("button")).find((b) => /设置|Settings/.test((b.textContent || "").trim()));
					if (trig) trig.click();
					let n = 0;
					const tid = setInterval(() => {
						try {
							if (clickCell() || ++n > 10) clearInterval(tid);
						} catch (e) {
							try {
								clearInterval(tid);
							} catch (err) {}
						}
					}, 200);
				} catch (e) {}
			};
			setGoSettingsHandler(goSettings);
			try {
				globalThis.__dshPromptGoSettings = goSettings;
			} catch (e) {}
			if (ctx.inputTriggers && typeof ctx.inputTriggers.registerSource === "function") ctx.effect(() => ctx.inputTriggers.registerSource(buildPromptSource()), "dsh-prompt: /prompt source");
			ctx.effect(() => ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-prompt-smart",
				order: 200,
				label: () => "dsh-prompt smart"
			}, SmartCardHost)), "dsh-prompt: smart card");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map