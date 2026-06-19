# Filename Naming Rule

## 标识

- 规则ID：filename-naming-rule
- 责任域：文件（file）

## 目的

- 约束文件命名风格（如 kebab-case），提升一致性与可读性。

## 行为

- 支持 `camelCase`、`PascalCase`、`snake_case`、`kebab-case` 与正则。
- 针对测试文件，允许 `.test`/`.spec` 后缀。

## 示例

- 合规：`no-any-rule.test.ts`
- 违规：`NoAnyRule.test.ts`
