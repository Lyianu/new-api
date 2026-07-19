package billingexpr_test

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/stretchr/testify/require"
)

// 结算必须应用快照中定格的客户折扣：预扣与结算共用同一乘子（对账一致）。
func TestComputeTieredQuotaAppliesCustomerDiscount(t *testing.T) {
	exprStr := `tier("base", p * 3 + c * 15)`
	params := billingexpr.TokenParams{P: 100_000, C: 1_000}
	// 3*100000 + 15*1000 = 315000 → /1e6 × 500000 = 157500

	cases := []struct {
		name     string
		discount float64
		want     int
	}{
		{"未设(0)等价原价", 0, 157_500},
		{"显式原价(1)", 1, 157_500},
		{"八折", 0.8, 126_000},
		{"上浮(1.5)", 1.5, 236_250},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			snap := &billingexpr.BillingSnapshot{
				BillingMode:      "tiered_expr",
				ExprString:       exprStr,
				ExprHash:         billingexpr.ExprHashString(exprStr),
				GroupRatio:       1.0,
				QuotaPerUnit:     500_000,
				CustomerDiscount: tc.discount,
			}
			result, err := billingexpr.ComputeTieredQuota(snap, params)
			require.NoError(t, err)
			require.Equal(t, tc.want, result.ActualQuotaAfterGroup)
			// BeforeGroup 保持表达式原价，折扣只在 AfterGroup 乘入，账单可解释。
			require.InDelta(t, 157_500.0, result.ActualQuotaBeforeGroup, 0.001)
		})
	}
}

// DiscountFactor 语义：nil / 未设 / 非法值一律回落 1（原价），杜绝 0 折扣事故。
func TestBillingSnapshotDiscountFactor(t *testing.T) {
	var nilSnap *billingexpr.BillingSnapshot
	require.Equal(t, 1.0, nilSnap.DiscountFactor())
	require.Equal(t, 1.0, (&billingexpr.BillingSnapshot{}).DiscountFactor())
	require.Equal(t, 1.0, (&billingexpr.BillingSnapshot{CustomerDiscount: -1}).DiscountFactor())
	require.Equal(t, 0.8, (&billingexpr.BillingSnapshot{CustomerDiscount: 0.8}).DiscountFactor())
}
