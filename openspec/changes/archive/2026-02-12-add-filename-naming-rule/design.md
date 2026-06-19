## 上下文

目前 CheckIt 系统中缺乏自动化的文件命名规范检查。随着项目规模扩大，不一致的命名风格影响了代码质量。我们需要引入一个新的规则 `filename-naming-rule` 来解决这个问题。

## 目标 / 非目标

**目标：**

- 实现可配置的文件命名检查规则。
- 支持基于目录的配置覆盖。
- 支持多种命名风格 (camelCase, PascalCase, snake_case, kebab-case, regex)。
- 支持目录名匹配检查。

**非目标：**

- 自动重命名文件的完整引用重构（本次主要关注检查逻辑，虽然可以标记为 fixable，但复杂的重构留待后续完善）。

## 决策

### 规则配置结构

将在 `Paradigm` 的 `rules` 中增加 `filename-naming-rule` 的配置。
配置结构设计如下：

```typescript
interface FilenameNamingRuleConfig {
  items: Array<{
    directory: string; // 匹配的目录路径或 glob
    rule: {
      [extension: string]:
        | 'camelCase'
        | 'PascalCase'
        | 'snake_case'
        | 'kebab-case'
        | `regex:${string}`;
      matchDirectory?: boolean;
    };
  }>;
}
```

或者更扁平的结构，但考虑到“多组规则”，数组结构更合适。
为了与现有配置系统兼容，我们将配置定义为对象数组。

示例配置：

```json
"filename-naming-rule": {
  "configs": [
    {
      "directory": "src/components",
      "extensions": {
        ".tsx": "PascalCase",
        ".ts": "camelCase"
      },
      "matchDirectory": true
    },
    {
      "directory": "src/utils",
      "extensions": {
        ".ts": "camelCase"
      }
    }
  ]
}
```

### 实现位置

规则将在 `packages/backend/src/rules/filename-naming-rule.ts` 中实现。
它将实现 `ReviewRule` 接口。

## 风险 / 权衡

- **配置复杂性**: 用户可能配置冲突的规则。决策是采用“最长匹配”或“第一个匹配”原则。这里采用**第一个匹配**原则，数组顺序决定优先级。
