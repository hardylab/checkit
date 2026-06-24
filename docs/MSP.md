# Checkit MSP (Minimal Sellable Product)

> 修正版 MSP · 2026-06-24
> 三层架构:商业层 / 产品层 / 引擎层
> **核心原则:checkit / LintAny 本质是 CLI 工具,Web / Electron 都只是壳**
> **CLI 命令占位符:`<brand>` = 当前品牌名(LintAny)。文档内所有 CLI 命令用 `<brand>` 占位,落地时替换为实际命令名。**

---

## 0. 命名约定

| 旧词 | 标准词 | 备注 |
|---|---|---|
| 规则范式 / rule paradigm / rule group | **preset** | UI / API / 文件名统一 |
| 规则集 / rule set / rule bundle | **rule-set** | 仓库内置的官方集(只读) |
| 用户保存的 preset | **preset** | 用户可编辑,跨项目复用 |

数据文件分布:
- **per-project**:`.checkit/state.json` + `.checkit/presets/*.json`
- **global**:`~/.checkit/config.json`(全局偏好)+ `~/.checkit/presets/*.json`(跨项目 preset)

**不用** IndexedDB / localStorage 存核心状态(那是 web 的,desktop 只是壳)。

---

## 1. 商业层 (A) — 单位经济可算

### A1. Astro 营销官网
- 路径:独立 Astro 项目,SSG 静态托管
- 内容:Landing / Pricing / 产品使用手册 / FAQ / Changelog
- 流量入口:`hardylab/checkit` GitHub README + npm 上 `@checkit/cli` 描述指向
- **与 desktop 共仓,部署分离**:仓根 `/docs-site/` (Astro),与 `apps/desktop/` 并列
- 品牌名称: LintAny（Checkit 只是内部项目代号）
- 域名：LintAny.com
- Slogan: Lint Anything Against Best Practices.
- 产品哲学：lintany 总是会根据世界知识中的最佳实践为用户保驾护航 —— 用户从哪里来，要往哪里去，现实与理想之间的差距
- 能力边界：核心是发现问题而是修复问题 —— 当然也可以在一些简单场景提供修复功能，但复杂的问题应该由专业的工具承担，Lintany 做好执法者角色

### A2. Onboarding 5 步(从 landing 到 first value)
1. landing 看 30 秒 demo 视频 → 点 "Try it"
2. `pnpm add -D @<brand>/cli` 装包(已有)
3. `<brand> scan` 第一次扫描 → 看到 7 个 issue(已有)
4. `<brand> chat "我想加 TS strict"` 第一次对话 → 看到推荐 rules
5. `<brand> preset new my-preset --from-last-chat` 保存第一个 preset

**验收**:第 5 步耗时 < 3 分钟(从 npm install 到 preset 创建完成)

### A3. 定价(MSP 必须有)
- **Free**:本地 keyword agent + 官方 bundled rule-sets + 无限 preset 数量(本地)
- **Pro $9/月**:LLM agent adapter + preset 云同步(GitHub gist 自动同步)+ AI 修复优先级提升
- **Team $29/月/席**:共享 preset 库 + 审计日志 + SSO

(具体数字待 unit economics 算出来再定 — 这是占位)

### A4. Share / Export 飞轮(让用户把 preset 发出去)
- `<brand> preset export <name>` → 输出 `.json` 文件或 URL
- `<brand> preset import <url-or-file>` → 拉入 preset
- 营销官网 preset 库页面:GitHub gist 索引的公开 preset(无服务器成本)

---

## 2. 产品层 (B) — 用户能感知

### B1. Tabs 项目空间
- **位置**:顶部 Topbar 改为 Tabs(替代当前 banner)
- **功能**:多个 tab = 多个项目(`cwd` 不同)
- **新建 tab**:点 `+` → 弹窗:选目录 + 选 preset(default = bundled rule-sets)
- **Tab 内容**:项目名 / preset 名 / scan 状态(绿点/黄点/红点)

### B2. 规则市场 + "我的" + 对话 = 同一页 3 toggle
**不**是 3 个独立 tab。是 Rules 页内 3 个 view mode:
- "市场" — 所有 bundled rule-sets
- "我的" — 用户 saved preset
- "对话" — chat 界面 + 推荐规则

