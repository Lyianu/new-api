package setting

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

// 分组×模型限流：按「分组 + 模型模式」配置并发(in-flight)与 RPM 上限，
// 对分组内的**每个用户各自**生效（例：default 分组对 claude-* 配 5 并发，
// 则该分组每个用户调用 claude 系模型时各有 5 并发，而非全组共享 5）。
//
// 模型模式支持：精确("claude-3-opus")、前缀("claude-*")、通配(""/"*")。
// 同一分组多条规则命中时按 specificity 取最具体者（精确 > 前缀 > 通配），
// 并发与 RPM 各自独立回落。限流计数键使用「命中规则的模式」而非具体模型名，
// 因此同一条规则（如 claude-*）覆盖的所有模型共享一个计数器。
//
// 执行侧见 middleware.GroupModelLimit / service.AcquireInflight、AllowRpm。

// GroupModelLimitRule 是一条「模型模式 → 限额」规则。0 表示不限。
type GroupModelLimitRule struct {
	Model          string `json:"model"`
	MaxConcurrency int    `json:"max_concurrency"`
	RpmLimit       int    `json:"rpm_limit"`
}

var (
	groupModelLimits      = map[string][]GroupModelLimitRule{}
	groupModelLimitsMutex sync.RWMutex
)

func GroupModelLimits2JSONString() string {
	groupModelLimitsMutex.RLock()
	defer groupModelLimitsMutex.RUnlock()
	jsonBytes, err := json.Marshal(groupModelLimits)
	if err != nil {
		return "{}"
	}
	return string(jsonBytes)
}

func UpdateGroupModelLimitsByJSONString(jsonStr string) error {
	parsed := map[string][]GroupModelLimitRule{}
	if strings.TrimSpace(jsonStr) != "" {
		if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil {
			return err
		}
	}
	groupModelLimitsMutex.Lock()
	defer groupModelLimitsMutex.Unlock()
	groupModelLimits = parsed
	return nil
}

// CheckGroupModelLimits 校验 JSON 合法性与取值范围（负数无意义，直接拒绝）。
func CheckGroupModelLimits(jsonStr string) error {
	parsed := map[string][]GroupModelLimitRule{}
	if strings.TrimSpace(jsonStr) == "" {
		return nil
	}
	if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil {
		return err
	}
	for group, rules := range parsed {
		for _, r := range rules {
			if r.MaxConcurrency < 0 || r.RpmLimit < 0 {
				return fmt.Errorf("分组 %q 模型 %q：限额不允许为负数", group, r.Model)
			}
		}
	}
	return nil
}

// groupModelMatchSpecificity 返回规则模式对目标模型名的匹配度：
// -1 = 不匹配；0 = 通配(""/"*")；1 = 前缀("claude-*")；2 = 精确。
func groupModelMatchSpecificity(rule, target string) int {
	rule = strings.TrimSpace(rule)
	if rule == "" || rule == "*" {
		return 0
	}
	if strings.HasSuffix(rule, "*") {
		if strings.HasPrefix(target, strings.TrimSuffix(rule, "*")) {
			return 1
		}
		return -1
	}
	if rule == target {
		return 2
	}
	return -1
}

// ResolvedGroupModelLimit 是解析结果；RuleModel 记录命中规则的模式，
// 供限流键使用（同规则覆盖的模型共享计数器）。零值 = 不限。
type ResolvedGroupModelLimit struct {
	MaxConcurrency  int
	ConcurrencyRule string
	RpmLimit        int
	RpmRule         string
}

// ResolveGroupModelLimit 解析某分组下某模型的限额。
// 并发与 RPM 各自取「命中且设置了该项」的最具体规则；同 specificity 后配置靠前者优先。
func ResolveGroupModelLimit(group, modelName string) ResolvedGroupModelLimit {
	groupModelLimitsMutex.RLock()
	rules := groupModelLimits[group]
	groupModelLimitsMutex.RUnlock()

	res := ResolvedGroupModelLimit{}
	scConc, scRpm := -1, -1
	for _, r := range rules {
		sc := groupModelMatchSpecificity(r.Model, modelName)
		if sc < 0 {
			continue
		}
		if r.MaxConcurrency > 0 && sc > scConc {
			res.MaxConcurrency, res.ConcurrencyRule, scConc = r.MaxConcurrency, r.Model, sc
		}
		if r.RpmLimit > 0 && sc > scRpm {
			res.RpmLimit, res.RpmRule, scRpm = r.RpmLimit, r.Model, sc
		}
	}
	return res
}

// HasGroupModelLimits 供热路径快速短路：无任何规则时限流中间件近零开销。
func HasGroupModelLimits() bool {
	groupModelLimitsMutex.RLock()
	defer groupModelLimitsMutex.RUnlock()
	return len(groupModelLimits) > 0
}
