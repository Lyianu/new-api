package model

import (
	"github.com/QuantumNous/new-api/common"
)

// CustomerPolicy 是「按客户 × (供应商/渠道, 模型)」粒度的**折扣**规则。
//
// 维度语义（0 / 空 / "*" 表示通配）：
//   - VendorId：折扣维度（供应商/Provider）。0 表示任意供应商。
//   - ChannelId：渠道维度。0 表示任意渠道。
//   - ModelName：模型名，支持精确、通配 "*"/""、前缀 "claude-*"。
//
// 注意：MaxConcurrency / RpmLimit 字段已废弃（保留仅为兼容存量数据），
// 并发/RPM 限流改为「分组×模型」配置（setting.GroupModelLimit +
// middleware.GroupModelLimit），不再按用户生效。
type CustomerPolicy struct {
	Id             int     `json:"id"`
	UserId         int     `json:"user_id" gorm:"index:idx_customer_policy_user"`
	VendorId       int     `json:"vendor_id" gorm:"default:0"`   // 0 = 任意供应商
	ChannelId      int     `json:"channel_id" gorm:"default:0"`  // 0 = 任意渠道
	ModelName      string  `json:"model_name" gorm:"type:varchar(128);default:''"`
	DiscountRatio  float64 `json:"discount_ratio" gorm:"default:1"` // 1=原价，0.9=九折；<=0 视为未设
	MaxConcurrency int     `json:"max_concurrency" gorm:"default:0"` // 已废弃：限流改由分组×模型配置
	RpmLimit       int     `json:"rpm_limit" gorm:"default:0"`       // 已废弃：限流改由分组×模型配置
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
	if DB == nil {
		return nil, nil
	}
	var policies []*CustomerPolicy
	err := DB.Where("user_id = ?", userId).Find(&policies).Error
	return policies, err
}

// GetAllCustomerPolicies 返回全部策略规则（供缓存构建 / 管理端列表）。
// DB 未就绪时返回空集，保证解析器在早期/测试环境下不 panic。
func GetAllCustomerPolicies() ([]*CustomerPolicy, error) {
	if DB == nil {
		return nil, nil
	}
	var policies []*CustomerPolicy
	err := DB.Order("user_id asc, priority desc, id asc").Find(&policies).Error
	return policies, err
}
