# CLAUDE.md — Project Conventions for new-api

@AGENTS.md

## Claude Code

- Follow the shared project instructions imported from `AGENTS.md`.

## Fork 须知（重要）

本仓库是上游开源项目 **`github.com/QuantumNous/new-api`** 的 fork，用于在上游基础上叠加自定义功能，同时保持随时可同步上游更新。开发时务必遵守以下事项：

### Git 远程与分支
- `origin` 指向本人 fork（`github.com:Lyianu/new-api.git`）；上游用 `upstream` 远程追踪：
  - 如未配置：`git remote add upstream https://github.com/QuantumNous/new-api.git`
- **不要直接在 `main` 上写自定义代码**。自定义功能放在独立分支（如 `feature/*`），便于同步上游。
- 同步上游：`git fetch upstream` → `git rebase upstream/main`（个人维护，历史干净）或 `git merge upstream/main`（团队协作，更稳）。

### 降低同步冲突的工程约束
- **优先新增文件，而非修改上游文件**。自定义逻辑尽量放进新建的目录/包/文件（如新建 `relay/channel/<provider>/`、独立 service 文件），上游不会动这些新文件，几乎零冲突。
- 必须改上游核心文件时（如 `relay/relay_adaptor.go` 的 switch、`constant/` 常量），**只加最少的行，不要顺手重构**周围代码。
- 给自定义改动加统一标记注释（如 `// FORK: ...`），方便同步冲突时快速识别归属。
- 能用配置 / 环境变量 / docker-compose 实现的，就不要改源码。

### 绝对不能动的两点
1. **不要修改 go.mod 的 module path**（保持 `github.com/QuantumNous/new-api`）。改它会导致全仓库 import 路径连锁修改，且每次同步上游必冲突。Go 不要求 module path 与 fork 仓库地址一致。
2. **遵守上游署名保护**（见 `AGENTS.md` 的 Project Governance）：`new-api` / `QuantumNous` 的品牌、版权、footer、meta 等标识禁止删改。

### 扩展点说明（当前项目无运行时插件机制）
- 项目没有动态插件 / 主题热插拔；任何超出配置的功能都需改 Go 源码并重新编译。
- 加 Provider 走 Adaptor 模式（`relay/channel/adapter.go`），但注册仍需改 `relay/relay_adaptor.go`、`constant/api_type.go`、`constant/channel.go`。
- 主题仅 `default`/`classic` 两套，值为硬编码，新增主题需改多个核心文件。