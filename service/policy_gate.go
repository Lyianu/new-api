package service

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// 合规文档门禁：当某文档的最新版本标记了"未确认前暂停服务"且用户尚未
// 确认该版本时，阻断其 relay 调用（网页控制台不阻断——用户必须能登录
// 网页完成确认）。
//
// 缓存策略：
//   - 最新版本表：全局缓存 30s（发布是低频操作，多副本间最迟 30s 收敛）
//   - 用户确认状态：仅当存在阻断版本时才查询，结果缓存 60s；
//     用户完成确认后主动失效，即时恢复服务

const (
	latestPolicyTTL  = 30 * time.Second
	userAcceptTTL    = 60 * time.Second
	acceptCacheLimit = 100000 // 上限保护，超出后整体重置
)

type latestPolicyCache struct {
	mu        sync.RWMutex
	fetchedAt time.Time
	blocking  map[string]int // docType -> 需确认的最新版本（仅含 block 标记的）
}

var policyLatest latestPolicyCache

type userAcceptEntry struct {
	blocked   bool
	expiresAt time.Time
}

var (
	userAcceptMu    sync.RWMutex
	userAcceptCache = make(map[int]userAcceptEntry)
)

// blockingVersions 返回当前带阻断标记的最新版本集合（带缓存）。
func blockingVersions() map[string]int {
	policyLatest.mu.RLock()
	if time.Since(policyLatest.fetchedAt) < latestPolicyTTL {
		b := policyLatest.blocking
		policyLatest.mu.RUnlock()
		return b
	}
	policyLatest.mu.RUnlock()

	policyLatest.mu.Lock()
	defer policyLatest.mu.Unlock()
	if time.Since(policyLatest.fetchedAt) < latestPolicyTTL {
		return policyLatest.blocking
	}
	latest, err := model.GetLatestPolicyVersions()
	if err != nil {
		// 查询失败 fail-open：合规门禁不能因数据库抖动误伤全量调用
		common.SysError("policy gate: failed to load latest policies: " + err.Error())
		policyLatest.fetchedAt = time.Now()
		policyLatest.blocking = nil
		return nil
	}
	blocking := make(map[string]int)
	for _, pv := range latest {
		if pv.BlockUntilAccept {
			blocking[pv.DocType] = pv.Version
		}
	}
	policyLatest.fetchedAt = time.Now()
	policyLatest.blocking = blocking
	return blocking
}

// InvalidatePolicyCaches 发布新版本后调用，立即刷新全局缓存。
func InvalidatePolicyCaches() {
	policyLatest.mu.Lock()
	policyLatest.fetchedAt = time.Time{}
	policyLatest.mu.Unlock()
	userAcceptMu.Lock()
	userAcceptCache = make(map[int]userAcceptEntry)
	userAcceptMu.Unlock()
}

// InvalidateUserPolicyCache 用户完成确认后调用，即时恢复其服务。
func InvalidateUserPolicyCache(userId int) {
	userAcceptMu.Lock()
	delete(userAcceptCache, userId)
	userAcceptMu.Unlock()
}

// IsUserPolicyBlocked 判断用户是否因未确认阻断性协议而暂停服务。
// 常态（无阻断版本）零数据库开销。
func IsUserPolicyBlocked(userId int) bool {
	blocking := blockingVersions()
	if len(blocking) == 0 {
		return false
	}

	userAcceptMu.RLock()
	if e, ok := userAcceptCache[userId]; ok && time.Now().Before(e.expiresAt) {
		userAcceptMu.RUnlock()
		return e.blocked
	}
	userAcceptMu.RUnlock()

	accepted, err := model.GetUserAcceptedVersions(userId)
	if err != nil {
		common.SysError("policy gate: failed to load user acceptance: " + err.Error())
		return false // fail-open
	}
	blocked := false
	for docType, ver := range blocking {
		if accepted[docType] < ver {
			blocked = true
			break
		}
	}

	userAcceptMu.Lock()
	if len(userAcceptCache) >= acceptCacheLimit {
		userAcceptCache = make(map[int]userAcceptEntry)
	}
	userAcceptCache[userId] = userAcceptEntry{
		blocked:   blocked,
		expiresAt: time.Now().Add(userAcceptTTL),
	}
	userAcceptMu.Unlock()
	return blocked
}
