package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func setupGroupModelLimits(t *testing.T, jsonStr string) {
	t.Helper()
	orig := GroupModelLimits2JSONString()
	t.Cleanup(func() { _ = UpdateGroupModelLimitsByJSONString(orig) })
	require.NoError(t, UpdateGroupModelLimitsByJSONString(jsonStr))
}

// 匹配度：精确 > 前缀 > 通配；并发与 RPM 各自独立回落。
func TestResolveGroupModelLimitSpecificity(t *testing.T) {
	setupGroupModelLimits(t, `{
		"default": [
			{"model": "*", "max_concurrency": 10, "rpm_limit": 100},
			{"model": "claude-*", "max_concurrency": 5},
			{"model": "claude-3-opus", "rpm_limit": 30}
		]
	}`)

	// 精确命中 opus：RPM 用精确规则，并发回落到前缀规则
	r := ResolveGroupModelLimit("default", "claude-3-opus")
	require.Equal(t, 5, r.MaxConcurrency)
	require.Equal(t, "claude-*", r.ConcurrencyRule)
	require.Equal(t, 30, r.RpmLimit)
	require.Equal(t, "claude-3-opus", r.RpmRule)

	// 前缀命中 sonnet：并发用前缀规则，RPM 回落到通配规则
	r = ResolveGroupModelLimit("default", "claude-3-sonnet")
	require.Equal(t, 5, r.MaxConcurrency)
	require.Equal(t, 100, r.RpmLimit)
	require.Equal(t, "*", r.RpmRule)

	// 其他模型：全部落在通配规则
	r = ResolveGroupModelLimit("default", "gpt-4o")
	require.Equal(t, 10, r.MaxConcurrency)
	require.Equal(t, "*", r.ConcurrencyRule)

	// 未配置的分组：不限
	r = ResolveGroupModelLimit("vip", "claude-3-opus")
	require.Equal(t, 0, r.MaxConcurrency)
	require.Equal(t, 0, r.RpmLimit)
}

func TestCheckGroupModelLimits(t *testing.T) {
	require.NoError(t, CheckGroupModelLimits(``))
	require.NoError(t, CheckGroupModelLimits(`{}`))
	require.NoError(t, CheckGroupModelLimits(`{"default":[{"model":"*","max_concurrency":5,"rpm_limit":0}]}`))
	require.Error(t, CheckGroupModelLimits(`{"default":[{"model":"*","max_concurrency":-1}]}`), "负数并发应拒绝")
	require.Error(t, CheckGroupModelLimits(`not json`))
}

func TestHasGroupModelLimits(t *testing.T) {
	setupGroupModelLimits(t, `{}`)
	require.False(t, HasGroupModelLimits())
	require.NoError(t, UpdateGroupModelLimitsByJSONString(`{"default":[{"model":"*","rpm_limit":60}]}`))
	require.True(t, HasGroupModelLimits())
}
