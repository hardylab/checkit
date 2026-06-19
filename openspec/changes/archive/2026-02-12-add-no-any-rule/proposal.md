## 为什么

当前代码库中允许随意使用 `any` 类型，这会导致 TypeScript 类型系统的优势被削弱，增加运行时错误的风险。为了提高代码的类型安全性，需要引入一条规则来禁止使用 `any`，并鼓励使用 `unknown` 或更具体的类型。对于确实无法避免使用 `any` 的情况，应提供一种标准化的方式来豁免检查（即添加 ESLint 禁用注释）。

## 变更内容

引入一个新的代码审查规则 `no-any-rule`，用于检测并阻止 `any` 类型的使用。

- 规则应检查 TypeScript 代码中的 `any` 关键字。
- 如果检测到 `any` 且没有相应的豁免注释，则报告错误。
- 提供自动修复功能：对于无法避免的情况，自动在上一行添加 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 注释。

## 功能 (Capabilities)

### 新增功能

- `no-any-rule`: 定义禁止使用 `any` 类型的规则及其自动修复行为。

### 修改功能

<!-- 无 -->

## 影响

- `packages/backend/src/rules/`: 将新增 `no-any-rule.ts` 和对应的测试文件。
- `packages/backend/src/rules/index.ts`: 需要导出新规则。
- `packages/backend/src/paradigms/normal.ts`: 需要在默认范式中启用此规则。
- 代码库中现有的 `any` 使用可能会在规则启用后被标记（如果在后续扫描中运行的话）。
