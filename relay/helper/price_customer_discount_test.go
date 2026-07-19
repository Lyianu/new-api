package helper

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// stubPolicyResolver 为指定用户返回固定折扣（模拟客户策略表），
// 用于端到端验证三条计费路径的折扣注入与预扣/结算对账。
type stubPolicyResolver struct {
	userId   int
	discount float64
}

func (s stubPolicyResolver) Resolve(ctx service.PolicyContext) service.ResolvedPolicy {
	p := service.SystemDefaultPolicy()
	if ctx.UserId == s.userId {
		p.DiscountRatio = s.discount
	}
	return p
}

func withStubDiscount(t *testing.T, userId int, discount float64) {
	t.Helper()
	service.SetPolicyResolver(stubPolicyResolver{userId: userId, discount: discount})
	t.Cleanup(func() { service.SetPolicyResolver(nil) })
}

func newDiscountTestContext(t *testing.T) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	return ctx
}

// ---- tiered_expr：预扣打折 → 快照定格 → 结算复用同一乘子，零差额对账 ----

func TestCustomerDiscountTieredPreConsumeAndSettleReconcile(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"tiered-discount-model":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"tiered-discount-model":"tier(\"base\", p * 3 + c * 15)"}`,
	}))

	const userId = 42
	withStubDiscount(t, userId, 0.8)

	ctx := newDiscountTestContext(t)
	info := &relaycommon.RelayInfo{
		UserId:          userId,
		OriginModelName: "tiered-discount-model",
		UserGroup:       "default",
		UsingGroup:      "default",
		BillingRequestInput: &billingexpr.RequestInput{
			Body: []byte(`{}`),
		},
	}

	// 预扣：3*100000 + 15*1000 = 315000 → 157500 quota，八折 = 126000。
	priceData, err := ModelPriceHelper(ctx, info, 100_000, &types.TokenCountMeta{MaxTokens: 1_000})
	require.NoError(t, err)
	require.Equal(t, 126_000, priceData.QuotaToPreConsume)
	require.NotNil(t, info.TieredBillingSnapshot)
	require.Equal(t, 0.8, info.TieredBillingSnapshot.CustomerDiscount)

	// 结算（实际用量与估算一致）：必须与预扣完全相等——对账零差额。
	ok, settled, result := service.TryTieredSettle(info, billingexpr.TokenParams{P: 100_000, C: 1_000})
	require.True(t, ok)
	require.Equal(t, priceData.QuotaToPreConsume, settled)
	require.NotNil(t, result)

	// 结算（实际用量更多）：165000 × 0.8 = 132000，折扣仍然生效。
	ok, settled, _ = service.TryTieredSettle(info, billingexpr.TokenParams{P: 100_000, C: 2_000})
	require.True(t, ok)
	require.Equal(t, 132_000, settled)
}

func TestCustomerDiscountTieredNoPolicyKeepsOriginalPrice(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"tiered-nodiscount-model":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"tiered-nodiscount-model":"tier(\"base\", p * 3 + c * 15)"}`,
	}))

	// 策略只命中用户 42；用户 7 无折扣，按原价。
	withStubDiscount(t, 42, 0.8)

	ctx := newDiscountTestContext(t)
	info := &relaycommon.RelayInfo{
		UserId:              7,
		OriginModelName:     "tiered-nodiscount-model",
		UserGroup:           "default",
		UsingGroup:          "default",
		BillingRequestInput: &billingexpr.RequestInput{Body: []byte(`{}`)},
	}

	priceData, err := ModelPriceHelper(ctx, info, 100_000, &types.TokenCountMeta{MaxTokens: 1_000})
	require.NoError(t, err)
	require.Equal(t, 157_500, priceData.QuotaToPreConsume)
	require.Equal(t, 1.0, info.TieredBillingSnapshot.CustomerDiscount)

	ok, settled, _ := service.TryTieredSettle(info, billingexpr.TokenParams{P: 100_000, C: 1_000})
	require.True(t, ok)
	require.Equal(t, 157_500, settled)
}

// ---- 按次计费（MJ / Task）：折扣注入 otherRatios，消费路径恰好应用一次 ----

func TestCustomerDiscountPerCallInjectsOtherRatio(t *testing.T) {
	savedModelPrices := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedModelPrices))
	})
	modelPrices, err := common.Marshal(map[string]float64{"percall-discount-model": 0.5})
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(modelPrices)))

	const userId = 42
	withStubDiscount(t, userId, 0.8)

	ctx := newDiscountTestContext(t)
	info := &relaycommon.RelayInfo{
		UserId:          userId,
		OriginModelName: "percall-discount-model",
		UserGroup:       "default",
		UsingGroup:      "default",
	}

	priceData, err := ModelPriceHelperPerCall(ctx, info)
	require.NoError(t, err)
	// 基础额度不在 helper 内打折（否则 Task 统一应用点会双重打折）。
	require.Equal(t, 250_000, priceData.Quota) // 0.5 × 500000 × groupRatio(1)
	require.Equal(t, 0.8, priceData.OtherRatios()["customer_discount"])

	// 模拟 MJ / Task 的统一应用点：应用后即为折后价，预扣与结算共用该值。
	quota, clamp := common.QuotaFromFloatChecked(priceData.ApplyOtherRatiosToFloat(float64(priceData.Quota)))
	require.Nil(t, clamp)
	require.Equal(t, 200_000, quota)
}

func TestCustomerDiscountPerCallNoPolicyLeavesRatiosEmpty(t *testing.T) {
	savedModelPrices := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedModelPrices))
	})
	modelPrices, err := common.Marshal(map[string]float64{"percall-nodiscount-model": 0.5})
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(modelPrices)))

	withStubDiscount(t, 42, 0.8)

	ctx := newDiscountTestContext(t)
	info := &relaycommon.RelayInfo{
		UserId:          7, // 未命中策略
		OriginModelName: "percall-nodiscount-model",
		UserGroup:       "default",
		UsingGroup:      "default",
	}

	priceData, err := ModelPriceHelperPerCall(ctx, info)
	require.NoError(t, err)
	require.Equal(t, 250_000, priceData.Quota)
	require.False(t, priceData.HasOtherRatio("customer_discount"))
}

// ---- 倍率计费（回归）：折扣仍以 otherRatio 注入，预扣/结算共用乘子 ----

func TestCustomerDiscountRatioPathRegression(t *testing.T) {
	savedModelRatios := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedModelRatios))
	})
	modelRatios, err := common.Marshal(map[string]float64{"ratio-discount-model": 15})
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(modelRatios)))

	const userId = 42
	withStubDiscount(t, userId, 0.8)

	ctx := newDiscountTestContext(t)
	info := &relaycommon.RelayInfo{
		UserId:          userId,
		OriginModelName: "ratio-discount-model",
		UserGroup:       "default",
		UsingGroup:      "default",
	}

	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	require.Equal(t, 0.8, priceData.OtherRatios()["customer_discount"])
	// 结算乘子（text_quota ApplyOtherRatios* 使用同一 otherRatios 集合）。
	require.InDelta(t, 0.8, priceData.OtherRatioMultiplier(), 1e-9)
}
