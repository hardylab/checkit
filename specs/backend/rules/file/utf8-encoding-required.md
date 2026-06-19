# UTF-8 Encoding Required

## 标识

- 规则ID：utf8-encoding-required
- 责任域：文件（file）

## 目的

- 要求源文件使用 UTF-8 编码（可选是否允许 BOM），避免跨平台编码问题。

## 配置

- `allowBom: boolean` 是否允许 BOM

## 行为

- 检测文件编码与 BOM，违规则报错。
