## 1. 接口定义变更

- [x] 1.1 在 `packages/shared/src/types/review-rules.ts` 中更新 `ReviewRule` 接口，增加 `flow` 属性定义。
- [x] 1.2 运行 `tsc` 验证类型定义变更。

## 2. 后端执行逻辑实现

- [x] 2.1 在 `packages/backend/src/main.ts` 中引入 flow 相关的类型和逻辑。
- [x] 2.2 实现规则分组逻辑：区分普通规则和 Flow 规则，并将 Flow 规则按 Key 分组。
- [x] 2.3 实现 Flow 内部排序和执行逻辑：按 `order` 排序，遇错中断。
- [x] 2.4 整合普通规则和 Flow 规则的执行。

## 3. 验证与测试

- [ ] 3.1 创建测试用的 Mock 规则，包含普通规则和不同 Flow/Order 的规则。
- [ ] 3.2 编写单元测试验证 Flow 机制：
  - 验证普通规则总是执行。
  - 验证 Flow 规则按 Order 执行。
  - 验证 Flow 中断机制（前序失败，后续不执行）。
- [ ] 3.3 运行所有测试确保无回归。
