# Flow Naming Rules

## 目的

定义 Flow 机制相关的命名规范。

## 需求

### 需求:Flow 命名一致性检查

系统必须提供一个 `FlowNamingRule`，用于检查验收规则的命名是否与 `flow.key` 保持一致。

#### 场景:合法命名

- **当** 一个规则类 `PdcaPlanRule` 位于 `pdca-plan.ts` 文件中
- **且** 定义了 `flow: { key: "pdca", order: 1 }`
- **那么** 检查通过，无 issue 报告

#### 场景:非法类名

- **当** 一个规则类 `PlanRule` 定义了 `flow: { key: "pdca", order: 1 }`
- **那么** 报告 Error 级别的 issue，提示类名必须以 `Pdca` 开头

#### 场景:非法文件名

- **当** 一个规则类 `PdcaPlanRule` 位于 `plan.ts` 文件中
- **且** 定义了 `flow: { key: "pdca", order: 1 }`
- **那么** 报告 Error 级别的 issue，提示文件名必须以 `pdca-` 开头

#### 场景:忽略无 Flow 规则

- **当** 一个规则类没有定义 `flow` 属性
- **那么** 不执行命名检查
