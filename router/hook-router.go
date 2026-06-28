package router

// FORK: 自定义钩子（Custom Hooks）管理后台路由。纯新增文件;仅在 router/main.go 中以
// // FORK: 标记调用 SetHookRouter 一行。所有路由置于 /api/hook 之下并要求 AdminAuth。

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetHookRouter(router *gin.Engine) {
	hookRouter := router.Group("/api/hook")
	hookRouter.Use(middleware.AdminAuth())
	{
		hookRouter.GET("", controller.GetAllHookConfigs)
		hookRouter.GET("/:id", controller.GetHookConfig)
		hookRouter.POST("", controller.CreateHookConfig)
		hookRouter.PUT("", controller.UpdateHookConfig)
		hookRouter.DELETE("/:id", controller.DeleteHookConfig)
	}
}
