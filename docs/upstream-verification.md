# 上游响应验签 设计文档（下期实现）

> 状态：**设计阶段**（本期只出文档，下期实现）。对应 PRD：
> “使用记录对于 Claude 模型（可配置），允许让用户选择是否记录上游响应包……将 TLS 响应保留 5min（可配置），以便用户验证其签名来自 Anthropic。”

## 1. 目标与背景

市面中转“掺水”（篡改/降配/伪造上游响应）泛滥。Cerberus 作为商用分发平台，需要给下游用户一种**可独立验证**的手段，证明某次 Claude 响应**确实来自 Anthropic 官方**、且**内容未被中间篡改**。

难点：Anthropic 的 API 响应在**应用层没有逐条签名**。唯一的密码学信任根来自 **TLS 层**——与 `api.anthropic.com` 建立 TLS 会话时，服务器证书链锚定到公共 CA，且会话内容由协商出的会话密钥加密。因此可采用 **TLSNotary 式证明**：留存本次上游响应的 TLS 密文 + 会话密钥 + 服务器证书链，让第三方离线验证“这段密文用这些密钥解出的明文，正是该次响应，且证书链归属 Anthropic”。

**关键约束：只有 `../cc-bridge` 直连 Anthropic 的 TLS**（new-api 通过 cc-bridge 取 Claude）。因此 TLS 材料的**留存必须在 cc-bridge 内实现**，new-api 只做透传与展示。

## 2. 总体架构

```
用户 ──> new-api ──(HTTP)──> cc-bridge ──(TLS)──> api.anthropic.com
                    │                    │
                    │                    └─ 抓取本次 TLS 材料，写入带 TTL 的临时存储，返回 capture_id
                    └─ 将 capture_id 落入 Log.Other；用户在日志详情点“验证/下载”，代理到 cc-bridge
```

- **cc-bridge**：新增“响应留存”能力，按请求头/配置决定是否为本次请求抓取 TLS 材料；抓取后写入带 TTL 的临时存储，返回 `capture_id`（随响应头回传给 new-api）。
- **new-api**：将 `capture_id` 落入消费日志 `Log.Other`；提供用户侧“验证/下载”入口，代理到 cc-bridge 的验证/下载端点；受用户开关与管理端“允许模型”控制。

## 3. cc-bridge 侧设计

### 3.1 抓取内容（一次响应的 TLS 证明材料）
- **TLS 记录密文**：本次响应对应的 TLS record（application_data）原始密文字节。
- **会话密钥材料**：`SSLKEYLOG` 格式的密钥（TLS1.3 的 `SERVER_TRAFFIC_SECRET_0` 等），足以解密上述密文。
- **服务器证书链**：握手期间 `api.anthropic.com` 出示的完整证书链（DER），用于验证归属与有效期。
- **元信息**：SNI/host、协商的密码套件与 TLS 版本、时间戳、请求/响应字节范围。

> 说明：TLSNotary 的“不可否认”通常需要一个诚实第三方 notary 参与握手，或用 MPC 拆分密钥。本设计的**初版为“运营方背书 + 可离线校验一致性”**：证明“密文可由所给密钥解出该明文，且证书链归属 Anthropic 且当时有效”，用于反掺水核验；若需完全防运营方伪造，再引入 notary/MPC（列为后续增强）。

### 3.2 存储与生命周期
- 带 **TTL 的临时存储**（默认 **5 分钟**，可配 `capture_ttl_seconds`），到期自动清除。
- 存储位置候选：内存 LRU（小、快、进程内）/ 本地临时文件（大响应）/ Redis（多实例共享）。初版建议**内存 LRU + 总量上限**，超限或到期即淘汰。
- 复用 cc-bridge 现有 `captures/` 基础设施与存储抽象（`src/store/`）。

### 3.3 开销评估（需实测）
- 每条留存 ≈ 响应密文大小 + 数 KB 密钥/证书。长响应（流式、长上下文）可能达数百 KB~MB。
- 需设：单条上限、总量上限（字节）、并发留存上限；超限降级为“本次不留存”并在响应头标记，避免打爆内存。

