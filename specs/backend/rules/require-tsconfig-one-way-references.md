# Require TSConfig One-Way References

## 标识

- 规则ID：require-tsconfig-one-way-references
- 责任域：架构（architecture）

## 目的

- 要求项目引用关系为单向依赖，避免循环依赖与复杂的构建链。

## 行为

- 检查 `references` 配置是否形成单向 DAG。

## 实施建议

- 在多包场景下清晰划分层级，底层仅被高层引用，不进行反向依赖。
  end_patch
