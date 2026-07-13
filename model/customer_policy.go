package model

import (
	"github.com/QuantumNous/new-api/common"
)

// CustomerPolicy 是「按客户 × (供应商/渠道, 模型)」粒度的策略规则。
//
// 维度语义（0 / 空 / "*" 表示通配）：
//   - VendorId：折扣维度（供应商/Provider）。0 表示任意供应商。
//   - ChannelId：并发/RPM 维度（物理渠道）。0 表示任意渠道。
//   - ModelName：模型名，支持精确、通配 "*"/""、前缀 "claude-*"。
//
// 一条规则同时可携带折扣与并发/RPM 限制；解析时按维度各自回落（见 service.PolicyResolver）。
// 折扣规则通常设置 VendorId（ChannelId=0）；并发/RPM 规则通常设置 ChannelId。
type CustomerPolicy struct {
	Id             int     `json:"id"`
	UserId         int     `json:"user_id" gorm:"index:idx_customer_policy_user"`
	VendorId       int     `json:"vendor_id" gorm:"default:0"`   // 0 = 任意供应商
	ChannelId      int     `json:"channel_id" gorm:"default:0"`  // 0 = 任意渠道
	ModelName      string  `json:"model_name" gorm:"type:varchar(128);default:''"`
	DiscountRatio  float64 `json:"discount_ratio" gorm:"default:1"` // 1=原价，0.9=九折；<=0 视为未设
	MaxConcurrency int     `json:"max_concurrency" gorm:"default:0"` // 0=不限
	RpmLimit       int     `json:"rpm_limit" gorm:"default:0"`       // 0=用分组默认
	Priority       int     `json:"priority" gorm:"default:0"`        // 命中优先级，越大越优先
	CreatedTime    int64   `json:"created_time" gorm:"bigint"`
	UpdatedTime    int64   `json:"updated_time" gorm:"bigint"`
}

func (p *CustomerPolicy) Insert() error {
	now := common.GetTimestamp()
	p.CreatedTime = now
	p.UpdatedTime = now
	return DB.Create(p).Error
}

func (p *CustomerPolicy) Update() error {
	p.UpdatedTime = common.GetTimestamp()
	return DB.Model(p).Select("vendor_id", "channel_id", "model_name",
		"discount_ratio", "max_concurrency", "rpm_limit", "priority", "updated_time").
		Updates(p).Error
}

func DeleteCustomerPolicy(id int) error {
	return DB.Delete(&CustomerPolicy{}, "id = ?", id).Error
}

// GetCustomerPoliciesByUser 返回某用户的全部策略规则。
func GetCustomerPoliciesByUser(userId int) ([]*CustomerPolicy, error) {
	var policies []*CustomerPolicy
	err := DB.Where("user_id = ?", userId).Find(&policies).Error
	return policies, err
}

// GetAllCustomerPolicies 返回全部策略规则（供缓存构建 / 管理端列表）。
func GetAllCustomerPolicies() ([]*CustomerPolicy, error) {
	var policies []*CustomerPolicy
	err := DB.Order("user_id asc, priority desc, id asc").Find(&policies).Error
	return policies, err
}
