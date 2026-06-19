# Spec Traceability Check

## 标识

- 规则ID：spec-traceability-check
- 责任域：规范追踪（traceability）

## 目的

- 要求关键实现文件在文件头部显式标注关联规范文档链接，确保实现与规范的一致性与可溯源性。

## 范围

- 命中目录：`controllers/`, `services/`, `rules/`
- 文件名或内容包含关键字：`controller`, `service`, `class`, `function`
- 忽略：`test` 目录

## 合规判定

- 文件头部必须存在非空链接形式：
  - `// spec:[spec](specs/<module>/<doc>.md#L<number>)`
- 空链接（如 `// spec:[spec]()`）不合规。

## 修复策略

- 不自动修复：需要开发者提供真实规范链接。

## 示例

```ts
// 合规
// spec:[spec](specs/backend/rules/no-any-rule.md#L1)
export class NoAnyRule {
  /* ... */
}

// 不合规
// spec:[spec]()
export class NoAnyRule {
  /* ... */
}
```

## 实施建议

- 建立规范文档目录结构（如 `specs/backend/...`），按模块落地行为说明与验收标准。
- 新增实现或重构时，同步维护对应 spec 链接。
