/**
 * dsh-prompt — host 半：DSH 默认缓存目录持久化（issue #20，直接切换，不迁移）
 *
 * 架构（ follows 第三方先例 dsh-usage-statistics-panel，同 profile 已验证）：
 * - 官方存储栈：ctx.storageDomain.open(dsh_prompt) → 落盘 <home>/storages/dsh_prompt.json
 *   （single 布局，与 message_feedback.json 同构；卸载不清理，重装同版本直接复用）。
 * - 暴露方式：HTTP 桥 ctx.webServer.register({ kind: 'prefix', path: '/_dsh/dsh-prompt' })，
 *   client 经同源 fetch 读写（不用 ctx.remote.* —— 第三方同包 Remote 最小例子未有
 *   profile 内先例，HTTP 桥有 usage-panel + vision-router 双先例，风险更低；§5-2/§5-4 见本票决议）。
 * - 热重载：domain 名每进程只允许 open 一次，fiber dispose + re-import 后新 apply()
 *   复用 globalThis 单例（抄 usage-panel STORE_KEY 做法），否则 already-open 会拖垮整个 host。
 * - 跨进程：storage-json 无跨进程写锁，同文件双写 last-write-wins；
 *   domain/changed 仅进程内可见（官方已知限制）。本插件以单进程权威为准，
 *   双进程同开属平台限制，不在本票解决（§5-1 决议）。
 * - 日志（地图 #45）：宿主侧日志走 ./log/index.js 一个入口（进程单例），电话经 POST /_dsh/dsh-prompt/log
 *   进来；路由错误与拒绝记 host.route.fail / host.bridge.reject / host.store.degraded，
 *   一律只记机器码与 8 位散列，不记错误原文（清单见仓库根 event-list.dsh-prompt.json）。
 */

import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { z } from "zod";

/** 客户端日志电话的路由。与 lib/log/index.js 的 LOG_ROUTE_PATH 同值（回归脚本断言两者一致，防漂移）。 */
const LOG_ROUTE = "/_dsh/dsh-prompt/log";

/** 更新能力的三条路由（#39）。与 lib/update.js 里的同值（回归脚本断言一致，防漂移）。 */
const UPDATE_ROUTES = ["/_dsh/dsh-prompt/update/status", "/_dsh/dsh-prompt/update/check", "/_dsh/dsh-prompt/update/install"];

/** 更新路由这一族的前缀（判失败属于哪一族时用）。从第一条端点派生，不写第三份路径字面量（复审 V7）。 */
const UPDATE_ROUTE_FAMILY = UPDATE_ROUTES[0].slice(0, UPDATE_ROUTES[0].lastIndexOf("/"));

export const name = "dsh-prompt";

/** Host 装配依赖：存储域（持久化）+ webServer（HTTP 桥）。 */
export const inject = ["storageDomain", "webServer"];

/* ── Domain 声明（unit 名须匹配 /^[a-z][a-z0-9_]*$/，连字符非法 → 用下划线） ── */
/* #23 统一标签：customs 记录新增 labels；旧形状（tag 单标签 + 占位 domain/stage/action）
 * 全部改为可选、读时映射为 labels（见 snapshot 归一化），版本号不动（不触发拒读），不双写。 */

const DomainEnum = z.enum(["思考框架", "学习", "工程", "执行"]);
const StageEnum = z.enum(["执行前", "执行中", "执行后"]); // #31：“任意”彻底移除（手改写入走 400 路径）

const CustomRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().default(""),
  labels: z.array(z.string()).optional(),
  body: z.string().max(1000),
  builtin: z.boolean().optional(),
  createdAt: z.number().int().nonnegative(),
  // 旧形状只读兼容（#23 前 client 写入）：tag 取首元，空回落「自定义」；占位三件套丢弃
  tag: z.string().optional(),
  domain: DomainEnum.optional(),
  stage: StageEnum.optional(),
  action: z.array(z.string()).optional(),
});

/** 旧记录读时归一化：labels 缺失/为空 → 旧 tag 首元 → 空回落「自定义」 */
function normalizeCustomLabels(rec) {
  if (rec && Array.isArray(rec.labels) && rec.labels.length > 0) return rec.labels;
  const tag = rec && typeof rec.tag === "string" ? rec.tag.trim() : "";
  return [tag || "自定义"];
}

const UsageRecordSchema = z.object({
  count: z.number().int().nonnegative(),
});

