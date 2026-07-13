package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// validateCustomerPolicy 校验策略规则的合法性（钱相关，严格自检）。
func validateCustomerPolicy(p *model.CustomerPolicy) (string, bool) {
	if p.UserId <= 0 {
		return "用户ID无效", false
	}
	if p.VendorId < 0 || p.ChannelId < 0 {
		return "供应商或渠道ID无效", false
	}
	// DiscountRatio: 0 表示未设(继承默认)，否则必须 (0,10] 之间，避免误配成 0 折扣或极端放大。
	if p.DiscountRatio < 0 || p.DiscountRatio > 10 {
		return "折扣倍率必须在 0 到 10 之间（0 表示不设折扣）", false
	}
	if p.MaxConcurrency < 0 || p.RpmLimit < 0 {
		return "并发或RPM限制不能为负", false
	}
	return "", true
}

// GetUserCustomerPolicies 列出某用户的全部策略规则（管理员）。
func GetUserCustomerPolicies(c *gin.Context) {
	userId, err := strconv.Atoi(c.Query("user_id"))
	if err != nil || userId <= 0 {
		common.ApiErrorMsg(c, "用户ID无效")
		return
	}
	policies, err := model.GetCustomerPoliciesByUser(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, policies)
}

// AddCustomerPolicy 新增策略规则（管理员）。
func AddCustomerPolicy(c *gin.Context) {
	var p model.CustomerPolicy
	if err := c.ShouldBindJSON(&p); err != nil {
		common.ApiError(c, err)
		return
	}
	if msg, ok := validateCustomerPolicy(&p); !ok {
		common.ApiErrorMsg(c, msg)
		return
	}
	if err := p.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidatePolicyCache()
	common.ApiSuccess(c, p)
}

// UpdateCustomerPolicy 更新策略规则（管理员）。
func UpdateCustomerPolicy(c *gin.Context) {
	var p model.CustomerPolicy
	if err := c.ShouldBindJSON(&p); err != nil {
		common.ApiError(c, err)
		return
	}
	if p.Id <= 0 {
		common.ApiErrorMsg(c, "策略ID无效")
		return
	}
	if msg, ok := validateCustomerPolicy(&p); !ok {
		common.ApiErrorMsg(c, msg)
		return
	}
	if err := p.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidatePolicyCache()
	common.ApiSuccess(c, p)
}

// DeleteCustomerPolicy 删除策略规则（管理员）。
func DeleteCustomerPolicy(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "策略ID无效")
		return
	}
	if err := model.DeleteCustomerPolicy(id); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidatePolicyCache()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
