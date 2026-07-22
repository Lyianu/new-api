// Package archive 将中转请求的原始报文归档到 Elasticsearch，满足监管留存
// 与追责要求。归档内容刻意不做脱敏：原始请求/响应正文用于事后审计与
// jailbreak 分类器训练，元数据（用户/令牌/模型/渠道/requestId 等）冗余
// 存储一份，保证归档自包含——数据库消费日志可能被清理，且失败或被拦截
// 的请求在库中未必有记录；requestId 同时保留，便于回查库内计费细节。
//
// 写入完全异步（有界队列 + 批量 bulk），ES 不可用或队列打满时丢弃并计数，
// 绝不阻塞或影响业务请求（fail-open）。
package archive

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Entry 一条归档记录。字段保持扁平，便于 ES 动态映射与 Kibana 检索。
type Entry struct {
	Timestamp         time.Time `json:"@timestamp"`
	RequestId         string    `json:"request_id,omitempty"`
	UpstreamRequestId string    `json:"upstream_request_id,omitempty"`

	UserId    int    `json:"user_id"`
	Username  string `json:"username,omitempty"`
	TokenId   int    `json:"token_id,omitempty"`
	TokenName string `json:"token_name,omitempty"`
	Group     string `json:"group,omitempty"`

	Model       string   `json:"model,omitempty"`
	ChannelId   int      `json:"channel_id,omitempty"`
	ChannelName string   `json:"channel_name,omitempty"`
	UseChannels []string `json:"use_channels,omitempty"`

	Method    string `json:"method,omitempty"`
	Path      string `json:"path,omitempty"`
	ClientIP  string `json:"client_ip,omitempty"`
	UserAgent string `json:"user_agent,omitempty"`

	StatusCode   int    `json:"status_code"`
	IsStream     bool   `json:"is_stream"`
	Hijacked     bool   `json:"hijacked,omitempty"`
	LatencyMs    int64  `json:"latency_ms"`
	RejectReason string `json:"reject_reason,omitempty"`

	RequestContentType string `json:"request_content_type,omitempty"`
	RequestBody        string `json:"request_body,omitempty"`
	RequestTruncated   bool   `json:"request_truncated,omitempty"`

	ResponseContentType string `json:"response_content_type,omitempty"`
	ResponseBody        string `json:"response_body,omitempty"`
	ResponseTruncated   bool   `json:"response_truncated,omitempty"`
}

type config struct {
	enabled            bool
	url                string
	username           string
	password           string
	apiKey             string
	indexPrefix        string
	maxBodyBytes       int64
	queueSize          int
	batchSize          int
	flushInterval      time.Duration
	insecureSkipVerify bool
}

var (
	initOnce sync.Once
	cfg      config
	queue    chan *Entry
	stopCh   chan struct{}
	doneCh   chan struct{}
	client   *http.Client

	droppedCount atomic.Int64
	failedCount  atomic.Int64
)

// ensureInit 延迟到首次使用时读 env，保证 .env 已由 main 加载。
func ensureInit() {
	initOnce.Do(func() {
		cfg = config{
			enabled:            common.GetEnvOrDefaultBool("ARCHIVE_ES_ENABLED", false),
			url:                strings.TrimRight(common.GetEnvOrDefaultString("ARCHIVE_ES_URL", ""), "/"),
			username:           common.GetEnvOrDefaultString("ARCHIVE_ES_USERNAME", ""),
			password:           common.GetEnvOrDefaultString("ARCHIVE_ES_PASSWORD", ""),
			apiKey:             common.GetEnvOrDefaultString("ARCHIVE_ES_API_KEY", ""),
			indexPrefix:        common.GetEnvOrDefaultString("ARCHIVE_ES_INDEX_PREFIX", "relay-archive"),
			maxBodyBytes:       int64(common.GetEnvOrDefault("ARCHIVE_ES_MAX_BODY_BYTES", 1<<20)),
			queueSize:          common.GetEnvOrDefault("ARCHIVE_ES_QUEUE_SIZE", 4096),
			batchSize:          common.GetEnvOrDefault("ARCHIVE_ES_BATCH_SIZE", 32),
			flushInterval:      time.Duration(common.GetEnvOrDefault("ARCHIVE_ES_FLUSH_INTERVAL_MS", 2000)) * time.Millisecond,
			insecureSkipVerify: common.GetEnvOrDefaultBool("ARCHIVE_ES_INSECURE_SKIP_VERIFY", false),
		}
		if cfg.enabled && cfg.url == "" {
			common.SysError("archive: ARCHIVE_ES_ENABLED=true 但未配置 ARCHIVE_ES_URL，归档已禁用")
			cfg.enabled = false
		}
		if !cfg.enabled {
			return
		}
		transport := &http.Transport{}
		if cfg.insecureSkipVerify {
			transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
		}
		client = &http.Client{Timeout: 15 * time.Second, Transport: transport}
		queue = make(chan *Entry, cfg.queueSize)
		stopCh = make(chan struct{})
		doneCh = make(chan struct{})
		go worker()
		common.SysLog(fmt.Sprintf("archive: ES 归档已启用，url=%s indexPrefix=%s", cfg.url, cfg.indexPrefix))
	})
}

