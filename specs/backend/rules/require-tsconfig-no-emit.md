# Require TSConfig No Emit

## 标识

- 规则ID：require-tsconfig-no-emit
- 责任域：构建（build）

## 目的

- 要求 `tsconfig` 中设置 `noEmit: true`（或通过构建工具统一产物），避免随意在源码编译阶段输出文件。

## 行为

- 检查项目 `tsconfig` 配置项是否包含 `noEmit: true`。

## 实施建议

- 将产物输出交由 bundler/构建管线统一控制。
