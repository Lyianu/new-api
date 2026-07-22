package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 合规文档版本化存储。三类文档（服务条款/隐私政策/退款政策）各自独立
// 递增版本号；发布新版本后，已确认旧版本的用户需要重新确认，发布时可
// 标记"未确认前暂停服务"（阻断 relay 调用，见 service/policy_gate.go）。
// 确认记录按 (user, doc, version) 追加而非覆盖，保留完整合规审计链。

const (
	PolicyTypeTerms   = "terms_of_service"
	PolicyTypePrivacy = "privacy_policy"
	PolicyTypeRefund  = "refund_policy"
)

var PolicyTypes = []string{PolicyTypeTerms, PolicyTypePrivacy, PolicyTypeRefund}

func IsValidPolicyType(t string) bool {
	for _, v := range PolicyTypes {
		if v == t {
			return true
		}
	}
	return false
}

type PolicyVersion struct {
	Id               int    `json:"id"`
	DocType          string `json:"doc_type" gorm:"type:varchar(32);uniqueIndex:idx_policy_type_ver,priority:1"`
	Version          int    `json:"version" gorm:"uniqueIndex:idx_policy_type_ver,priority:2"`
	Title            string `json:"title" gorm:"type:varchar(128)"`
	Content          string `json:"content" gorm:"type:text"`
	BlockUntilAccept bool   `json:"block_until_accept"`
	CreatedAt        int64  `json:"created_at" gorm:"bigint"`
	CreatedBy        int    `json:"created_by"`
}

type PolicyAcceptance struct {
	Id         int    `json:"id"`
	UserId     int    `json:"user_id" gorm:"uniqueIndex:idx_policy_accept,priority:1"`
	DocType    string `json:"doc_type" gorm:"type:varchar(32);uniqueIndex:idx_policy_accept,priority:2"`
	Version    int    `json:"version" gorm:"uniqueIndex:idx_policy_accept,priority:3"`
	AcceptedAt int64  `json:"accepted_at" gorm:"bigint"`
	Ip         string `json:"ip" gorm:"type:varchar(64)"`
}

// GetLatestPolicyVersions 各文档类型的最新版本（无记录的类型不返回）。
func GetLatestPolicyVersions() ([]*PolicyVersion, error) {
	var out []*PolicyVersion
	for _, t := range PolicyTypes {
		var pv PolicyVersion
		err := DB.Where("doc_type = ?", t).Order("version desc").First(&pv).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			return nil, err
		}
		out = append(out, &pv)
	}
	return out, nil
}

// GetPolicyVersions 某文档类型的历史版本（新在前）。
func GetPolicyVersions(docType string, limit int) ([]*PolicyVersion, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var out []*PolicyVersion
	err := DB.Where("doc_type = ?", docType).Order("version desc").Limit(limit).Find(&out).Error
	return out, err
}

// PublishPolicyVersion 发布新版本：版本号 = 当前最大 + 1。
func PublishPolicyVersion(docType, title, content string, blockUntilAccept bool, createdBy int) (*PolicyVersion, error) {
	if !IsValidPolicyType(docType) {
		return nil, fmt.Errorf("invalid policy doc type: %s", docType)
	}
	var pv *PolicyVersion
	err := DB.Transaction(func(tx *gorm.DB) error {
		var maxVer int
		if err := tx.Model(&PolicyVersion{}).Where("doc_type = ?", docType).
			Select("COALESCE(MAX(version), 0)").Scan(&maxVer).Error; err != nil {
			return err
		}
		pv = &PolicyVersion{
			DocType:          docType,
			Version:          maxVer + 1,
			Title:            title,
			Content:          content,
			BlockUntilAccept: blockUntilAccept,
			CreatedAt:        common.GetTimestamp(),
			CreatedBy:        createdBy,
		}
		return tx.Create(pv).Error
	})
	return pv, err
}

// AcceptPolicies 记录用户对指定文档"当前最新版本"的确认。幂等。
func AcceptPolicies(userId int, ip string, docTypes []string) error {
	latest, err := GetLatestPolicyVersions()
	if err != nil {
		return err
	}
	byType := make(map[string]*PolicyVersion, len(latest))
	for _, pv := range latest {
		byType[pv.DocType] = pv
	}
	now := common.GetTimestamp()
	for _, t := range docTypes {
		pv, ok := byType[t]
		if !ok {
			continue // 未发布过的文档类型无需确认
		}
		acc := &PolicyAcceptance{
			UserId:     userId,
			DocType:    t,
			Version:    pv.Version,
			AcceptedAt: now,
			Ip:         ip,
		}
		// 重复确认同一版本时静默忽略，保证幂等
		if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(acc).Error; err != nil {
			return err
		}
	}
	return nil
}

// GetUserAcceptedVersions 用户对各文档已确认的最高版本。
func GetUserAcceptedVersions(userId int) (map[string]int, error) {
	type row struct {
		DocType string
		MaxVer  int
	}
	var rows []row
	err := DB.Model(&PolicyAcceptance{}).
		Select("doc_type, MAX(version) as max_ver").
		Where("user_id = ?", userId).
		Group("doc_type").Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make(map[string]int, len(rows))
	for _, r := range rows {
		out[r.DocType] = r.MaxVer
	}
	return out, nil
}
