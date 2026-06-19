# 提案：Flow 命名规范规则

## 目标

强制执行使用了 `flow` 字段的验收规则的命名规范，确保其文件名和类名与 `flow.key` 保持一致，以提高代码的可读性和可维护性。

## 背景

随着 Flow 机制的引入，为了方便识别属于同一 Flow 的规则，需要制定统一的命名规范。

## 方案

新增一个架构检查规则 `FlowNamingRule`，检查所有实现了 `ReviewRule` 接口的类：

1.  如果规则定义了 `flow` 属性。
2.  检查其类名是否以 `flow.key` (PascalCase) 开头。
3.  检查其所在文件名是否以 `flow.key` (kebab-case) 开头。

例如，若 `flow: { key: "pdca", ... }`：

- 合法类名：`PdcaPlanRule`, `PdcaDoRule`
- 非法类名：`PlanRule`
- 合法文件名：`pdca-plan.ts`, `pdca-do.ts`
- 非法文件名：`plan.ts`

## 影响

- 需要扫描 `packages/backend/src/rules` 下的所有规则文件。
- 不符合规范的规则将报告 error 级别的 issue。
