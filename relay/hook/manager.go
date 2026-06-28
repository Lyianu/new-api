package hook

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// pipeline 是某一时刻编译好的运行时管线:事件 -> 按 Priority 升序排列的钩子。
type pipeline struct {
	byEvent map[HookEvent][]Hook
}

func emptyPipeline() *pipeline {
	return &pipeline{byEvent: map[HookEvent][]Hook{}}
}

// Manager 持有当前管线与异步队列,负责调度与热加载。
type Manager struct {
	mu    sync.RWMutex
	pipe  *pipeline
	queue *asyncQueue
}

var manager = &Manager{pipe: emptyPipeline()}

// hasHooks 快速判断某事件是否有订阅者,供调用方在热路径上提前短路、零开销。
func (m *Manager) hasHooks(event HookEvent) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.pipe.byEvent[event]) > 0
}

// setPipeline 原子替换运行时管线(热加载)。
func (m *Manager) setPipeline(p *pipeline) {
	m.mu.RLock()
	q := m.queue
	m.mu.RUnlock()
	if q == nil {
		q = newAsyncQueue(0, 4)
	}
	m.mu.Lock()
	m.pipe = p
	m.queue = q
	m.mu.Unlock()
}

func (m *Manager) snapshot(event HookEvent) []Hook {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.pipe.byEvent[event]
}

// Dispatch 执行某事件上的全部钩子。
//   - 同步钩子按 Priority 串行,首个 Deny 立即短路返回。
//   - 异步钩子入队,永不阻断;入队失败(队列满)记录告警。
//   - fail-closed 钩子超时/报错视为 Deny;fail-open 仅记录后继续。
//
// 返回值非 nil 且 Decision==DecisionDeny 时,调用方应阻断请求。
func (m *Manager) Dispatch(ctx context.Context, hc *HookContext) *HookResult {
	hooks := m.snapshot(hc.Event)
	if len(hooks) == 0 {
		return cont()
	}

	for _, h := range hooks {
		if !h.Match(hc) {
			continue
		}

		if h.Mode() == ModeAsync {
			m.mu.RLock()
			q := m.queue
			m.mu.RUnlock()
			if q != nil && !q.enqueue(asyncJob{hook: h, hc: hc.Snapshot()}) {
				common.SysError("hook queue full, dropped async hook: " + h.Name())
			}
			continue
		}

		res, err := runSyncWithTimeout(ctx, h, hc)
		if err != nil {
			if h.FailMode() == FailClosed {
				common.SysError("hook fail-closed deny [" + h.Name() + "]: " + err.Error())
				return &HookResult{
					Decision:   DecisionDeny,
					StatusCode: 503,
					Code:       "hook_unavailable",
					Message:    "request blocked: audit hook unavailable",
				}
			}
			common.SysError("hook fail-open continue [" + h.Name() + "]: " + err.Error())
			continue
		}
		if res == nil {
			continue
		}
		switch res.Decision {
		case DecisionDeny:
			return res
		case DecisionModify:
			// Phase 2:在 upstream.before 上应用改写。request.received 暂仅记录。
			if len(res.ModifiedBody) > 0 {
				hc.RawRequestBody = res.ModifiedBody
			}
		}
	}
	return cont()
}

// runSyncWithTimeout 在独立 goroutine 中执行同步钩子,确保超时能真正中断等待
// (即使钩子内部未严格遵守 ctx)。
func runSyncWithTimeout(ctx context.Context, h Hook, hc *HookContext) (result *HookResult, err error) {
	timeout := h.Timeout()
	runCtx := ctx
	if timeout > 0 {
		var cancel context.CancelFunc
		runCtx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	type outcome struct {
		res *HookResult
		err error
	}
	ch := make(chan outcome, 1)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				ch <- outcome{err: &hookPanicError{msg: toString(r)}}
			}
		}()
		res, err := h.Handle(runCtx, hc)
		ch <- outcome{res: res, err: err}
	}()

	select {
	case <-runCtx.Done():
		return nil, runCtx.Err()
	case o := <-ch:
		return o.res, o.err
	}
}

type hookPanicError struct{ msg string }

func (e *hookPanicError) Error() string { return "hook panic: " + e.msg }

// compile 将一组钩子编译成按事件分桶、按 Priority 升序的管线。
func compile(hooks []Hook) *pipeline {
	p := emptyPipeline()
	for _, h := range hooks {
		for _, ev := range h.Events() {
			p.byEvent[ev] = append(p.byEvent[ev], h)
		}
	}
	for ev := range p.byEvent {
		bucket := p.byEvent[ev]
		sort.SliceStable(bucket, func(i, j int) bool {
			return bucket[i].Priority() < bucket[j].Priority()
		})
		p.byEvent[ev] = bucket
	}
	return p
}

// shutdownTimeout 是进程退出时等待异步队列排空的上限。
const shutdownTimeout = 5 * time.Second

// Shutdown 在进程退出时尽量排空异步队列。当前未在 main 注册(Phase 1 进程通常直接退出),
// 保留为可选优雅停机入口。
func Shutdown() {
	manager.mu.RLock()
	q := manager.queue
	manager.mu.RUnlock()
	if q != nil {
		q.shutdown(shutdownTimeout)
	}
}
