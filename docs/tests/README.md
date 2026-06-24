# Test Cases 索引

| 文档 | 范围 | 阶段 | 状态 |
|------|------|------|------|
| **[MVP-TC.md](MVP-TC.md)** | MVP 全量验收 A/T/E/C/D（§9） | ③ ⑥ | 定稿 |
| **[V0.2-TC.md](V0.2-TC.md)** | v0.2 增量验收（T9–T15、E9–E15、C4–C6、D5–D7、A6–A7）+ MVP §9.0 回归门禁 | ③ ⑥ | v1.0 定稿 |
| [MVP-TC-gap-B1-B4.md](MVP-TC-gap-B1-B4.md) | 差距修复 B1–B4 专项 | ③ ⑤ ⑥ | 定稿 |

## 自动化测试（⑤）

| 文件 | 覆盖 |
|------|------|
| `MCP Server/test/credentials.test.js` | 凭证解析（11 例） |
| `MCP Server/test/tools-utils.test.js` | B1–B4 工具/错误码（8 例） |
| `MCP Server/test/run-all.js` | 聚合运行 |

```powershell
cd "MCP Server"
pnpm test        # 19/19，无 SAP
pnpm test:e2e    # 21/21，需 SAP
```

## SDD 约束

编码（④）前须在本目录有对应 Test Case；见 [AGENTS.md](../../AGENTS.md)「强制引用」。
