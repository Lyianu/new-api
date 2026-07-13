package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// 用户级并发(in-flight) 与 RPM 限流。
// 并发采用「有序集合 + 惰性剔除过期成员」实现，天然抗泄漏（release 未执行也会在
// inflightMaxHoldSeconds 后自动回收）。Redis 版用 Lua 保证「计数+占用」原子。
// RPM 采用按分钟的固定窗口计数。二者均支持 Redis(多实例) / 内存(单实例) 双模式。

const (
	inflightMaxHoldSeconds = 600 // 并发槽最长持有时间(秒)，防 release 泄漏
	inflightKeyPrefix      = "inflight:"
	rpmKeyPrefix           = "rpm:"
)

// acquireInflightScript：原子地剔除过期成员、计数、未超限则占用。返回 1=成功 0=超限。
// KEYS[1]=zset key；ARGV: now(纳秒) minScore limit member ttl(秒)
var acquireInflightScript = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[2])
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[3]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[5])
return 1
`

// ---- 内存实现 ----

type memInflight struct {
	mu      sync.Mutex
	members map[string]map[string]int64 // key -> (member -> unixNano)
}

var memInflightStore = &memInflight{members: make(map[string]map[string]int64)}

func (m *memInflight) acquire(key, member string, limit int) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	set := m.members[key]
	if set == nil {
		set = make(map[string]int64)
		m.members[key] = set
	}
	cutoff := time.Now().Add(-inflightMaxHoldSeconds * time.Second).UnixNano()
	for mem, ts := range set {
		if ts < cutoff {
			delete(set, mem)
		}
	}
	if len(set) >= limit {
		return false
	}
	set[member] = time.Now().UnixNano()
	return true
}

func (m *memInflight) release(key, member string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if set := m.members[key]; set != nil {
		delete(set, member)
		if len(set) == 0 {
			delete(m.members, key)
		}
	}
}

// AcquireInflight 尝试占用一个并发槽。limit<=0 表示不限。
// 返回 (是否成功, 释放函数)；释放函数总是安全可调用（失败时为 no-op）。
func AcquireInflight(key string, limit int) (bool, func()) {
	if limit <= 0 {
		return true, func() {}
	}
	member := common.GetRandomString(20)

	if common.RedisEnabled && common.RDB != nil {
		ctx := context.Background()
		now := time.Now().UnixNano()
		minScore := now - int64(inflightMaxHoldSeconds)*int64(time.Second)
		zkey := inflightKeyPrefix + key
		res, err := common.RDB.Eval(ctx, acquireInflightScript,
			[]string{zkey},
			now, minScore, limit, member, inflightMaxHoldSeconds).Result()
		if err != nil {
			// Redis 异常时不阻断业务（放行），避免限流器故障影响可用性。
			common.SysError("inflight acquire redis error: " + err.Error())
			return true, func() {}
		}
		if n, ok := res.(int64); ok && n == 1 {
			return true, func() {
				common.RDB.ZRem(context.Background(), zkey, member)
			}
		}
		return false, func() {}
	}

	if memInflightStore.acquire(key, member, limit) {
		return true, func() { memInflightStore.release(key, member) }
	}
	return false, func() {}
}

// ---- RPM：按分钟固定窗口 ----

type memRpm struct {
	mu      sync.Mutex
	windows map[string]*rpmWindow
}

type rpmWindow struct {
	minute int64
	count  int
}

var memRpmStore = &memRpm{windows: make(map[string]*rpmWindow)}

func (m *memRpm) allow(key string, limit int) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	minute := time.Now().Unix() / 60
	w := m.windows[key]
	if w == nil || w.minute != minute {
		m.windows[key] = &rpmWindow{minute: minute, count: 1}
		return true
	}
	if w.count >= limit {
		return false
	}
	w.count++
	return true
}

// AllowRpm 返回是否允许（未超过每分钟 limit 次）。limit<=0 表示不限。
func AllowRpm(key string, limit int) bool {
	if limit <= 0 {
		return true
	}

	if common.RedisEnabled && common.RDB != nil {
		ctx := context.Background()
		minute := time.Now().Unix() / 60
		rkey := fmt.Sprintf("%s%s:%d", rpmKeyPrefix, key, minute)
		count, err := common.RDB.Incr(ctx, rkey).Result()
		if err != nil {
			common.SysError("rpm incr redis error: " + err.Error())
			return true // 故障放行
		}
		if count == 1 {
			common.RDB.Expire(ctx, rkey, 70*time.Second)
		}
		return count <= int64(limit)
	}

	return memRpmStore.allow(key, limit)
}
