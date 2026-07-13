package operation_setting

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func approxEqual(a, b float64) bool {
	return math.Abs(a-b) < 1e-6
}

// withDisplay 临时设置展示类型与汇率并在测试后还原。
func withDisplay(t *testing.T, displayType string, usdRate float64) {
	t.Helper()
	origType := generalSetting.QuotaDisplayType
	origRate := USDExchangeRate
	generalSetting.QuotaDisplayType = displayType
	USDExchangeRate = usdRate
	t.Cleanup(func() {
		generalSetting.QuotaDisplayType = origType
		USDExchangeRate = origRate
	})
}

// CNY 本位：quota / QuotaPerUnit 直接为人民币。
func TestQuotaToCny(t *testing.T) {
	// QuotaPerUnit 个 quota == ¥1
	if got := QuotaToCny(common.QuotaPerUnit); !approxEqual(got, 1.0) {
		t.Fatalf("QuotaToCny(QuotaPerUnit) = %v, want 1.0", got)
	}
	if got := CnyToQuota(1.0); !approxEqual(got, common.QuotaPerUnit) {
		t.Fatalf("CnyToQuota(1) = %v, want %v", got, common.QuotaPerUnit)
	}
}

func TestQuotaToDisplayCurrency_CNY(t *testing.T) {
	withDisplay(t, QuotaDisplayTypeCNY, 7.3)
	symbol, v := QuotaToDisplayCurrency(common.QuotaPerUnit)
	if symbol != "¥" || !approxEqual(v, 1.0) {
		t.Fatalf("CNY display = (%s, %v), want (¥, 1.0)", symbol, v)
	}
}

// USD 展示为 CNY 派生：¥1 / 7.3 ≈ $0.13699。
func TestQuotaToDisplayCurrency_USD(t *testing.T) {
	withDisplay(t, QuotaDisplayTypeUSD, 7.3)
	symbol, v := QuotaToDisplayCurrency(common.QuotaPerUnit)
	if symbol != "$" || !approxEqual(v, 1.0/7.3) {
		t.Fatalf("USD display = (%s, %v), want ($, %v)", symbol, v, 1.0/7.3)
	}
}

// 充值：不同展示类型下用户输入金额换算回人民币。
func TestDisplayCurrencyToCny(t *testing.T) {
	withDisplay(t, QuotaDisplayTypeCNY, 7.3)
	if got := DisplayCurrencyToCny(100); !approxEqual(got, 100) {
		t.Fatalf("CNY input 100 -> %v, want 100", got)
	}

	withDisplay(t, QuotaDisplayTypeUSD, 7.3)
	if got := DisplayCurrencyToCny(10); !approxEqual(got, 73) {
		t.Fatalf("USD input 10 -> %v, want 73", got)
	}
}

// USDExchangeRate<=0 时应回落为 1，避免除零。
func TestUsdExchangeRateFallback(t *testing.T) {
	withDisplay(t, QuotaDisplayTypeUSD, 0)
	symbol, v := QuotaToDisplayCurrency(common.QuotaPerUnit)
	if symbol != "$" || !approxEqual(v, 1.0) {
		t.Fatalf("USD display with rate=0 = (%s, %v), want ($, 1.0)", symbol, v)
	}
}