const PinnedRecordSchema = z.object({
  pos: z.number().int().nonnegative(),
});

const GlobalSchema = z.object({
  lastUsed: z.string().nullable(),
});

export const promptDomainSpec = defineDomain({
  name: "dsh_prompt",
  version: 0,
  layout: "single",
  tables: {
    customs: domainTable(CustomRecordSchema),
    usage: domainTable(UsageRecordSchema),
    pinned: domainTable(PinnedRecordSchema),
  },
  global: {
    schema: GlobalSchema,
    initial: { lastUsed: null },
  },
});

/* ── 进程级单例（热重载 guard，抄 usage-panel） ── */

const STORE_KEY = "__dshPromptStore";

function _resetSharedStoreForTests() {
  delete globalThis[STORE_KEY];
}

class PromptStore {
  constructor(storageDomain) {
    this.storageDomain = storageDomain;
    this.domain = null;
    this.customs = null;
    this.usage = null;
    this.pinned = null;
    this.openError = undefined;
    /** read-modify-write 串行链（bump/setPinned 的 get→set 原子化；domain 链只保单写有序）。 */
    this.writeChain = Promise.resolve();
    this.ready = this.initialize().catch((err) => {
      this.openError = err;
    });
  }

  async initialize() {
    const domain = await this.storageDomain.open(promptDomainSpec);
    this.domain = domain;
    this.customs = domain.table("customs");
    this.usage = domain.table("usage");
    this.pinned = domain.table("pinned");
  }

  requireOpen() {
    if (this.openError !== undefined) {
      const detail = this.openError instanceof Error ? this.openError.message : String(this.openError);
      throw new StoreError(503, `dsh-prompt store degraded (domain unavailable: ${detail})`);
    }
    if (!this.domain || !this.customs || !this.usage || !this.pinned) {
      throw new StoreError(503, "dsh-prompt store not ready");
    }
  }

