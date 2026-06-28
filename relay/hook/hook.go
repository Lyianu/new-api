// Package hook 实现 fork 自定义的「中转钩子」系统：在请求中转的关键生命周期节点上,
// 以可配置的方式插入「旁路观察」或「阻断 / 改写」逻辑。
//
// 设计见 docs/hooks-design.md。两个驱动需求——合规审计放行、原始请求留存——是同一套
// 抽象的两种执行策略组合（sync+fail-closed / async+fail-open）。
//
// 本包为纯新增,不修改上游;与上游的集成点集中在 integration.go,并在少量上游文件中以
// // FORK: 标记最小接入。
package hook

import (
	"context"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
)

// HookEvent 是钩子可订阅的生命周期事件。
type HookEvent string

const (
	// EventRequestReceived 解析完客户端请求、选完分组、扣费之前触发。可阻断。
	EventRequestReceived HookEvent = "request.received"
	// EventBeforeUpstream 转换成上游格式、即将发出前触发。可阻断 / 可改写（Phase 2）。
	EventBeforeUpstream HookEvent = "upstream.before"
	// EventAfterUpstream 拿到上游响应后触发。观察 / 可改写非流式（Phase 2）。
	EventAfterUpstream HookEvent = "upstream.after"
	// EventCompleted 计费结算完成后触发。纯观察。
	EventCompleted HookEvent = "request.completed"
	// EventError 任意阶段出错时触发。纯观察。
	EventError HookEvent = "request.error"
)

// ExecMode 决定钩子在关键路径上同步执行,还是异步入队。
type ExecMode string

const (
	ModeSync  ExecMode = "sync"
	ModeAsync ExecMode = "async"
)

// FailMode 决定钩子超时 / 报错时是阻断还是放行。
type FailMode string

const (
	// FailClosed 钩子不可用时阻断请求（合规审计优先）。
	FailClosed FailMode = "closed"
	// FailOpen 钩子不可用时放行请求（归档类可用性优先）。
	FailOpen FailMode = "open"
)

// Decision 是单个钩子对请求的处置意见。
type Decision int

const (
	DecisionContinue Decision = iota // 放行,无意见
	DecisionDeny                     // 阻断,按协议返回错误
	DecisionModify                   // 用 ModifiedBody 替换请求体后继续（Phase 2）
)

// HookResult 是钩子 Handle 的返回决策。
type HookResult struct {
	Decision     Decision
	StatusCode   int    // Deny 时返回给客户端的 HTTP 状态码（默认 403）
	Code         string // Deny 时的错误码
	Message      string // Deny 时的错误信息
	ModifiedBody []byte // Modify 时生效（Phase 2）
}

func cont() *HookResult { return &HookResult{Decision: DecisionContinue} }

// HookContext 贯穿一次中转,承载钩子所需的只读上下文。
// 载荷字段按事件填充,均为只读副本——钩子不得原地修改。
type HookContext struct {
	Event     HookEvent
	RequestID string

	// 主体与路由信息
	UserID      int
	TokenID     int
	ChannelID   int
	ChannelType int
	TokenName   string
	Group       string
	ModelName   string
	RegionTag   string // 由分组 / 渠道标签推导,服务「分地区」诉求
	RelayFormat types.RelayFormat
	RelayMode   int

	// 载荷
	RawRequestBody []byte     // 客户端原始请求体
	ResponseBody   []byte     // 上游响应体（after / completed）
	Usage          *dto.Usage // 用量（after / completed）
	StatusCode     int

	Headers   http.Header // 已脱敏（剔除鉴权头）
	ClientIP  string
	StartTime time.Time

	Attributes map[string]any // 钩子之间传值的便签
}

// Snapshot 返回一个可安全交给异步 worker 的副本。
// 字节切片为只读,浅拷贝即可;Headers / Attributes 做浅复制避免并发读写。
func (hc *HookContext) Snapshot() *HookContext {
	cp := *hc
	if hc.Headers != nil {
		cp.Headers = hc.Headers.Clone()
	}
	if hc.Attributes != nil {
		attrs := make(map[string]any, len(hc.Attributes))
		for k, v := range hc.Attributes {
			attrs[k] = v
		}
		cp.Attributes = attrs
	}
	return &cp
}

// Hook 是所有钩子的统一接口。BaseHook 提供除 Handle 外的默认实现,
// 内置类型（webhook / archive）只需嵌入 BaseHook 并实现 Handle。
type Hook interface {
	Name() string
	Type() string
	Events() []HookEvent
	Mode() ExecMode
	FailMode() FailMode
	Priority() int
	Timeout() time.Duration
	Match(hc *HookContext) bool
	Handle(ctx context.Context, hc *HookContext) (*HookResult, error)
}
