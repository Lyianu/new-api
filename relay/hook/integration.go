package hook

// 本文件是 relay/hook 与上游中转流程的唯一耦合面:把 gin.Context + RelayInfo 适配成
// 与协议无关的 HookContext,并把钩子的 Deny 决策翻译成 *types.NewAPIError。
// 上游 controller 只需调用 DispatchRequestReceived 一处。

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// 外发信封 / 归档时必须剔除的鉴权类请求头。
var sensitiveHeaders = []string{
	"Authorization",
	"X-Api-Key",
	"X-Goog-Api-Key",
	"Api-Key",
	"Cookie",
	"Proxy-Authorization",
}

// DispatchRequestReceived 在 request.received 事件上运行钩子。
// 返回非 nil 时调用方应中断中转并返回该错误(钩子阻断)。无钩子订阅时零开销直接返回。
func DispatchRequestReceived(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	if !manager.hasHooks(EventRequestReceived) {
		return nil
	}

	hc := buildContext(c, info)
	res := manager.Dispatch(c.Request.Context(), hc)
	if res == nil || res.Decision != DecisionDeny {
		return nil
	}

	msg := res.Message
	if msg == "" {
		msg = "request blocked by hook"
	}
	if res.Code != "" {
		msg = fmt.Sprintf("%s (%s)", msg, res.Code)
	}
	status := res.StatusCode
	if status <= 0 {
		status = 403
	}
	return types.NewError(
		fmt.Errorf("%s", msg),
		types.ErrorCodePromptBlocked,
		types.ErrOptionWithStatusCode(status),
		types.ErrOptionWithSkipRetry(),
	)
}

func buildContext(c *gin.Context, info *relaycommon.RelayInfo) *HookContext {
	// request.received 在渠道最终选定之前触发,info.ChannelMeta 此时可能为 nil。
	// 渠道信息按上下文键尽力读取(未选定则为 0),避免解引用 nil 的内嵌 *ChannelMeta。
	requestID := info.RequestId
	if requestID == "" {
		requestID = c.GetString(common.RequestIdKey)
	}
	hc := &HookContext{
		Event:       EventRequestReceived,
		RequestID:   requestID,
		UserID:      info.UserId,
		TokenID:     info.TokenId,
		ChannelID:   common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		ChannelType: common.GetContextKeyInt(c, constant.ContextKeyChannelType),
		TokenName:   c.GetString("token_name"),
		Group:       info.UsingGroup,
		ModelName:   info.OriginModelName,
		RegionTag:   info.UsingGroup, // Phase 1:以分组作为地区标签;后续可由渠道标签 / IP geo 细化
		RelayFormat: info.RelayFormat,
		RelayMode:   info.RelayMode,
		ClientIP:    c.ClientIP(),
		StartTime:   info.StartTime,
		Headers:     sanitizeHeaders(c),
	}

	if body, err := readRequestBody(c); err != nil {
		common.SysError("hook: read request body failed: " + err.Error())
	} else {
		hc.RawRequestBody = body
	}
	return hc
}

// readRequestBody 取客户端原始体。Bytes() 不改变 storage 读位置,不影响后续中转读取。
func readRequestBody(c *gin.Context) ([]byte, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	return storage.Bytes()
}

func sanitizeHeaders(c *gin.Context) map[string][]string {
	if c.Request == nil {
		return nil
	}
	cloned := c.Request.Header.Clone()
	for _, h := range sensitiveHeaders {
		cloned.Del(h)
	}
	return cloned
}
