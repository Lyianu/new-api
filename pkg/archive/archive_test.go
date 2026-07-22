package archive

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// 端到端：Enqueue 后 worker 应按 bulk ndjson 格式写入，索引名按天分片。
func TestArchiveBulkWrite(t *testing.T) {
	var mu sync.Mutex
	var received []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/_bulk" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/x-ndjson" {
			t.Errorf("unexpected content type: %s", ct)
		}
		body, _ := io.ReadAll(r.Body)
		mu.Lock()
		received = append(received, string(body))
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"took":1,"errors":false,"items":[]}`))
	}))
	defer srv.Close()

	t.Setenv("ARCHIVE_ES_ENABLED", "true")
	t.Setenv("ARCHIVE_ES_URL", srv.URL)
	t.Setenv("ARCHIVE_ES_FLUSH_INTERVAL_MS", "50")
	t.Setenv("ARCHIVE_ES_INDEX_PREFIX", "test-archive")

	if !Enabled() {
		t.Fatal("archive should be enabled")
	}

	ts := time.Date(2026, 7, 22, 3, 4, 5, 0, time.UTC)
	Enqueue(&Entry{
		Timestamp:    ts,
		RequestId:    "req-123",
		UserId:       42,
		Model:        "claude-sonnet-5",
		ChannelId:    7,
		RequestBody:  `{"messages":[{"role":"user","content":"hi"}]}`,
		ResponseBody: "data: {\"id\":\"x\"}\n\n",
		StatusCode:   200,
	})

	deadline := time.Now().Add(3 * time.Second)
	for {
		mu.Lock()
		n := len(received)
		mu.Unlock()
		if n > 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("bulk request not received in time")
		}
		time.Sleep(20 * time.Millisecond)
	}

	mu.Lock()
	payload := received[0]
	mu.Unlock()
	lines := strings.Split(strings.TrimRight(payload, "\n"), "\n")
	if len(lines) != 2 {
		t.Fatalf("expected 2 ndjson lines, got %d: %q", len(lines), payload)
	}
	var meta map[string]map[string]string
	if err := json.Unmarshal([]byte(lines[0]), &meta); err != nil {
		t.Fatalf("bad meta line: %v", err)
	}
	if idx := meta["create"]["_index"]; idx != "test-archive-2026.07.22" {
		t.Errorf("unexpected index name: %s", idx)
	}
	var doc map[string]any
	if err := json.Unmarshal([]byte(lines[1]), &doc); err != nil {
		t.Fatalf("bad doc line: %v", err)
	}
	if doc["request_id"] != "req-123" {
		t.Errorf("request_id missing: %v", doc)
	}
	if doc["model"] != "claude-sonnet-5" {
		t.Errorf("model missing: %v", doc)
	}
	if !strings.Contains(doc["request_body"].(string), "hi") {
		t.Errorf("request_body missing: %v", doc)
	}
}
