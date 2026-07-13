package service

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func approx(a, b float64) bool { return math.Abs(a-b) < 1e-9 }

func ctxFor(userId, vendorId, channelId int, modelName string) PolicyContext {
	return PolicyContext{
		UserId:    userId,
		VendorId:  vendorId,
		ChannelId: channelId,
		ModelName: modelName,
	}
}

// 无规则 → 系统默认。
func TestResolve_Default(t *testing.T) {
	got := ResolvePolicyRows(nil, ctxFor(1, 10, 5, "claude-3"))
	if !approx(got.DiscountRatio, 1.0) || got.MaxConcurrency != 0 || got.RpmLimit != 0 {
		t.Fatalf("default = %+v", got)
	}
}

// 折扣按 vendor：vendor 命中的规则生效，未命中回落 1.0。
func TestResolve_VendorDiscount(t *testing.T) {
	rows := []*model.CustomerPolicy{
		{Id: 1, UserId: 1, VendorId: 10, DiscountRatio: 0.9},
	}
	if got := ResolvePolicyRows(rows, ctxFor(1, 10, 0, "claude-3")); !approx(got.DiscountRatio, 0.9) {
		t.Fatalf("vendor match discount = %v, want 0.9", got.DiscountRatio)
	}
	// 其他 vendor 不命中 → 默认 1.0
	if got := ResolvePolicyRows(rows, ctxFor(1, 20, 0, "gpt-4")); !approx(got.DiscountRatio, 1.0) {
		t.Fatalf("vendor miss discount = %v, want 1.0", got.DiscountRatio)
	}
}

// 更具体的规则优先：(vendor,model精确) > (vendor,*)。
func TestResolve_Specificity(t *testing.T) {
	rows := []*model.CustomerPolicy{
		{Id: 1, UserId: 1, VendorId: 10, ModelName: "*", DiscountRatio: 0.9},
		{Id: 2, UserId: 1, VendorId: 10, ModelName: "claude-3-opus", DiscountRatio: 0.5},
	}
	if got := ResolvePolicyRows(rows, ctxFor(1, 10, 0, "claude-3-opus")); !approx(got.DiscountRatio, 0.5) {
		t.Fatalf("specific model discount = %v, want 0.5", got.DiscountRatio)
	}
	if got := ResolvePolicyRows(rows, ctxFor(1, 10, 0, "claude-3-haiku")); !approx(got.DiscountRatio, 0.9) {
		t.Fatalf("vendor-wide discount = %v, want 0.9", got.DiscountRatio)
	}
}

// 前缀通配 claude-* 命中。
func TestResolve_PrefixMatch(t *testing.T) {
	rows := []*model.CustomerPolicy{
		{Id: 1, UserId: 1, VendorId: 10, ModelName: "claude-*", DiscountRatio: 0.8},
	}
	if got := ResolvePolicyRows(rows, ctxFor(1, 10, 0, "claude-3-sonnet")); !approx(got.DiscountRatio, 0.8) {
		t.Fatalf("prefix match discount = %v, want 0.8", got.DiscountRatio)
	}
	if got := ResolvePolicyRows(rows, ctxFor(1, 10, 0, "gpt-4")); !approx(got.DiscountRatio, 1.0) {
		t.Fatalf("prefix miss discount = %v, want 1.0", got.DiscountRatio)
	}
}

// 并发/RPM 按渠道维度独立解析，各自回落。
func TestResolve_ConcurrencyAndRpmByChannel(t *testing.T) {
	rows := []*model.CustomerPolicy{
		{Id: 1, UserId: 1, VendorId: 10, DiscountRatio: 0.9}, // 仅折扣
		{Id: 2, UserId: 1, ChannelId: 5, MaxConcurrency: 3, RpmLimit: 60},
	}
	got := ResolvePolicyRows(rows, ctxFor(1, 10, 5, "claude-3"))
	if !approx(got.DiscountRatio, 0.9) {
		t.Fatalf("discount = %v, want 0.9", got.DiscountRatio)
	}
	if got.MaxConcurrency != 3 || got.RpmLimit != 60 {
		t.Fatalf("limits = (%d,%d), want (3,60)", got.MaxConcurrency, got.RpmLimit)
	}
	// 换渠道 → 并发/RPM 回落默认，折扣仍按 vendor 命中
	got2 := ResolvePolicyRows(rows, ctxFor(1, 10, 9, "claude-3"))
	if got2.MaxConcurrency != 0 || got2.RpmLimit != 0 {
		t.Fatalf("other channel limits = (%d,%d), want (0,0)", got2.MaxConcurrency, got2.RpmLimit)
	}
	if !approx(got2.DiscountRatio, 0.9) {
		t.Fatalf("other channel discount = %v, want 0.9", got2.DiscountRatio)
	}
}

// Priority 打破 specificity 平局。
func TestResolve_PriorityTieBreak(t *testing.T) {
	rows := []*model.CustomerPolicy{
		{Id: 1, UserId: 1, VendorId: 10, DiscountRatio: 0.9, Priority: 1},
		{Id: 2, UserId: 1, VendorId: 10, DiscountRatio: 0.7, Priority: 5},
	}
	if got := ResolvePolicyRows(rows, ctxFor(1, 10, 0, "x")); !approx(got.DiscountRatio, 0.7) {
		t.Fatalf("priority tie-break discount = %v, want 0.7", got.DiscountRatio)
	}
}
