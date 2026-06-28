/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
// FORK: 自定义钩子（Custom Hooks）管理页类型。对应后端 controller/hook_config.go 的 hookConfigDTO。
import { z } from 'zod'

// ============================================================================
// Hook Schema & Types
// ============================================================================

// 后端以原始 JSON 内联返回 events / match / config，因此前端直接拿到数组 / 对象。
export const hookSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(), // "webhook" | "archive"
  enabled: z.boolean(),
  events: z.array(z.string()),
  mode: z.string(), // "sync" | "async"
  fail_mode: z.string(), // "closed" | "open"
  timeout_ms: z.number(),
  priority: z.number(),
  match: z.record(z.string(), z.unknown()).nullable().optional(),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.number(),
  updated_at: z.number(),
})

export type Hook = z.infer<typeof hookSchema>

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

// 后端 GET /api/hook 返回扁平数组（管理配置量小，无需服务端分页）。
export type GetHooksResponse = ApiResponse<Hook[]>

export interface HookFormData {
  id?: number
  name: string
  type: string
  enabled: boolean
  events: string[]
  mode: string
  fail_mode: string
  timeout_ms: number
  priority: number
  match: Record<string, unknown>
  config: Record<string, unknown>
}

// ============================================================================
// Dialog Types
// ============================================================================

export type HooksDialogType = 'create' | 'update' | 'delete'
