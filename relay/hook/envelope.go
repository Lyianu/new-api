package hook

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/common"
)

// 外部 Webhook 信封是 new-api 与外部钩子服务之间的稳定契约。
// 大多数钩子无需写 Go,只要实现一个接收 RequestEnvelope、返回 ResponseEnvelope 的 HTTP 端点。

// RequestEnvelope 是 new-api -> 外部钩子的请求体。
type RequestEnvelope struct {
	Event     string            `json:"event"`
	RequestID string            `json:"requestId"`
	Principal EnvelopePrincipal `json:"principal"`
	Route     EnvelopeRoute     `json:"route"`
	Client    EnvelopeClient    `json:"client"`
	Request   EnvelopeRequest   `json:"request"`
	Response  *EnvelopeResponse `json:"response,omitempty"`
}

type EnvelopePrincipal struct {
	UserID    int    `json:"userId"`
	TokenID   int    `json:"tokenId"`
	TokenName string `json:"tokenName,omitempty"`
	Group     string `json:"group,omitempty"`
	Region    string `json:"region,omitempty"`
}

type EnvelopeRoute struct {
	RelayFormat string `json:"relayFormat"`
	RelayMode   int    `json:"relayMode"`
	Model       string `json:"model"`
	ChannelID   int    `json:"channelId"`
	ChannelType int    `json:"channelType"`
}

type EnvelopeClient struct {
	IP string `json:"ip,omitempty"`
}

type EnvelopeRequest struct {
	Headers map[string]string `json:"headers,omitempty"`
	// Body 直接透传客户端原始 JSON,避免二次序列化损失精度。
	Body json.RawMessage `json:"body,omitempty"`
}

type EnvelopeResponse struct {
	StatusCode int             `json:"statusCode,omitempty"`
	Body       json.RawMessage `json:"body,omitempty"`
}

// ResponseEnvelope 是外部钩子 -> new-api 的响应体。
type ResponseEnvelope struct {
	Decision string          `json:"decision"`          // "allow" | "deny" | "modify"
	Status   int             `json:"status,omitempty"`  // deny 时返回给客户端的状态码
	Code     string          `json:"code,omitempty"`    // deny 时错误码
	Message  string          `json:"message,omitempty"` // deny 时错误信息
	Patch    json.RawMessage `json:"patch,omitempty"`   // modify 时的新请求体（Phase 2）
}

// BuildRequestEnvelope 从 HookContext 组装外发信封。Headers 已在上游脱敏。
func BuildRequestEnvelope(hc *HookContext) *RequestEnvelope {
	env := &RequestEnvelope{
		Event:     string(hc.Event),
		RequestID: hc.RequestID,
		Principal: EnvelopePrincipal{
			UserID:    hc.UserID,
			TokenID:   hc.TokenID,
			TokenName: hc.TokenName,
			Group:     hc.Group,
			Region:    hc.RegionTag,
		},
		Route: EnvelopeRoute{
			RelayFormat: string(hc.RelayFormat),
			RelayMode:   hc.RelayMode,
			Model:       hc.ModelName,
			ChannelID:   hc.ChannelID,
			ChannelType: hc.ChannelType,
		},
		Client: EnvelopeClient{IP: hc.ClientIP},
		Request: EnvelopeRequest{
			Headers: flattenHeaders(hc.Headers),
			Body:    rawJSONOrNil(hc.RawRequestBody),
		},
	}
	if len(hc.ResponseBody) > 0 || hc.StatusCode != 0 {
		env.Response = &EnvelopeResponse{
			StatusCode: hc.StatusCode,
			Body:       rawJSONOrNil(hc.ResponseBody),
		}
	}
	return env
}

// ParseResponseEnvelope 解析外部钩子返回的信封,并转成 *HookResult。
func ParseResponseEnvelope(data []byte) (*HookResult, error) {
	var env ResponseEnvelope
	if err := common.Unmarshal(data, &env); err != nil {
		return nil, err
	}
	switch env.Decision {
	case "deny", "block":
		status := env.Status
		if status == 0 {
			status = 403
		}
		return &HookResult{
			Decision:   DecisionDeny,
			StatusCode: status,
			Code:       env.Code,
			Message:    env.Message,
		}, nil
	case "modify":
		return &HookResult{
			Decision:     DecisionModify,
			ModifiedBody: []byte(env.Patch),
		}, nil
	default: // "allow" / "" / 其他 -> 放行
		return cont(), nil
	}
}

func flattenHeaders(h map[string][]string) map[string]string {
	if len(h) == 0 {
		return nil
	}
	out := make(map[string]string, len(h))
	for k, v := range h {
		if len(v) > 0 {
			out[k] = v[0]
		}
	}
	return out
}

// rawJSONOrNil 仅在 body 是合法 JSON 时透传为 RawMessage,否则返回 nil
// （非 JSON 体——如二进制音频——不塞进信封,由 archive 等按需处理）。
// 校验经由 common.Unmarshal,避免直接调用 encoding/json 的函数。
func rawJSONOrNil(body []byte) json.RawMessage {
	if len(body) == 0 {
		return nil
	}
	var probe json.RawMessage
	if err := common.Unmarshal(body, &probe); err != nil {
		return nil
	}
	return json.RawMessage(body)
}
