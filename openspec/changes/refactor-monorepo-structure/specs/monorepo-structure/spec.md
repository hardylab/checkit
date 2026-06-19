## 新增需求

### 需求:Monorepo 目录结构

系统必须采用 pnpm workspace 管理的 Monorepo 结构，并包含以下核心目录：

- `packages/shared`: 存放公共代码、类型定义和工具函数。
- `packages/web`: 存放前端应用代码（原根目录代码）。
- `packages/backend`: 存放后端服务代码。

#### 场景:验证目录结构

- **当** 检查项目根目录时
- **那么** 应当存在 `pnpm-workspace.yaml` 文件和 `packages` 目录，且 `packages` 下包含 `shared`, `web`, `backend`

### 需求:跨包源码引用

在开发环境中，模块间的引用必须直接指向 TypeScript 源码文件，而不是构建后的产物（dist）。

- `packages/web` 引用 `packages/shared` 时，必须解析到 `packages/shared/src/index.ts`（或相应源文件）。

#### 场景:Web 包引用 Shared 包

- **当** 在 `packages/web` 中导入 `@checkit/shared`
- **那么** 导入应当成功，且 IDE 跳转到 `packages/shared/src` 下的源码文件

### 需求:Shared 包职责

`packages/shared` 必须包含项目中通用的类型定义和逻辑。

- 原 `src/types/review-rules.ts` 必须迁移至 `packages/shared/src/types/review-rules.ts`。

#### 场景:引用 ReviewIssue 类型

- **当** 在 `packages/web` 或 `packages/backend` 中使用 `ReviewIssue` 类型
- **那么** 应当从 `@checkit/shared` 导入