**用户旅程**:探索 → 固化 → 使用
```
[市场] → 选 rules → 看到 [保存为 preset] → 切到 [我的] 看到新 preset → 切到项目 tab 应用
                                                            ↑                                       ↓
                                                    (也可从对话生成) ←———————————— [对话] 推荐 rules
```

### B3. 界面语言 + 深浅色
- **全局偏好**,不绑项目 → 存 `~/.checkit/config.json`
- `<brand> config set locale zh-CN`
- `<brand> config set theme dark`
- Web UI 启动时读此文件,fallback 到系统偏好

### B4. preset 编辑器
- 可视化拖拽 rules(已有 rule-market drawer 雏形可复用)
- 字段:rule id / enabled / threshold / globs
- 元数据:name / description / version / source(manual/ai-generated/bundled)

---

## 3. 引擎层 (C) — CLI-first,技术债不积压

### C0. 设计原则
**所有功能必须在裸 CLI 下可调通。Web/Electron 只是 CLI 的图形壳。**

### C1. AI Adapter 接口
```ts
interface AiAdapter {
  id: string;                       // "local-keyword" | "openai" | "claude" | "ollama" | "opencode"
  chat(msg: string, ctx: ChatContext): Promise<{
    reply: string;
    suggestions: RuleSuggestion[];
    recommendedPresets: Preset[];
  }>;
}
```

实现列表:
- **LocalKeywordAdapter**(默认,无 API key 也能用)— 已有 `keyword → rules` 脚本
- **OpenAIAdapter** — gpt-4o-mini / gpt-4o
- **ClaudeAdapter** — claude-sonnet / claude-opus
- **OllamaAdapter** — 本地 llama3 / qwen2.5-coder
- **OpenCodeAdapter** — 已有,接入 `--ai-fix` 路径

**用户配置**:
- `<brand> config set ai.adapter openai`
- `<brand> config set ai.api_key sk-xxx`(或 env var `LINTANY_AI_KEY`)
- `<brand> config set ai.model gpt-4o-mini`

### C2. 密钥存储(三层 fallback)
1. **OS keyring**(优先):Windows Credential Manager / macOS Keychain / Linux Secret Service
   - 用 `keytar` 或 `node-keytar`
2. **env var**:`CHECKIT_<PROVIDER>_KEY`
3. **加密文件**:`~/.checkit/secrets.json`(用机器 ID 派生密钥,AES-GCM)

**不**写明文到 `config.json`(除了 keyring reference)

### C3. 离线契约
- `/api/scan` 不可达时(CLI 没装 / network down):
  - Dashboard 显示 banner:`⚠️ <brand> CLI 未检测到,功能受限`
  - "导入 JSON 报告" 按钮正常工作(浏览器/Electron 不需要 CLI)
  - "新建扫描" 按钮 disable + tooltip
- 规则市场 / preset 编辑 / 对话(本地 adapter)全部正常
- **绝不 crash**

### C4. 数据存储
- 项目级:`.checkit/state.json`(项目根,CWD 自动发现)+ `.checkit/presets/*.json`
- 全局:`~/.checkit/config.json`(偏好)+ `~/.checkit/presets/*.json`(跨项目 preset)
- 云同步 preset(Pro 特性):GitHub gist 后台同步,本地定期 pull/push

---

## 4. CLI 命令清单(裸 CLI 必须全跑通)

```bash
# 注:`<brand>` 是 CLI 命令名占位符(LintAny 落地时为 `lintany`)
#     内部子命令(scan / preset / chat / config / doctor)固定不变

# 扫描
<brand> scan [--cwd <dir>] [--fix] [--reporter json|table]
<brand> scan --upload <report.json>   # 接收外部报告

# preset 管理
<brand> preset list
<brand> preset new <name> [--from-last-chat] [--rules <ids>]
<brand> preset show <name>
<brand> preset apply <name> [--cwd <dir>]
<brand> preset export <name> [--output <file>] [--gist]
<brand> preset import <file-or-url>

# AI 对话
<brand> chat                           # REPL 模式(TTY)
<brand> chat --no-tui --json           # CI / 管道模式
<brand> chat "帮我做一个 TS strict preset"  # 单次
<brand> chat --apply <preset-name>     # 对话后保存为 preset

# 全局配置
<brand> config set <key> <value>       # ai.adapter / theme / locale / api_key
<brand> config get <key>
<brand> config list
<brand> config unset <key>

# Agent 检测
<brand> doctor                         # 检查 CLI / Node / agent / preset 可用性
```

