package service

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
)

// 客户折扣只作用于表达式得出的 token 费；工具调用附加费按原价累加。
func TestComposeTieredTextQuotaDiscountsTokenFeeOnly(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			GroupRatio:       1,
			CustomerDiscount: 0.5,
		},
	}
	summary := textQuotaSummary{ToolCallSurchargeQuota: decimal.NewFromInt(200)}
	tieredResult := &billingexpr.TieredResult{ActualQuotaBeforeGroup: 1000}

	got := composeTieredTextQuota(relayInfo, summary, 0, tieredResult)
	require.Equal(t, 700, got) // 1000×1×0.5 + 200：附加费未被打折

	// 未设折扣：token 费按原价。
	relayInfo.TieredBillingSnapshot.CustomerDiscount = 0
	got = composeTieredTextQuota(relayInfo, summary, 0, tieredResult)
	require.Equal(t, 1200, got)
}
