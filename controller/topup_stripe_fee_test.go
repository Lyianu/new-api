package controller

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

// setStripeFee 设定手续费参数并在测试后还原。
func setStripeFee(t *testing.T, percent, fixed float64) {
	t.Helper()
	origPercent := setting.StripeFeePercent
	origFixed := setting.StripeFeeFixed
	t.Cleanup(func() {
		setting.StripeFeePercent = origPercent
		setting.StripeFeeFixed = origFixed
	})
	setting.StripeFeePercent = percent
	setting.StripeFeeFixed = fixed
}

// gross-up 核心性质：按 P 收款、Stripe 扣掉 P×p+F 后，净到账恰为 N。
func TestStripeGrossUpNetsTargetAmount(t *testing.T) {
	setStripeFee(t, 0.054, 2.2)

	for _, net := range []float64{5, 10, 100, 1000, 9999} {
		p := stripeGrossUp(net)
		received := p - (p*0.054 + 2.2)
		require.InDelta(t, net, received, 1e-9, "net=%v", net)
	}
}

// 线性加价（N×(1+p)）的旧算法必然亏损，gross-up 后不再出现。
func TestStripeGrossUpBeatsLinearMarkup(t *testing.T) {
	setStripeFee(t, 0.054, 2.2)

	linear := 100 * 1.054
	receivedLinear := linear - (linear*0.054 + 2.2)
	require.Less(t, receivedLinear, 100.0, "旧线性算法净到账必然不足")

	grossed := stripeGrossUp(100)
	require.Greater(t, grossed, linear)
}

// 异常配置钳制：p≥0.5 或 <0 视为 0，F<0 视为 0，不得出现除零/负价。
func TestStripeGrossUpClampsBadConfig(t *testing.T) {
	setStripeFee(t, 1.2, -5)
	require.InDelta(t, 100.0, stripeGrossUp(100), 1e-9)

	setStripeFee(t, -0.1, 2)
	require.InDelta(t, 102.0, stripeGrossUp(100), 1e-9)
}

// 应付金额向上取整到分，且与实际扣款分值一致；净到账不得低于目标额度。
func TestGetStripePayMoneyCeilsToCent(t *testing.T) {
	setupCnyTopup(t, operation_setting.QuotaDisplayTypeCNY)
	setStripeFee(t, 0.054, 2.2)

	pay := getStripePayMoney(100, "default")
	cents := math.Round(pay * 100)
	require.InDelta(t, pay*100, cents, 1e-6, "必须是整分金额")

	// (100+2.2)/0.946 = 108.0338... → 向上取整到 108.04
	require.InDelta(t, 108.04, pay, 1e-9)

	received := pay - (pay*0.054 + 2.2)
	require.GreaterOrEqual(t, received, 100.0-1e-9, "净到账不得低于入账额度")
}

// 订单不变量：实付金额（pay_money 落库值）不得低于入账基数（money 落库值），
// 即通道手续费恒非负——否则说明费率配置或公式出错，平台在贴钱。
func TestStripePayMoneyNeverBelowChargedAmount(t *testing.T) {
	setupCnyTopup(t, operation_setting.QuotaDisplayTypeCNY)
	setStripeFee(t, 0.054, 2.2)

	user := model.User{Group: "default"}
	for _, amount := range []float64{5, 10, 47, 100, 999, 10000} {
		payMoney := getStripePayMoney(amount, user.Group)
		charged := GetChargedAmount(amount, user)
		require.GreaterOrEqual(t, payMoney, charged, "amount=%v", amount)
	}

	// 手续费归零时两者应相等（除向上取整的 <1 分误差）
	setStripeFee(t, 0, 0)
	require.InDelta(t, GetChargedAmount(100, user), getStripePayMoney(100, "default"), 0.01)
}

// 小额充值下固定费占比显著：¥5 的应付金额需明显高于线性 5.4% 加价。
func TestGetStripePayMoneySmallAmountCoversFixedFee(t *testing.T) {
	setupCnyTopup(t, operation_setting.QuotaDisplayTypeCNY)
	setStripeFee(t, 0.054, 2.2)

	pay := getStripePayMoney(5, "default")
	// (5+2.2)/0.946 = 7.6109... → 7.62
	require.InDelta(t, 7.62, pay, 1e-9)

	received := pay - (pay*0.054 + 2.2)
	require.GreaterOrEqual(t, received, 5.0-1e-9)
}

// 充值分组倍率统一只作用于收款侧：入账不随倍率变化，应付按倍率加价
// （与易支付/Waffo 路径同语义；防止回归到上游"双边乘"的矛盾行为）。
func TestTopupGroupRatioAppliesToPaySideOnly(t *testing.T) {
	setupCnyTopup(t, operation_setting.QuotaDisplayTypeCNY)
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1,"vip":1.2}`))

	user := model.User{Group: "vip"}
	require.InDelta(t, 100.0, GetChargedAmount(100, user), 1e-6, "入账恒为请求额度")
	require.InDelta(t, 120.0, getStripePayMoney(100, "vip"), 1e-9, "应付按倍率加价")
	// 手续费叠加在加价后的净额上：gross-up(120)
	setStripeFee(t, 0.054, 2.2)
	require.InDelta(t, math.Ceil((120+2.2)/0.946*100)/100, getStripePayMoney(100, "vip"), 1e-9)
}
