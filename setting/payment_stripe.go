package setting

var StripeApiSecret = ""
var StripeWebhookSecret = ""

// Stripe 手续费转嫁（gross-up）参数。
// Stripe 按「总额 P 的百分比 + 每笔固定费」收费（Standard pricing），
// 应付金额 P = (净额 N + StripeFeeFixed) / (1 - StripeFeePercent)，保证净到账 ≈ N。
// 默认值对应美国账户 + USD 结算 + CNY 计价收款：
// 2.9% 基础 + 1.5% 国际卡 + 1% 货币转换 = 5.4%；每笔固定费 $0.30 ≈ ¥2.2。
var StripeFeePercent = 0.054

// StripeFeeFixed 每笔固定手续费，单位元(CNY)。
var StripeFeeFixed = 2.2

var StripeMinTopUp = 1
var StripePromotionCodesEnabled = false
