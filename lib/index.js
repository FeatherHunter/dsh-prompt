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
  try {
    logCap?.log?.("host.route.fail", {
      route: String(meta?.route ?? ""),
      method: String(meta?.method ?? ""),
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

/** 最小同源围栏（抄 usage-panel trust-fence 核心：loopback 必须，cross-site 拒绝，origin 需同 host）。 */
function isAllowed(req) {
  try {
    const host = req.headers?.host;
    const hostValue = Array.isArray(host) ? host[0] : host;
    if (!hostValue) return false;
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

function buildPromptRoute(ctx, store, logReady) {
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
  ctx.effect(() => {
    const route = buildPromptRoute(ctx, store, logReady);
    return ctx.webServer.register(route);
  }, "dsh-prompt: routes");
}

export { _resetSharedStoreForTests };
