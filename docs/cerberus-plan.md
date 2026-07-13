# Cerberus 实施计划

> 本文档为 `PRD.md` 的落地实施方案。Cerberus 是 new-api 的商用 fork，对外销售各类模型 API，页面语义对齐 OpenRouter。
> Claude 模型由 `../cc-bridge` 提供，涉及上游能力的功能需协同改动其代码。

## 实施进度（cerberus 分支）

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| P1 CNY 记账本位 | ✅ 完成 | 锚翻转+价格表缩放+展示反转+全网关(易支付/Stripe/Waffo/Pancake/Creem)+前端基座，含单测 |
| P1b 模型页 Provider 分组 | ✅ 完成 | 按 vendor 分组罗列 + 元/刀汇率徽章 + i18n |
| P2 客户折扣(PolicyResolver) | ✅ 后端完成 | 模型+Resolver+计费注入(已验证对账一致)+CRUD API+单测；**剩管理端UI** |
| P3 用户级并发+RPM | ✅ 后端完成 | in-flight信号量+RPM(Redis/内存双模式)+中间件挂载+单测；配置复用P2 CRUD；**剩管理端UI** |
| P4 Vendor 对外展示 | ✅ 后端完成 | UserVisibleChannel开关+日志vendor脱敏派生；**剩前端日志列** |
| P5 上游验签 | ✅ 设计文档 | 见 `docs/upstream-verification.md`，下期实现 |
| P6 全量测试 | ✅ 完成 | 后端 30 包全绿；抓到并修复计费 nil-DB panic（hasPolicies 快路径）。根 main 包因前端 dist 未构建的环境问题无法编译（非代码问题） |
| 管理端策略矩阵 UI | ⏳ 待做 | P2/P3 共享的前端编辑器。**需前端工具链**：新增 TanStack 路由要重新生成 `routeTree.gen.ts`，且需可视化验证，宜在能跑 dev server 的会话完成。后端 CRUD API `/api/customer-policy` 已就绪 |
| P4 前端日志 vendor 列 | ⏳ 待做 | 后端已在日志 JSON 输出 `vendor_name`；前端 usage-logs 加用户可见列（开关开启时）。属可视化验证的小收尾 |

## 0. 决策基线（已确认）

| 项 | 决策 |
| --- | --- |
| 部署形态 | **全新部署**，无存量余额/定价迁移 |
| 记账本位币 | **CNY**：quota 作为 CNY 的整数记账单位，USD 变为派生展示货币 |
| 折扣维度 | 按 **vendor（Provider）**，在分组价之上**再乘**；查不到逐级回落系统默认 `1.0` |
| 并发 / RPM 维度 | 按**物理渠道 × 模型**，逐级回落系统默认；支持 Redis（多实例）/ 内存（单实例）双模式 |
| 策略解析 | 收敛到 **`PolicyResolver` 接口**，可整体替换为表达式/外部服务等自由算法 |
| 渠道对外展示 | 展示 **vendor 脱敏名**，物理渠道仅管理员可见；开关默认关 |
| 模型页版式 | 按 **Provider 分组罗列**（OpenRouter 风格），保留筛选 |
| 上游验签 | **下期实现**，本期仅交付设计文档 |
| 多语言 | 所有实现**原生 i18n**，前端 7 语种 + 后端 3 语种同步补键，零硬编码 |

## 1. 现状底数（探索结论）

