package operation_setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// 额度展示类型
const (
	QuotaDisplayTypeUSD    = "USD"
	QuotaDisplayTypeCNY    = "CNY"
	QuotaDisplayTypeTokens = "TOKENS"
	QuotaDisplayTypeCustom = "CUSTOM"
)

type GeneralSetting struct {
	DocsLink            string `json:"docs_link"`
	PingIntervalEnabled bool   `json:"ping_interval_enabled"`
	PingIntervalSeconds int    `json:"ping_interval_seconds"`
	// 当前站点额度展示类型：USD / CNY / TOKENS
	QuotaDisplayType string `json:"quota_display_type"`
	// 自定义货币符号，用于 CUSTOM 展示类型
	CustomCurrencySymbol string `json:"custom_currency_symbol"`
	// 自定义货币与美元汇率（1 USD = X Custom）
	CustomCurrencyExchangeRate float64 `json:"custom_currency_exchange_rate"`
}

// 默认配置
// Cerberus 记账本位为 CNY，默认额度展示即人民币。
var generalSetting = GeneralSetting{
	DocsLink:                   "https://docs.newapi.pro",
	PingIntervalEnabled:        false,
	PingIntervalSeconds:        60,
	QuotaDisplayType:           QuotaDisplayTypeCNY,
	CustomCurrencySymbol:       "¤",
	CustomCurrencyExchangeRate: 1.0,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("general_setting", &generalSetting)
}

func GetGeneralSetting() *GeneralSetting {
	return &generalSetting
}

// IsCurrencyDisplay 是否以货币形式展示（美元或人民币）
func IsCurrencyDisplay() bool {
	return generalSetting.QuotaDisplayType != QuotaDisplayTypeTokens
}

// IsCNYDisplay 是否以人民币展示
func IsCNYDisplay() bool {
	return generalSetting.QuotaDisplayType == QuotaDisplayTypeCNY
}

// GetQuotaDisplayType 返回额度展示类型
func GetQuotaDisplayType() string {
	return generalSetting.QuotaDisplayType
}

// GetCurrencySymbol 返回当前展示类型对应符号
func GetCurrencySymbol() string {
	switch generalSetting.QuotaDisplayType {
	case QuotaDisplayTypeUSD:
		return "$"
	case QuotaDisplayTypeCNY:
		return "¥"
	case QuotaDisplayTypeCustom:
		if generalSetting.CustomCurrencySymbol != "" {
			return generalSetting.CustomCurrencySymbol
		}
		return "¤"
	default:
		return ""
	}
}

// GetUsdToCurrencyRate 返回 1 USD = X <currency> 的 X（TOKENS 不适用）
func GetUsdToCurrencyRate(usdToCny float64) float64 {
	switch generalSetting.QuotaDisplayType {
	case QuotaDisplayTypeUSD:
		return 1
	case QuotaDisplayTypeCNY:
		return usdToCny
	case QuotaDisplayTypeCustom:
		if generalSetting.CustomCurrencyExchangeRate > 0 {
			return generalSetting.CustomCurrencyExchangeRate
		}
		return 1
	default:
		return 1
	}
}

// ---- CNY 本位换算（单一真源）----
// 记账本位为 CNY：cny = quota / QuotaPerUnit。其余展示货币由可配置汇率派生。
// USDExchangeRate 语义：1 USD = USDExchangeRate 元人民币。

// usdExchangeRate 返回有效的 1USD=?CNY 汇率（<=0 时回落 1，避免除零）。
func usdExchangeRate() float64 {
	if USDExchangeRate > 0 {
		return USDExchangeRate
	}
	return 1
}

// QuotaToCny 把 quota 换算为人民币金额（记账本位）。
func QuotaToCny(quota float64) float64 {
	return quota / common.QuotaPerUnit
}

// CnyToQuota 把人民币金额换算为 quota（充值入账用）。
func CnyToQuota(cny float64) float64 {
	return cny * common.QuotaPerUnit
}

// QuotaToDisplayCurrency 按当前展示类型把 quota 换算为 (符号, 金额)。
// TOKENS 展示类型由调用方单独处理。
func QuotaToDisplayCurrency(quota float64) (string, float64) {
	cny := QuotaToCny(quota)
	switch generalSetting.QuotaDisplayType {
	case QuotaDisplayTypeUSD:
		return "$", cny / usdExchangeRate()
	case QuotaDisplayTypeCustom:
		rate := generalSetting.CustomCurrencyExchangeRate
		if rate <= 0 {
			rate = 1
		}
		symbol := generalSetting.CustomCurrencySymbol
		if symbol == "" {
			symbol = "¤"
		}
		// 自定义币种沿用「相对美元」语义：先派生美元，再乘自定义汇率。
		return symbol, (cny / usdExchangeRate()) * rate
	default: // CNY（本位）
		return "¥", cny
	}
}
