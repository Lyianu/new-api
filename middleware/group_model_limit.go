package middleware

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// GroupModelLimit 按「分组 × 模型」规则对**每个用户各自**施加并发(in-flight)
// 与 RPM 限制：分组对模型 A 配 5 并发，则该分组每个用户调用 A 时各有 5 并发。
//
// 必须放在 Distribute() 之后：此时实际计费分组(UsingGroup，含 auto 分组解析)
// 与模型名已入 context。限流计数键使用「命中规则的模式」而非具体模型名/渠道，
// 因此同一条规则（如 claude-*）覆盖的所有模型共享一个计数器，规则作用域与
// 计数粒度严格一致。规则配置见 setting.GroupModelLimit（系统设置 → 速率限制）。
func GroupModelLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := common.GetContextKeyInt(c, constant.ContextKeyUserId)
		if userId <= 0 {
			c.Next()
			return
		}
		// 快路径：无任何规则时直接放行（纯内存读，近零开销）。
		if !setting.HasGroupModelLimits() {
			c.Next()
			return
		}
		group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
		if group == "" {
			group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
		}
		modelName := c.GetString("original_model")

		limit := setting.ResolveGroupModelLimit(group, modelName)
		if limit.MaxConcurrency <= 0 && limit.RpmLimit <= 0 {
			c.Next()
			return
		}

		// RPM：先判定（不占用并发槽）。
		if limit.RpmLimit > 0 {
			key := fmt.Sprintf("%d:%s:%s", userId, group, limit.RpmRule)
			if !service.AllowRpm(key, limit.RpmLimit) {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests,
					fmt.Sprintf("您已达到该模型的每分钟请求上限：%d 次/分钟", limit.RpmLimit))
				return
			}
		}

		// 并发：占用一个 in-flight 槽，请求结束（含下游流式响应）后释放。
		if limit.MaxConcurrency > 0 {
			key := fmt.Sprintf("%d:%s:%s", userId, group, limit.ConcurrencyRule)
			ok, release := service.AcquireInflight(key, limit.MaxConcurrency)
			if !ok {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests,
					fmt.Sprintf("您已达到该模型的并发上限：%d", limit.MaxConcurrency))
				return
			}
			defer release()
		}

		c.Next()
	}
}