---

## 5. 不在本 MSP 范围(明确排除)

- ❌ 30 rule 质量复审(单独工作流)
- ❌ 规则集 marketplace 的搜索/评分/评论(社交功能)
- ❌ IDE 插件(VS Code extension)
- ❌ CI/CD 集成(GitHub Action)— 后续
- ❌ 团队权限管理 / SSO(Team 计划才需要)
- ❌ 计费 / Stripe 集成(launch 后)

---

## 6. 验收标准(MSP 完成定义)

### 必须满足(否则不算 MSP):
1. ✅ `pnpm add -D @<brand>/cli` 装包可用(已有)
2. ✅ 5 步 onboarding < 3 分钟
3. ✅ 裸 CLI `<brand> scan / preset / chat / config` 全部跑通
4. ✅ Astro 营销站上线(Landing + Docs + FAQ)
5. ✅ Web / Electron 都能跑同一份代码(Electron 优先,Web fallback)
6. ✅ 至少 3 个 bundled rule-set + 1 个 demo preset
7. ✅ AI 对话支持本地 keyword + 至少 1 个云 provider(OpenAI 或 Claude)
8. ✅ 离线契约(`/api/scan` 不可达不 crash)
9. ✅ Tabs 项目空间(顶栏 tabs,新建项目弹窗)
10. ✅ preset 跨项目复用(global preset 库)

### Nice-to-have(有就更好):
- 1 个 Pro 特性(云同步 / LLM agent)
- 1 个 Share 飞轮示例(GitHub gist preset)
- GitHub Action `check-action`(不算 MSP 但能拉动流量)

---

## 7. 实施路径(建议 4 阶段,每阶段 1-2 周)

**Phase 1 — CLI-first 闭环(2 周)**
- 修 `--ai-fix` 退出码 bug(独立 bug)
- 加 `<brand> preset` 命令子集(`new` / `list` / `apply`)
- preset JSON schema 定型 + `.checkit/presets/` 目录约定
- LocalKeywordAdapter 抽到独立 module

**Phase 2 — AI Adapter 抽象(1 周)**
- `AiAdapter` interface 定型
- OpenAIAdapter + ClaudeAdapter 实现
- `<brand> config set ai.*` 命令
- OS keyring 集成(`keytar`)

**Phase 3 — UI 改造(2 周)**
- 顶栏 → Tabs(项目空间)
- Rules 页面 3 toggle(市场/我的/对话)
- 对话 → preset 保存按钮
- 界面语言 + 深浅色(读全局 config)

**Phase 4 — 营销站 + 验收(1 周)**
- Astro 项目落地(`/docs-site/`)
- Landing / Docs / FAQ 内容
- 5 步 onboarding 录制视频
- 全验收清单逐项过

---

## 8. 与现有进度对接

### 已完成(不需要重做):
- `@checkit/cli` 发包 + tarball 验证(commit `04d1aae`)
- 3 个 examples + KILLER-DEMO + README(commit `e06d4f8`)
- `apps/desktop` 桌面 app(Electron + Next.js,4 屏 / 86 E2E)
- `apps/desktop` 规则市场 VSCode 3-pane 布局
- `/api/scan` / `/api/rules` / `/api/chat` API routes
- LocalKeywordAdapter(无 LLM 关键词脚本)
- `--ai-fix` CLI hook + opencode adapter

### 待做(本 MSP 范围):
- ❌ preset 命令 + 数据 schema(Phase 1)
- ❌ AI adapter 抽象 + 多 provider(Phase 2)
- ❌ Tabs 顶栏改造(Phase 3)
- ❌ Astro 营销站(Phase 4)
- ❌ 5 步 onboarding 视频(Phase 4)

### 已知 bug(独立修,不在 MSP 阻塞):
- `--fix` 不改代码(独立 bug)
- exit code 错(独立 bug)
- bundle 9.8MB 偏大(独立)
- dts 没出(独立)

---

**最后一句话**:MSP 不是"功能 list",是**5 分钟内能让一个新用户走到 first value 的最小路径**。上面的所有功能都得问"如果去掉这个,first value 还走得通吗?" — 走得通就不在 MSP。
