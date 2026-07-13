package service

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/model"
)

// PolicyContext 是策略解析的输入上下文，字段均可从 RelayInfo 取得。
type PolicyContext struct {
	UserId    int
	Group     string
	VendorId  int // 折扣维度：由 modelName → vendor 映射得到
	ChannelId int // 并发/RPM 维度：物理渠道
	ModelName string
}

// ResolvedPolicy 是解析结果。零值即系统默认（不打折、不限并发、用分组默认 RPM）。
type ResolvedPolicy struct {
	DiscountRatio  float64 // 1.0 = 原价（再乘在分组价之上）
	MaxConcurrency int     // 0 = 不限
	RpmLimit       int     // 0 = 用分组默认
}

// SystemDefaultPolicy 是查不到任何规则时的系统默认。
func SystemDefaultPolicy() ResolvedPolicy {
	return ResolvedPolicy{DiscountRatio: 1.0, MaxConcurrency: 0, RpmLimit: 0}
}

// PolicyResolver 把「折扣 / 并发 / RPM 取什么值」抽象到接口后面，
// 调用方（计费、限流中间件）只问结果、不关心算法，便于将来整体替换为
// 表达式 / 外部服务等任意实现。
type PolicyResolver interface {
	Resolve(ctx PolicyContext) ResolvedPolicy
}

// ---- 纯回落逻辑（无 DB 依赖，可单测）----

// modelMatchSpecificity 返回规则模型名对目标模型名的匹配specificity：
//
//	-1 = 不匹配；0 = 通配("" / "*")；1 = 前缀("claude-*")；2 = 精确
func modelMatchSpecificity(rule, target string) int {
	rule = strings.TrimSpace(rule)
	if rule == "" || rule == "*" {
		return 0
	}
	if strings.HasSuffix(rule, "*") {
		prefix := strings.TrimSuffix(rule, "*")
		if strings.HasPrefix(target, prefix) {
			return 1
		}
		return -1
	}
	if rule == target {
		return 2
	}
	return -1
}

// ruleMatches 判断规则是否命中上下文，并返回specificity分（越大越具体）。
// 不命中返回 (0,false)。
func ruleMatches(p *model.CustomerPolicy, ctx PolicyContext) (int, bool) {
	if p.VendorId != 0 && p.VendorId != ctx.VendorId {
		return 0, false
	}
	if p.ChannelId != 0 && p.ChannelId != ctx.ChannelId {
		return 0, false
	}
	ms := modelMatchSpecificity(p.ModelName, ctx.ModelName)
	if ms < 0 {
		return 0, false
	}
	score := ms
	if p.VendorId != 0 {
		score += 2
	}
	if p.ChannelId != 0 {
		score += 2
	}
	return score, true
}

// betterThan 判断候选 (score,p) 是否比当前最优 (bestScore,best) 更优。
// 优先级：specificity分 > Priority > Id（均取更大者）。
func betterThan(score int, p *model.CustomerPolicy, bestScore int, best *model.CustomerPolicy) bool {
	if best == nil {
		return true
	}
	if score != bestScore {
		return score > bestScore
	}
	if p.Priority != best.Priority {
		return p.Priority > best.Priority
	}
	return p.Id > best.Id
}

// ResolvePolicyRows 是纯回落解析：对折扣 / 并发 / RPM 三项各自挑选
// 「命中且设置了该项」的最具体规则；任一项无命中则回落系统默认。
func ResolvePolicyRows(rows []*model.CustomerPolicy, ctx PolicyContext) ResolvedPolicy {
	res := SystemDefaultPolicy()

	var bestDiscount, bestConc, bestRpm *model.CustomerPolicy
	var scDiscount, scConc, scRpm int

	for _, p := range rows {
		score, ok := ruleMatches(p, ctx)
		if !ok {
			continue
		}
		if p.DiscountRatio > 0 && betterThan(score, p, scDiscount, bestDiscount) {
			bestDiscount, scDiscount = p, score
		}
		if p.MaxConcurrency > 0 && betterThan(score, p, scConc, bestConc) {
			bestConc, scConc = p, score
		}
		if p.RpmLimit > 0 && betterThan(score, p, scRpm, bestRpm) {
			bestRpm, scRpm = p, score
		}
	}

	if bestDiscount != nil {
		res.DiscountRatio = bestDiscount.DiscountRatio
	}
	if bestConc != nil {
		res.MaxConcurrency = bestConc.MaxConcurrency
	}
	if bestRpm != nil {
		res.RpmLimit = bestRpm.RpmLimit
	}
	return res
}

// ---- 表驱动实现（带内存缓存，写时失效）----

type TablePolicyResolver struct {
	mu     sync.RWMutex
	byUser map[int][]*model.CustomerPolicy
	loaded bool
}

var defaultPolicyResolver = &TablePolicyResolver{}

// activeResolver 是当前生效的解析器，默认表驱动，可在启动时或测试中替换为其他实现
// （表达式 / 外部服务等），从而不改动计费/限流调用点即可切换折扣计算方式。
var activeResolver PolicyResolver = defaultPolicyResolver

// GetPolicyResolver 返回当前生效的解析器。
func GetPolicyResolver() PolicyResolver {
	return activeResolver
}

// SetPolicyResolver 替换当前生效的解析器（传 nil 则回退默认表驱动实现）。
func SetPolicyResolver(r PolicyResolver) {
	if r == nil {
		activeResolver = defaultPolicyResolver
		return
	}
	activeResolver = r
}

// InvalidatePolicyCache 在策略写入后调用，下次 Resolve 时重建缓存。
func InvalidatePolicyCache() {
	defaultPolicyResolver.mu.Lock()
	defaultPolicyResolver.loaded = false
	defaultPolicyResolver.byUser = nil
	defaultPolicyResolver.mu.Unlock()
}

func (r *TablePolicyResolver) ensureLoaded() {
	r.mu.RLock()
	if r.loaded {
		r.mu.RUnlock()
		return
	}
	r.mu.RUnlock()

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.loaded {
		return
	}
	all, err := model.GetAllCustomerPolicies()
	byUser := make(map[int][]*model.CustomerPolicy)
	if err == nil {
		for _, p := range all {
			byUser[p.UserId] = append(byUser[p.UserId], p)
		}
	}
	r.byUser = byUser
	r.loaded = true
}

func (r *TablePolicyResolver) Resolve(ctx PolicyContext) ResolvedPolicy {
	r.ensureLoaded()
	r.mu.RLock()
	rows := r.byUser[ctx.UserId]
	r.mu.RUnlock()
	if len(rows) == 0 {
		return SystemDefaultPolicy()
	}
	return ResolvePolicyRows(rows, ctx)
}
