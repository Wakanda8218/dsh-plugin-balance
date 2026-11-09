# dsh-plugin-balance

在 DeepSeek Harness 输入框下方的**统计条**（`1 轮 143 步 · 176 tok/s · 20.5M tok · 缓存命中 99%` 那一行）里显示：

- **本对话消耗金额**（按 token 用量估算）
- **高峰时段显著标识**：金额变暖色并带「峰」徽标
- **账户余额**：作为次要后缀显示

```
1 轮 143 步 · 176 tok/s · 20.5M tok · 缓存命中 99% · 本对话 ¥3.20 峰 · 余额 ¥12.34 · 25%
```

## 功能

- **本对话消耗**：读取会话的 `tokenUsage` 投影（整段日志的累计用量，翻页/压缩不影响），按输入未命中、输入缓存命中、输出三类 token 计价。
- **高峰标识**：当前时间落在 DeepSeek 高峰窗口时，金额变为警告色并在其后显示「峰」徽标；悬停可看到高峰时段的说明。
- **账户余额**：沿用原有 `account.getBalance` 查询，每 60 秒、窗口聚焦、页面恢复可见时刷新；未登录时只显示消耗，不显示余额。
- **实时更新**：每轮回复落盘后 token 用量投影变化，金额随之更新；高峰/低谷判断每 30 秒重新计算一次。
- **悬停明细**：显示三类 token 的数量 × 费率、各项金额、合计、当前时段费率说明、现金余额、赠金（如有），以及估算口径提示。
- **中英双语**、明暗主题自动适配。

## 费用口径

采用 DeepSeek 官方 `deepseek-flash` 人民币价（2026-09-10 生效），单位为 **元 / 百万 token**：

| 项目 | 低谷 | 高峰（×2） |
| --- | ---: | ---: |
| 输入 · 缓存命中 | ¥0.02 | ¥0.04 |
| 输入 · 缓存未命中 | ¥1.00 | ¥2.00 |
| 输出 | ¥4.00 | ¥8.00 |

- **高峰窗口**：周一至周五 UTC 01:00–04:00、06:00–10:00，即北京时间 **09:00–12:00、14:00–18:00**；周末全为低谷。
- `deepseek-v4-pro` 自 2026-09-14 起已路由到 V4.1-Flash 并按 Flash 价格计费，因此两种模型共用一张价表。
- 金额是**估算**：按「当前时段」的费率乘整段对话的 token 总量。跨高峰/低谷的历史对话可能与实际账单略有差异；账单以平台为准。
- 页面显示为人民币；美元价见 [DeepSeek 定价页](https://api-docs.deepseek.com/quick_start/pricing)。

## 安装

### 从 GitHub 安装

```bash
dsh plugin --profile desktop add git+https://github.com/Wakanda8218/dsh-plugin-balance.git
```

需要固定版本时，在 URL 后追加提交或标签：

```bash
dsh plugin --profile desktop add git+https://github.com/Wakanda8218/dsh-plugin-balance.git#v0.1.0
```

也可以在 **Plugins** 页的安装入口粘贴同一个 git 地址。

### 手动安装

```bash
git clone https://github.com/Wakanda8218/dsh-plugin-balance.git
```

然后让 `plugin_manager` 的 `install_bundle` 指向本地目录：

```text
link:<克隆目录的绝对路径>
```

安装后**刷新页面**即可看到；若仍不出现，重启一次 DeepSeek Harness（部分构建只在启动时重新组合 profile）。

卸载：在 Plugins 页移除 `dsh-plugin-balance`，或 `plugin_manager` 的 `remove_bundle`。

## 实现方式

这是一个「bundle + browser-only client」二合一的包。DSH 的插件安装入口只接受声明了 `dsh.bundle` 的包，因此：

| 文件 | 作用 |
| --- | --- |
| `package.json` | `dsh.bundle.patch` 让包可被 Plugins 页安装；`dsh.client` 声明 `platform: "web"` 并让 Host 把 `./client` 作为浏览器 bundle 提供 |
| `cordis.patch.yml` | bundle 层：插入自己的 Loader 条目 `ui-balance` |
| `lib/index.js` | Host 侧空插件（浏览器插件也需要一个 Loader 入口） |
| `lib/client.js` | 浏览器 bundle：向 `conversation.composer.dock` 列表插槽注册统计条里的费用条目 |
| `icon.svg` | Plugins 页图标 |

关键点：

1. **加载协议**：浏览器 bundle 通过 `window.__ModuleLoader__.load({ id, factory })` 注册，`factory(require)` 内只依赖平台静态模块 `react`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-ui-primitives`，不需要 `dsh.client.external`。
2. **插槽**：`conversation.composer.dock` 是 ui-chat 声明的会话级统计条列表插槽，内置条目为 `activity`（order 0）和 `usage`（order 1）；本插件注册 `balance`（order 2），因此排在它们之后、上下文占用指示之前。
3. **消耗数据**：组件从会话作用域拿到 `useProjection`，读取 `tokenUsage` 投影的 `uncachedInputTokens`、`cacheReadTokens`、`cacheWriteTokens`、`outputTokens`。这些是整个会话的累计值，不是当前屏幕上的片段。
4. **余额数据**：通过 `ctx.remote.account.getBalance({ version, locale, timezoneOffsetSeconds })` 读取 Host 已缓存的账户钱包，**不接触 token**；`version` 取自页面注入的 `window.__DSH_BOOT__.release.version`。
5. **样式**：工厂执行时注入一段带 `data-plugin-css` 去重标记的 `<style>`，类名统一 `dshBalance_*` 前缀；金额、徽标、提示行分别复用 DSH 的语义色变量。

## 开发

- 直接编辑 `lib/client.js`，无需构建；`link:` 安装指向本目录，保存后**刷新页面**即可生效。
- 费率、高峰窗口集中在 `lib/client.js` 的 `PRICES` 与 `isPeak()`；平台调整价格后改这两处即可。
- 离线自检：`node scripts/verify.mjs`。它在 vm 沙箱中执行 bundle，用桩 `React`/`Tooltip` 渲染高峰与低谷两种场景，断言金额、徽标、明细、余额后缀、未登录隐藏与零用量。
- 修改 `package.json` 或 `cordis.patch.yml` 后，需要在 Plugins 页禁用再启用（或重启应用），Host 才会重新读取 manifest。

## 已知限制

- 金额按当前时段费率估算，跨时段的历史用量不会逐条按当时费率重算。
- 只统计当前会话的 token；子代理会话是否计入取决于其用量是否写入父会话日志。
- 余额来自 Host 的账户查询，最多滞后 60 秒；充值后可等待自动刷新或重开页面。
- 只显示 DeepSeek 账户钱包，不覆盖 API Key 的配额/限额信息。
