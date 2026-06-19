## 为什么

当前项目缺乏统一的文件命名规范，导致代码库中存在多种命名风格，降低了代码的可读性和一致性。需要引入自动化的文件命名检查规则，以强制执行团队约定的命名风格。

## 变更内容

引入一个新的代码审查规则 `filename-naming-rule`，支持：

- 基于目录配置多组规则。
- 为不同文件类型指定命名风格（camelCase, PascalCase, snake_case, kebab-case, regex）。
- 检查文件名是否与目录名一致。

## 功能 (Capabilities)

### 新增功能

- `filename-naming-rule`: 定义文件名命名规范检查的核心逻辑和配置结构。

### 修改功能

<!-- 无 -->

## 影响

- `packages/backend`: 将新增规则实现。
- `packages/shared`: 将新增规则配置类型定义。
- `openspec/specs`: 将新增 `filename-naming-rule` 规范。
