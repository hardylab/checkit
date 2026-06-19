## 上下文

项目需要从单体结构迁移到 Monorepo，以支持前后端分离和代码共享。当前代码都在根目录 `src` 下。

## 目标 / 非目标

**目标：**

- 建立标准的 pnpm Monorepo 结构。
- 拆分 `web`, `backend`, `shared` 包。
- 确保开发体验（DX）流畅，特别是跨包引用时的源码跳转。

**非目标：**

- 此时不涉及具体的后端业务逻辑实现。
- 不引入新的构建工具（继续使用 Vite）。

## 决策

1. **包管理**: 使用 `pnpm workspace`。
   - **理由**: 高效的依赖管理，原生支持 Monorepo。

2. **跨包引用**: 使用 TypeScript Project References + Vite Alias。
   - **理由**: 满足“直接调用源文件”的需求。Vite Alias 可以将 `@checkit/shared` 映射到 `packages/shared/src`，避免构建步骤。TS Project References 确保类型检查正确。
   - **配置**:
     - 根 `tsconfig.json`: 包含 `references` 指向各包。
     - `packages/web/tsconfig.json`: `references` 指向 `packages/shared`。
     - `packages/web/vite.config.ts`: 配置 `resolve.alias`。

3. **包命名**: 统一使用 `@checkit/` 前缀。
   - `@checkit/web`
   - `@checkit/backend`
   - `@checkit/shared`

## 风险 / 权衡

- **风险**: 迁移过程中可能会破坏现有的导入路径。
  - **缓解**: 迁移后立即运行测试和 lint 检查。
- **风险**: 开发服务器可能需要重启以识别新的依赖关系。
  - **缓解**: 文档说明。
