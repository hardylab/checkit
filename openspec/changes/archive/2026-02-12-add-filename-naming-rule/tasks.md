## 1. 基础实现

- [x] 1.1 创建 `packages/backend/src/rules/filename-naming-rule.ts` 文件并定义规则基本结构。
- [x] 1.2 在 `filename-naming-rule.ts` 中实现配置解析逻辑，支持从 `Paradigm` 中读取规则配置。

## 2. 规则逻辑实现

- [x] 2.1 实现目录匹配逻辑：遍历文件并找到第一个匹配的规则配置。
- [x] 2.2 实现文件扩展名匹配逻辑：根据文件扩展名确定应使用的命名风格。
- [x] 2.3 实现命名风格检查逻辑：支持 camelCase, PascalCase, snake_case, kebab-case, regex。
- [x] 2.4 实现目录名一致性检查逻辑：当配置 `matchDirectory: true` 时验证文件名。

## 3. 测试与集成

- [x] 3.1 创建 `packages/backend/src/rules/filename-naming-rule.test.ts` 测试文件。
- [x] 3.2 编写测试用例覆盖所有命名风格和目录匹配场景。
- [x] 3.3 在 `packages/backend/src/paradigms/normal.ts` 中注册新规则。
