package hook

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// archive 是内置的可靠归档类型,满足「原始请求留存」监管诉求。
// 采用进程内批量投递 + 磁盘 spill:ES 抖动时落盘补发,保证至少一次投递。
//
// 批量的生命周期与钩子实例解耦:按 (sink|endpoint|index) 复用全局 batchSink,
// 因此配置热加载重建钩子时不会泄漏 goroutine(distinct 端点数量很小)。

type archiveConfig struct {
	Sink       string            `json:"sink"`              // "elasticsearch" | "http"
	Endpoint   string            `json:"endpoint"`          // ES base url 或 collector url
	Index      string            `json:"index,omitempty"`   // 支持 %Y %m %d 占位
	Headers    map[string]string `json:"headers,omitempty"` // 鉴权头等
	BatchSize  int               `json:"batchSize,omitempty"`
	FlushMs    int               `json:"flushMs,omitempty"`
	SpillDir   string            `json:"spillDir,omitempty"`
	MaxBodyKB  int               `json:"maxBodyKB,omitempty"` // 单条 body 上限,超出截断
	SampleN    int               `json:"sampleN,omitempty"`   // >1 时每 N 条留 1 条
	IncludeRsp bool              `json:"includeResponse"`     // 是否在 completed 事件附带响应
}

type archiveHook struct {
	BaseHook
	cfg     archiveConfig
	sink    *batchSink
	counter uint64
}

// NewArchiveHook 是 "archive" 类型工厂。
func NewArchiveHook(s Spec) (Hook, error) {
	var cfg archiveConfig
	if len(s.RawConfig) > 0 {
		if err := common.Unmarshal(s.RawConfig, &cfg); err != nil {
			return nil, fmt.Errorf("archive %q: invalid config: %w", s.Name, err)
		}
	}
	if cfg.Endpoint == "" {
		return nil, fmt.Errorf("archive %q: missing endpoint", s.Name)
	}
	if cfg.Sink == "" {
		cfg.Sink = "elasticsearch"
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 200
	}
	if cfg.FlushMs <= 0 {
		cfg.FlushMs = 2000
	}
	return &archiveHook{BaseHook: NewBaseHook(s), cfg: cfg, sink: getSink(cfg)}, nil
}

func (h *archiveHook) Handle(ctx context.Context, hc *HookContext) (*HookResult, error) {
	// 采样:每 N 条留 1 条。
	if h.cfg.SampleN > 1 {
		if atomic.AddUint64(&h.counter, 1)%uint64(h.cfg.SampleN) != 0 {
			return cont(), nil
		}
	}

	doc, err := h.buildDoc(hc)
	if err != nil {
		return nil, err
	}
	h.sink.submit(doc)
	return cont(), nil
}

// buildDoc 组装一条归档文档(脱敏后的元数据 + 原始请求体)。
func (h *archiveHook) buildDoc(hc *HookContext) ([]byte, error) {
	maxBody := h.cfg.MaxBodyKB * 1024
	rec := map[string]any{
		"timestamp":   hc.StartTime.UTC().Format(time.RFC3339Nano),
		"event":       string(hc.Event),
		"requestId":   hc.RequestID,
		"userId":      hc.UserID,
		"tokenId":     hc.TokenID,
		"tokenName":   hc.TokenName,
		"group":       hc.Group,
		"region":      hc.RegionTag,
		"model":       hc.ModelName,
		"channelId":   hc.ChannelID,
		"channelType": hc.ChannelType,
		"relayFormat": string(hc.RelayFormat),
		"clientIp":    hc.ClientIP,
		"headers":     flattenHeaders(hc.Headers),
		"request":     rawJSONOrNil(truncate(hc.RawRequestBody, maxBody)),
	}
	if h.cfg.IncludeRsp && len(hc.ResponseBody) > 0 {
		rec["response"] = rawJSONOrNil(truncate(hc.ResponseBody, maxBody))
		rec["statusCode"] = hc.StatusCode
	}
	return common.Marshal(rec)
}

func truncate(b []byte, max int) []byte {
	if max <= 0 || len(b) <= max {
		return b
	}
	return b[:max]
}

// ───────────────────────── batchSink ─────────────────────────

type batchSink struct {
	sink     string
	endpoint string
	index    string
	headers  map[string]string

	batchSize int
	flush     time.Duration
	spillDir  string

	in   chan []byte
	once sync.Once
}

var (
	sinkMu    sync.Mutex
	sinkCache = map[string]*batchSink{}
)

// getSink 按配置复用或新建一个全局 batchSink。
func getSink(cfg archiveConfig) *batchSink {
	key := cfg.Sink + "|" + cfg.Endpoint + "|" + cfg.Index
	sinkMu.Lock()
	defer sinkMu.Unlock()
	if s, ok := sinkCache[key]; ok {
		return s
	}
	s := &batchSink{
		sink:      cfg.Sink,
		endpoint:  strings.TrimSuffix(cfg.Endpoint, "/"),
		index:     cfg.Index,
		headers:   cfg.Headers,
		batchSize: cfg.BatchSize,
		flush:     time.Duration(cfg.FlushMs) * time.Millisecond,
		spillDir:  cfg.SpillDir,
		in:        make(chan []byte, 8192),
	}
	s.once.Do(func() {
		go s.run()
		if s.spillDir != "" {
			go s.replayLoop()
		}
	})
	sinkCache[key] = s
	return s
}

