# Backend Main

## 目的

- 作为后端规则执行入口：解析参数（目标路径、--fix）、收集文件、加载范式与规则、运行检查并应用修复、输出结果。

## 行为

- 参数：`.<target> [--fix]`
- 文件收集：忽略 `node_modules/.git/dist/.turbo` 目录
- 执行：根据范式的规则集合运行，聚合 issue，输出到 stdout
- 退出码：有 error 则 1，否则 0

## 实施建议

- 控制输出（使用 stdout），避免使用 `console.log` 造成结构性告警。
