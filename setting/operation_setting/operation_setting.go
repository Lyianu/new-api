package operation_setting

import "strings"

var DemoSiteEnabled = false
var SelfUseModeEnabled = false

// UserVisibleChannel 是否向下游用户展示“供应商(vendor)”脱敏名（日志/模型页）。
// 默认关闭；开启也仅暴露 vendor 名，物理渠道(ChannelId/ChannelName)始终仅管理员可见。
var UserVisibleChannel = false

var AutomaticDisableKeywords = []string{
	"Your credit balance is too low",
	"This organization has been disabled.",
	"You exceeded your current quota",
	"Permission denied",
	"The security token included in the request is invalid",
	"Operation not allowed",
	"Your account is not authorized",
}

func AutomaticDisableKeywordsToString() string {
	return strings.Join(AutomaticDisableKeywords, "\n")
}

func AutomaticDisableKeywordsFromString(s string) {
	AutomaticDisableKeywords = []string{}
	ak := strings.Split(s, "\n")
	for _, k := range ak {
		k = strings.TrimSpace(k)
		k = strings.ToLower(k)
		if k != "" {
			AutomaticDisableKeywords = append(AutomaticDisableKeywords, k)
		}
	}
}
