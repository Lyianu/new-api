package middleware

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// UserPolicyLimit 按「客户 × (渠道, 模型)」粒度施加并发(in-flight)与 RPM 限制。
// 必须放在 Distribute() 之后：此时渠道已选定(channel_id/original_model 已入 context)，
// 才能做渠道级限流。限额由 PolicyResolver 解析，查不到则回落系统默认(不限)。
func UserPolicyLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := common.GetContextKeyInt(c, constant.ContextKeyUserId)
		if userId <= 0 {
			c.Next()
			return
		}
		// 快路径：无任何客户策略时直接放行，零开销。
		if !service.HasCustomerPolicies() {
			c.Next()
			return
		}
		channelId := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
		modelName := c.GetString("original_model")
		group := common.GetContextKeyString(c, constant.ContextKeyUserGroup)

		vendorId := model.GetModelVendorID(modelName)
		policy := service.GetPolicyResolver().Resolve(service.PolicyContext{
			UserId:    userId,
			Group:     group,
			VendorId:  vendorId,
			ChannelId: channelId,
			ModelName: modelName,
		})

		// 无任何限制则直接放行，避免额外开销。
		if policy.RpmLimit <= 0 && policy.MaxConcurrency <= 0 {
			c.Next()
			return
		}

		limitKey := fmt.Sprintf("%d:%d:%s", userId, channelId, modelName)

		// RPM：先判定（不占用并发槽）。
		if policy.RpmLimit > 0 && !service.AllowRpm(limitKey, policy.RpmLimit) {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests,
				fmt.Sprintf("您已达到该渠道/模型的每分钟请求上限：%d 次/分钟", policy.RpmLimit))
			return
		}

		// 并发：占用一个 in-flight 槽，请求结束（含下游处理）后释放。
		if policy.MaxConcurrency > 0 {
			ok, release := service.AcquireInflight(limitKey, policy.MaxConcurrency)
			if !ok {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests,
					fmt.Sprintf("您已达到该渠道/模型的并发上限：%d", policy.MaxConcurrency))
				return
			}
			defer release()
		}

		c.Next()
	}
}
