package setting

var StripeApiSecret = ""
var StripeWebhookSecret = ""
var StripePriceId = ""

// StripeUnitPrice 每 1 元人民币额度对应的实际收款金额，仅用于前端预览显示。
// 真实扣款由 Stripe 后台的 StripePriceId(Price 对象) × quantity 决定，
// 需保证 StripeUnitPrice 与该 Price 对象的单价一致（CNY 本位默认 1.0 = ¥1/单位）。
var StripeUnitPrice = 1.0
var StripeMinTopUp = 1
var StripePromotionCodesEnabled = false
