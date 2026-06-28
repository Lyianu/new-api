package hook

import (
	"time"
)

// Matcher 是钩子的作用域过滤器。每个维度为空表示「不限」;非空表示成员匹配。
// 直接服务「受部分地区法律要求」——给目标地区的请求打 region/group 标签,
// 审计钩子只命中这些请求,其余请求零开销。
type Matcher struct {
	Regions      []string `json:"region,omitempty"`
	Groups       []string `json:"group,omitempty"`
	Models       []string `json:"model,omitempty"`
	ChannelTypes []int    `json:"channelType,omitempty"`
	RelayFormats []string `json:"relayFormat,omitempty"`
}

func containsStr(list []string, v string) bool {
	for _, item := range list {
		if item == v {
			return true
		}
	}
	return false
}

func containsInt(list []int, v int) bool {
	for _, item := range list {
		if item == v {
			return true
		}
	}
	return false
}

// Match 在所有非空维度上做「与」逻辑:每个非空维度都需命中。
func (m Matcher) Match(hc *HookContext) bool {
	if len(m.Regions) > 0 && !containsStr(m.Regions, hc.RegionTag) {
		return false
	}
	if len(m.Groups) > 0 && !containsStr(m.Groups, hc.Group) {
		return false
	}
	if len(m.Models) > 0 && !containsStr(m.Models, hc.ModelName) {
		return false
	}
	if len(m.ChannelTypes) > 0 && !containsInt(m.ChannelTypes, hc.ChannelType) {
		return false
	}
	if len(m.RelayFormats) > 0 && !containsStr(m.RelayFormats, string(hc.RelayFormat)) {
		return false
	}
	return true
}

// Spec 是从 DB 记录解码出来、传给类型工厂的通用参数。
// 类型私有配置在 RawConfig 中,由各工厂自行解析。
type Spec struct {
	Name      string
	Type      string
	Events    []HookEvent
	Mode      ExecMode
	FailMode  FailMode
	Timeout   time.Duration
	Priority  int
	Matcher   Matcher
	RawConfig []byte // ConfigJSON 原文
}

// BaseHook 承载所有钩子共有的配置,实现 Hook 接口中除 Handle 外的全部方法。
type BaseHook struct {
	name     string
	typ      string
	events   []HookEvent
	mode     ExecMode
	failMode FailMode
	timeout  time.Duration
	priority int
	matcher  Matcher
}

// NewBaseHook 从 Spec 构造 BaseHook,集中处理默认值规范化。
func NewBaseHook(s Spec) BaseHook {
	timeout := s.Timeout
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	mode := s.Mode
	if mode != ModeSync && mode != ModeAsync {
		mode = ModeSync
	}
	failMode := s.FailMode
	if failMode != FailClosed && failMode != FailOpen {
		// 同步默认 fail-closed（合规优先）,异步默认 fail-open（可用性优先）。
		if mode == ModeAsync {
			failMode = FailOpen
		} else {
			failMode = FailClosed
		}
	}
	return BaseHook{
		name:     s.Name,
		typ:      s.Type,
		events:   s.Events,
		mode:     mode,
		failMode: failMode,
		timeout:  timeout,
		priority: s.Priority,
		matcher:  s.Matcher,
	}
}

func (b *BaseHook) Name() string             { return b.name }
func (b *BaseHook) Type() string             { return b.typ }
func (b *BaseHook) Events() []HookEvent      { return b.events }
func (b *BaseHook) Mode() ExecMode           { return b.mode }
func (b *BaseHook) FailMode() FailMode       { return b.failMode }
func (b *BaseHook) Priority() int            { return b.priority }
func (b *BaseHook) Timeout() time.Duration   { return b.timeout }
func (b *BaseHook) Match(hc *HookContext) bool { return b.matcher.Match(hc) }
