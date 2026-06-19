# Normal Paradigm

## 标识

- 范式名：normal
- 描述：标准编码范式，提供结构/样式/架构等基础检查与自动修复。

## 规则集合（示例）

- group-test-files、use-spec-coding、no-any-rule、spec-traceability-check、
  no-console-log、env-var-check、no-magic-numbers、function-size-limit、
  no-circular-dependency、require-test-file、require-index-export、index-only-exports、
  require-tsconfig-no-emit、require-tsconfig-one-way-references、utf8-encoding-required、
  tab-size-two-spaces、filename-naming-rule

## 自动修复

- 范式级开关 `autofix: true`；具体规则可覆盖开关。

## 实施建议

- 根据项目情况调整允许列表与触发范围，保持“零误报可接受、零漏报优先”的原则。
