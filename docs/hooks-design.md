# 自定义钩子系统设计 (Custom Hooks)

> FORK 自定义功能设计文档。本特性为本仓库 fork 在上游 `github.com/QuantumNous/new-api` 之上叠加的自定义能力,
> 遵循 `CLAUDE.md` 的 fork 工程约束:**优先新增文件,核心文件只加最少行并以 `// FORK:` 标记**。
>
> 状态:设计阶段(Design)。开发分支:`feature/custom-hooks`。

## 1. 背景与目标

new-api 是一个把 40+ 上游 AI 提供商统一在一套 API 之后的网关。在中转(relay)的关键生命周期节点,
我们需要一套**可配置的拦截器(Hook)**,既能"旁路观察"也能"阻断/改写"请求。

### 1.1 业务驱动需求

1. **合规审计放行**:受部分地区法律要求,请求需先发往审计服务,根据审计返回结果决定是否放行。
2. **原始请求留存**:受监管要求,需将所有原始请求保存一段时间,发往 ES 或其他服务。

### 1.2 设计原则

这两个需求是同一套抽象的两种**执行策略**:

| 需求 | 执行模型 | 失败策略 |
|------|----------|----------|
| 审计放行 | 同步(`sync`)、可阻断 | `fail-closed`(合规优先) |
| 原始请求留存 | 异步(`async`)、不阻断 | `fail-open`(可用性优先) |

把"同步/异步""阻断/放行""失败策略"做成正交配置项,框架就自然泛化——以后加敏感词替换、请求改写、
指标上报、人工审批,都不必改框架。

### 1.3 已确认的关键决策

| 决策 | 选择 | 影响 |
|------|------|------|
| 扩展形态 | **外部 Webhook 优先** | 框架重心是稳定 JSON 信封 + 调度器;大多数钩子是外部 HTTP 服务,无需改 Go、不重编译 |
| 审计降级 | **按钩子/地区分别配置** | 不设全局默认,`failMode` 是每条钩子记录上的字段,配合 match 规则的 region 列表区分 |
| 配置来源 | **数据库 + 管理后台 UI** | 配置存 DB、后台可视化编辑、热加载;前端新增页面(唯一较重的 fork 触点) |

## 2. 核心抽象

### 2.1 生命周期事件(挂载点)

```go
type HookEvent string

const (
    EventRequestReceived HookEvent = "request.received" // 解析完客户端请求、选完 channel、扣费之前 —— 可阻断
    EventBeforeUpstream  HookEvent = "upstream.before"  // 转换成上游格式、即将发出 —— 可阻断/可改写
    EventAfterUpstream   HookEvent = "upstream.after"   // 拿到上游响应(含 usage)—— 观察/可改写(非流式)
    EventStreamChunk     HookEvent = "stream.chunk"     // 流式每个 SSE 分片(高级,Phase 3)
    EventCompleted       HookEvent = "request.completed"// 计费结算完成 —— 纯观察
    EventError           HookEvent = "request.error"    // 任意阶段出错
)
```

需求映射:

- 需求 1(审计)挂 `request.received`:此点已有原始 prompt + 用户 + 模型 + channel,且在扣费之前,阻断不产生计费。
- 需求 2(归档)挂 `request.received`(归档请求);可选叠加 `request.completed`(把响应/用量一起归档)。

### 2.2 Hook 接口

```go
type Hook interface {
    Name() string
    Events() []HookEvent              // 订阅哪些事件
    Match(hc *HookContext) bool       // 作用域过滤(地区/分组/模型/channel)
    Handle(ctx context.Context, hc *HookContext) (*HookResult, error)
}
```

### 2.3 HookContext(贯穿的数据载体)

复用现有 `RelayInfo` 与 body storage,不重复读 body。

```go
type HookContext struct {
    Event       HookEvent
    RequestID   string

    // 主体信息
    UserID, TokenID, ChannelID, ChannelType int
    TokenName, Group, ModelName             string
    RegionTag                               string // 由 group / channel 标签 / IP geo 推导,服务"分地区"诉求
    RelayFormat types.RelayFormat
    RelayMode   int

    // 载荷(按事件填充,均为只读副本)
    RawRequestBody []byte    // 客户端原始体
    UpstreamBody   []byte    // 转换后即将上行的体(upstream.before)
    ResponseBody   []byte    // 上游响应体(upstream.after / completed;流式见 §7)
    Usage          *dto.Usage
    StatusCode     int

    Headers   http.Header // 已脱敏(剔除 Authorization / x-api-key / x-goog-api-key)
    ClientIP  string
    StartTime time.Time

    Attributes map[string]any // 钩子之间传值的便签
}
```

