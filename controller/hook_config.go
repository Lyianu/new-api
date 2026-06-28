package controller

// FORK: 自定义钩子（Custom Hooks）管理后台 CRUD。纯新增,不修改上游。
// wire 层用结构化 JSON（events/match/config）,存储层用 TEXT 列字符串,二者在此转换。

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/hook"

	"github.com/gin-gonic/gin"
)

// hookConfigDTO 是钩子配置的 API 形态:三个 JSON blob 以结构化 JSON 暴露 / 接收,
// 避免与前端之间出现「JSON 字符串里再套 JSON」的双重转义。
type hookConfigDTO struct {
	Id        int             `json:"id"`
	Name      string          `json:"name"`
	Type      string          `json:"type"`
	Enabled   bool            `json:"enabled"`
	Events    json.RawMessage `json:"events"`
	Mode      string          `json:"mode"`
	FailMode  string          `json:"fail_mode"`
	TimeoutMs int             `json:"timeout_ms"`
	Priority  int             `json:"priority"`
	Match     json.RawMessage `json:"match"`
	Config    json.RawMessage `json:"config"`
	CreatedAt int64           `json:"created_at"`
	UpdatedAt int64           `json:"updated_at"`
}

func toHookDTO(m *model.HookConfig) hookConfigDTO {
	return hookConfigDTO{
		Id:        m.Id,
		Name:      m.Name,
		Type:      m.Type,
		Enabled:   m.Enabled,
		Events:    rawOrDefault(m.Events, "[]"),
		Mode:      m.Mode,
		FailMode:  m.FailMode,
		TimeoutMs: m.TimeoutMs,
		Priority:  m.Priority,
		Match:     rawOrDefault(m.MatchJSON, "{}"),
		Config:    rawOrDefault(m.ConfigJSON, "{}"),
		CreatedAt: m.CreatedAt,
		UpdatedAt: m.UpdatedAt,
	}
}

func rawOrDefault(s, def string) json.RawMessage {
	if strings.TrimSpace(s) == "" {
		return json.RawMessage(def)
	}
	return json.RawMessage(s)
}

// applyToModel 把 DTO 写回 model（仅业务字段;Id / 时间戳单独处理）。
func (d *hookConfigDTO) applyToModel(m *model.HookConfig) {
	m.Name = strings.TrimSpace(d.Name)
	m.Type = strings.TrimSpace(d.Type)
	m.Enabled = d.Enabled
	m.Events = rawToString(d.Events)
	m.Mode = d.Mode
	m.FailMode = d.FailMode
	m.TimeoutMs = d.TimeoutMs
	m.Priority = d.Priority
	m.MatchJSON = rawToString(d.Match)
	m.ConfigJSON = rawToString(d.Config)
}

func rawToString(r json.RawMessage) string {
	s := strings.TrimSpace(string(r))
	if s == "" || s == "null" {
		return ""
	}
	return s
}

// validateHookDTO 做提交前的基本校验。
func validateHookDTO(d *hookConfigDTO) string {
	if strings.TrimSpace(d.Name) == "" {
		return "钩子名称不能为空"
	}
	if !hook.IsRegisteredType(strings.TrimSpace(d.Type)) {
		return "不支持的钩子类型: " + d.Type
	}
	// events 必填且为非空 JSON 数组。
	var events []string
	if err := common.Unmarshal(rawOrDefault(string(d.Events), "[]"), &events); err != nil {
		return "events 不是合法的 JSON 数组"
	}
	if len(events) == 0 {
		return "至少需要订阅一个事件"
	}
	if d.Mode != "" && d.Mode != string(hook.ModeSync) && d.Mode != string(hook.ModeAsync) {
		return "mode 仅支持 sync / async"
	}
	if d.FailMode != "" && d.FailMode != string(hook.FailClosed) && d.FailMode != string(hook.FailOpen) {
		return "fail_mode 仅支持 closed / open"
	}
	// match / config 若非空需为合法 JSON。
	if s := rawToString(d.Match); s != "" {
		var probe json.RawMessage
		if err := common.UnmarshalJsonStr(s, &probe); err != nil {
			return "match 不是合法 JSON"
		}
	}
	if s := rawToString(d.Config); s != "" {
		var probe json.RawMessage
		if err := common.UnmarshalJsonStr(s, &probe); err != nil {
			return "config 不是合法 JSON"
		}
	}
	return ""
}

func reloadHooks() {
	if err := hook.Reload(); err != nil {
		common.SysError("hook reload after CRUD failed: " + err.Error())
	}
}

// GetAllHookConfigs 列出全部钩子配置。
func GetAllHookConfigs(c *gin.Context) {
	configs, err := model.GetAllHookConfigs()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	dtos := make([]hookConfigDTO, 0, len(configs))
	for _, m := range configs {
		dtos = append(dtos, toHookDTO(m))
	}
	common.ApiSuccess(c, dtos)
}

// GetHookConfig 读取单条钩子配置。
func GetHookConfig(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	m, err := model.GetHookConfigById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, toHookDTO(m))
}

// CreateHookConfig 新建钩子配置。
func CreateHookConfig(c *gin.Context) {
	var d hookConfigDTO
	if err := c.ShouldBindJSON(&d); err != nil {
		common.ApiError(c, err)
		return
	}
	if msg := validateHookDTO(&d); msg != "" {
		common.ApiErrorMsg(c, msg)
		return
	}
	if dup, err := model.IsHookConfigNameDuplicated(0, strings.TrimSpace(d.Name)); err != nil {
		common.ApiError(c, err)
		return
	} else if dup {
		common.ApiErrorMsg(c, "钩子名称已存在")
		return
	}

	var m model.HookConfig
	d.applyToModel(&m)
	if err := m.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	reloadHooks()
	common.ApiSuccess(c, toHookDTO(&m))
}

// UpdateHookConfig 更新钩子配置。
func UpdateHookConfig(c *gin.Context) {
	var d hookConfigDTO
	if err := c.ShouldBindJSON(&d); err != nil {
		common.ApiError(c, err)
		return
	}
	if d.Id == 0 {
		common.ApiErrorMsg(c, "缺少钩子 ID")
		return
	}
	if msg := validateHookDTO(&d); msg != "" {
		common.ApiErrorMsg(c, msg)
		return
	}
	if dup, err := model.IsHookConfigNameDuplicated(d.Id, strings.TrimSpace(d.Name)); err != nil {
		common.ApiError(c, err)
		return
	} else if dup {
		common.ApiErrorMsg(c, "钩子名称已存在")
		return
	}

	m, err := model.GetHookConfigById(d.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	d.applyToModel(m)
	if err := m.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	reloadHooks()
	common.ApiSuccess(c, toHookDTO(m))
}

// DeleteHookConfig 删除钩子配置。
func DeleteHookConfig(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteHookConfigById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	reloadHooks()
	common.ApiSuccess(c, nil)
}
