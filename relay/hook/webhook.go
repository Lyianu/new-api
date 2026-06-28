package hook

import (
	"context"
	"fmt"

	"github.com/QuantumNous/new-api/common"
)

// webhook 是主力内置类型:把钩子做成稳定的 HTTP 信封协议。
// 审计服务实现一个接收 RequestEnvelope、返回 ResponseEnvelope 的端点即可,无需改 new-api、不重编译。

type webhookConfig struct {
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers,omitempty"`
}

type webhookHook struct {
	BaseHook
	cfg webhookConfig
}

// NewWebhookHook 是 "webhook" 类型工厂。
func NewWebhookHook(s Spec) (Hook, error) {
	var cfg webhookConfig
	if len(s.RawConfig) > 0 {
		if err := common.Unmarshal(s.RawConfig, &cfg); err != nil {
			return nil, fmt.Errorf("webhook %q: invalid config: %w", s.Name, err)
		}
	}
	if cfg.URL == "" {
		return nil, fmt.Errorf("webhook %q: missing url", s.Name)
	}
	return &webhookHook{BaseHook: NewBaseHook(s), cfg: cfg}, nil
}

func (h *webhookHook) Handle(ctx context.Context, hc *HookContext) (*HookResult, error) {
	env := BuildRequestEnvelope(hc)
	payload, err := common.Marshal(env)
	if err != nil {
		return nil, fmt.Errorf("marshal envelope: %w", err)
	}

	resp, err := postJSON(ctx, h.cfg.URL, h.cfg.Headers, payload, h.Timeout())
	if err != nil {
		return nil, err
	}
	// 非 2xx 视为钩子不可用,交由 FailMode 决定阻断 / 放行(审计场景应为 fail-closed)。
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("hook %q returned status %d", h.Name(), resp.StatusCode)
	}
	return ParseResponseEnvelope(resp.Body)
}

func init() {
	RegisterHookType("webhook", NewWebhookHook)
}
