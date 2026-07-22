package middleware

import (
	"bufio"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/archive"

	"github.com/gin-gonic/gin"
)

// captureWriter 在写给客户端的同时把响应体（含 SSE 流）复制到有界缓冲，
// 供请求结束后归档。超出上限后停止复制、只打截断标记，不影响正常输出。
type captureWriter struct {
	gin.ResponseWriter
	buf       []byte
	limit     int64
	truncated bool
	hijacked  bool
}

func (w *captureWriter) capture(data []byte) {
	remain := w.limit - int64(len(w.buf))
	if remain <= 0 {
		w.truncated = true
		return
	}
	if int64(len(data)) > remain {
		w.buf = append(w.buf, data[:remain]...)
		w.truncated = true
		return
	}
	w.buf = append(w.buf, data...)
}

func (w *captureWriter) Write(data []byte) (int, error) {
	w.capture(data)
	return w.ResponseWriter.Write(data)
}

func (w *captureWriter) WriteString(s string) (int, error) {
	w.capture([]byte(s))
	return w.ResponseWriter.WriteString(s)
}

func (w *captureWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	w.hijacked = true
	return w.ResponseWriter.Hijack()
}

// RelayArchive 中转请求归档中间件：请求结束后把原始请求/响应正文与
// 用户/令牌/模型/渠道等元数据异步写入 ES（监管留存，不脱敏）。
// 必须挂在 TokenAuth/UserAuth 之后（保证可归因）、Distribute 之前
// （保证分发失败的请求也被归档）。归档未启用时为零开销直通。
func RelayArchive() gin.HandlerFunc {
	if !archive.Enabled() {
		return func(c *gin.Context) { c.Next() }
	}
	limit := archive.MaxBodyBytes()
	return func(c *gin.Context) {
		start := time.Now()
		cw := &captureWriter{ResponseWriter: c.Writer, limit: limit}
		c.Writer = cw
		c.Next()
		archive.Enqueue(buildEntry(c, cw, start))
	}
}

func buildEntry(c *gin.Context, cw *captureWriter, start time.Time) *archive.Entry {
	e := &archive.Entry{
		Timestamp:         start,
		RequestId:         c.GetString(common.RequestIdKey),
		UpstreamRequestId: c.GetString(common.UpstreamRequestIdKey),
		UserId:            c.GetInt("id"),
		Username:          c.GetString("username"),
		TokenId:           c.GetInt("token_id"),
		TokenName:         c.GetString("token_name"),
		Group:             c.GetString("group"),
		Model:             c.GetString("original_model"),
		ChannelId:         common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		ChannelName:       common.GetContextKeyString(c, constant.ContextKeyChannelName),
		UseChannels:       c.GetStringSlice("use_channel"),
		Method:            c.Request.Method,
		Path:              c.Request.URL.Path,
		ClientIP:          c.ClientIP(),
		UserAgent:         c.Request.UserAgent(),
		StatusCode:        cw.Status(),
		IsStream:          common.GetContextKeyBool(c, constant.ContextKeyIsStream),
		Hijacked:          cw.hijacked,
		LatencyMs:         time.Since(start).Milliseconds(),
		RejectReason:      common.GetContextKeyString(c, constant.ContextKeyAdminRejectReason),
	}

	e.RequestContentType = c.ContentType()
	e.RequestBody, e.RequestTruncated = readRequestBody(c, cw.limit)

	e.ResponseContentType = cw.Header().Get("Content-Type")
	e.ResponseBody = string(cw.buf)
	e.ResponseTruncated = cw.truncated
	return e
}

// readRequestBody 从 BodyStorage 读原始请求体（可重复读，handler 已消费
// 过也不受影响）。BodyStorageCleanup 在本中间件之后才执行清理，此处仍可读。
func readRequestBody(c *gin.Context, limit int64) (string, bool) {
	if c.Request == nil || c.Request.Method == http.MethodGet {
		return "", false
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil || storage == nil {
		return "", false
	}
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return "", false
	}
	data, err := io.ReadAll(io.LimitReader(storage, limit+1))
	if err != nil {
		return "", false
	}
	if int64(len(data)) > limit {
		return string(data[:limit]), true
	}
	return string(data), false
}
