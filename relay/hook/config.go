package hook

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// Factory 按类型名构造一个钩子。内置类型(webhook/archive)在各自 init() 中注册;
// 新增内置类型 = 新增一个文件 + 一行 RegisterHookType,对 fork 纯新增、零冲突。
type Factory func(Spec) (Hook, error)

var (
	registryMu sync.RWMutex
	registry   = map[string]Factory{}
)

// RegisterHookType 注册一个内置钩子类型工厂。
func RegisterHookType(typeName string, f Factory) {
	registryMu.Lock()
	defer registryMu.Unlock()
	registry[typeName] = f
}

func lookupFactory(typeName string) (Factory, bool) {
	registryMu.RLock()
	defer registryMu.RUnlock()
	f, ok := registry[typeName]
	return f, ok
}

// IsRegisteredType 供 controller 校验用户提交的钩子类型是否受支持。
func IsRegisteredType(typeName string) bool {
	_, ok := lookupFactory(typeName)
	return ok
}

// buildHook 把一条 DB 配置解码、规范化并交给对应工厂,产出运行时钩子实例。
func buildHook(cfg *model.HookConfig) (Hook, error) {
	factory, ok := lookupFactory(cfg.Type)
	if !ok {
		return nil, fmt.Errorf("unknown hook type %q", cfg.Type)
	}

	var events []HookEvent
	if cfg.Events != "" {
		var raw []string
		if err := common.UnmarshalJsonStr(cfg.Events, &raw); err != nil {
			return nil, fmt.Errorf("parse events for hook %q: %w", cfg.Name, err)
		}
		for _, e := range raw {
			events = append(events, HookEvent(e))
		}
	}
	if len(events) == 0 {
		return nil, fmt.Errorf("hook %q subscribes to no events", cfg.Name)
	}

	var matcher Matcher
	if cfg.MatchJSON != "" {
		if err := common.UnmarshalJsonStr(cfg.MatchJSON, &matcher); err != nil {
			return nil, fmt.Errorf("parse match for hook %q: %w", cfg.Name, err)
		}
	}

	spec := Spec{
		Name:      cfg.Name,
		Type:      cfg.Type,
		Events:    events,
		Mode:      ExecMode(cfg.Mode),
		FailMode:  FailMode(cfg.FailMode),
		Timeout:   time.Duration(cfg.TimeoutMs) * time.Millisecond,
		Priority:  cfg.Priority,
		Matcher:   matcher,
		RawConfig: []byte(cfg.ConfigJSON),
	}
	return factory(spec)
}

// loadAndCompile 从 DB 读取启用的配置并编译为运行时管线。
// 单条配置非法不影响其余钩子,仅记录告警跳过。
func loadAndCompile() (*pipeline, error) {
	configs, err := model.GetEnabledHookConfigs()
	if err != nil {
		return nil, err
	}
	var hooks []Hook
	for _, cfg := range configs {
		h, err := buildHook(cfg)
		if err != nil {
			common.SysError("skip invalid hook config: " + err.Error())
			continue
		}
		hooks = append(hooks, h)
	}
	return compile(hooks), nil
}

var (
	versionMu      sync.Mutex
	currentVersion model.HookConfigVersion
)

// Reload 立即重建运行时管线(供 CRUD 变更后本实例即时生效)。
func Reload() error {
	p, err := loadAndCompile()
	if err != nil {
		return err
	}
	manager.setPipeline(p)
	if v, err := model.GetHookConfigVersion(); err == nil {
		versionMu.Lock()
		currentVersion = v
		versionMu.Unlock()
	}
	return nil
}

// pollInterval 是多实例热加载的轮询周期。其他实例改了配置后,本实例最迟在此周期内刷新。
const pollInterval = 30 * time.Second

// Init 在启动时加载一次配置并启动版本轮询。应在 model.InitDB 之后调用。
func Init() {
	if err := Reload(); err != nil {
		common.SysError("hook init load failed: " + err.Error())
	}
	go pollLoop()
	common.SysLog("custom hook system initialized")
}

func pollLoop() {
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()
	for range ticker.C {
		v, err := model.GetHookConfigVersion()
		if err != nil {
			continue
		}
		versionMu.Lock()
		changed := v != currentVersion
		versionMu.Unlock()
		if !changed {
			continue
		}
		if err := Reload(); err != nil {
			common.SysError("hook reload failed: " + err.Error())
			continue
		}
		common.SysLog("custom hook config reloaded")
	}
}
