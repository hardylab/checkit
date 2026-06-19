## 上下文

当前 `ReviewRule` 定义中，`check` 函数的 `options` 参数类型为 `Record<string, unknown>`，这使得在使用规则时缺乏类型检查。`Paradigm` 接口中的 `rules` 属性也是如此。为了提高开发体验和代码质量，我们需要一种机制来强类型化这些配置。

## 目标 / 非目标

**目标：**

- 定义一个全局接口 `ReviewRuleOptions` 作为规则配置的注册表。
- 更新 `Paradigm` 接口，使其 `rules` 属性类型为 `Partial<ReviewRuleOptions>`（或类似）。
- 允许通过 `declare global` 扩展 `ReviewRuleOptions`。

**非目标：**

- 修改运行时行为。这纯粹是类型层面的变更。

## 决策

1.  **全局注册表模式**：
    在 `packages/shared/src/types/review-rules.ts` 中定义一个空的接口 `ReviewRuleOptions`。

    ```typescript
    export interface ReviewRuleOptions {
      // Intentionally empty, to be extended via declaration merging
      [key: string]: unknown; // Fallback for unknown rules
    }
    ```

    _注意：为了允许未注册的规则，我们可能需要保留索引签名，或者让索引签名在另一个类型中处理。但为了强类型，最好是让 `rules` 属性类型为 `Partial<ReviewRuleOptions> & Record<string, unknown>`。_

    更精确的做法是：

    ```typescript
    export interface ReviewRuleRegistry {
      // To be extended
    }

    // Fallback for rules not in registry
    export type ParadigmRules = {
      [K in keyof ReviewRuleRegistry]?: ReviewRuleRegistry[K];
    } & Record<string, unknown>;
    ```

2.  **扩展 Paradigm 接口**：

    ```typescript
    export interface Paradigm {
      // ...
      rules: ParadigmRules;
    }
    ```

3.  **规则定义中的扩展**：
    在每个规则文件（如 `filename-naming-rule.ts`）中：

    ```typescript
    export interface FilenameNamingOptions {
      configs: NamingConfigItem[];
    }

    declare module '@checkit/shared' {
      interface ReviewRuleRegistry {
        'filename-naming-rule': FilenameNamingOptions;
      }
    }
    ```

    _注意：由于 `ReviewRuleRegistry` 定义在 shared 包中，我们需要扩充该模块。_

## 风险 / 权衡

- **风险**：模块扩充（Module Augmentation）可能比较棘手，特别是对于 monorepo 结构。需要确保 `d.ts` 文件正确生成或源文件被正确引用。
- **缓解**：由于我们在同一 monorepo 中直接引用源码（通过 `packages/backend/src` 引用 `packages/shared/src`），只要 TypeScript 配置正确，声明合并应该能工作。

## 迁移计划

1.  修改 `shared` 包中的类型定义。
2.  逐个修改 backend 中的规则文件，添加类型声明。
3.  验证 `normal.ts` 中的类型推导。
