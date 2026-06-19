# No Any Rule

## 标识

- 规则ID：no-any-rule
- 责任域：类型安全（type-safety）

## 目的

- 禁止在生产代码中使用 TypeScript `any` 类型，提升类型精确度与可维护性。

## 范围

- 适用于 `packages/backend/src` 中除 `test` 目录外的 `.ts/.tsx` 文件。

## 行为

- 检测以下使用场景：
  - 类型标注：`const a: any`
  - 泛型参数：`Map<string, any>`
  - 断言：`x as any`
- 忽略以下场景：
  - 字符串字面量中的 `any`
  - 测试目录下的文件
  - 明确禁用注释：
    - 前一行：`// eslint-disable-next-line @typescript-eslint/no-explicit-any`
    - 同行：`// eslint-disable-line @typescript-eslint/no-explicit-any`

## 配置

- 暂无显式配置项；规则在范式中可通过 issue 等级调整提示级别。

## 修复策略

- 自动修复在目标代码行之前插入禁用注释：
  - `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- 具备幂等性：若上一行已存在禁用注释，不重复插入。

## 示例

```ts
// 违规
const a: any = 1;
function f(x: any) {}
const m = new Map<string, any>();
const y = x as any;

// 允许（同行禁用）
const a: any = 1; // eslint-disable-line @typescript-eslint/no-explicit-any

// 允许（上一行禁用）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const a: any = 1;
```

## 例外与理由

- 某些第三方库或极端动态场景可能需要 `any`；通过禁用注释进行显式声明，形成可审计的例外。

## 实施建议

- 优先使用 `unknown` 或精确的类型别名/接口。
- 渐进迁移：先以 warning 级别提示，配合自动修复帮助团队建立约束与例外清单。