- **唯一记账锚**：`common/constants.go:62` `QuotaPerUnit`（现 500000 quota = $1）。倍率基准 `$0.002/1K tokens`（`setting/ratio_setting/model_ratio.go:12-24`，`USD2RMB=7.3`）。`USDExchangeRate` 当前**仅用于展示**。
- **扣费公式**（`service/text_quota.go:307`）：`quota =(token 加权 × modelRatio × groupRatio)× ∏otherRatios`。折扣唯一现有维度是**分组**（`relay/helper/price.go:44 HandleGroupRatio`；汇总 `price.go:119`）。
- **渠道级无任何倍率/价格覆盖**；计费只用 `ChannelId` 做统计与日志。渠道在计费前已选定，`RelayInfo` 同时持有 `UserId / ChannelId / OriginModelName`——折扣与限流注入的天然切点。
- **无真正 in-flight 并发限制**，只有时间窗口限流（`middleware/model-rate-limit.go`），粒度到分组。
- `UserSetting` 是 `User.Setting` 内 JSON text，加字段免迁移。
- 模型页（`web/default/src/features/pricing`）已有 vendor 筛选（`pricing-sidebar.tsx vendorOptions`）与卡片 vendor 图标；`GetPricing` 返回 `vendors[]` + 每模型 `vendor_id/name/icon`。
- i18n 基础设施齐备：前端 i18next（`web/default/src/i18n/locales/`，zh/en/fr/ja/ru/vi/zh-TW）；后端 `i18n/`（`keys.go` 常量 + `locales/` yaml，en/zh-CN/zh-TW）。

## 2. 核心抽象：PolicyResolver

将"折扣 / 并发 / RPM 取什么值"收敛到单一接口后面，调用方只问结果、不关心算法，便于将来整体替换。

```go
// 计费/限流上下文（RelayInfo 已全部持有）
type PolicyContext struct {
    UserId    int
    Group     string
    VendorId  int    // 折扣维度：modelName → pricing vendor 映射
    ChannelId int    // 并发/RPM 维度：物理渠道
    ModelName string
}

type ResolvedPolicy struct {
    DiscountRatio  float64 // 再乘在分组价之上；默认 1.0
    MaxConcurrency int     // 0 = 不限
    RpmLimit       int     // 0 = 用分组默认
}

type PolicyResolver interface {
    Resolve(ctx PolicyContext) ResolvedPolicy
}
```

- **默认实现 `TablePolicyResolver`**：查 `customer_policy` 表，逐级回落，命中不到落系统默认。回落链本身抽象成有序 key 列表。
- **可替换**：`ExprPolicyResolver` / `RemotePolicyResolver` 实现同一接口，启动注入。
- **热路径缓存**：仿 `ability`/`ratio_setting` 内存缓存，写时失效。

### 回落链

**折扣（vendor）** — vendor 由 `modelName → pricing.VendorID` 派生：
1. `(user, vendor, model)` → 2. `(user, vendor)` → 3. `(user)` → 4. **系统默认 = 1.0**

**并发 / RPM（物理渠道）**：
1. `(user, channel, model)` → 2. `(user, channel)` → 3. `(user, model)` → 4. `(user)` → 5. **系统默认（全局/分组值）**

折扣注入：`PriceData.AddOtherRatio("customer_discount", ratio)`，**再乘**在 `modelRatio × groupRatio` 之上，预扣与结算共用同一乘子。

### 数据模型：`customer_policy`

```
UserId        int      // 客户
VendorId      int      // 0 = 任意 vendor（折扣维度）
ChannelId     int      // 0 = 任意渠道（并发/RPM 维度）
ModelName     string   // "" / "*" = 任意模型，支持前缀 claude-*
DiscountRatio float64  // 折扣倍率，1=原价，0.9=九折
MaxConcurrency int     // in-flight 上限，0=不限
RpmLimit      int      // 每分钟上限，0=分组默认
Priority      int      // 命中优先级
```

## 3. 分阶段计划

### P1 — CNY 记账本位 + 模型页 Provider 分组
- `QuotaPerUnit` 语义重定义为 **quota per 1 CNY**；引入显式 `BaseCurrency = CNY`。
- `model_ratio.go` 默认价格表 CNY 化（`USD/RMB` 常量角色互换，默认表以 CNY 基准）。
- 充值链路去 USD 换算：`controller/topup.go:399` 的 `amount × QuotaPerUnit` 直接是 CNY→quota；各支付网关 `Price/StripeUnitPrice` 语义统一 CNY。
- 展示层方向反转（`logger/logger.go`、`controller/billing.go`、`general_setting.go`）：默认 CNY，USD 除汇率派生；`quota_display_type` 默认 `CNY`。
- 模型页"元/刀"双展示（`features/pricing/lib/price.ts`）。
- 模型页改为按 Provider 分组罗列，保留筛选。
- 配齐支付/计费单测。
- **风险：计费红线，全量单测。**

