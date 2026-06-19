## 为什么

当前的 `group-test-files` 规则仅在检测到 2 个及以上测试文件时才建议移动。用户希望如果目录中已经存在 `test` 目录，则强制将所有 `*.test.ts` 文件（即使只有 1 个）移动到 `test` 目录，以保持目录结构整洁。

## 变更内容

修改 `group-test-files` 规则逻辑：

- 检查当前目录是否已存在 `test` 或 `__tests__` 子目录。
- 如果存在，则检查当前目录下是否存在 `*.test.ts` 或 `*.test.tsx` 文件。
- 如果存在测试文件，无论数量多少，都建议移动到 `test` 目录。
- 保留原有逻辑：如果不存在 `test` 目录，仍需 >= 2 个测试文件才建议创建并移动。

## 功能 (Capabilities)

### 新增功能

<!-- 无 -->

### 修改功能

- `group-test-files`: 修改测试文件分组规则，增加基于现有 `test` 目录的强制移动逻辑。

## 影响

- `packages/backend/src/rules/group-test-files.ts`: 核心规则逻辑修改。
- `packages/backend/src/rules/group-test-files.test.ts`: 增加测试用例以验证新行为。
