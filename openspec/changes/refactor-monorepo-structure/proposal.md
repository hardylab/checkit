## 为什么

当前项目采用单体结构，随着 `shared`, `web`, `backend` 等不同职责模块的引入，需要重构为 pnpm Monorepo 结构以更好地管理依赖和代码边界，支持模块化开发。

## 变更内容

- **BREAKING**: 将根目录代码移动到 `packages/web`。
- 创建 `packages/shared` 用于存放共享代码（如类型定义）。
- 创建 `packages/backend` 用于后端代码（暂时初始化）。
- 配置 `pnpm-workspace.yaml` 管理工作区。
- 配置 TypeScript Project References 和 Vite 别名以支持源码级跨包调用。

## 功能 (Capabilities)

### 新增功能

- `monorepo-structure`: 定义 Monorepo 的目录结构、包职责和构建/开发工作流规范。

### 修改功能

<!-- 无 -->

## 影响

- 根目录 `package.json` 将不再直接包含应用依赖。
- 现有的 `src/` 代码将移动到 `packages/web/src/`。
- `src/types/review-rules.ts` 将移动到 `packages/shared/src/`。
- 开发命令将发生变化（需使用 `-F <package>` 或在对应目录下运行）。
