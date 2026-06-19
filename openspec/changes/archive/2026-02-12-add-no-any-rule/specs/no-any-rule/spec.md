# 规范: 禁止使用 any 规则 (No Any Rule)

## ADDED Requirements

### 需求:禁止使用 Any 类型 (No Any Type Usage)

系统必须实现 `no-any-rule` 审查规则，用于检测 TypeScript 代码中 `any` 关键字的使用。

#### 场景:检测到 any 类型

- **当** TypeScript 文件中包含 `: any` 或 `as any` 或 `<any>` 等显式 `any` 类型声明
- **且** 该行或上一行没有 `eslint-disable-next-line @typescript-eslint/no-explicit-any` 注释
- **那么** 系统应报告一个 `type-safety` 类型的错误，提示应使用 `unknown` 或具体类型

#### 场景:忽略带有豁免注释的 any

- **当** TypeScript 文件中包含显式 `any` 类型声明
- **且** 该行或上一行包含 `eslint-disable-next-line @typescript-eslint/no-explicit-any` 注释
- **那么** 系统不应报告错误

#### 场景:自动修复 any 使用

- **当** 检测到未被豁免的 `any` 类型使用
- **且** 用户启用自动修复
- **那么** 系统应在该行代码的上一行插入 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 注释，并保持缩进一致
