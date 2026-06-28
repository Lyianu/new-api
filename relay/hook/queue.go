package hook

import (
	"context"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// asyncJob 是一条待异步执行的钩子任务。
type asyncJob struct {
	hook Hook
	hc   *HookContext
}

// asyncQueue 是异步钩子的有界队列 + worker 池。
// 异步钩子永远不阻断关键路径:队列满时丢弃并告警(归档类的可靠投递由钩子自身的 spill 负责)。
type asyncQueue struct {
	jobs    chan asyncJob
	workers int
	wg      sync.WaitGroup
	stop    chan struct{}
	once    sync.Once
}

func newAsyncQueue(capacity, workers int) *asyncQueue {
	if capacity <= 0 {
		capacity = 4096
	}
	if workers <= 0 {
		workers = 4
	}
	q := &asyncQueue{
		jobs:    make(chan asyncJob, capacity),
		workers: workers,
		stop:    make(chan struct{}),
	}
	for i := 0; i < workers; i++ {
		q.wg.Add(1)
		go q.loop()
	}
	return q
}

func (q *asyncQueue) loop() {
	defer q.wg.Done()
	for {
		select {
		case <-q.stop:
			return
		case job := <-q.jobs:
			q.run(job)
		}
	}
}

// run 执行单条异步任务,带 panic-recover 与每钩子超时。异步钩子的 fail-open 体现在:
// 出错只记录,不回传任何阻断决策。
func (q *asyncQueue) run(job asyncJob) {
	defer func() {
		if r := recover(); r != nil {
			common.SysError("hook async panic: " + toString(r))
		}
	}()

	ctx := context.Background()
	if to := job.hook.Timeout(); to > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, to)
		defer cancel()
	}
	if _, err := job.hook.Handle(ctx, job.hc); err != nil {
		common.SysError("hook async error [" + job.hook.Name() + "]: " + err.Error())
	}
}

// enqueue 非阻塞入队;队列满立即返回 false,由调用方记录丢弃。
func (q *asyncQueue) enqueue(job asyncJob) bool {
	select {
	case q.jobs <- job:
		return true
	default:
		return false
	}
}

func (q *asyncQueue) shutdown(timeout time.Duration) {
	q.once.Do(func() {
		close(q.stop)
	})
	done := make(chan struct{})
	go func() {
		q.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(timeout):
	}
}

func toString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	if e, ok := v.(error); ok {
		return e.Error()
	}
	return "unknown"
}
