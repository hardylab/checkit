## 为什么

当前 `Paradigm` 接口中的 `rules` 属性定义为 `Record<string, Record<string, unknown>>`，这意味着在编写 `normal.ts` 等范式文件时，无法对规则的配置选项进行类型检查和自动补全。这增加了配置错误的风险。通过利用 TypeScript 的 `declare global` 和接口合并功能，我们可以实现强类型的规则配置。

## 变更内容

- 修改 `ReviewRuleOptions`（或等效的类型注册表）以支持全局扩展。
- 更新 `Paradigm` 接口，使其 `rules` 属性能够根据规则名称索引到具体的 Options 类型。
- 在现有的规则文件中添加全局类型声明，注册各自的 Options 类型。

## 功能 (Capabilities)

### 新增功能

- `typed-paradigm-rules`: 实现基于全局注册表的 Paradigm 规则类型推导。

### 修改功能

<!-- 无 -->

## 影响

- `packages/shared/src/types/review-rules.ts`: 修改 `Paradigm` 和相关接口。
- `packages/backend/src/rules/*.ts`: 需要更新所有规则文件以包含类型声明。
- `packages/backend/src/paradigms/normal.ts`: 将自动获得类型推导支持。