### 3.4 触发与开关
- 仅当 new-api 传入“需要留存”标记（如请求头 `X-Cerberus-Capture: 1`）时才抓取，默认不抓取（零开销）。
- cc-bridge 侧另有总开关与配额，作为最后防线。

### 3.5 对外端点（cc-bridge）
- `GET /capture/{capture_id}`：下载 TLS 材料包（密文+密钥+证书链+元信息，打包为可校验归档）。
- `GET /capture/{capture_id}/verify`：服务端便捷校验（解密一致性 + 证书链校验），返回结构化结果。
- 鉴权：仅接受来自 new-api 的服务间调用（内部令牌）；`capture_id` 为高熵不可枚举。

## 4. new-api 侧设计

### 4.1 触发链路
- 计费/转发前，若满足条件（见 4.2），给发往 cc-bridge 的请求加 `X-Cerberus-Capture: 1`。
- cc-bridge 响应头回传 `X-Cerberus-Capture-Id`，new-api 写入本次消费日志的 `Log.Other.capture_id`。

### 4.2 开关与作用域（可配置）
- **用户级**：`dto.UserSetting.RecordUpstreamResponse bool`（用户自助开启，默认关）。
- **模型作用域**：管理端配置“允许留存的模型”（默认仅 Claude 系，如 `claude-*`），避免对闭源 GPT 等误留存。
- **TTL**：管理端 `capture_ttl_seconds`（默认 300，透传给 cc-bridge 或双方各持一份）。
- **总开关**：管理端一键关闭整个功能。

### 4.3 用户侧展示
- 日志详情：当该条 `Log.Other.capture_id` 存在且未过期，展示“验证/下载”入口。
- “下载”→ 代理 cc-bridge `GET /capture/{id}`；“验证”→ 代理 `verify` 并渲染结果（证书主体/签发者、有效期、解密一致性、时间戳）。
- 过期后入口置灰并提示“留存已过期（TTL）”。

### 4.4 数据与隐私
- `Log.Other.capture_id` 属**管理员+本人可见**（普通用户仅能看自己的日志，`formatUserLogs` 不剥离该 id）。
- **会话密钥高度敏感**：仅用于一次性核验、TTL 后即焚；下载包应提示用户妥善处理；服务间传输全程 TLS。

## 5. 独立验证工具（供用户/第三方）
提供一个开源的小工具/脚本（或文档化步骤）：
1. 用 `SSLKEYLOG` 密钥解密 TLS record 密文 → 还原明文响应；比对与用户收到的响应一致。
2. 校验服务器证书链：链是否完整、是否锚定公共 CA、`CN/SAN` 是否为 `api.anthropic.com`、抓取时间戳是否在证书有效期内。
3. 二者皆通过 ⇒ “该响应确来自 Anthropic 且未被篡改”。

## 6. 风险与待决
- **不可否认性边界**：初版依赖运营方留存，能防“第三方中间篡改/掺水”，但不能在密码学上防“运营方自证伪造”。若业务需要，后续引入 notary/MPC-TLS（成本高）。
- **性能/内存**：长响应留存的内存与带宽开销，必须实测并设硬上限。
- **合规**：留存上游响应涉及数据留存，需在用户协议中说明；密钥材料的安全处置。
- **流式响应**：SSE 分块的 TLS record 边界与重组，需要在 cc-bridge 抓取层正确切分。

## 7. 落地清单（下期）
- [ ] cc-bridge：抓取层（`src/service/upstream.rs`）+ TTL 存储（`src/store/`）+ `/capture/*` 端点 + 配置项。
- [ ] cc-bridge：单条/总量/并发上限与降级；开销实测。
- [ ] new-api：`X-Cerberus-Capture` 触发 + 回写 `Log.Other.capture_id`。
- [ ] new-api：`UserSetting.RecordUpstreamResponse` + 管理端允许模型/TTL/总开关。
- [ ] new-api：日志详情“验证/下载”入口（代理 cc-bridge），i18n 全语种。
- [ ] 独立验证工具/文档。
- [ ] 端到端联调 + 安全评审（密钥处置、鉴权、TTL 焚毁）。