### P2 — 客户折扣（PolicyResolver）
- `customer_policy` 表 + migration。
- `PolicyResolver` 接口 + `TablePolicyResolver`（vendor 折扣，回落 1.0）。
- 折扣注入 `PriceData.AddOtherRatio`；内存缓存写时失效。
- 管理端用户策略矩阵编辑器（增删 `(vendor, model, 折扣)` 行）。
- **风险：计费核心，单测覆盖回落链与叠加语义。**

### P3 — 用户级并发 + RPM
- in-flight 信号量中间件：`distributor` 之后 acquire、`defer` release，跨渠道重试重取。
- 复合键 RPM 限流（复用 `common/limiter`）。
- 按物理渠道 × 模型回落系统默认；Redis/内存双模式。
- 管理端并发/RPM 配置并入策略矩阵。

### P4 — Vendor 对外展示
- 系统开关 `UserVisibleChannel`（默认关）。
- `formatUserLogs`（`model/log.go:116`）保留 vendor 脱敏名（非物理渠道）。
- `GetPricing` 附带 vendor；物理 `ChannelId/Name` 仅管理员可见。

### P5 — 上游 TLS 验签（设计文档，下期实现）
- 产出 `docs/upstream-verification.md`：cc-bridge TLS 留存格式（密文帧 + SSLKEYLOG + 证书链，TTL 默认 5min 可配，返回 `capture_id`）；验证工具形态；存储/内存开销评估；new-api 透传（`Log.Other` 存 `capture_id`）与用户开关 `UserSetting.RecordUpstreamResponse` + 管理端允许模型配置。

### P6 — 全量测试
- 支付/计费单测；Stripe 沙盒端到端；折扣/并发/RPM 端到端；i18n 键完整性校验。

## 4. 横切约束

- **支付/计费红线**：所有货币换算与扣费用 `decimal` 精确计算；任何改动配齐单测；预扣与结算共用同一乘子，防止对不上账。
- **闭源模型防封号**：不修改业务请求体；渠道对外只暴露 vendor 脱敏名，不泄露供应链。
- **原生 i18n**：面向用户文案全部走 i18n key；每 PR 同步补齐前端 7 语种 + 后端 3 语种；利用 `i18n/locales/_reports/_sync-report.json` 校验遗漏。
- **架构长远**：策略解析走 `PolicyResolver` 接口，避免把折扣/限流逻辑散落进计费主干。

## 5. 关键文件索引

- 记账锚：`common/constants.go:62`、`setting/ratio_setting/model_ratio.go:12-24`
- 预扣：`relay/helper/price.go`（`HandleGroupRatio:44` / `ModelPriceHelper:72` / `PerCall:186` / `Tiered:268`）
- 结算：`service/text_quota.go:181`、`pkg/billingexpr/settle.go:11`
- PriceData：`types/price_data.go:16-114`
- 展示：`logger/logger.go:122-173`、`controller/billing.go:48-101`、`setting/operation_setting/general_setting.go:44-91`
- 充值：`controller/topup.go:149-187,397-401`、`controller/topup_stripe.go:399-421`
- 渠道选择：`middleware/distributor.go:32`、`service/channel_select.go:84`、`model/ability.go:18`
- 限流：`middleware/model-rate-limit.go:167`、`common/limiter/limiter.go`、`setting/rate_limit.go`
- 日志：`model/log.go:58`（结构）/`:116`（`formatUserLogs`）
- 模型页：`web/default/src/features/pricing/`
- i18n：`web/default/src/i18n/locales/`、`i18n/keys.go`、`i18n/locales/`
