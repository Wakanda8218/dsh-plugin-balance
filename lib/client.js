/**
 * Browser half of `dsh-plugin-balance`.
 *
 * The Host's client module system serves this file as the package's `./client`
 * export and executes it as a lazy-CJS factory. It registers one entry in the
 * Chat composer's statistics dock (`conversation.composer.dock`) that shows the
 * current conversation's estimated spend, a peak-hour marker, and the signed-in
 * account's wallet balance.
 *
 * Pricing follows DeepSeek's published `deepseek-flash` CNY table: cache-hit
 * input ¥0.02/M, cache-miss input ¥1.00/M, output ¥4.00/M off-peak, doubled
 * during peak windows (Monday–Friday 01:00–04:00 and 06:00–10:00 UTC). The
 * estimate applies the current period's rates to the whole session; a session
 * that spans both periods can differ slightly from the invoice.
 *
 * The bundle only requires static platform modules, so it needs no
 * `dsh.client.external` declarations.
 */
window.__ModuleLoader__.load({
	id: "dsh-plugin-balance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const jsxRuntime = require("react/jsx-runtime");
		const jsx = jsxRuntime.jsx;
		const jsxs = jsxRuntime.jsxs;
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const Tooltip = primitives.Tooltip;

		//#region dictionaries
		/** Locale namespace owned by this plugin. */
		const NS = "plugin.balance";

		/** English dictionary (key-set source of truth). */
		const en = {
			cost: "Chat",
			costTitle: "Conversation spend (estimate)",
			inputMiss: "Input · cache miss",
			inputHit: "Input · cache hit",
			output: "Output",
			total: "Total",
			balance: "Balance",
			bonus: "Bonus",
			peakBadge: "Peak",
			peakNote: "Peak hours now (Mon–Fri, 09:00–12:00 and 14:00–18:00 Beijing). Rates are 2× off-peak.",
			offPeakNote: "Off-peak now; estimated at off-peak rates.",
			estimateNote: "Estimated at the current period's rates; usage spanning both periods can differ from the invoice.",
			pending: "Waiting for usage",
			perMillion: "M"
		};

		/** Simplified Chinese dictionary, complete against the English keys. */
		const zh = {
			cost: "本对话",
			costTitle: "本对话消耗（估算）",
			inputMiss: "输入 · 缓存未命中",
			inputHit: "输入 · 缓存命中",
			output: "输出",
			total: "合计",
			balance: "余额",
			bonus: "赠金",
			peakBadge: "峰",
			peakNote: "当前为高峰时段（周一至周五 09:00–12:00、14:00–18:00），费率为低谷的 2 倍。",
			offPeakNote: "当前为低谷时段，按低谷费率估算。",
			estimateNote: "按当前时段费率估算，跨时段的历史用量可能与账单略有偏差。",
			pending: "等待用量数据",
			perMillion: "M"
		};
		//#endregion

		//#region styles
		const css = ".dshBalance_anchor{min-width:0;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));display:inline-flex}.dshBalance_pill{box-sizing:border-box;border-radius:var(--dsw-radius-sm);max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}.dshBalance_pill svg{flex:none;width:14px;height:14px}@media (hover:hover){.dshBalance_pill:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}}.dshBalance_label{text-overflow:ellipsis;min-width:0;overflow:hidden;display:inline-flex;align-items:center;gap:4px}.dshBalance_cost{color:var(--dsw-alias-label-secondary)}.dshBalance_pillPeak .dshBalance_cost{color:var(--dsw-alias-state-warn-primary)}.dshBalance_badge{border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 14%,transparent);color:var(--dsw-alias-state-warn-primary);flex:none;padding:0 4px;font-size:10px;font-weight:500;line-height:14px}.dshBalance_sep{color:var(--dsw-alias-separator-primary);margin:0 2px}.dshBalance_balance{color:var(--dsw-alias-label-tertiary)}.dshBalance_tip{display:flex;flex-direction:column;gap:6px;min-width:250px;font-size:12px;line-height:18px}.dshBalance_tipTitle{color:var(--dsw-alias-label-primary);font-weight:500}.dshBalance_tipRow{justify-content:space-between;align-items:baseline;gap:18px;display:flex}.dshBalance_tipRow span:last-child{font-variant-numeric:tabular-nums;flex:none}.dshBalance_tipRow span:first-child{color:var(--dsw-alias-label-secondary)}.dshBalance_tipRow .dshBalance_tipRate{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-left:auto;margin-right:10px}.dshBalance_tipRule{height:1px;background:var(--dsw-alias-border-l2);margin:2px 0}.dshBalance_tipNote{color:var(--dsw-alias-label-tertiary)}.dshBalance_tipMuted{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px}";
		const tagId = "dsh-plugin-balance/CostPill.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-balance";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		const cls = {
			anchor: "dshBalance_anchor",
			pill: "dshBalance_pill",
			pillPeak: "dshBalance_pillPeak",
			label: "dshBalance_label",
			cost: "dshBalance_cost",
			badge: "dshBalance_badge",
			sep: "dshBalance_sep",
			balance: "dshBalance_balance",
			tip: "dshBalance_tip",
			tipTitle: "dshBalance_tipTitle",
			tipRow: "dshBalance_tipRow",
			tipRate: "dshBalance_tipRate",
			tipRule: "dshBalance_tipRule",
			tipNote: "dshBalance_tipNote",
			tipMuted: "dshBalance_tipMuted"
		};
		//#endregion

		//#region formatting
		/** Currency symbols for the wallets the Platform returns. */
		const CURRENCY_SYMBOLS = { CNY: "¥", USD: "$" };

		/**
		 * @param currency - ISO currency code of one wallet.
		 * @returns its display symbol, or the code plus a space for unknown currencies.
		 */
		function currencySymbol(currency) {
			return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
		}

		/**
		 * Format one decimal balance the way the account settings page does:
		 * grouped digits and two decimals, positives truncated to cents, positive
		 * sub-cent amounts as `<0.01`, and negative amounts rounded with a minimum
		 * displayed magnitude of 0.01.
		 * @param raw - validated decimal balance string.
		 * @param currency - wallet currency.
		 * @returns display text, or null when the amount is not a finite number.
		 */
		function formatMoney(raw, currency) {
			const value = Number(raw);
			const symbol = currencySymbol(currency);
			if (!Number.isFinite(value)) return null;
			const negative = value < 0;
			const absolute = Math.abs(value);
			if (absolute === 0) return `${symbol}0.00`;
			if (absolute < 0.01) return negative ? `-${symbol}0.01` : `<${symbol}0.01`;
			const [integer, fraction] = (Math.floor(absolute * 100) / 100).toFixed(2).split(".");
			return `${negative ? "-" : ""}${symbol}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
		}

		/**
		 * Join the amounts of all wallets of one kind, keeping each currency distinct.
		 * @param wallets - wallet records with `balance` and `currency`.
		 * @returns joined display text, or null when there is nothing to show.
		 */
		function formatWallets(wallets) {
			if (!Array.isArray(wallets)) return null;
			const parts = [];
			const seen = new Set();
			for (const wallet of wallets) {
				if (wallet === null || typeof wallet !== "object") continue;
				const text = formatMoney(wallet.balance, wallet.currency);
				if (text === null) continue;
				const key = `${wallet.currency}:${text}`;
				if (seen.has(key)) continue;
				seen.add(key);
				parts.push(text);
			}
			return parts.length === 0 ? null : parts.join(" / ");
		}

		/**
		 * Format an estimated spend as a CNY amount with two decimals.
		 * @param value - amount in yuan.
		 * @returns display text; sub-cent positive amounts read `<¥0.01`.
		 */
		function formatCost(value) {
			if (!Number.isFinite(value)) return "—";
			if (value <= 0) return "¥0.00";
			if (value < 0.01) return "<¥0.01";
			return `¥${value.toFixed(2)}`;
		}

		/**
		 * @param value - amount in yuan.
		 * @returns four-decimal text for one tooltip line.
		 */
		function preciseCost(value) {
			if (!Number.isFinite(value)) return "—";
			return `¥${value.toFixed(4)}`;
		}

		/**
		 * @param value - token count.
		 * @returns grouped exact count.
		 */
		function formatTokens(value) {
			return Math.max(0, Math.round(value)).toLocaleString("en-US");
		}
		//#endregion

		//#region pricing
		/**
		 * `deepseek-flash` CNY prices per 1M tokens, effective 2026-09-10.
		 * `deepseek-v4-pro` traffic has been rerouted to Flash at these rates, so
		 * one table covers both current model names.
		 */
		const PRICES = {
			offPeak: { hit: 0.02, miss: 1, output: 4 },
			peak: { hit: 0.04, miss: 2, output: 8 }
		};

		/**
		 * Whether one instant falls in a DeepSeek peak window: Monday–Friday,
		 * 01:00–04:00 or 06:00–10:00 UTC. Weekends are entirely off-peak.
		 * @param date - instant to classify.
		 * @returns true during a peak window.
		 */
		function isPeak(date) {
			const day = date.getUTCDay();
			if (day === 0 || day === 6) return false;
			const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
			return minutes >= 60 && minutes < 240 || minutes >= 360 && minutes < 600;
		}

		/**
		 * Price one token-usage projection at the period in effect now.
		 * @param usage - `tokenUsage` projection totals.
		 * @param peak - whether peak rates apply.
		 * @returns per-bucket amounts, the total, and the rates used.
		 */
		function priceUsage(usage, peak) {
			const rates = peak ? PRICES.peak : PRICES.offPeak;
			const hit = Math.max(0, usage.cacheReadTokens ?? 0);
			const miss = Math.max(0, usage.uncachedInputTokens ?? 0) + Math.max(0, usage.cacheWriteTokens ?? 0);
			const output = Math.max(0, usage.outputTokens ?? 0);
			const hitCost = hit * rates.hit / 1e6;
			const missCost = miss * rates.miss / 1e6;
			const outputCost = output * rates.output / 1e6;
			return {
				hit,
				miss,
				output,
				hitCost,
				missCost,
				outputCost,
				total: hitCost + missCost + outputCost,
				rates
			};
		}
		//#endregion

		//#region account reads
		/**
		 * Build version captured when the bundle materializes, while the boot graph
		 * the Host injected is still on the page.
		 */
		const CLIENT_VERSION = readClientVersion();

		/**
		 * Build the request identity one account call carries: the page's build
		 * version, the active UI language, and the current UTC offset in seconds.
		 * @returns metadata accepted by `account.getBalance`.
		 */
		function clientMetadata(ctx) {
			return {
				version: CLIENT_VERSION,
				locale: ctx.locale.getSnapshot().active,
				timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60
			};
		}

		/**
		 * Read the build version from the boot graph the Host injected, falling back
		 * to a neutral value when the page no longer carries it.
		 * @returns a non-empty version string.
		 */
		function readClientVersion() {
			try {
				const release = window.__DSH_BOOT__?.release;
				if (typeof release?.version === "string" && release.version.length > 0) return release.version;
			} catch {}
			return "0.0.0";
		}

		/**
		 * Own the balance snapshot the dock entry reads.
		 *
		 * A read is deduplicated while in flight. A failure keeps the last shown
		 * amounts and marks the balance stale instead of inventing a zero balance,
		 * and a `null` outcome (no stored account grant) hides it.
		 * @param ctx - browser context with `remote.account` and `locale`.
		 * @returns snapshot, subscription, refresh, and disposal.
		 */
		function createBalanceStore(ctx) {
			let snapshot = { phase: "loading", wallets: [], bonusWallets: [], updatedAt: 0, refreshing: false };
			const listeners = new Set();
			let inflight;
			let disposed = false;

			const publish = (next) => {
				if (disposed) return;
				snapshot = next;
				for (const listener of listeners) listener();
			};

			const read = async () => {
				let outcome;
				try {
					outcome = await ctx.remote.account.getBalance(clientMetadata(ctx));
				} catch {
					if (!disposed) publish({ ...snapshot, phase: "error", refreshing: false });
					return;
				}
				if (disposed) return;
				if (!outcome.ok) {
					publish({ ...snapshot, phase: "error", refreshing: false });
					return;
				}
				const value = outcome.value;
				if (value === null || value === void 0) {
					publish({ phase: "signed-out", wallets: [], bonusWallets: [], updatedAt: 0, refreshing: false });
					return;
				}
				if (value.status !== "ready") {
					publish({ ...snapshot, phase: "error", refreshing: false });
					return;
				}
				publish({
					phase: "ready",
					wallets: Array.isArray(value.value) ? value.value : [],
					bonusWallets: Array.isArray(value.bonusWallets) ? value.bonusWallets : [],
					updatedAt: Date.now(),
					refreshing: false
				});
			};

			const refresh = () => {
				if (disposed) return Promise.resolve();
				if (inflight !== void 0) return inflight;
				publish({ ...snapshot, refreshing: true });
				inflight = read().finally(() => {
					inflight = void 0;
				});
				return inflight;
			};

			return {
				getSnapshot: () => snapshot,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				refresh,
				dispose: () => {
					disposed = true;
					listeners.clear();
				}
			};
		}
		//#endregion

		//#region component
		/** A 14px wallet glyph matching the dock's statistic icons. */
		const WALLET_ICON = jsxs("svg", {
			viewBox: "0 0 16 16",
			width: 14,
			height: 14,
			fill: "none",
			stroke: "currentColor",
			strokeWidth: 1.3,
			"aria-hidden": true,
			children: [jsx("rect", { x: 2, y: 3.5, width: 12, height: 9, rx: 2 }), jsx("path", { d: "M2 6.5h12" }), jsx("circle", { cx: 11, cy: 9.5, r: 0.9, fill: "currentColor", stroke: "none" })]
		}, void 0);

		/**
		 * Render one tooltip row.
		 * @param label - bucket name.
		 * @param tokens - bucket size.
		 * @param rate - price per 1M tokens in yuan.
		 * @param cost - bucket cost in yuan.
		 * @returns the row node.
		 */
		function tipRow(t, label, tokens, rate, cost) {
			return jsxs("span", {
				className: cls.tipRow,
				children: [
					jsx("span", { children: label }),
					jsx("span", { className: cls.tipRate, children: `${formatTokens(tokens)} × ¥${rate.toFixed(2)}/${t("perMillion")}` }),
					jsx("span", { children: preciseCost(cost) })
				]
			});
		}

		/**
		 * Render the composer's spend, peak marker, and account balance.
		 *
		 * Spend is priced from the session's whole-log `tokenUsage` projection at
		 * the rates of the period in effect now. The peak badge and warm amount are
		 * the prominent marker; the tooltip breaks the estimate down by bucket and
		 * shows the balance.
		 * @param props - injected balance store plus the session hooks and `t` seat.
		 * @returns the dock entry.
		 */
		function CostPill(props) {
			const { t, store, useProjection } = props;
			const usage = useProjection("tokenUsage");
			const balance = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
			const [now, setNow] = React.useState(() => Date.now());
			React.useEffect(() => {
				const timer = window.setInterval(() => setNow(Date.now()), 30_000);
				return () => {
					window.clearInterval(timer);
				};
			}, []);

			const peak = isPeak(new Date(now));
			const priced = usage === void 0 ? null : priceUsage(usage, peak);
			const costText = priced === null ? "…" : formatCost(priced.total);
			const wallets = balance.phase === "ready" ? formatWallets(balance.wallets) : balance.phase === "loading" ? "…" : null;
			const bonus = balance.phase === "ready" ? formatWallets((balance.bonusWallets ?? []).filter((wallet) => Number(wallet.balance) > 0)) : null;

			const tipChildren = [jsx("span", { className: cls.tipTitle, children: t("costTitle") }, void 0)];
			if (priced === null) {
				tipChildren.push(jsx("span", { className: cls.tipNote, children: t("pending") }, void 0));
			} else {
				tipChildren.push(tipRow(t, t("inputMiss"), priced.miss, priced.rates.miss, priced.missCost));
				tipChildren.push(tipRow(t, t("inputHit"), priced.hit, priced.rates.hit, priced.hitCost));
				tipChildren.push(tipRow(t, t("output"), priced.output, priced.rates.output, priced.outputCost));
				tipChildren.push(jsx("span", { className: cls.tipRule }, void 0));
				tipChildren.push(jsxs("span", {
					className: cls.tipRow,
					children: [jsx("span", { children: t("total") }), jsx("span", { children: preciseCost(priced.total) }, void 0)]
				}, void 0));
			}
			tipChildren.push(jsx("span", { className: cls.tipRule }, void 0));
			tipChildren.push(jsx("span", { className: cls.tipNote, children: peak ? t("peakNote") : t("offPeakNote") }, void 0));
			if (wallets !== null) tipChildren.push(jsx("span", { className: cls.tipNote, children: `${t("balance")}: ${wallets}` }, void 0));
			if (bonus !== null) tipChildren.push(jsx("span", { className: cls.tipNote, children: `${t("bonus")}: ${bonus}` }, void 0));
			tipChildren.push(jsx("span", { className: cls.tipMuted, children: t("estimateNote") }, void 0));
			const tooltip = jsxs("span", { className: cls.tip, children: tipChildren }, void 0);

			const label = jsxs("span", {
				className: cls.label,
				children: [
					jsx("span", { className: cls.cost, children: `${t("cost")} ${costText}` }, void 0),
					peak ? jsx("span", { className: cls.badge, children: t("peakBadge") }, void 0) : null,
					wallets === null ? null : jsxs(jsxRuntime.Fragment, {
						children: [jsx("span", { className: cls.sep, "aria-hidden": true, children: "·" }, void 0), jsx("span", { className: cls.balance, children: `${t("balance")} ${wallets}` }, void 0)]
					}, void 0)
				]
			}, void 0);

			const reading = `${t("cost")} ${costText}${peak ? ` ${t("peakBadge")}` : ""}${wallets === null ? "" : ` · ${t("balance")} ${wallets}`}`;
			return jsx("span", {
				className: cls.anchor,
				"data-composer-stat": "balance",
				children: jsx(Tooltip, {
					label: tooltip,
					side: "top",
					portal: true,
					delayMs: 200,
					children: jsx("span", {
						className: `${cls.pill}${peak ? ` ${cls.pillPeak}` : ""}`,
						"aria-label": reading,
						children: [WALLET_ICON, label]
					}, void 0)
				}, void 0)
			}, void 0);
		}
		//#endregion

		//#region plugin
		/** Services this browser plugin needs before it activates. */
		const inject = ["slots", "locale", "remote", "remote.account"];

		/**
		 * Register the composer dock entry and its balance refresh loop.
		 * @param ctx - browser context with slot, locale, and account Remote services.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { en, zh }), "balance: dictionaries");

			const store = createBalanceStore(ctx);
			ctx.effect(() => {
				const refreshWhenVisible = () => {
					if (!document.hidden) store.refresh();
				};
				const timer = window.setInterval(refreshWhenVisible, 60_000);
				document.addEventListener("visibilitychange", refreshWhenVisible);
				window.addEventListener("focus", refreshWhenVisible);
				store.refresh();
				return () => {
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", refreshWhenVisible);
					window.removeEventListener("focus", refreshWhenVisible);
					store.dispose();
				};
			}, "balance: refresh loop");

			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "balance",
				order: 2,
				locale: NS,
				inject: () => ({ store })
			}, CostPill));
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
