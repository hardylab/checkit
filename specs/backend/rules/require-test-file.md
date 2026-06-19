# Require Test File

## 标识

- 规则ID：require-test-file
- 责任域：质量（quality）

## 目的

- 要求每个规则实现具备对应的测试文件，保障规则行为的稳定性。

## 行为

- 检查规则实现目录内是否存在 `*.test.ts`。

## 示例

```ts
// 合规
src / rules / ts / no - any - rule.ts;
src / rules / ts / test / no - any - rule.test.ts;
```

## 实施建议

- 在新增规则时，同步编写测试用例覆盖核心行为、异常与修复路径。
