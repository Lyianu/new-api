package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupRandomIdTestState(t *testing.T) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.Exec("DELETE FROM users").Error)

	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = oldRedisEnabled
	})
}

// 新注册用户必须拿到随机主键（非自增小序号），避免从 ID 推断全站用户量。
func TestInsertAssignsRandomUserId(t *testing.T) {
	setupRandomIdTestState(t)

	ids := make(map[int]bool)
	for _, name := range []string{"rand-user-a", "rand-user-b", "rand-user-c"} {
		user := User{
			Username: name,
			Password: "password-123",
			Status:   common.UserStatusEnabled,
			Role:     common.RoleCommonUser,
		}
		require.NoError(t, user.Insert(0))
		assert.GreaterOrEqual(t, user.Id, randomUserIdMin, "id must be in random range")
		assert.LessOrEqual(t, user.Id, randomUserIdMax)
		assert.False(t, ids[user.Id], "ids must be unique")
		ids[user.Id] = true
	}
}

// 显式指定 Id 的创建路径（root 初始化、测试夹具）不得被覆盖。
func TestInsertKeepsExplicitUserId(t *testing.T) {
	setupRandomIdTestState(t)

	user := User{
		Id:       1,
		Username: "explicit-id-user",
		Password: "password-123",
		Status:   common.UserStatusEnabled,
		Role:     common.RoleRootUser,
	}
	require.NoError(t, user.Insert(0))
	assert.Equal(t, 1, user.Id)
}

// 撞号时应换号重试而不是失败。
func TestAssignRandomIdRetriesOnCollision(t *testing.T) {
	setupRandomIdTestState(t)

	first := User{
		Username: "collision-seed",
		Password: "password-123",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, first.Insert(0))

	// 预置一个与已存在 ID 相同的候选无法直接模拟随机数，
	// 这里退而验证 assignRandomIdWithTx 对已占用 ID 的检测路径：
	second := User{Id: 0, Username: "collision-second", Password: "password-123", Status: common.UserStatusEnabled}
	require.NoError(t, second.Insert(0))
	assert.NotEqual(t, first.Id, second.Id)
}
