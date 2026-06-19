# CheckIt 配置

> 类 ESLint 的渐进式配置:零配置可跑,需要时按需配置。

## 快速开始

在你的项目里:

```bash
# 1. 安装 CheckIt CLI
pnpm add -D @checkit/cli

# 2. 添加 scripts 到 package.json
{
  "scripts": {
    "review": "checkit",
    "review:fix": "checkit --fix"
  }
}

# 3. (可选)创建 checkit.config.json
{
  "extends": ["@checkit/preset-normal"],
  "rules": {
    "no-console-log": "warn"
  }
}

# 4. 跑
pnpm review
```

零配置时,CheckIt 会使用内置 default 配置(`target: "."`,忽略 `node_modules/dist/.git`)。

---

## 配置文件查找顺序

CheckIt 从 `cwd` 向上查找(直到 repo 边界 `.git` / `package.json`)。

**每一级目录内**,按以下顺序查找:

1. `<dir>/.checkit/checkit.config.{js,ts,json,yaml,yml}` ← 私有目录(最高优先)
2. `<dir>/.checkit/default.config.{js,ts,json,yaml,yml}`  ← 私有目录
3. `<dir>/checkit.config.{js,ts,json,yaml,yml}`          ← 项目根平铺
4. `<dir>/default.config.{js,ts,json,yaml,yml}`           ← 项目根平铺

第一个找到的胜出。

**推荐**:把 config 放进 `.checkit/` 私有目录,跟 `.claude/`、`.vscode/` 风格一致:

```
your-project/
└── .checkit/
    ├── default.config.json   ← CheckIt 优先发现这里
    └── rules/
        └── my-custom-rule.ts
```

**向后兼容**:项目根平铺的 `checkit.config.*` 仍然支持,适合简单项目。

**显式指定**(优先级最高):

```bash
checkit --config ./my-checkit.config.json
```

---

## 配置字段

### `extends`

继承其他 preset(类似 ESLint 的 `extends`),按顺序叠加,后者覆盖前者。

```jsonc
{
  "extends": [
    "@checkit/preset-normal",       // npm 包:从 node_modules/@checkit/preset-normal 加载
    "./.checkit/presets/team.yaml"  // 相对路径:本项目内 preset
  ]
}
```

#### Preset 来源

- **npm 包**:从 `node_modules/<pkg>` 加载,优先查找 `checkit.preset.{json,yaml,js,ts}`,兜底用 `default export`
- **相对路径**:从 `cwd` 解析,支持 `.json/.yaml/.yml/.js/.ts` 任意格式

### `rules`

规则配置。**简写**(字符串)和**详细写法**(对象)都支持。

#### 简写

```jsonc
{
  "rules": {
    "no-console-log": "warn",
    "no-any-rule": "error",
    "filename-naming-rule": "off"   // 关闭某条
  }
}
```

#### 详细写法

```jsonc
{
  "rules": {
    "no-console-log": {
      "level": "warn",
      "type": "structure",
      "options": { "exclude": ["**/scripts/**"] },
      "autofix": true
    }
  }
}
```

字段:
- `level`:`"off" | "warn" | "error"`
- `type`:`"structure" | "traceability" | "styling" | "state" | "documentation" | "architecture" | "type-safety" | "security"`
- `options`:规则特定选项
- `autofix`:是否自动修复(覆盖全局 `autofix`)

#### 自定义规则路径

支持 `.ts` / `.js` 文件路径:

```jsonc
{
  "rules": {
    "./.checkit/rules/my-team-rule.ts": "error"
  }
}
```

文件必须 `export default` 一个 `ReviewRule` 实例(或带 `default` / `RuleCtor` 字段)。

### `ignorePatterns`

项目级忽略(glob 模式,基于 minimatch)。

```jsonc
{
  "ignorePatterns": [
    "**/dist/**",
    "**/build/**",
    "**/*.test.ts"
  ]
}
```

**优先级**(后者胜出):
1. 内置默认:`node_modules/**`, `dist/**`, `.git/**`
2. `extends` 的 preset
3. 当前 config 的 `ignorePatterns`
4. CLI `--ignore <pattern>`

### `.checkitignore` 文件

类似 `.gitignore` / `.eslintignore`,在项目根放一个 `.checkitignore`:

```
# generated artifacts
dist/**
build/**

# tests
**/*.test.ts
**/__tests__/**

# deps
node_modules/**
```

**语法**:
- 空行 / `#` 开头 → 忽略
- 以 `/` 开头 → 相对 cwd
- 以 `/` 结尾 → 仅匹配目录
- 不以 `/` 开头/结尾 → minimatch glob(支持 `**` 通配)

### `target`

review 目标路径(相对 config 所在目录)。

```jsonc
{
  "target": "src/"  // 默认 "."
}
```

### `autofix`

全局自动修复开关。

```jsonc
{
  "autofix": false  // 默认 false
}
```

CLI `--fix` 可临时启用。

