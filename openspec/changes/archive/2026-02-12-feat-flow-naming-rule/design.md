# 设计：Flow 命名规范规则

## 概述

实现一个静态代码分析规则 `FlowNamingRule`，用于检查验收规则的命名是否符合 Flow 机制的约定。

## 详细设计

### 1. 规则逻辑

- **目标文件**：所有 `.ts` 文件（排除 `.d.ts`, `.test.ts`, `.spec.ts`）。
- **解析方法**：由于运行时环境限制（无 `ts-morph`，`typescript` 仅为 devDep），采用正则表达式进行轻量级解析。
- **检测步骤**：
  1. 读取文件内容。
  2. 识别文件中定义的所有类：`class\s+(\w+)`。
  3. 在每个类的作用域内（简化为：下一个类定义之前），查找 `flow` 属性定义。
     - 匹配模式：`flow\s*=\s*\{\s*key:\s*['"]([^'"]+)['"]`
     - 或 `flow\s*:\s*\{\s*key:\s*string;\s*order:\s*number\s*\}\s*=\s*\{\s*key:\s*['"]([^'"]+)['"]` (带类型注解)
  4. 提取 `flow.key`。
  5. **类名检查**：类名必须以 `PascalCase(flow.key)` 开头。
     - 例如 `key: "pdca"` -> 类名必须以 `Pdca` 开头。
     - 转换逻辑：`key.charAt(0).toUpperCase() + key.slice(1)`。
  6. **文件名检查**：文件名（不含扩展名）必须以 `kebab-case(flow.key)` 开头。
     - 例如 `key: "pdca"` -> 文件名必须以 `pdca-` 开头。
     - 转换逻辑：`key.toLowerCase() + '-'`。

### 2. 边缘情况

- 如果一个文件包含多个类，且都有 flow，分别检查。
- 如果 flow key 包含特殊字符，需规范化处理（假设 key 仅包含字母数字）。

### 3. 实现位置

- 新建规则文件：`packages/backend/src/rules/architecture/flow-naming-rule.ts`
- 注册规则：`packages/backend/src/rules/registry.ts`

### 4. 测试计划

- 创建单元测试 `packages/backend/src/rules/architecture/test/flow-naming-rule.test.ts`。
- 构造包含合法和非法命名的模拟文件内容进行测试。
