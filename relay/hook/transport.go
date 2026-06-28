package hook

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

// sharedTransport 复用连接,避免每次钩子调用新建 TCP/TLS。
var sharedHTTPClient = &http.Client{
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
	},
}

// httpResponse 是一次钩子 HTTP 调用的结果。
type httpResponse struct {
	StatusCode int
	Body       []byte
}

// postJSON 向 url POST 一段 JSON,带超时与自定义 header。
// 由调用方（webhook/archive）传入已序列化的 payload,避免在此处依赖具体信封类型。
func postJSON(ctx context.Context, url string, headers map[string]string, payload []byte, timeout time.Duration) (*httpResponse, error) {
	reqCtx := ctx
	if timeout > 0 {
		var cancel context.CancelFunc
		reqCtx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := sharedHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// 限制响应体大小,避免恶意 / 异常的超大响应拖垮关键路径。
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1 MiB
	if err != nil {
		return nil, fmt.Errorf("read hook response: %w", err)
	}
	return &httpResponse{StatusCode: resp.StatusCode, Body: body}, nil
}
