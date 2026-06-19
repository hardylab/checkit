## 新增需求

### 需求:定义审查问题数据结构 (ReviewIssue)

系统必须定义 `ReviewIssue` 接口，用于描述代码审查中发现的问题。该接口必须包含以下字段：

- `type`: 问题类型，必须是 "structure" | "traceability" | "styling" | "state" | "documentation" | "architecture" | "type-safety" 之一。
- `module`: 模块名称，表示所属的 brick 或 project。
- `file`: 可选，相关文件路径。
- `line`: 可选，相关行号。
- `message`: 问题描述信息。
- `fixable`: 可选，表示是否可自动修复。

#### 场景:定义 ReviewIssue 接口

- **当** 在代码中引用 `ReviewIssue` 类型时
- **那么** 它应包含 `type`, `module`, `message` 等必需属性，且类型正确

### 需求:定义规则上下文数据结构 (RuleContext)

系统必须定义 `RuleContext` 接口，用于提供规则执行时的上下文信息。该接口必须包含以下字段：

- `cwd`: 当前工作目录。
- `projectRoot`: Monorepo 根目录。
- `targetPath`: 当前目标目录路径。
- `targetName`: Brick 或 Project 名称。
- `targetType`: 目标类型，必须是 "brick" | "project" | "root" 之一。
- `files`: 目标目录下的文件列表（仅文件名）。
- `autoFix`: 是否启用自动修复。

#### 场景:定义 RuleContext 接口

- **当** 在代码中引用 `RuleContext` 类型时
- **那么** 它应包含 `cwd`, `projectRoot`, `files` 等必需属性

### 需求:定义审查规则接口 (ReviewRule)

系统必须定义 `ReviewRule` 接口，用于标准化审查规则的实现。该接口必须包含以下成员：

- `id`: 规则的唯一标识符。
- `glob`: 可选，用于过滤文件的 glob 模式。
- `check(context: RuleContext)`: 检查函数，返回 `ReviewIssue[]`。
- `fix(issue: ReviewIssue)`: 修复函数，返回 `boolean` 表示是否修复成功。

#### 场景:定义 ReviewRule 接口

- **当** 实现一个 `ReviewRule` 对象时
- **那么** 它必须包含 `id`, `check`, `fix` 方法，且签名符合定义