### 2.4 HookResult(决策)

```go
type Decision int

const (
    DecisionContinue Decision = iota // 放行,无意见
    DecisionDeny                     // 阻断,按协议返回错误
    DecisionModify                   // 用 ModifiedBody 替换后继续
)

type HookResult struct {
    Decision     Decision
    StatusCode   int    // Deny 时返回给客户端的状态码
    Code         string // 错误码
    Message      string // 错误信息(按 OpenAI / Claude / Gemini 协议格式化)
    ModifiedBody []byte // Modify 时生效
}
```

### 2.5 执行策略(每条钩子独立配置 —— 泛化的关键)

| 维度 | 取值 | 说明 |
|------|------|------|
| `Mode` | `sync` / `async` | 同步在关键路径、能阻断;异步入队、不影响延迟 |
| `FailMode` | `closed` / `open` | 钩子超时/报错:closed=阻断(审计),open=放行(归档)。**按钩子/地区独立** |
| `Timeout` | 如 800ms | 每钩子独立超时 |
| `Priority` | int | 同步钩子按序执行,首个 Deny 短路 |

需求 1 = `sync + closed`;需求 2 = `async + open`。同一套接口,配置差异而已。

## 3. 调度器(Manager)

```go
func (m *Manager) Dispatch(ctx context.Context, hc *HookContext) *HookResult {
    for _, h := range m.subscribed[hc.Event] { // 已按 Priority 排序
        if !h.Match(hc) {
            continue
        }
        if h.Mode == ModeAsync {
            m.enqueue(h, hc.Snapshot()) // 入有界队列,worker 池消费,panic-recover
            continue
        }
        res, err := runWithTimeout(ctx, h, hc) // 同步
        if err != nil {
            if h.FailMode == FailClosed {
                return deny(503, "HOOK_UNAVAILABLE", "audit unavailable")
            }
            logError(err) // fail-open
            continue
        }
        switch res.Decision {
        case DecisionDeny:
            return res // 短路
        case DecisionModify:
            hc.ApplyPatch(res)
        }
    }
    return cont()
}
```

要点:

- 同步钩子按 `Priority` 串行,**首个 Deny 立即短路**返回。
- 异步钩子永远不阻断;入有界队列,由 worker 池消费,每次执行 panic-recover。
- `fail-closed` 钩子超时即视为 Deny;`fail-open` 仅记录告警后继续。

## 4. 泛化机制

### 4.1 通用外部 Webhook 协议(重心)

本项目**没有运行时插件机制**(主题仅 default/classic 硬编码,无动态加载)。因此"无需重新编译即可扩展"的
唯一路径是**把钩子做成网络协议**:大多数钩子不写 Go,而是实现一个外部 HTTP 服务,new-api 用一份**稳定 JSON 信封**调用它。

**请求信封(new-api → 外部钩子):**

```jsonc
POST {hook_endpoint}
{
  "event": "request.received",
  "requestId": "...",
  "timestamp": "2026-06-28T12:00:00Z",
  "principal": { "userId": 12, "tokenName": "t1", "group": "cn-east" },
  "route":     { "relayFormat": "openai", "model": "gpt-4o", "channelId": 3, "channelType": 1 },
  "client":    { "ip": "1.2.3.4" },
  "request":   { "headers": { /* 已脱敏 */ }, "body": { /* 原始 JSON */ } },
  "response":  null
}
```

**响应信封(外部钩子 → new-api):**

```jsonc
HTTP/1.1 200 OK
{
  "decision": "allow",                 // "allow" | "deny" | "modify"
  "status": 403,                       // deny 时返回给客户端的状态码
  "code": "AUDIT_BLOCKED",             // deny 时错误码
  "message": "blocked by regional audit", // deny 时错误信息
  "patch": { /* ... */ }               // modify 时的请求体补丁
}
```

- 审计服务:实现此端点,**同步**调用,返回 allow/deny。
- ES 归档:可用内置 `archive` 直写 ES,或也走此信封发给一个 collector(**异步**、忽略返回)。
- 以后任何新钩子 = 新起一个外部服务,**完全不碰 new-api 代码、不重编译**。这就是"最泛化"。

