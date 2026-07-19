package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

// setupCnyTopup 固定与充值换算相关的全局配置，测试后还原。
func setupCnyTopup(t *testing.T, displayType string) {
	t.Helper()
	origType := operation_setting.GetGeneralSetting().QuotaDisplayType
	origRate := operation_setting.USDExchangeRate
	origPrice := operation_setting.Price
	origStripe := setting.StripeUnitPrice
	origWaffo := setting.WaffoUnitPrice
	origDiscounts := operation_setting.GetPaymentSetting().AmountDiscount
	origGroupRatio := common.TopupGroupRatio2JSONString()

	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = origType
		operation_setting.USDExchangeRate = origRate
		operation_setting.Price = origPrice
		setting.StripeUnitPrice = origStripe
		setting.WaffoUnitPrice = origWaffo
		operation_setting.GetPaymentSetting().AmountDiscount = origDiscounts
		_ = common.UpdateTopupGroupRatioByJSONString(origGroupRatio)
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = displayType
	operation_setting.USDExchangeRate = 7.3
	operation_setting.Price = 1.0
	setting.StripeUnitPrice = 1.0
	setting.WaffoUnitPrice = 1.0
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{}
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1}`))
}

// CNY 展示：输入即人民币，credit 与到账 quota 一一对应。
func TestTopupCreditCnyAmount_CNY(t *testing.T) {
	setupCnyTopup(t, operation_setting.QuotaDisplayTypeCNY)
	require.Equal(t, int64(100), topupCreditCnyAmount(100))
	// 到账 quota = credit × QuotaPerUnit
	require.InDelta(t, float64(100)*common.QuotaPerUnit,
		operation_setting.CnyToQuota(float64(topupCreditCnyAmount(100))), 1e-6)
}

// 充值输入固定为元：展示类型切到 USD/TOKENS 也不改变输入语义。
func TestTopupCreditCnyAmount_FixedCnyRegardlessOfDisplayType(t *testing.T) {
	for _, displayType := range []string{
		operation_setting.QuotaDisplayTypeUSD,
		operation_setting.QuotaDisplayTypeTokens,
		operation_setting.QuotaDisplayTypeCustom,
	} {
		setupCnyTopup(t, displayType)
		require.Equal(t, int64(100), topupCreditCnyAmount(100), "displayType=%s", displayType)
		require.InDelta(t, 100.0, getPayMoney(100, "default"), 1e-6, "displayType=%s", displayType)
	}
}

// 易支付：CNY 展示下足额收款（Price=1.0），付款额 == 人民币额度。
func TestGetPayMoney_CNY_FullCharge(t *testing.T) {
	setupCnyTopup(t, operation_setting.QuotaDisplayTypeCNY)
	require.InDelta(t, 100.0, getPayMoney(100, "default"), 1e-6)
}

// Stripe 入账基数(GetChargedAmount)为人民币；quota = 基数 × QuotaPerUnit。
func TestGetChargedAmount_CNY(t *testing.T) {
	setupCnyTopup(t, operation_setting.QuotaDisplayTypeCNY)
	user := model.User{Group: "default"}
	require.InDelta(t, 100.0, GetChargedAmount(100, user), 1e-6)
}

// Waffo 收美元：¥100 credit（CNY 展示）→ $100/7.3 ≈ 13.6986。
func TestGetWaffoPayMoney_ConvertsToUsd(t *testing.T) {
	setupCnyTopup(t, operation_setting.QuotaDisplayTypeCNY)
	require.InDelta(t, 100.0/7.3, getWaffoPayMoney(100, "default"), 1e-6)
}
