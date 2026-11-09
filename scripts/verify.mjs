/**
 * Offline smoke test for the browser bundle.
 *
 * The bundle has no build step and no runtime dependencies beyond the platform's
 * React and primitives, so this script executes it in a `vm` context with a
 * stubbed `__ModuleLoader__`, renders the registered dock entry with a stubbed
 * React, and asserts the spend estimate, peak marker, tooltip breakdown, and
 * balance suffix.
 *
 * Run with: node scripts/verify.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const bundlePath = fileURLToPath(new URL('../lib/client.js', import.meta.url));
const noop = () => {};
const styleTags = [];
let capturedEntry;

const PeakMonday = Date.parse('2026-11-09T02:00:00Z');
const OffPeakSaturday = Date.parse('2026-11-07T12:00:00Z');
let fixedNow = PeakMonday;

class FakeDate extends Date {
  constructor(...args) {
    super(...(args.length === 0 ? [fixedNow] : args));
  }
  static now() {
    return fixedNow;
  }
}

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Date: FakeDate,
  __ModuleLoader__: {
    load: (entry) => {
      capturedEntry = entry;
    }
  }
};
sandbox.window = {
  __DSH_BOOT__: { release: { version: '0.2.2-rc.1' } },
  setInterval: () => 1,
  clearInterval: noop,
  addEventListener: noop,
  removeEventListener: noop
};
sandbox.window.__ModuleLoader__ = sandbox.__ModuleLoader__;
sandbox.document = {
  hidden: false,
  querySelector: () => null,
  createElement: () => ({ dataset: {}, textContent: '' }),
  head: { appendChild: (tag) => styleTags.push(tag) },
  addEventListener: noop,
  removeEventListener: noop
};

vm.runInNewContext(fs.readFileSync(bundlePath, 'utf8'), sandbox, { filename: bundlePath });
assert.equal(capturedEntry.id, 'dsh-plugin-balance', 'bundle registers its package id');

const FakeReact = {
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, noop],
  useEffect: noop
};
const jsx = (type, props) => ({ type, props });
const jsxs = (type, props) => ({ type, props });
const Tooltip = (props) => ({ type: 'Tooltip', props });

const exported = capturedEntry.factory((request) => {
  if (request === 'react') return FakeReact;
  if (request === 'react/jsx-runtime') return { jsx, jsxs, Fragment: Symbol('Fragment') };
  if (request === '@deepseek-ai/dsh-client-ui-primitives') return { Tooltip };
  throw new Error(`unexpected require: ${request}`);
});

assert.deepEqual(Array.from(exported.inject), ['slots', 'locale', 'remote', 'remote.account']);
assert.equal(typeof exported.apply, 'function');
assert.equal(styleTags.length, 1, 'stylesheet injected once');

function createContext(balanceHandler) {
  const dictionaries = {};
  const registered = [];
  const ctx = {
    locale: {
      register: (ns, dicts) => {
        dictionaries[ns] = dicts;
        return noop;
      },
      bind: (ns) => (key) => dictionaries[ns].zh[key] ?? key,
      getSnapshot: () => ({ active: 'zh' })
    },
    remote: {
      account: {
        getBalance: async () => balanceHandler()
      }
    },
    effect: (callback) => {
      callback();
    },
    slots: {
      inject: (name, callback) => {
        callback();
      },
      register: (entry, component) => {
        registered.push({ entry, component });
        return noop;
      }
    }
  };
  return { ctx, registered };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const dict = {
  cost: '本对话',
  costTitle: '本对话消耗（估算）',
  inputMiss: '输入 · 缓存未命中',
  inputHit: '输入 · 缓存命中',
  output: '输出',
  total: '合计',
  balance: '余额',
  peakBadge: '峰',
  peakNote: '当前为高峰时段',
  offPeakNote: '当前为低谷时段',
  estimateNote: '按当前时段费率估算',
  pending: '等待用量数据',
  perMillion: 'M'
};
const t = (key) => dict[key];

function textOf(node) {
  if (node === null || node === void 0) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.props?.children);
}

const USAGE = {
  uncachedInputTokens: 1_000_000,
  outputTokens: 100_000,
  cacheReadTokens: 10_000_000,
  cacheWriteTokens: 0
};

async function render(options = {}) {
  const usage = 'usage' in options ? options.usage : USAGE;
  const balance = options.balance ?? { ok: true, value: { status: 'ready', value: [{ currency: 'CNY', balance: '12.34' }], bonusWallets: [] } };
  const { ctx, registered } = createContext(() => balance);
  exported.apply(ctx);
  assert.equal(registered.length, 1);
  const { entry, component } = registered[0];
  assert.equal(entry.name, 'conversation.composer.dock');
  assert.equal(entry.id, 'balance');
  assert.equal(entry.order, 2);
  const store = entry.inject().store;
  await flush();
  const tree = component({
    t,
    store,
    useProjection: (key) => (key === 'tokenUsage' ? usage : undefined)
  });
  const tooltip = tree.props.children;
  const pill = tooltip.props.children;
  return { tree, tooltip, pill, store };
}

// 1. Peak Monday: 2x rates, warm badge, balance suffix, full breakdown.
{
  fixedNow = PeakMonday;
  const { pill, tooltip } = await render();
  const text = textOf(pill);
  assert.match(text, /本对话 ¥3\.20/);
  assert.match(text, /峰/);
  assert.match(text, /余额 ¥12\.34/);
  assert.match(pill.props.className, /dshBalance_pillPeak/);
  const tip = textOf(tooltip.props.label);
  assert.match(tip, /输入 · 缓存未命中/);
  assert.match(tip, /¥3\.2000/);
  assert.match(tip, /高峰/);
}

// 2. Off-peak Saturday: half price, no badge.
{
  fixedNow = OffPeakSaturday;
  const { pill } = await render();
  const text = textOf(pill);
  assert.match(text, /本对话 ¥1\.60/);
  assert.doesNotMatch(text, /峰/);
  assert.doesNotMatch(pill.props.className, /dshBalance_pillPeak/);
}

// 3. Signed out: spend stays, balance suffix is omitted.
{
  fixedNow = PeakMonday;
  const { pill } = await render({ balance: { ok: true, value: null } });
  const text = textOf(pill);
  assert.match(text, /本对话 ¥3\.20/);
  assert.doesNotMatch(text, /余额/);
}

// 4. Usage projection not ready: a placeholder, not a fabricated zero.
{
  fixedNow = PeakMonday;
  const { pill, tooltip } = await render({ usage: undefined });
  assert.match(textOf(pill), /本对话 …/);
  assert.match(textOf(tooltip.props.label), /等待用量数据/);
}

// 5. Zero usage: ¥0.00.
{
  fixedNow = PeakMonday;
  const { pill } = await render({
    usage: { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
  });
  assert.match(textOf(pill), /本对话 ¥0\.00/);
}

console.log('dsh-plugin-balance: all checks passed');
