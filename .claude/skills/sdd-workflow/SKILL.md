---
name: sdd-workflow
description: Use when starting any feature, user story, or bugfix in ES-MCP-Server — enforces US → Unit Spec → PRD → Testing Case → Coding (multi-agent) → Unit Test (multi-agent) → E2E pipeline with phase gates
---

# SDD Workflow — ES-MCP-Server

**US → Unit Spec → PRD → Test Case → Code → Unit Test → E2E。测试先于编码。不可跳过阶段。**

## Phase Gate Rule

```
US ──[gate]──▶ ① ──[gate]──▶ ② ──[gate]──▶ ③ ──[gate]──▶ ④ ──[gate]──▶ ⑤ ──[gate]──▶ ⑥
```

**每个阶段必须完成并通过验收，方可在同一分支继续下一阶段。禁止跨阶段跳跃。**

## Phase Map

| # | 阶段 | 输出物 | 负责 Skill | 验收标准 |
|---|------|--------|-----------|----------|
| ① | **Unit Spec** | 每个 Unit 的详细规格（范围、入/出参、依赖） | superpowers:writing-plans | 所有 Unit 边界清晰、无歧义 |
| ② | **PRD** | 产品需求文档（整合 Unit Spec） | superpowers:writing-plans | PRD 完整覆盖所有 Unit，签字确认 |
| ③ | **Testing Case** | 每个 Unit 的测试用例文档 | superpowers:test-driven-development | 测试用例覆盖 happy path + 异常 + 边界；**代码一行未写** |
| ④ | **Coding** | 实现代码 | superpowers:subagent-driven-development + superpowers:dispatching-parallel-agents | 每 Unit 独立 agent 实现，diff 文件传递 |
| ⑤ | **Unit Test** | 测试执行结果 | superpowers:verification-before-completion | 全部测试通过，覆盖率达标 |
| ⑥ | **E2E** | 端到端验证报告 | superpowers:verification-before-completion + gstack:qa | 验收用例全部通过 |

## Red Flags — STOP and Go Back

| 行为 | 问题 |
|------|------|
| "这个 Unit 很简单，直接写代码就行" | 违反 ③ 先于 ④。简单 ≠ 不需要测试用例。 |
| "PRD 和 Unit Spec 差不多，合并吧" | Unit Spec 是开发单元边界，PRD 是产品视角。职责不同。 |
| "测试用例写完再补" | ③ 必须完成并评审通过才能进入 ④。 |
| "我先写一个 Unit 验证思路" | ③ 之前一行代码不写。用 spec 验证思路，不用代码。 |
| "E2E 就是跑一遍工具调用，很快" | ⑥ 必须对照验收标准逐项打勾，不可口头确认。 |

## Quick Reference

### ① Unit Spec
- 输入：已确认的 US 列表
- 输出：`docs/specs/<feature>/unit-*.md`
- 拆分 US 为独立开发单元，标明依赖关系（并行 vs 串行）

### ② PRD
- 输入：所有 `unit-*.md`
- 输出：`docs/prd/<feature>.md`
- 整合为产品语言需求文档，明确 MVP 范围与 Out of Scope

### ③ Testing Case（★ 先于编码）
- 输入：PRD + Unit Spec
- 输出：`docs/specs/<feature>/test-cases.md`
- **关键约束：此时代码仓库无任何实现变更**
- 每个 Unit 至少 1 normal + 1 error + 1 boundary 用例
- checklist 格式，可直接用于 ⑥

### ④ Coding（multi-agent dispatch）
- 输入：Unit Spec + Test Cases
- SDD：每 Unit 派一个 agent，task-brief → implement → review
- 独立 Unit 并行 dispatch；有依赖者按拓扑序串行

### ⑤ Unit Test（multi-agent dispatch）
- 输入：实现代码 + Test Cases (③)
- 对照 ③ 的测试用例执行，`npm test` 全绿

### ⑥ E2E
- 输入：完整实现 + Test Cases checklist
- 输出：`docs/specs/<feature>/e2e-report.md`
- 逐项打勾，记录实际 vs 预期，启动 `gstack:qa` 质量把关

## 关联技能

| 技能 | 用途 |
|------|------|
| superpowers:brainstorming | US 确认前的需求澄清 |
| superpowers:writing-plans | ① Unit Spec + ② PRD |
| superpowers:test-driven-development | ③ Testing Case |
| superpowers:subagent-driven-development | ④ Coding（SDD 主控） |
| superpowers:dispatching-parallel-agents | ④ ⑤ 并行 dispatch |
| superpowers:verification-before-completion | ⑤ Unit Test + ⑥ E2E |
| gstack:qa | ⑥ E2E 质量把关 |
| gstack:review | ④ 代码审查 |

## 与本项目其他文档的关系

- 需求文档（`docs/MVP需求说明.md`）→ 产出 US 列表
- 开发指南（`docs/MCP-Server开发指南.md`）→ ④ 编码时的技术约束
- 任务清单（`docs/TASKS.md`）→ 跟踪各 Unit 进度
