# No Circular Dependency

## 标识

- 规则ID：no-circular-dependency
- 责任域：架构（architecture）

## 目的

- 检测并禁止循环依赖，避免运行时错误与构建不稳定。

## 行为

- 通过依赖图分析模块相互引用，发现环路即告警。

## 实施建议

- 采用分层架构（domain → service → interface），仅向上依赖。