### 4.2 进程内钩子工厂(内置类型)

```go
RegisterHookType("webhook", NewWebhookHook) // 通用信封,主力
RegisterHookType("archive", NewArchiveHook) // ES/HTTP/Kafka 批量投递 + 磁盘 spill
```

加新内置类型 = `relay/hook/builtin/` 下新增一个文件 + 一行注册。对 fork 是**纯新增、零冲突**。

> 注:`archive` 之所以保留为进程内类型(而非也走外部 collector),是因为可靠投递(批量、磁盘 spill、ES 抖动补发)
> 在进程内实现更稳,且免去额外部署一个 collector。

### 4.3 作用域匹配器(直接服务"部分地区")

每条钩子带 matcher,支持 `region` / `group` / `model` / `channelType` / `relayFormat` 任意组合。
"受部分地区法律要求" → 给该地区的 token 打 group 标签或给 channel 打 region 标签,审计钩子 `Match` 只命中这些请求,
其余请求零开销。

## 5. 可靠性与性能

- **同步审计在关键路径**:超时要紧(几百 ms),配熔断器。审计服务挂掉且 `fail-closed` 时,
  是"全量阻断"还是"降级放行"由该钩子自己的 `failMode` 决定(不同地区可不同)。
- **异步归档不丢数据**:有界队列 + worker 池 + **本地磁盘 spill(WAL)**;ES 抖动时落盘补发,满足监管留存的可靠性。
  支持批量(ES `_bulk`)。
- **采样与裁剪**:归档支持采样率、字段裁剪、body 大小上限,控制带宽。
- **脱敏**:信封强制剔除 `Authorization` / `x-api-key` / `x-goog-api-key`;prompt 内容本身敏感,外发走 mTLS。
- **熔断**:外部钩子加熔断器,避免审计宕机时持续打满;`fail-open` 熔断后直接放行,`fail-closed` 熔断后按策略阻断。

## 6. 与代码的集成(fork 友好)

### 6.1 新增文件(零冲突)

```
relay/hook/
  hook.go            接口 / 事件 / Context / Result
  manager.go         注册 + Dispatch(sync/async/failmode)
  envelope.go        外部 webhook 信封(稳定契约)
  config.go          从 DB 加载 + 内存缓存 + 热加载
  transport.go       Transport 接口 + HTTP 实现
  queue.go           异步队列 + 磁盘 spill
  builtin/
    webhook.go       通用外部钩子(信封)
    archive.go       异步 ES/HTTP/Kafka 归档
model/hook_config.go CRUD 数据模型(GORM)
controller/hook_config.go 后台 CRUD 处理器
router/hook-router.go     后台管理路由(新建,SetHookRouter)
```

### 6.2 上游文件改动(全部 `// FORK:` 标记,只加不改)

| 文件 | 改动 | 约行数 |
|------|------|--------|
| `controller/relay.go` | `GenRelayInfo` 后插 `hook.Dispatch(request.received)`,Deny 走现成协议化错误返回 | 6–8 |
| `relay/relay_adaptor.go` | `GetAdaptor` 返回前 `hook.WrapAdaptor()`(Phase 2 用) | 3 |
| `main.go` | `hook.Init()` 启动加载 | 1 |
| `model/main.go` | AutoMigrate 注册 `HookConfig` | 1 |
| `router/main.go` | 调用新建的 `SetHookRouter()` | 1 |

`controller.Relay` 是 OpenAI / Claude / Gemini 等**所有格式的统一汇聚点**,一个挂载点即覆盖需求 1 与需求 2 的请求侧。
`GetAdaptor` 是所有 provider / 所有 relay 模式的工厂返回点,包一层装饰器即给全部上游调用套上 `before/after` 钩子,
无需改每个 helper。

### 6.3 前端(唯一较重的 fork 触点)

DB + UI 决策带来的主要成本在前端。加一个管理页要碰**菜单注册**与**路由注册**两个上游文件(各几行),其余是新建组件树:

- 新建 `web/default/src/pages/Hook/`(列表页 + CRUD 表单),纯新增。
- 上游触点:侧边栏菜单配置、前端路由表各加一条,标 `// FORK:`,只加不改。
- i18n 走 `t('English key')`,新增 key 进 `web/default/src/i18n/locales/{lang}.json`。

> 建议:做成**独立页面**(而非塞进现有"系统设置"的 tab),与上游设置页几乎不交叠,同步上游时冲突面最小。

