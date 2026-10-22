// check-thanks.mjs — 致谢表离线一致性门禁：JSON 是源、表格是渲染结果。
//
// 为什么要有它：
//   致谢表由脚本自动追加（scripts/update-thanks.mts，中英两表同画），人眼看不出
//   「花数错一朵、顺序差一位、链接指错一个」。这扇门禁不联网，只做三件事：
//   1. 数据自洽（游标不比数据小、数组有序无重复、最后活跃时间真是最大值）；
//   2. 进位规则钉死（1/9/10/11/99/100/123/1000/10000 的花串写死，改规则先改这里）；
//   3. 表格就是渲染结果（两处标记之间的正文与 renderTable 逐字节一致，
//      中英两表行序、花串、链接一一对上）。
// 不守「有没有漏掉新贡献」——那是联网脚本与每日任务的事，离线门禁够不着。
//
// 口径来源：dsh-mattpocock-skills-deck 的 tests/verify-thanks-table.ts，
// 搬到本仓时按 check-target-tree（禁 tests/ 桶）改放 scripts/，判据一字未动。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ZH_START,
  ZH_END,
  EN_START,
  EN_END,
  isSkippedLogin,
  rosesFor,
  itemsOf,
  totalOf,
  orderedLogins,
  renderTable,
} from './update-thanks.mts';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA = JSON.parse(readFileSync(join(ROOT, 'docs', 'thanks-data.json'), 'utf8'));
const ZH_TEXT = readFileSync(join(ROOT, 'README.md'), 'utf8');
const EN_TEXT = readFileSync(join(ROOT, 'docs', 'README.en.md'), 'utf8');

function between(text, start, end) {
  const si = text.indexOf(start);
  const ei = text.indexOf(end);
  assert.ok(si >= 0 && ei > si, `找不到完整的表格标记：${start} / ${end}`);
  assert.equal(text.indexOf(start, si + 1), -1, `表格开始标记出现了两次：${start}`);
  return text.slice(si + start.length, ei).trim();
}

const ZH_TABLE = between(ZH_TEXT, ZH_START, ZH_END);
const EN_TABLE = between(EN_TEXT, EN_START, EN_END);

function parseRows(table) {
  return table
    .split('\n')
    .filter((l) => l.startsWith('| [@'))
    .map((l) => {
      const parts = l.split('|').map((s) => s.trim());
      const login = (/\[@([^@\]]+)\]/.exec(parts[1]) || [])[1] || '';
      return { login, roses: parts[2], cell: parts[3] };
    });
}

test('游标是整数且不比数据里最大的编号小', () => {
  assert.ok(Number.isInteger(DATA.cursors.issues) && Number.isInteger(DATA.cursors.discussions), '游标必须是整数');
  let maxIssue = 0;
  let maxDiscussion = 0;
  for (const rec of Object.values(DATA.authors)) {
    for (const d of rec.issues) if (d.n > maxIssue) maxIssue = d.n;
    for (const d of rec.prs) if (d.n > maxIssue) maxIssue = d.n;
    for (const d of rec.discussions) if (d.n > maxDiscussion) maxDiscussion = d.n;
    for (const c of rec.comments || []) if (c.n > maxIssue) maxIssue = c.n;
  }
  assert.ok(DATA.cursors.issues >= maxIssue, `议题游标 ${DATA.cursors.issues} 比数据里最大的议题/PR 编号 ${maxIssue} 还小`);
  assert.ok(DATA.cursors.discussions >= maxDiscussion, `讨论游标 ${DATA.cursors.discussions} 比数据里最大的讨论编号 ${maxDiscussion} 还小`);
});