### `reporter`

报告器格式。

```jsonc
{
  "reporter": "stylish"  // 默认 stylish
  // 可选:"stylish" | "json" | "silent"
}
```

---

## CLI 用法

```bash
checkit                              # review 当前目录
checkit src/                         # review 指定路径
checkit --fix                        # 自动修复
checkit --recent 60                  # 只 review 最近 60 分钟改动的文件
checkit --rule "no-console-log=error" # 临时改某条规则的严重度
checkit --ignore "**/legacy/**"      # 临时加 ignore 模式
checkit --config ./custom.yaml       # 用指定配置文件
checkit --json                       # JSON 格式输出(用于 CI 集成)
```

可多次 `--rule` 和 `--ignore`:

```bash
checkit \
  --rule "no-console-log=error" \
  --rule "no-any-rule=off" \
  --ignore "**/test/**" \
  --ignore "**/fixtures/**"
```

---

## 配置合并规则

当 `extends` 链有多个 preset 时,按**顺序叠加**,后者覆盖前者:

```
preset-a (base) → preset-b → 你的 config
```

- `rules`:**浅合并**,key 相同则后者覆盖
- `ignorePatterns`:**数组拼接**
- `extends`:**数组拼接**(形成链)
- `target` / `autofix` / `reporter`:**后者覆盖**

---

## 实战示例

### 最小项目

```
my-app/
├── package.json
│   "scripts": { "review": "checkit" }
│   "devDependencies": { "@checkit/cli": "^1.0.0" }
└── src/
```

跑 `pnpm review` 即可(零配置,使用内置默认)。

### 中等项目(自定义规则)

```
my-app/
├── checkit.config.json
├── .checkitignore
├── package.json
└── src/
```

```jsonc
// checkit.config.json
{
  "extends": ["@checkit/preset-normal"],
  "rules": {
    "no-console-log": "warn",
    "use-spec-coding": "error",
    "no-any-rule": { "level": "warn", "type": "type-safety" },
    "./.checkit/rules/api-boundary.ts": "error"
  },
  "target": "src/"
}
```

### 大型项目(团队 preset)

```
my-app/
├── checkit.config.json    ← extends ["@my-company/checkit-preset"]
└── src/
```

```jsonc
// checkit.config.json
{
  "extends": ["@my-company/checkit-preset"],
  "rules": {
    "@my-company/checkit-preset/rules/legacy-fixer": "off"  // 关闭 preset 里某条
  }
}
```

---

## 与 ESLint 的对应关系

| ESLint | CheckIt |
|---|---|
| `.eslintrc.json` | `checkit.config.json` |
| `.eslintignore` | `.checkitignore` |
| `eslint-config-airbnb` | `@checkit/preset-normal` |
| `extends: ["airbnb"]` | `extends: ["@checkit/preset-normal"]` |
| `rules: { "no-console": "warn" }` | `rules: { "no-console-log": "warn" }` |
| `eslint --fix` | `checkit --fix` |
| `eslint --rule '{"no-console":"error"}' .` | `checkit --rule "no-console-log=error"` |
| `parserOptions.ecmaVersion` | (暂不支持,通过 `target.tsVersion` 扩展) |

---

## 进阶:自定义 preset 包

发布一个 `@my-company/checkit-preset`:

```
my-preset/
├── package.json
│   "name": "@my-company/checkit-preset"
│   "main": "./dist/index.js"
└── checkit.preset.json   ← CheckIt 优先找这个
```

```jsonc
// checkit.preset.json
{
  "extends": ["@checkit/preset-normal"],
  "rules": {
    "no-console-log": "error",
    "use-spec-coding": "error"
  }
}
```

或在 `index.js` 里 `export default`:

```js
// dist/index.js
export default {
  rules: {
    'no-console-log': 'error',
    'no-any-rule': 'error'
  }
};
```

项目安装后:

```bash
pnpm add -D @my-company/checkit-preset
```

```jsonc
// checkit.config.json
{
  "extends": ["@my-company/checkit-preset"]
}
```

---

## FAQ

**Q: 配置文件找不到怎么办?**
A: CheckIt 会回退到内置 default 配置(目标="."、内置 ignores、内置 normal paradigm)。会 warn 但不报错。

**Q: `extends` 循环了怎么办?**
A: CheckIt 检测到 `extends` 链有循环时抛错。

**Q: 规则 ID 拼错了怎么办?**
A: warn "Unknown rule: <id>",跳过该条规则。

**Q: 自定义规则文件不存在?**
A: warn "Custom rule file not found: <path>",跳过。

**Q: 可以禁用某条规则的 autofix 吗?**
A: 可以,设 `"autofix": false`:

```jsonc
{ "rules": { "no-console-log": { "level": "warn", "autofix": false } } }
```

---

**下一步**:阅读 [Rules Reference](rules-reference.md) 查看所有内置规则,或 [Authoring Rules](authoring-rules.md) 写自定义规则。
