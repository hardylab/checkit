# 规范: Paradigm 规则类型推导

## 目的

定义 Paradigm 规则配置的类型安全机制。

## 需求

### 需求:Paradigm 规则类型安全 (Paradigm Rule Type Safety)

系统必须支持 Paradigm 定义中规则配置的类型安全，允许 IDE 根据规则 ID 推导其 options 类型。

#### 场景:基于 ID 推导配置类型

- **当** 在 Paradigm 对象中定义 rules 属性
- **且** 输入已知的规则 ID（如 'filename-naming-rule'）
- **那么** 对应的属性值类型应被推导为该规则定义的 Options 类型（而非 unknown）

#### 场景:扩展新规则的类型支持

- **当** 创建一个新的 ReviewRule
- **且** 在全局作用域中声明扩展 ReviewRuleOptions 接口
- **那么** Paradigm 定义应自动感知该新规则及其配置类型