  /** 全量快照（GET /store 的唯一装配点；customs 附归一化 labels，旧记录兼容） */
  snapshot() {
    this.requireOpen();
    const customs = [...this.customs.keys()]
      .map((k) => this.customs.get(k))
      .filter(Boolean)
      .map((r) => ({ ...r, labels: normalizeCustomLabels(r) }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const usage = {};
    for (const k of this.usage.keys()) {
      const r = this.usage.get(k);
      if (r) usage[k] = r.count;
    }
    const pinned = [...this.pinned.keys()]
      .map((k) => ({ id: k, pos: this.pinned.get(k)?.pos ?? 0 }))
      .sort((a, b) => a.pos - b.pos)
      .map((e) => e.id);
    const lastUsed = this.domain.global?.get()?.lastUsed ?? null;
    return { customs, usage, pinned, lastUsed };
  }

  async putCustom(tpl) {
    return this.enqueue(async () => {
      this.requireOpen();
      const parsed = CustomRecordSchema.safeParse(tpl);
      if (!parsed.success) throw new StoreError(400, "invalid custom template");
      await this.customs.put(parsed.data.id, parsed.data);
      return parsed.data;
    });
  }

  async deleteCustom(id) {
    return this.enqueue(async () => {
      this.requireOpen();
      if (typeof id !== "string" || !id) throw new StoreError(400, "invalid id");
      await this.customs.delete(id);
      // 删除同步清 pinned（与旧 client removeCustom 语义一致）
      try {
        await this.pinned.delete(id);
      } catch (e) { /* pinned 缺席视为成功 */ }
      return { deleted: id };
    });
  }

  /** 用量 +1 并原子设置 lastUsed（三触点经此一致；旧 bumpUsage L49-50 副作用搬进 host）。 */
  async bumpUsage(id) {
    return this.enqueue(async () => {
      this.requireOpen();
      if (typeof id !== "string" || !id) throw new StoreError(400, "invalid id");
      const cur = this.usage.get(id)?.count ?? 0;
      await this.usage.put(id, { count: cur + 1 });
      await this.domain.global.set({ lastUsed: id });
      return { id, count: cur + 1 };
    });
  }

  /** 置顶全量替换（有序数组 → {id,pos} 行；移除的键删除）。 */
  async setPinned(ids) {
    return this.enqueue(async () => {
      this.requireOpen();
      if (!Array.isArray(ids) || ids.length > 5 || ids.some((x) => typeof x !== "string" || !x)) {
        throw new StoreError(400, "invalid pinned list (array of ≤5 ids)");
      }
      const prev = new Set(this.pinned.keys());
      const next = new Set(ids);
      for (const k of prev) {
        if (!next.has(k)) await this.pinned.delete(k);
      }
      for (let i = 0; i < ids.length; i++) {
        await this.pinned.put(ids[i], { pos: i });
      }
      return { pinned: [...ids] };
    });
  }

  enqueue(op) {
    const run = this.writeChain.then(op);
    this.writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

class StoreError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sharedStore(storageDomain) {
  const g = globalThis;
  if (g[STORE_KEY]) return g[STORE_KEY];
  const created = new PromptStore(storageDomain);
  g[STORE_KEY] = created;
  return created;
}

/* ── HTTP 桥（同源 fetch；路由注册定位回答 §5-4） ── */

const MAX_JSON_BODY_BYTES = 65536;

async function readJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  let body = "";
  let bytes = 0;
  for await (const chunk of req) {
    bytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;
    if (bytes > maxBytes) throw new StoreError(413, `request body exceeds ${maxBytes} bytes`);
    body += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
  }
  if (body === "") return undefined;
  try {
    return JSON.parse(body);
  } catch (e) {
    throw new StoreError(400, "invalid json body");
  }
}

function writeJson(res, value, status = 200) {
  res.statusCode = status;
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

function writeRouteError(res, err, logCap, meta) {
  const status = err instanceof StoreError ? err.status : 500;
  // 宿主侧错误统一走日志能力（#49）：路由错误记 host.route.fail，存储域降级另记 host.store.degraded。
  // 只记机器码与散列，不记错误原文。
  // 路由与方法是**上下文值**（`route` = 原始请求路径、`method` = 原始请求方法），四轮整改（K2）起
  // 和更新链上那几个发射点同一条判据兜住：只认本文件路由表里的已知取值，不在表里的一律 8 位指纹
  // （见 ROUTE_FAIL_SEMANTICS 的说明）。错误原文本来就是 8 位指纹，不需要再过一遍。
  try {
    logCap?.log?.("host.route.fail", {
      route: safeFieldValue(String(meta?.route ?? ""), KNOWN_ROUTES),
      method: safeFieldValue(String(meta?.method ?? ""), KNOWN_METHODS),
      status,
      errorHash: hashText(String(err?.message ?? err ?? "")),
    });
    if (err instanceof StoreError && err.status === 503) {
      logCap?.log?.("host.store.degraded", { reason: "domain-unavailable", errorHash: hashText(String(err.message ?? "")) });
    }
  } catch (e) { /* 记日志失败不许影响响应 */ }
  writeJson(res, { ok: false, error: { code: "dsh_prompt_error", message: err?.message || "internal error" } }, status);
}

/** 散列（与日志能力内的同形实现一致，用来把错误原文换成 8 位指纹）。 */
function hashText(value) {
  const text = String(value ?? "");
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return ("0000000" + h.toString(16)).slice(-8);
}

/* ── 更新路由失败的「语义白名单 + 失败落盘节流」（#39 三轮整改 H1/H2，四轮整改 K1/K2/K3）──────
 * 为什么需要这两层：字段**名**的权威在真闸门（清单白名单），闸门对 ENUM 事件的字符串值另有
 * 形状基线（#57：清单顶层 valueDomain，标识符形状 + 32 字符，不匹配即丢弃该字段并计数）；
 * 但形状挡不住纯 ASCII 标识符形状的用户数据（如 my-template-v3），包改口径或升版仍能把
 * 正文形状的值送到闸门口（复审 D 实测：47 字符正文进了真日志文件；复审 F 实测形状网放行模板 id）。
 *
 * K1：判据从**字符形状**升级成**语义**。三轮那版用的安全字符集 `/^[A-Za-z0-9._:\/-]{0,64}$/` 恰好等于
 * 本插件模板 id 的字母表 —— `codereview`、`cmoq2k1a3f`、`my-template-v3`、`TEMPLATE_SECRET_internal_v9`
 * 全部逐字落盘（复审 F 实测）。现在一律只认下面几张**已知取值表**，不在表里的一律指纹化。
 * 注意：**本文件不保留「形状网」兜底** —— 本文件发射的字符串值位就是 (route, reason) 与 (route, method)
 * 这两组，都走表；留一条当下用不上的正则等于给变异留一块打不着的空靶（四轮整改的 M1 起初就是这样空过的）。
 * **不判字段名**（白名单只有真闸门那一套，别在桥前面再立一道）。
 *
 * K2：`host.route.fail` 的 `route` / `method` 直接来自原始请求路径 —— 本票链上唯一既没过网也没散列的
 * 发射点（复审 F 的 Top3 ③）。现在同一条语义判据兜住：route 只认路由表里的已知路径，method 只认
 * 五种 HTTP 方法，别的一律指纹。
 *
 * K3：节流从「同一状态落一次」升级成「首条必落 + 成因变化补一条 + 重落间隔下限」。三轮按 (route, reason)
 * 落一次，复审 F 量出两个残余：同一路由换了成因（包改口径、`errorKind` 每次不同）时**第二种成因被
 * 静默吞掉**，以及**请求级去重的键是没过网的原文 reason**、原文一变去重整体失效（62 次请求 62 行
 * ⇒ 14.33 MiB/天）。现状：账本按路由分组（组里再按 reason 分状态），状态里记 `reported`（已落盘成因）
 * 与 `pending`（间隔内到达、还没落盘的成因；深度自然不超过 1）；成因与次数进的是
 * **落盘判据**，不是去重键 —— 键稳定在 (route, reason)，所以「原文每次都变」不会把去重打散。
 * 账本按 updateReady（每个宿主实例一份）分开，免得两个宿主实例串状态。 */
const ROUTE_FAIL_FLOOR_MS = 60000;
/**
 * `host.route.fail` 的 route 位：本文件路由表里的**已知取值**（前缀注册，所以路径必然以 /_dsh/dsh-prompt
 * 开头）。`/_dsh/dsh-prompt/debug` 那条是 #50 删掉的临时诊断路由，留在这里是为了它那条 404 落盘不被
 * 指纹化 —— 它落了就给排障者一个具名取值可用。
 */
const KNOWN_ROUTES = [
  "/_dsh/dsh-prompt/store", "/_dsh/dsh-prompt/log", "/_dsh/dsh-prompt/customs/put",
  "/_dsh/dsh-prompt/customs/delete", "/_dsh/dsh-prompt/usage/bump", "/_dsh/dsh-prompt/pinned/set",
  "/_dsh/dsh-prompt/debug", UPDATE_ROUTE_FAMILY,
  ...UPDATE_ROUTES,
];
const KNOWN_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
/** 请求级 `update.route.fail` 的 reason：包 `toUpdateErrorPayload` 的已知码 + 本仓的自报码。 */
const KNOWN_REASONS = [
  "check-failed", "invalid-release", "check-expired", "update-busy", "install-failed", "unknown-profile",
  "source-install", "invalid-installation", "installation-changed", "pending-restart", "incompatible-node",
  "registry-conflict", "recovery-required", "unknown-phone", "phone-failed",
  "dep-load-fail", "capability-degraded", "capability-build-fail",
];
const routeFailLedger = new WeakMap();
/** 时间源（可注入：`test:issue-39` 用它把 60 秒间隔压在可控时间轴上量出来，生产是真时钟）。 */
let routeFailNow = () => Date.now();
let routeFailFloorMs = ROUTE_FAIL_FLOOR_MS;

/**
 * 单值兜底：非字符串原样（类型归闸门管）；字符串**只认已知取值表**，不在表里就换 8 位指纹。
 * 表是本文件唯一的判据（见上面那段说明：这里不留形状网兜底）。调用点只有两处：
 * `writeRouteError`（host.route.fail 的 route / method，K2）与 `updateRoutes`（update.route.fail 的
 * route / reason，K1）。
 */
function safeFieldValue(value, known) {
  if (typeof value !== "string") return value;
  return known.indexOf(value) >= 0 ? value : hashText(value);
}

/**
 * 离开重落间隔之后，把 `pending` 里**最老的、已经等够间隔**的成因补落掉。返回 true = 这次落盘了。
 * 为什么不是「只补这次请求带来的成因」：间隔内到达的成因可能**再也没被重复报**，只按它自己的调用
 * 来补就永远补不上 —— 那正是「真实的第二种成因被静默吞掉」（复审 F 打中的那类病）。所以队列按
 * **等待时长**出队：每项记着 `at`（到达时刻），等够 `routeFailFloorMs` 就能被**下一次任何调用**补上。
 * **不设条数上限**：上限同样会丢掉真实的新失败；频率由间隔把关（每个间隔最多落一条）。
 */
function flushPendingRouteFail(routeState, entry) {
  const head = entry.pending[0];
  if (!head) return false;
  if (routeFailNow() - head.at < routeFailFloorMs) return false;
  entry.pending.shift();
  entry.reported.add(head.hash);
  routeState.lastEmitAt = routeFailNow();
  return true;
}

/**
 * 队列纪律（两条，顺序别凭直觉调换）：
 * ① 先把成因排进 `pending`（已落过的、已在队列里的都只保一条）：**先排队、再看能不能落** ——
 *    反过来写（先落旧的、落成功就 return）会把当前成因挡在队外，而它可能再也没机会被报到，于是**静默丢失**；
 * ② 队列里最老的那条等够间隔了 → 落它（`flushPendingRouteFail`）；没等够就不落，留到下一轮。
 * 为什么必须有队列：间隔内到达的成因如果只靠「它自己再被报到」来补，可能永远补不上 ——
 * 而「真实的第二种成因被静默吞掉」正是三轮被复审 F 打中的那类病。
 */
function failDecision(routeState, entry, cause) {
  // 排进队列（已在队列里就只保一条；已落过的成因不再排队）
  if (!entry.reported.has(cause) && !entry.pending.some((p) => p.hash === cause)) {
    entry.pending.push({ hash: cause, at: routeFailNow() });
  }
  // 队列里最老的那条等够间隔了 → 落它
  if (flushPendingRouteFail(routeState, entry)) return true;
  // 没等够就不落：成因留在队列里等下一轮（「新成因不会丢」靠的就是这条）
  return false;
}

/**
 * 这个失败该不该落盘（K3）。三条纪律：
 * ① **首条必落**：这个 (route, reason) 从来没见过 → 落（真实故障不许因为节流而看不见）；
 *    唯一的例外是这条路由刚刚（< routeFailFloorMs）才落过 —— 那时把成因记进 `pending`，下一次请求补落；
 * ② **成因变化要可见**：同一状态换了成因（新的 `errorHash`）→ 补一条 —— 这正是三轮丢掉的可见性
 *    （复审 F 实测成因 B 的指纹出现 0 次）；
 * ③ **重落间隔下限**：同一状态两次落盘之间至少隔 routeFailFloorMs（见 failDecision 的队列纪律）。
 * 键稳定在 (route, reason)：**成因与次数进的是落盘判据，不是去重键**；队列**不设条数上限**
 * （上限等于给「真实的新失败」留一条被丢掉的路）。
 * 实测口径（.tmp-verify/rv4/k3-dedupe.mjs，1 请求 = 1 秒）：稳态 62 次 → 6 行（三条路由各 1 条失败
 * 消息）；失败/成功交替 30 轮 → 2 行；每请求换成因 62 次 → 1 行；首条永远落（冷启动实测 2 行）。
 */
function noteRouteFail(updateReady, route, reason, causeHash) {
  let ledger = routeFailLedger.get(updateReady);
  if (!ledger) {
    ledger = new Map();
    routeFailLedger.set(updateReady, ledger);
  }
  let routeState = ledger.get(String(route));
  if (!routeState) {
    routeState = { lastEmitAt: 0, states: new Map() };
    ledger.set(String(route), routeState);
  }
  const key = String(reason);
  const cause = String(causeHash);
  const entry = routeState.states.get(key);
  if (!entry) {
    const fresh = { reported: new Set([cause]), pending: [] };
    routeState.states.set(key, fresh);
    if (routeFailNow() - routeState.lastEmitAt < routeFailFloorMs) {
      fresh.reported = new Set();
      fresh.pending = [{ hash: cause, at: routeFailNow() }];
      return false;
    }
    routeState.lastEmitAt = routeFailNow();
    return true;
  }
  return failDecision(routeState, entry, cause);
}

/**
 * 这条路由成功了：清掉它的**成因账**（恢复后再失败要重新落一条）。条目留着 —— 它记着上次落盘时刻，
 * 那是重落间隔下限的依据（清了它，成功/失败交替会退化成逐请求落行）。
 */
function clearRouteFails(updateReady, route) {
  const ledger = routeFailLedger.get(updateReady);
  if (!ledger) return;
  const routeState = ledger.get(String(route));
  if (!routeState) return;
  for (const entry of routeState.states.values()) {
    entry.reported = new Set();
    entry.pending = [];
  }
}


/**
 * `test:issue-39` 专用：接管时间源与重落间隔（`testUpdate` 为 undefined 时恢复生产口径）。
 * 落在生产文件里是有意的：四个请求级场景（首条 / 成因变化 / 交替 / 恢复）都需要可控时间轴，
 * 而在测试里重新实现一遍 noteRouteFail 等于不测这段代码（第三轮「假台子」的教训）。
 */
function __setRouteFailClockForTests(testUpdate) {
  if (testUpdate === undefined) {
    routeFailNow = () => Date.now();
    routeFailFloorMs = ROUTE_FAIL_FLOOR_MS;
    return;
  }
  if (typeof testUpdate.now !== "function" || typeof testUpdate.floorMs !== "number" || !(testUpdate.floorMs >= 0)) {
    throw new Error("__setRouteFailClockForTests 需要 { now: () => number, floorMs: number >= 0 }");
  }
  routeFailNow = testUpdate.now;
  routeFailFloorMs = testUpdate.floorMs;
}

/**
 * 更新能力的三条路由（#39）。
 * 返回值是三态，调用点只关心第一件事「这条 URL 是不是更新能力的」：
 * - undefined：不归更新能力管（非 POST / 非白名单路径），调用点继续往下匹配既有端点 ——
 *   更新路由只在需要时插一句，既有路由表的顺序与内容都不动；
 * - "ok"：命中且电话成功，响应已写完（200 + { ok:true, value }）；
 * - "fail"：命中但失败（能力缺席 / 降级 / 电话报错），响应已写完（200 + { ok:false, error }）。
 * 注意 "fail" 也不是「不是我的路由」：落回下层会变成 404，而能力缺席的语义是明确回
 * update-capability-unavailable（回归脚本钉住了这条）。所以调用点按 `!== undefined` 判断，
 * 不按真假值判断 —— 三种返回值都是真值，这里的真假值有含义，别拿它当「成功与否」用。
 * 失败时落 update.route.fail（reason 记机器码，错误原文只留 8 位指纹），但**状态型失败只落一次**：
 * 能力缺席 / 降级的落盘在建能力那一步（logUpdateFail），请求级只留电话真失败（见下面 capabilityAbsent）；
 * 电话真失败这一支再按 (route, reason) 去重（同一状态落一次、成功后清账，见 noteRouteFail），
 * 值另过一层安全网（safeFieldValue）—— 持续失败不再每请求刷行，正文也进不了 reason。
 */
async function updateRoutes(req, res, path, method, logCap, updateReady) {
  if (method !== "POST" || !UPDATE_ROUTES.includes(path)) return undefined;
  const cap = await updateReady;
  const body = await readJsonBody(req);
  const result = cap && typeof cap.runRoute === "function" ? await cap.runRoute(path, body) : null;
  // 更新包的电话回包本身就有 ok 字段（成功 { ok:true, snapshot, manual, receipt }，
  // 失败 { ok:false, error, errorKind }，两个错误字段都是字符串）。这里不拆它的内容，只做两件事：
  // 1) 保持信封形状与既有端点一致：{ ok, value, error }；
  // 2) 能力缺席（import 失败 / 建不起来）时补一个能读的错误码 —— 绝不回「ok=false 但 error 为 null」。
  const failed = result === null || result.ok !== true;
  const error = failed
    ? { code: String(result?.error ?? "update-capability-unavailable"), message: String(result?.errorKind ?? "update capability not loaded") }
    : null;
  // 「能力缺席 / 降级」是**状态型**失败：建能力时已经落过一条 update.route.fail（见 logUpdateFail 的
  // dep-load-fail / capability-degraded / capability-build-fail），请求级不必再落 —— warn 绕过日志开关
  // （dsh-log 的 isEnabled 对 warn 恒真），面板按 UPD_POLL=1000 轮询时会刷成 15 MiB/天且用户关不掉
  // （#39 复审 V1 实测 1.03 行/请求）。请求级这一条只留给**电话真的失败**（check-expired / phone-failed 之类）。
  const capabilityAbsent = cap === null || cap === undefined || cap.ok === false
    || error?.code === "update-capability-unavailable";
  if (failed && !capabilityAbsent) {
    // 「更新没成」这件事以前只有回包、没有日志（#39 审查 F9）。reason 记机器码（check-expired 之类），
    // 错误原文只以 8 位指纹落盘；同一 (route, reason) 按 K3 节流（首条必落 / 成因变化补一条 /
    // 重落间隔下限），route 与 reason 都过语义白名单、正文形状的值换指纹（K1）。
    const causeHash = hashText(error.message);
    if (noteRouteFail(updateReady, path, error.code, causeHash)) {
      logCap?.log?.("update.route.fail", {
        route: safeFieldValue(path, KNOWN_ROUTES),
        reason: safeFieldValue(error.code, KNOWN_REASONS),
        errorHash: hashText(error.message),
      });
    }
  } else if (!failed) {
    // 这条路由这次成功了：清掉它的失败账（恢复后再失败是新状态，必须重新落一条）。
    clearRouteFails(updateReady, path);
  }
  writeJson(res, { ok: !failed, value: result, error }, 200);
  return failed ? "fail" : "ok";
}

/** 同源围栏：Host 必须是 loopback 字面量（127/8、::1、localhost，带端口先剥离），
 * cross-site 拒绝，Origin 缺失时只认 Host（loopback 已验过），Origin 存在时需与 Host 同值。
 * 只做字面量比对、不做 DNS 解析：127.0.0.1.nip.io 这类“解析到 loopback 的域名”一律拒。 */
function isLoopbackHostValue(hostValue) {
  const raw = String(hostValue).trim().toLowerCase();
  if (!raw) return false;
  let hostname = raw;
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    if (end < 0) return false;
    hostname = raw.slice(1, end);
  } else {
    const colonCount = (raw.match(/:/g) || []).length;
    if (colonCount === 0) {
      hostname = raw;
    } else if (colonCount === 1) {
      hostname = raw.slice(0, raw.lastIndexOf(":"));
    } else {
      // 裸 IPv6（不带方括号，如 ::1）：整体即 hostname，不尝试拆端口。
      hostname = raw;
    }
  }
  if (hostname.endsWith(".")) hostname = hostname.slice(0, -1);
  if (!hostname) return false;
  if (hostname === "localhost") return true;
  if (hostname === "::1") return true;
  // IPv4-mapped IPv6 loopback（如 ::ffff:127.0.0.1）：尾段按 127/8 验。
  if (hostname.startsWith("::ffff:")) {
    const tail = hostname.slice("::ffff:".length);
    const tailParts = tail.split(".");
    if (tailParts.length === 4 && tailParts[0] === "127") {
      return tailParts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
    }
    return false;
  }
  const parts = hostname.split(".");
  if (parts.length === 4 && parts[0] === "127") {
    return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
  }
  return false;
}

/** 最小同源围栏（loopback 必须，cross-site 拒绝，origin 需同 host）。 */
function isAllowed(req) {
  try {
    const host = req.headers?.host;
    const hostValue = Array.isArray(host) ? host[0] : host;
    if (!hostValue) return false;
    if (!isLoopbackHostValue(hostValue)) return false;
    const site = req.headers?.["sec-fetch-site"];
    const siteValue = Array.isArray(site) ? site[0] : site;
    if (siteValue === "cross-site") return false;
    const origin = req.headers?.origin;
    const originValue = Array.isArray(origin) ? origin[0] : origin;
    if (originValue === undefined) return true;
    return new URL(originValue).host.toLowerCase() === String(hostValue).trim().toLowerCase();
  } catch (e) {
    return false;
  }
}

function buildPromptRoute(ctx, store, logReady, updateReady) {
  const handler = async (req, res) => {
    /** 日志能力（失败即空实例，调用点不必判空）。 */
    const logCap = await logReady;
    if (!isAllowed(req)) {
      logCap?.log?.("host.bridge.reject", { reason: "untrusted-host" });
      writeJson(res, { ok: false, error: { code: "forbidden", message: "untrusted host" } }, 403);
      return;
    }
    const path = (req.url ?? "").split(/[?#]/, 1)[0];
    const method = req.method ?? "GET";
    try {
      const routed = await updateRoutes(req, res, path, method, logCap, updateReady);
      // 三态：undefined = 不归更新能力管，往下走；"ok" / "fail" = 响应已写完（含能力缺席）。
      if (routed !== undefined) return;
      await store.ready;
      if (method === "GET" && path === "/_dsh/dsh-prompt/store") {
        writeJson(res, { ok: true, value: store.snapshot() });
        return;
      }
      if (method === "POST" && path === LOG_ROUTE) {
        // 客户端日志电话入口（#49）：客户端只发电话名与入参，宿主转给日志能力的电话注册表。
        const body = await readJsonBody(req);
        const result = logCap && typeof logCap.runPhone === "function"
          ? await logCap.runPhone(body?.name, body?.args)
          : { ok: false, error: { code: "log-capability-unavailable", message: "log capability not loaded" } };
        if (result.ok) writeJson(res, { ok: true, value: result.value });
        else writeJson(res, { ok: false, error: result.error }, 200);
        return;
      }
      if (method === "POST" && path === "/_dsh/dsh-prompt/customs/put") {
        const body = await readJsonBody(req);
        const saved = await store.putCustom(body?.template ?? body);
        writeJson(res, { ok: true, value: saved });
        return;
      }
      if (method === "POST" && path === "/_dsh/dsh-prompt/customs/delete") {
        const body = await readJsonBody(req);
        const done = await store.deleteCustom(body?.id);
        writeJson(res, { ok: true, value: done });
        return;
      }
      if (method === "POST" && path === "/_dsh/dsh-prompt/usage/bump") {
        const body = await readJsonBody(req);
        const done = await store.bumpUsage(body?.id);
        writeJson(res, { ok: true, value: done });
        return;
      }
      if (method === "POST" && path === "/_dsh/dsh-prompt/pinned/set") {
        const body = await readJsonBody(req);
        const done = await store.setPinned(body?.ids ?? body?.pinned);
        writeJson(res, { ok: true, value: done });
        return;
      }
      if (method === "POST" && path === "/_dsh/dsh-prompt/debug") {
        // 该临时诊断路由（#32「输入不自动出卡」排查用）已随 #50 删除：它把会话草稿前 80 字写进
        // .tmp-verify/client-diag.jsonl，既是用户内容落盘、又是第二套日志出口。等价诊断力改由
        // smart.probe / smart.card.show / smart.card.miss 三条事件承担（见 src/client/smart.ts）。
        logCap?.log?.("host.route.fail", { route: "/_dsh/dsh-prompt/debug", method, status: 404, errorHash: hashText("removed-endpoint") });
        writeJson(res, { ok: false, error: { code: "not_found", message: `unknown endpoint ${path}` } }, 404);
        return;
      }
      writeJson(res, { ok: false, error: { code: "not_found", message: `unknown endpoint ${path}` } }, 404);
    } catch (err) {
      writeRouteError(res, err, logCap, { route: path, method });
    }
  };
  return { kind: "prefix", path: "/_dsh/dsh-prompt", handler };
}

export function apply(ctx, config = {}) {
  const store = sharedStore(ctx.storageDomain);
  // 日志能力按进程单例建一次，且走动态 import：日志能力缺失或建不起来时只是没有日志，不许拖垮插件装配
  // （既有回归脚本会把 lib/index.js 单独复制到临时目录跑，静态 import 在那里会因为找不到同级文件而炸）。
  const logReady = (async () => {
    try {
      const mod = await import("./log/index.js");
      return await mod.installLogCapability();
    } catch (e) {
      return null;
    }
  })();
  // 更新能力（#39）同法：动态 import 构建产物 lib/update.js（源码住 src/update/host/，esbuild 打包），
  // 建不起来只是没有更新能力，三条路由明确回 update-capability-unavailable，不拖垮插件装配。
  // 但「建不起来」不许静默（#39 审查 F9）：三条失败路径各落一条 update.route.fail，
  // 否则真机上更新按不动时，日志里连「更新能力没起来」都查不到。
  /** 更新能力起不来时的落盘口；日志能力本身缺席时自然什么都不落（那本来就没有日志）。 */
  async function logUpdateFail(reason, message) {
    try {
      const cap = await logReady;
      cap?.log?.("update.route.fail", { route: UPDATE_ROUTE_FAMILY, reason, errorHash: hashText(message) });
    } catch (e) { /* 记日志失败不许影响插件装配 */ }
  }
  const updateReady = (async () => {
    let mod;
    try {
      mod = await import("./update.js");
    } catch (e) {
      await logUpdateFail("dep-load-fail", e?.message || e);
      return null;
    }
    try {
      const cap = await mod.createUpdateCapability({ ctx, logReady });
      if (cap && cap.ok === false) await logUpdateFail("capability-degraded", cap.reason);
      return cap;
    } catch (e) {
      await logUpdateFail("capability-build-fail", e?.message || e);
      return null;
    }
  })();
  ctx.effect(() => {
    const route = buildPromptRoute(ctx, store, logReady, updateReady);
    return ctx.webServer.register(route);
  }, "dsh-prompt: routes");
}

export { _resetSharedStoreForTests, __setRouteFailClockForTests };
