package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// 合规文档（服务条款/隐私政策/退款政策）的查询、确认与管理。
// 版本模型与门禁语义见 model/policy.go、service/policy_gate.go。

// GetPolicies 匿名接口：各文档最新版本全文，供注册页与公开政策页展示。
func GetPolicies(c *gin.Context) {
	latest, err := model.GetLatestPolicyVersions()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, latest)
}

type policyStatusItem struct {
	DocType         string `json:"doc_type"`
	Title           string `json:"title"`
	LatestVersion   int    `json:"latest_version"`
	AcceptedVersion int    `json:"accepted_version"`
	NeedsAccept     bool   `json:"needs_accept"`
	Block           bool   `json:"block"`
}

// GetPolicyStatus 当前用户的确认状态，登录后前端据此弹出重确认弹窗。
func GetPolicyStatus(c *gin.Context) {
	userId := c.GetInt("id")
	latest, err := model.GetLatestPolicyVersions()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	accepted, err := model.GetUserAcceptedVersions(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]policyStatusItem, 0, len(latest))
	for _, pv := range latest {
		item := policyStatusItem{
			DocType:         pv.DocType,
			Title:           pv.Title,
			LatestVersion:   pv.Version,
			AcceptedVersion: accepted[pv.DocType],
			Block:           pv.BlockUntilAccept,
		}
		item.NeedsAccept = item.AcceptedVersion < item.LatestVersion
		items = append(items, item)
	}
	common.ApiSuccess(c, items)
}

type acceptPoliciesRequest struct {
	DocTypes []string `json:"doc_types"`
}

// AcceptPolicies 记录当前用户对指定文档最新版本的确认。
func AcceptPolicies(c *gin.Context) {
	userId := c.GetInt("id")
	var req acceptPoliciesRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.DocTypes) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid params"})
		return
	}
	for _, t := range req.DocTypes {
		if !model.IsValidPolicyType(t) {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid doc type: " + t})
			return
		}
	}
	if err := model.AcceptPolicies(userId, c.ClientIP(), req.DocTypes); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidateUserPolicyCache(userId)
	common.ApiSuccess(c, nil)
}

// GetPolicyVersionHistory 管理端：某文档的版本历史。
func GetPolicyVersionHistory(c *gin.Context) {
	docType := c.Query("doc_type")
	if !model.IsValidPolicyType(docType) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid doc type"})
		return
	}
	versions, err := model.GetPolicyVersions(docType, 20)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, versions)
}

type publishPolicyRequest struct {
	DocType          string `json:"doc_type"`
	Title            string `json:"title"`
	Content          string `json:"content"`
	BlockUntilAccept bool   `json:"block_until_accept"`
}

// PublishPolicy 管理端：发布新版本。所有已确认旧版本的用户在下次登录时
// 需要重新确认；若勾选 block_until_accept，未确认前其 relay 调用被暂停。
func PublishPolicy(c *gin.Context) {
	var req publishPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid params"})
		return
	}
	if !model.IsValidPolicyType(req.DocType) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid doc type"})
		return
	}
	if req.Content == "" || req.Title == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "title and content are required"})
		return
	}
	pv, err := model.PublishPolicyVersion(req.DocType, req.Title, req.Content, req.BlockUntilAccept, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidatePolicyCaches()
	common.ApiSuccess(c, pv)
}
