# PRD — MVP 差距修复（B1–B4）

| 字段 | 值 |
|------|-----|
| **版本** | v0.1 |
| **日期** | 2026-06-23 |
| **父文档** | [MVP需求说明.md](../MVP需求说明.md) v1.1.1 |
| **状态** | done |

## 摘要

US-01～08 已在 MVP PRD 确认。代码审查发现 4 个实现差距（B1–B4），本 PRD 为 **迭代补丁**，不扩大 MVP 工具范围（仍为 stdio + 8 只读工具）。

## 需求清单

| ID | 类型 | 描述 | Unit Spec | 优先级 |
|----|------|------|-----------|--------|
| GAP-B1 | FR | PO/SO `items` 独立字段 | [B1](units/B1-response-items-split.md) | P0 |
| GAP-B2 | FR | 扩展错误码 400/502/503/NETWORK | [B2](units/B2-error-code-mapping.md) | P0 |
| GAP-B3 | FR | fiscalYear 默认 + health version | [B3](units/B3-fiscal-year-and-version.md) | P0 |
| GAP-B4 | NFR | stderr 工具日志 + SAP_DEBUG | [B4](units/B4-observability-and-validation.md) | P1 |

## 非目标

- 新增 MCP 工具
- HTTP 传输模式 MVP 验收
- V4 供应商发票路径

## 验收门禁

全部 TC-B* 单元测试通过（`pnpm test` 19/19）+ MVP §9.2 T5 / §9.3 E5 E2E 待 Inspector 复验。

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2026-06-23 | 首版，B1–B4 Unit Spec 派生 |
| v0.2 | 2026-06-23 | B1–B4 编码与单元测试完成 |