test('数据自洽：无人混入、数组升序无重复、人人有时间、最后活跃真是最大值', () => {
  for (const [login, rec] of Object.entries(DATA.authors)) {
    assert.ok(!isSkippedLogin(login), `贡献数据里混进了不该进表的人：${login}`);
    for (const [key, arr] of [['issues', rec.issues], ['prs', rec.prs], ['discussions', rec.discussions]]) {
      assert.ok(Array.isArray(arr), `${login} 的 ${key} 不是数组`);
      const nums = arr.map((d) => d.n);
      const sorted = [...nums].sort((a, b) => a - b);
      assert.deepEqual(nums, sorted, `${login} 的 ${key} 必须升序无重复`);
      assert.equal(new Set(nums).size, nums.length, `${login} 的 ${key} 有重复编号`);
      for (const d of arr) assert.ok(typeof d.at === 'string' && d.at.length > 0, `${login} 的 ${key} #${d.n} 缺少诞生时间`);
    }
    for (const c of rec.comments || []) {
      assert.ok(c.thread === 'issue' || c.thread === 'pr', `${login} 的留言 thread 只能是 issue 或 pr`);
    }
    // 最后活跃时间必须是全部事项时间里最晚的那个，含留言时间：重算一遍，不信落盘的值。
    const stamps = itemsOf(rec).map((it) => it.at).filter((s) => !!s);
    assert.equal(stamps.length, totalOf(rec), `${login} 有事项缺时间，重算不了最后活跃`);
    const latest = [...stamps].sort()[stamps.length - 1];
    assert.equal(rec.lastActive, latest, `${login} 的 lastActive ${rec.lastActive} 不是最晚时间 ${latest}`);
  }
});

test('进位规则钉死：改规则先改这里', () => {
  const cases = [
    [1, '🌹'],
    [9, '🌹🌹🌹🌹🌹🌹🌹🌹🌹'],
    [10, '💐'],
    [11, '💐🌹'],
    [99, '💐💐💐💐💐💐💐💐💐🌹🌹🌹🌹🌹🌹🌹🌹🌹'],
    [100, '🏆'],
    [123, '🏆💐💐🌹🌹🌹'],
    [1000, '👑'],
    [10000, '💎'],
  ];
  for (const [total, want] of cases) assert.equal(rosesFor(total), want, `${total} 张票的花串应该是 ${want}`);
});

test('表格就是渲染结果：两处标记之间与 renderTable 逐字节一致', () => {
  assert.equal(ZH_TABLE, renderTable(DATA.authors, true), '中文 README 的致谢表不是当前数据的渲染结果（跑 node scripts/update-thanks.mts --render-only 重画）');
  assert.equal(EN_TABLE, renderTable(DATA.authors, false), '英文 README 的致谢表不是当前数据的渲染结果');
});

test('行序、花串、中英对等', () => {
  const zhRows = parseRows(ZH_TABLE);
  const enRows = parseRows(EN_TABLE);
  assert.equal(zhRows.length, Object.keys(DATA.authors).length, '中文表行数与数据人数对不上');
  assert.deepEqual(
    zhRows.map((r) => r.login),
    orderedLogins(DATA.authors),
    '中文表行序必须按“总数多在前、同数按最后活跃倒排、同人按登录名”排',
  );
  assert.deepEqual(
    enRows.map((r) => r.login),
    zhRows.map((r) => r.login),
    '英文表行序必须与中文表一致',
  );
  for (let i = 0; i < zhRows.length; i++) {
    assert.equal(enRows[i].roses, zhRows[i].roses, `${zhRows[i].login} 的中英花串不一致`);
    assert.equal(enRows[i].cell, zhRows[i].cell, `${zhRows[i].login} 的中英贡献列不一致`);
  }
  for (const r of zhRows) {
    const rec = DATA.authors[r.login];
    assert.ok(rec, `表里有 ${r.login}，数据里没有`);
    assert.equal(r.roses, rosesFor(totalOf(rec)), `${r.login} 的花串与票数对不上`);
    // 每个链接：文本号与地址号一致、地址段与类型对应、同一类编号升序。
    const linkRe = /\[#(\d+)\]\(https:\/\/github\.com\/FeatherHunter\/dsh-prompt\/(issues|pull|discussions)\/(\d+)\)/g;
    const kinds = { issues: [], pull: [], discussions: [] };
    let m;
    let count = 0;
    while ((m = linkRe.exec(r.cell)) !== null) {
      count++;
      assert.equal(m[1], m[3], `${r.login} 的链接文本号与地址号不一致：${m[0]}`);
      kinds[m[2]].push(Number(m[1]));
    }
    assert.equal(count, totalOf(rec), `${r.login} 的链接数 ${count} 与票数 ${totalOf(rec)} 对不上`);
    for (const [seg, list] of Object.entries(kinds)) {
      const sorted = [...list].sort((a, b) => a - b);
      assert.deepEqual(list, sorted, `${r.login} 的 ${seg} 链接没有按编号升序排`);
    }
  }
});
