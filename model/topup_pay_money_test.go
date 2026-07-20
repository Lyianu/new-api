package model

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// pay_money 落库回读：实付金额（含手续费）必须完整持久化，供账单展示与对账。
func TestTopUpPayMoneyRoundTrip(t *testing.T) {
	truncateTables(t)

	topUp := &TopUp{
		UserId:          1,
		Amount:          100,
		Money:           100,
		PayMoney:        108.04,
		TradeNo:         "ref_pay_money_roundtrip",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      1700000000,
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())

	got := GetTopUpByTradeNo("ref_pay_money_roundtrip")
	require.NotNil(t, got)
	assert.InDelta(t, 108.04, got.PayMoney, 1e-9)
	assert.InDelta(t, 100.0, got.Money, 1e-9)
}

// 存量订单兼容：未写 pay_money 的订单回读为 0，展示层依赖该值回退到 Money。
func TestTopUpPayMoneyDefaultsToZero(t *testing.T) {
	truncateTables(t)

	topUp := &TopUp{
		UserId:          1,
		Amount:          50,
		Money:           50,
		TradeNo:         "ref_pay_money_legacy",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      1700000000,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, topUp.Insert())

	got := GetTopUpByTradeNo("ref_pay_money_legacy")
	require.NotNil(t, got)
	assert.Zero(t, got.PayMoney)
}

// API 契约：JSON 序列化必须携带 pay_money 字段（账单前端依赖）。
func TestTopUpPayMoneyJSONField(t *testing.T) {
	data, err := json.Marshal(&TopUp{PayMoney: 12.9})
	require.NoError(t, err)

	var m map[string]any
	require.NoError(t, json.Unmarshal(data, &m))
	v, ok := m["pay_money"]
	require.True(t, ok, "json must contain pay_money")
	assert.InDelta(t, 12.9, v.(float64), 1e-9)
}
