## 1. 基础类型定义 (Shared Package)

- [x] 1.1 在 `packages/shared/src/types/review-rules.ts` 中定义 `ReviewRuleRegistry` 接口。
- [x] 1.2 更新 `Paradigm` 接口，使其 `rules` 属性使用 `ReviewRuleRegistry` 进行类型映射。

## 2. 规则类型扩展 (Backend Package)

- [x] 2.1 为 `filename-naming-rule` 添加 Options 类型定义和全局注册。
- [x] 2.2 为 `group-test-files` 添加 Options 类型定义和全局注册（如果需要配置）。
- [x] 2.3 为 `use-spec-coding` 添加 Options 类型定义和全局注册。
- [x] 2.4 为 `no-any-rule` 添加 Options 类型定义和全局注册。

## 3. 验证与清理

- [x] 3.1 验证 `packages/backend/src/paradigms/normal.ts` 是否获得类型推导支持。
- [x] 3.2 运行 `tsc` 检查整个项目是否有类型错误。
