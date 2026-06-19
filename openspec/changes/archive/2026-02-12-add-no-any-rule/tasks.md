## 1. 核心实现与测试

- [x] 1.1 在 `packages/backend/src/rules/` 中创建 `no-any-rule.ts`，实现规则逻辑（包括检测和自动修复）。
- [x] 1.2 在 `packages/backend/src/rules/test/` 中创建 `no-any-rule.test.ts`，添加测试用例覆盖各种 `any` 场景和修复行为。
- [x] 1.3 运行测试以验证规则实现的正确性。

## 2. 集成与配置

- [x] 2.1 在 `packages/backend/src/rules/index.ts` 中导出新规则。
- [x] 2.2 在 `packages/backend/src/paradigms/normal.ts` 中将 `no-any-rule` 添加到默认规则集（根据需要配置）。
- [x] 2.3 验证集成是否成功（可以通过运行整体测试或在示例项目中手动验证）。