// Enabled 归档是否启用（供中间件在路由构建期决定是否挂载）。
func Enabled() bool {
	ensureInit()
	return cfg.enabled
}

// MaxBodyBytes 单方向正文归档上限（截断后仍写入并打 truncated 标记）。
func MaxBodyBytes() int64 {
	ensureInit()
	return cfg.maxBodyBytes
}

// Enqueue 非阻塞投递。队列满则丢弃并计数——归档绝不能拖慢业务请求。
func Enqueue(e *Entry) {
	if e == nil || !Enabled() {
		return
	}
	select {
	case queue <- e:
	default:
		if n := droppedCount.Add(1); n == 1 || n%100 == 0 {
			common.SysError(fmt.Sprintf("archive: 队列已满，累计丢弃 %d 条归档记录", n))
		}
	}
}

// Shutdown 关停前尽力清空队列，避免丢失尾部记录。超时后放弃。
func Shutdown(timeout time.Duration) {
	if !Enabled() {
		return
	}
	close(stopCh)
	select {
	case <-doneCh:
	case <-time.After(timeout):
		common.SysError("archive: 关停清空归档队列超时，剩余记录已放弃")
	}
}

func worker() {
	defer close(doneCh)
	ticker := time.NewTicker(cfg.flushInterval)
	defer ticker.Stop()
	batch := make([]*Entry, 0, cfg.batchSize)
	flush := func() {
		if len(batch) == 0 {
			return
		}
		sendBulk(batch)
		batch = batch[:0]
	}
	for {
		select {
		case e := <-queue:
			batch = append(batch, e)
			if len(batch) >= cfg.batchSize {
				flush()
			}
		case <-ticker.C:
			flush()
		case <-stopCh:
			// 排空队列后退出
			for {
				select {
				case e := <-queue:
					batch = append(batch, e)
					if len(batch) >= cfg.batchSize {
						flush()
					}
				default:
					flush()
					return
				}
			}
		}
	}
}

func indexName(t time.Time) string {
	return fmt.Sprintf("%s-%s", cfg.indexPrefix, t.UTC().Format("2006.01.02"))
}

// sendBulk 以 ES bulk API 写入一批记录，失败重试一次后丢弃并计数。
func sendBulk(batch []*Entry) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	for _, e := range batch {
		meta := map[string]map[string]string{"create": {"_index": indexName(e.Timestamp)}}
		if err := enc.Encode(meta); err != nil {
			continue
		}
		if err := enc.Encode(e); err != nil {
			// 回滚 meta 行，避免 bulk 报文错位
			buf.Truncate(buf.Len() - lastLineLen(&buf))
			continue
		}
	}
	if buf.Len() == 0 {
		return
	}
	payload := buf.Bytes()
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Second)
		}
		lastErr = doBulkRequest(payload)
		if lastErr == nil {
			return
		}
	}
	n := failedCount.Add(int64(len(batch)))
	common.SysError(fmt.Sprintf("archive: bulk 写入失败（累计丢弃 %d 条）: %v", n, lastErr))
}

// lastLineLen 返回缓冲区最后一行（含换行）的长度，用于编码失败时回滚。
func lastLineLen(buf *bytes.Buffer) int {
	b := buf.Bytes()
	if len(b) == 0 {
		return 0
	}
	// 最后一个字节必为 '\n'（json.Encoder 行为），找上一行边界
	idx := bytes.LastIndexByte(b[:len(b)-1], '\n')
	return len(b) - idx - 1
}

func doBulkRequest(payload []byte) error {
	req, err := http.NewRequest(http.MethodPost, cfg.url+"/_bulk", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-ndjson")
	if cfg.apiKey != "" {
		req.Header.Set("Authorization", "ApiKey "+cfg.apiKey)
	} else if cfg.username != "" {
		req.SetBasicAuth(cfg.username, cfg.password)
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("es bulk status %d: %s", resp.StatusCode, string(body))
	}
	// bulk 整体 200 时单条仍可能失败，检查 errors 标志并记录（不重试单条）
	var bulkResp struct {
		Errors bool `json:"errors"`
	}
	if json.Unmarshal(body, &bulkResp) == nil && bulkResp.Errors {
		common.SysError("archive: bulk 响应包含单条写入错误: " + common.LocalLogPreview(string(body)))
	}
	return nil
}
