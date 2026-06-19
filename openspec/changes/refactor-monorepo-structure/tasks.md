## 1. 结构初始化

- [ ] 1.1 创建 `packages/shared`, `packages/web`, `packages/backend` 目录结构
- [ ] 1.2 创建根目录 `pnpm-workspace.yaml`
- [ ] 1.3 更新根目录 `package.json`（移除 dependencies，设为 private）

## 2. Shared 包设置

- [ ] 2.1 初始化 `packages/shared/package.json`
- [ ] 2.2 创建 `packages/shared/tsconfig.json`
- [ ] 2.3 迁移 `src/types/review-rules.ts` 到 `packages/shared/src/types/`
- [ ] 2.4 创建 `packages/shared/src/index.ts` 导出类型

## 3. Web 包迁移

- [ ] 3.1 初始化 `packages/web/package.json` 并移动依赖
- [ ] 3.2 移动根目录 `src` (除了 types), `index.html`, `vite.config.ts`, `public` 到 `packages/web`
- [ ] 3.3 创建 `packages/web/tsconfig.json` 并配置 references
- [ ] 3.4 更新 `packages/web/vite.config.ts` 配置 alias 指向 shared 源码
- [ ] 3.5 更新 Web 代码中的引用路径（指向 `@checkit/shared`）

## 4. Backend 包初始化

- [ ] 4.1 初始化 `packages/backend/package.json`
- [ ] 4.2 创建 `packages/backend/tsconfig.json`
- [ ] 4.3 创建基础入口文件 `packages/backend/src/index.ts`

## 5. 根目录配置与验证

- [ ] 5.1 更新根目录 `tsconfig.json` 包含 references
- [ ] 5.2 运行 `pnpm install` 链接工作区依赖
- [ ] 5.3 验证 Web 应用启动 (`pnpm -F @checkit/web dev`)
- [ ] 5.4 验证类型检查 (`pnpm -r exec tsc --noEmit`)