// submit 非阻塞投递一条文档;缓冲满则直接落盘 spill(若配置了 spillDir),否则丢弃并告警。
func (s *batchSink) submit(doc []byte) {
	select {
	case s.in <- doc:
	default:
		if s.spillDir != "" {
			s.spill([][]byte{doc})
		} else {
			common.SysError("archive sink buffer full, dropped 1 doc: " + s.endpoint)
		}
	}
}

func (s *batchSink) run() {
	defer func() {
		if r := recover(); r != nil {
			common.SysError("archive sink panic: " + toString(r))
		}
	}()
	ticker := time.NewTicker(s.flush)
	defer ticker.Stop()
	batch := make([][]byte, 0, s.batchSize)
	for {
		select {
		case doc := <-s.in:
			batch = append(batch, doc)
			if len(batch) >= s.batchSize {
				s.flushBatch(batch)
				batch = make([][]byte, 0, s.batchSize)
			}
		case <-ticker.C:
			if len(batch) > 0 {
				s.flushBatch(batch)
				batch = make([][]byte, 0, s.batchSize)
			}
		}
	}
}

// flushBatch 投递一批;失败则落盘 spill 等待 replayLoop 补发。
func (s *batchSink) flushBatch(batch [][]byte) {
	if err := s.deliver(batch); err != nil {
		common.SysError("archive deliver failed (" + s.endpoint + "): " + err.Error())
		if s.spillDir != "" {
			s.spill(batch)
		}
	}
}

// deliver 把一批文档投递到下游。ES 走 _bulk;http 走 JSON 数组。
func (s *batchSink) deliver(batch [][]byte) error {
	if len(batch) == 0 {
		return nil
	}
	var url string
	var payload []byte
	if s.sink == "http" {
		url = s.endpoint
		var buf bytes.Buffer
		buf.WriteByte('[')
		for i, doc := range batch {
			if i > 0 {
				buf.WriteByte(',')
			}
			buf.Write(doc)
		}
		buf.WriteByte(']')
		payload = buf.Bytes()
	} else { // elasticsearch _bulk
		url = s.endpoint + "/_bulk"
		index := expandIndex(s.index)
		action := []byte(fmt.Sprintf("{\"index\":{\"_index\":%q}}\n", index))
		var buf bytes.Buffer
		for _, doc := range batch {
			buf.Write(action)
			buf.Write(doc)
			buf.WriteByte('\n')
		}
		payload = buf.Bytes()
	}

	headers := s.headers
	if s.sink != "http" {
		// ES _bulk 要求 ndjson content-type;在不覆盖用户鉴权头的前提下补充。
		headers = withDefaultHeader(s.headers, "Content-Type", "application/x-ndjson")
	}
	resp, err := postJSON(context.Background(), url, headers, payload, 15*time.Second)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return nil
}

// spill 把一批文档落盘为待补发文件(ndjson,一行一条)。
func (s *batchSink) spill(batch [][]byte) {
	if err := os.MkdirAll(s.spillDir, 0o755); err != nil {
		common.SysError("archive spill mkdir failed: " + err.Error())
		return
	}
	name := fmt.Sprintf("spill-%d-%d.ndjson", time.Now().UnixNano(), len(batch))
	path := filepath.Join(s.spillDir, name)
	var buf bytes.Buffer
	for _, doc := range batch {
		buf.Write(doc)
		buf.WriteByte('\n')
	}
	if err := os.WriteFile(path, buf.Bytes(), 0o644); err != nil {
		common.SysError("archive spill write failed: " + err.Error())
	}
}

// replayLoop 周期性扫描 spillDir,补发后删除文件。
func (s *batchSink) replayLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		entries, err := filepath.Glob(filepath.Join(s.spillDir, "spill-*.ndjson"))
		if err != nil {
			continue
		}
		for _, path := range entries {
			data, err := os.ReadFile(path)
			if err != nil {
				continue
			}
			var batch [][]byte
			for _, line := range bytes.Split(data, []byte("\n")) {
				if len(bytes.TrimSpace(line)) > 0 {
					batch = append(batch, line)
				}
			}
			if len(batch) == 0 {
				os.Remove(path)
				continue
			}
			if err := s.deliver(batch); err == nil {
				os.Remove(path)
			}
			// 投递仍失败:保留文件,下个周期再试。
		}
	}
}

func expandIndex(index string) string {
	if index == "" {
		return "llm-requests"
	}
	now := time.Now().UTC()
	r := strings.NewReplacer(
		"%Y", now.Format("2006"),
		"%m", now.Format("01"),
		"%d", now.Format("02"),
	)
	return r.Replace(index)
}

func withDefaultHeader(headers map[string]string, key, val string) map[string]string {
	out := make(map[string]string, len(headers)+1)
	for k, v := range headers {
		out[k] = v
	}
	if _, ok := out[key]; !ok {
		out[key] = val
	}
	return out
}

func init() {
	RegisterHookType("archive", NewArchiveHook)
}
