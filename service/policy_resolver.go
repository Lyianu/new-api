package service

import (
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// hasPolicies 标记系统内是否存在任何客户策略。计费/限流热路径先读它（纯原子、无 DB），
// 仅当为 true 时才走 DB 支持的解析，避免在无策略场景引入 DB 依赖与开销，
// 也保证早期/测试环境（DB 未就绪）不会 panic。
var hasPolicies atomic.Bool

// 缓存 TTL：与定价缓存对齐（1 分钟），保证多实例部署下其他节点的策略变更
// 最迟 1 分钟内生效；失败退避避免 DB 故障期间每个请求都打库。
const (
	policyCacheTTL           = time.Minute
	policyCacheRetryInterval = 5 * time.Second
)

// HasCustomerPolicies 返回是否存在任何客户策略（供调用方快路径判断）。
// 内部触发一次 TTL 惰性刷新（缓存新鲜时仅一次 RLock + 原子读，无 DB），
// 使多实例部署下其他节点的策略增删也能在 TTL 内被感知。
// 非默认解析器（SetPolicyResolver 注入的表达式/外部服务/测试实现）自行决定
// 策略存在性，快路径不得替它短路，此时恒返回 true。
func HasCustomerPolicies() bool {
	if activeResolver != defaultPolicyResolver {
		return true
	}
	defaultPolicyResolver.ensureLoaded()
	return hasPolicies.Load()
}

// WarmupPolicyCache 在启动、DB 就绪后调用一次，使 hasPolicies 反映真实状态。
func WarmupPolicyCache() {
	defaultPolicyResolver.ensureLoaded()
}

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
	mu       sync.RWMutex
	byUser   map[int][]*model.CustomerPolicy
	loaded   bool
	lastLoad time.Time // 上次成功加载时间（TTL 起点）
	lastTry  time.Time // 上次尝试加载时间（含失败，用于退避）
}

// fresh 返回缓存是否已加载且未过 TTL。调用方需持有 r.mu（读或写锁）。
func (r *TablePolicyResolver) fresh() bool {
	return r.loaded && time.Since(r.lastLoad) < policyCacheTTL
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

// InvalidatePolicyCache 在策略写入后调用：重置并立即重建缓存，
// 使 hasPolicies 立刻反映最新状态（管理端写操作触发，频率低）。
// 注意仅对本实例即时生效；其他实例依赖 TTL（policyCacheTTL）内的惰性刷新。
func InvalidatePolicyCache() {
	defaultPolicyResolver.mu.Lock()
	defaultPolicyResolver.loaded = false
	defaultPolicyResolver.byUser = nil
	defaultPolicyResolver.lastTry = time.Time{}
	defaultPolicyResolver.mu.Unlock()
	defaultPolicyResolver.ensureLoaded()
}

func (r *TablePolicyResolver) ensureLoaded() {
	r.mu.RLock()
	if r.fresh() {
		r.mu.RUnlock()
		return
	}
	r.mu.RUnlock()

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.fresh() {
		return
	}
	// 失败退避：加载出错后 retryInterval 内沿用旧缓存，避免 DB 故障时每请求打库。
	if time.Since(r.lastTry) < policyCacheRetryInterval {
		return
	}
	r.lastTry = time.Now()
	all, err := model.GetAllCustomerPolicies()
	if err != nil {
		// 计费安全：出错时保留旧缓存与 hasPolicies，绝不静默清空策略
		//（清空意味着折扣与限流全部失效），并显式记录。
		common.SysError("加载客户策略缓存失败（沿用旧缓存）: " + err.Error())
		return
	}
	byUser := make(map[int][]*model.CustomerPolicy)
	for _, p := range all {
		byUser[p.UserId] = append(byUser[p.UserId], p)
	}
	r.byUser = byUser
	r.loaded = true
	r.lastLoad = time.Now()
	hasPolicies.Store(len(byUser) > 0)
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