## 7. 数据模型与配置

### 7.1 HookConfig(新文件 `model/hook_config.go`)

```go
// FORK: 自定义钩子配置
type HookConfig struct {
    Id         int    `gorm:"primaryKey"`
    Name       string `gorm:"size:128;uniqueIndex"`
    Type       string `gorm:"size:32"`   // "webhook" | "archive"
    Enabled    bool
    Events     string `gorm:"type:text"` // JSON: ["request.received", ...]
    Mode       string `gorm:"size:16"`   // "sync" | "async"
    FailMode   string `gorm:"size:16"`   // "closed" | "open" —— 每条独立
    TimeoutMs  int
    Priority   int
    MatchJSON  string `gorm:"type:text"` // JSON: {region:[..],group:[..],model:[..]}
    ConfigJSON string `gorm:"type:text"` // 类型私有:webhook={url,headers}; archive={sink,endpoint,index,...}
    CreatedAt  int64
    UpdatedAt  int64
}
```

跨数据库约束(SQLite / MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6):

- 全部用 `TEXT` 存 JSON,**不使用 DB 专属 JSON 列类型**。
- **不使用** `gorm:"default:..."` 布尔 tag(避免 AutoMigrate 反复 `ALTER TABLE`),默认值在构造 / 规范化时给。
- JSON 编解码一律走 `common.Marshal` / `common.Unmarshal`(禁止直接 `encoding/json`)。
- 迁移走 GORM `AutoMigrate`;SQLite 加列用 `ALTER TABLE ... ADD COLUMN`。

### 7.2 配置示例(后台编辑,落库为上述记录)

```jsonc
[
  {
    "name": "cn-audit",
    "type": "webhook",
    "enabled": true,
    "events": ["request.received"],
    "mode": "sync",
    "failMode": "closed",
    "timeoutMs": 800,
    "priority": 10,
    "match":  { "region": ["cn-east", "cn-south"] },
    "config": { "url": "https://audit.internal/check" }
  },
  {
    "name": "raw-archive",
    "type": "archive",
    "enabled": true,
    "events": ["request.received"],
    "mode": "async",
    "failMode": "open",
    "priority": 100,
    "match":  {},
    "config": {
      "sink": "elasticsearch",
      "endpoint": "http://es:9200",
      "index": "llm-req-%Y.%m.%d",
      "batchSize": 200,
      "spillDir": "/var/lib/newapi/hookwal"
    }
  }
]
```

### 7.3 热加载

钩子配置存 DB → 内存维护一份编译好的 pipeline,带 version 戳。后台改动后用 **Redis pub/sub 或轮询 version**
(复用项目已有 Redis)让多实例刷新。整套刷新逻辑封在 `relay/hook` 包内,**不动上游 options 设置同步代码**。

## 8. 分期实施

| 阶段 | 内容 | 产出 |
|------|------|------|
| **Phase 1** | `relay/hook` 核心(接口/Manager/Context/信封)+ `request.received` 挂载点 + `webhook` 同步审计 + `archive` 异步 ES(批量+磁盘 spill)+ `HookConfig` model + 后端 CRUD API | **满足两个需求的最小闭环** |
| **Phase 1.5** | 管理后台 UI 页面 | 可视化增删改查 + 热加载 |
| **Phase 2** | adaptor 装饰器 → `upstream.before` / `upstream.after` + `DecisionModify` 改写 + Kafka sink | 请求/响应改写能力 |
| **Phase 3** | 流式响应 tee、熔断器、指标可观测 | 生产级可观测与韧性 |

## 9. 安全与合规注意

- 信封外发的 prompt 内容高度敏感:强制脱敏鉴权头,传输走 mTLS,审计/归档端点应在可信网络内。
- `fail-closed` 钩子的可用性直接影响业务可用性:务必为审计服务配冗余 + 熔断 + 告警。
- 留存数据的保留期(retention)由下游(ES ILM 等)负责,new-api 侧只负责可靠投递与索引命名。

## 10. Fork 合规

- 全部新增逻辑置于新建包/文件;核心文件改动以 `// FORK:` 标记且只加最少行。
- 不修改 `go.mod` module path(保持 `github.com/QuantumNous/new-api`)。
- 不触碰上游品牌 / 版权 / footer / meta 等受保护标识。
- 在 `feature/custom-hooks` 分支开发,定期 `git fetch upstream && git rebase upstream/main` 同步。
