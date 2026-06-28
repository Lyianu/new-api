package model

// FORK: 自定义钩子（Custom Hooks）配置存储。
// 本文件为 fork 自定义功能，纯新增，不修改上游。配置以 TEXT 列存 JSON 字符串，
// 兼容 SQLite / MySQL>=5.7.8 / PostgreSQL>=9.6；不使用 DB 专属 JSON 列类型，
// 不使用 gorm:"default:" 布尔 tag（默认值在 controller 规范化时给）。

import "time"

// HookConfig 描述一条可配置的中转钩子。
//
// Events / MatchJSON / ConfigJSON 均以 TEXT 列保存 JSON 文本：
//   - Events:     ["request.received", ...]
//   - MatchJSON:  {"region":[..],"group":[..],"model":[..],"channelType":[..],"relayFormat":[..]}
//   - ConfigJSON: 类型私有，webhook={"url":..,"headers":{..}}; archive={"sink":..,"endpoint":..,..}
type HookConfig struct {
	Id         int    `json:"id" gorm:"primaryKey"`
	Name       string `json:"name" gorm:"size:128;uniqueIndex"`
	Type       string `json:"type" gorm:"size:32"` // "webhook" | "archive"
	Enabled    bool   `json:"enabled"`
	Events     string `json:"events" gorm:"type:text"`
	Mode       string `json:"mode" gorm:"size:16"`      // "sync" | "async"
	FailMode   string `json:"fail_mode" gorm:"size:16"` // "closed" | "open"
	TimeoutMs  int    `json:"timeout_ms"`
	Priority   int    `json:"priority"`
	MatchJSON  string `json:"match" gorm:"type:text;column:match_json"`
	ConfigJSON string `json:"config" gorm:"type:text;column:config_json"`
	CreatedAt  int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (HookConfig) TableName() string {
	return "hook_configs"
}

// GetAllHookConfigs 返回全部钩子配置（管理后台列表）。
func GetAllHookConfigs() ([]*HookConfig, error) {
	var configs []*HookConfig
	err := DB.Order("priority asc, id asc").Find(&configs).Error
	return configs, err
}

// GetEnabledHookConfigs 返回所有启用的钩子配置，供 relay/hook 编译运行时管线。
func GetEnabledHookConfigs() ([]*HookConfig, error) {
	var configs []*HookConfig
	err := DB.Where("enabled = ?", true).Order("priority asc, id asc").Find(&configs).Error
	return configs, err
}

// GetHookConfigById 按主键读取单条配置。
func GetHookConfigById(id int) (*HookConfig, error) {
	var config HookConfig
	err := DB.First(&config, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

// HookConfigVersion 用于多实例热加载：以记录数 + 最大更新时间标识配置版本。
// 任意增删改都会改变其中之一，poller 据此决定是否重建运行时管线。
type HookConfigVersion struct {
	Count      int64
	MaxUpdated int64
}

// GetHookConfigVersion 统计当前配置版本标识。
func GetHookConfigVersion() (HookConfigVersion, error) {
	var v HookConfigVersion
	if err := DB.Model(&HookConfig{}).Count(&v.Count).Error; err != nil {
		return v, err
	}
	// COALESCE 在三种数据库下均可用，避免空表时扫描出 NULL。
	row := DB.Model(&HookConfig{}).Select("COALESCE(MAX(updated_at), 0)").Row()
	if err := row.Scan(&v.MaxUpdated); err != nil {
		return v, err
	}
	return v, nil
}

// IsHookConfigNameDuplicated 校验名称唯一（excludeId 用于更新时排除自身）。
func IsHookConfigNameDuplicated(excludeId int, name string) (bool, error) {
	var count int64
	err := DB.Model(&HookConfig{}).Where("name = ? AND id <> ?", name, excludeId).Count(&count).Error
	return count > 0, err
}

func (h *HookConfig) Insert() error {
	return DB.Create(h).Error
}

func (h *HookConfig) Update() error {
	// 显式更新 updated_at:Select 指定列时 GORM 的 autoUpdateTime 行为不稳定,
	// 而多实例热加载的版本轮询依赖 updated_at 变化。
	h.UpdatedAt = time.Now().Unix()
	// 用 Select 显式覆盖全部业务字段，确保布尔/零值（如 Enabled=false）也能落库。
	return DB.Model(h).Where("id = ?", h.Id).Select(
		"name", "type", "enabled", "events", "mode", "fail_mode",
		"timeout_ms", "priority", "match_json", "config_json", "updated_at",
	).Updates(h).Error
}

func DeleteHookConfigById(id int) error {
	return DB.Delete(&HookConfig{}, "id = ?", id).Error
}
