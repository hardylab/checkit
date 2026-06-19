# CheckIt Tauri 桌面应用

**跨平台桌面应用** - 使用 Tauri 2.0 构建

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 19 + Ant Design 5 + Vite 6 |
| **后端** | Rust + Tauri 2.0 |
| **引擎** | CheckIt Rust 核心 |

---

## 功能特性

### 1. 仪表盘

- 规则总数统计
- 按类别分布
- 按严重级别分布
- 实时问题计数

### 2. 规则管理

- 查看所有规则
- 规则筛选和搜索
- 规则导入/导出
- 添加自定义规则

### 3. 代码检查

- 实时代码编辑
- 即时检查结果
- 问题详情展示
- 修复建议显示

---

## 快速开始

### 安装依赖

```bash
# 安装 Rust (如果未安装)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Node.js 18+

# 安装 Tauri CLI
cargo install tauri-cli

# 安装前端依赖
cd packages/rust/src-tauri/ui
pnpm install
```

### 开发模式

```bash
cd packages/rust
pnpm dev
```

### 构建应用

```bash
cd packages/rust
pnpm build
```

构建产物位置：
- Windows: `target/release/CheckIt.exe`
- macOS: `target/release/bundle/macos/CheckIt.app`
- Linux: `target/release/bundle/deb/checkit.deb`

---

## 项目结构

```
packages/rust/
├── src/                    # CheckIt Rust 核心库
│   ├── core/
│   ├── engine/
│   └── rules/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs         # Tauri 应用入口
│   │   └── commands.rs     # Tauri Commands
│   ├── ui/                 # 前端代码
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   └── package.json
│   ├── icons/              # 应用图标
│   ├── tauri.conf.json     # Tauri 配置
│   └── Cargo.toml
└── package.json
```

---

## Tauri Commands (Rust ↔ Frontend)

### `check_code`

检查代码内容

```typescript
const result = await invoke('check_code', {
  path: 'test.ts',
  content: 'function foo(x: any) {}',
});
```

### `load_rules`

从目录加载规则

```typescript
const count = await invoke('load_rules', {
  rulesPath: './rules',
});
```

### `get_rules`

获取所有规则

```typescript
const rules = await invoke('get_rules');
```

### `add_rule`

添加规则

```typescript
await invoke('add_rule', {
  rule: {
    id: 'custom/no-console',
    description: '禁止使用 console.log',
    category: 'BestPractice',
    severity: 'Warning',
    pattern: 'console\\.log',
    message: '不要使用 console.log',
  },
});
```

### `get_stats`

获取规则统计

```typescript
const stats = await invoke('get_stats');
```

### `generate_built_in_rules`

生成内置规则

```typescript
const rules = await invoke('generate_built_in_rules');
```

---

## 界面截图

### 仪表盘

```
┌─────────────────────────────────────────┐
│  CheckIt - 最佳实践数字化引擎            │
├──────────┬──────────────────────────────┤
│ 仪表盘   │  规则总数    发现问题  检查文件│
│ 规则管理 │    10          0         0   │
│ 代码检查 │                              │
└──────────┴──────────────────────────────┘
```

### 规则管理

```
┌─────────────────────────────────────────┐
│ 规则 ID  │ 描述    │ 类别 │ 级别       │
├─────────────────────────────────────────┤
│ ts/no-any│ 禁止 any │ Type │ Warning 🟡│
│ sec/eval │ 禁止 eval│ Sec  │ Error 🔴  │
└─────────────────────────────────────────┘
```

### 代码检查

```
┌──────────────┬───────────────────────────┐
│ 输入代码     │ 检查结果                  │
│ ┌──────────┐ │ ┌───────────────────────┐ │
│ │function  │ │ │文件│行号│问题│级别│   │ │
│ │foo(x:any)│ │ │────┼────┼────┼──────│ │
│ │{}        │ │ │test│ 1  │no  │⚠️    │ │
│ └──────────┘ │ │    │    │any │      │ │
│ [检查代码]   │ └───────────────────────┘ │
└──────────────┴───────────────────────────┘
```

---

## 性能对比

| 操作 | CLI | Tauri | 说明 |
|------|-----|-------|------|
| 启动时间 | 10ms | 500ms | Tauri 需要加载 UI |
| 检查速度 | 3ms | 10ms | IPC 通信开销 |
| 内存占用 | 20MB | 100MB | UI 框架开销 |
| 用户体验 | CLI | GUI | 更友好 |

---

## 打包发布

### Windows

```bash
cargo tauri build
# 输出：target/release/bundle/msi/CheckIt_0.1.0_x64_en-US.msi
```

### macOS

```bash
cargo tauri build
# 输出：target/release/bundle/macos/CheckIt.app
```

### Linux

```bash
cargo tauri build
# 输出：target/release/bundle/deb/checkit_0.1.0_amd64.deb
```

---

## 开发技巧

### 调试前端

```bash
# 在浏览器中打开开发者工具
# Tauri 应用支持 Chrome DevTools
```

### 调试后端

```bash
# 启用日志
RUST_LOG=debug cargo tauri dev
```

### 热重载

- 前端代码修改自动重载
- Rust 代码修改自动重新编译

---

## 依赖说明

### Rust 依赖

| 依赖 | 用途 |
|------|------|
| `tauri` | 桌面应用框架 |
| `tauri-plugin-shell` | Shell API |
| `checkit` | 核心引擎 |
| `tokio` | 异步运行时 |
| `serde` | 序列化 |

### 前端依赖

| 依赖 | 用途 |
|------|------|
| `react` | UI 框架 |
| `antd` | UI 组件库 |
| `@tauri-apps/api` | Tauri API |
| `monaco-editor` | 代码编辑器 |

---

## 下一步

### 短期

1. **代码编辑器** - 集成 Monaco Editor
2. **文件树** - 显示项目文件结构
3. **批量检查** - 检查整个项目
4. **结果导出** - 导出检查报告

### 中期

1. **规则编辑器** - GUI 编辑规则
2. **规则市场** - 下载社区规则
3. **自动修复** - 一键修复问题
4. **配置管理** - GUI 编辑配置

### 长期

1. **插件系统** - 第三方插件
2. **云同步** - 规则云同步
3. **团队协作** - 共享规则配置
4. **AI 辅助** - AI 生成修复建议

---

## 许可证

MIT
