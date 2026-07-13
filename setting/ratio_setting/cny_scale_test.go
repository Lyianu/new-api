package ratio_setting

import (
	"math"
	"testing"
)

// 缩放前后：货币计价表 ×USD2RMB，无量纲倍率表不变。
func TestScaleSeedToBaseCurrency(t *testing.T) {
	// 取缩放前的原始种子值（未经 InitRatioSettings 缩放的字面量）。
	// 由于 scaleSeedToBaseCurrency 用 sync.Once 幂等，这里直接断言缩放后的运行时值。
	scaleSeedToBaseCurrency()

	// defaultModelRatio 应被 ×USD2RMB。gpt-4o 上游种子为 1.25（$0.0025/1K），
	// CNY 本位后应为 1.25 * 7.3。
	if got, ok := defaultModelRatio["gpt-4o"]; ok {
		want := 1.25 * USD2RMB
		if math.Abs(got-want) > 1e-6 {
			t.Fatalf("defaultModelRatio[gpt-4o] = %v, want %v", got, want)
		}
	}

	// 无量纲的 completion 倍率不得被缩放。
	if got, ok := defaultCompletionRatio["gpt-image-1"]; ok {
		if math.Abs(got-8) > 1e-6 {
			t.Fatalf("defaultCompletionRatio[gpt-image-1] = %v, want 8 (must NOT scale)", got)
		}
	}
}

// 幂等：重复调用不得二次缩放导致价格翻倍。
func TestScaleSeedIdempotent(t *testing.T) {
	scaleSeedToBaseCurrency()
	before := defaultModelRatio["gpt-4o"]
	scaleSeedToBaseCurrency()
	after := defaultModelRatio["gpt-4o"]
	if math.Abs(before-after) > 1e-9 {
		t.Fatalf("scale not idempotent: before=%v after=%v", before, after)
	}
}
