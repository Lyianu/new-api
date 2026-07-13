package types

import (
	"math"
	"testing"

	"github.com/shopspring/decimal"
)

// 对账一致性：customer_discount 折扣在「预扣(float)」与「结算(decimal)」上的乘子必须一致，
// 否则会造成预扣与实扣对不上账。此测试锁定 AddOtherRatio 注入折扣的这一不变量。
func TestCustomerDiscountConsistency(t *testing.T) {
	p := &PriceData{}
	p.AddOtherRatio("customer_discount", 0.9)

	base := 1_000_000.0
	fromFloat := p.ApplyOtherRatiosToFloat(base)
	fromDecimal := p.ApplyOtherRatiosToDecimal(decimal.NewFromFloat(base)).InexactFloat64()

	if math.Abs(fromFloat-fromDecimal) > 1e-6 {
		t.Fatalf("pre-consume(%.6f) != settle(%.6f)", fromFloat, fromDecimal)
	}
	if math.Abs(fromFloat-base*0.9) > 1e-6 {
		t.Fatalf("discounted = %.6f, want %.6f", fromFloat, base*0.9)
	}
}

// 折扣与其它 otherRatio（如按量计费的 BillingRatios）叠加时按乘法累积。
func TestCustomerDiscountStacksMultiplicatively(t *testing.T) {
	p := &PriceData{}
	p.AddOtherRatio("billing_x", 2.0)
	p.AddOtherRatio("customer_discount", 0.5)
	if got := p.OtherRatioMultiplier(); math.Abs(got-1.0) > 1e-9 {
		t.Fatalf("multiplier = %.6f, want 1.0 (2.0*0.5)", got)
	}
}

// 非法折扣(<=0 / NaN / Inf)不得污染计费。
func TestCustomerDiscountRejectsInvalid(t *testing.T) {
	p := &PriceData{}
	p.AddOtherRatio("customer_discount", 0)
	p.AddOtherRatio("bad_nan", math.NaN())
	p.AddOtherRatio("bad_inf", math.Inf(1))
	if got := p.OtherRatioMultiplier(); math.Abs(got-1.0) > 1e-9 {
		t.Fatalf("multiplier = %.6f, want 1.0 (invalid ratios ignored)", got)
	}
}
