## 新增需求

### 需求:规则可以定义所属的 Flow

系统必须允许 `ReviewRule` 定义可选的 `flow` 属性，包含 `key` (字符串) 和 `order` (数字)。

#### 场景:定义 Flow 属性

- **当** 定义一个 ReviewRule 时
- **且** 指定了 `flow: { key: "pdca", order: 1 }`
- **那么** 该规则被识别为 "pdca" 工作流的第一步

### 需求:Flow 中的规则按顺序执行

系统必须按照 `order` 的升序执行同一个 `flow` (`key` 相同) 中的规则。

#### 场景:顺序执行

- **当** 有两个规则属于同一个 "pdca" flow，order 分别为 1 和 2
- **那么** order 为 1 的规则必须先于 order 为 2 的规则执行

### 需求:Flow 执行中断

当一个 Flow 中的某一步骤检查失败（产生 Issue）时，系统必须停止该 Flow 中后续步骤（order 更大）的检查。

#### 场景:检查失败中断 Flow

- **当** "pdca" flow 中 order 为 1 的规则检查产生了 Issue
- **那么** "pdca" flow 中 order 为 2 的规则**不会**被执行
- **且** 系统记录该 Flow 被中断

#### 场景:检查通过继续 Flow

- **当** "pdca" flow 中 order 为 1 的规则检查**没有**产生 Issue
- **那么** "pdca" flow 中 order 为 2 的规则**会被**执行

### 需求:无 Flow 规则照常执行

没有定义 `flow` 属性的规则，必须照常执行，不受 Flow 机制的阻断影响。

#### 场景:混合执行

- **当** 存在普通规则 A 和 Flow "pdca" (含规则 B, C)
- **那么** 规则 A 总是会被执行
- **且** 规则 B 和 C 的执行遵循 Flow 机制
