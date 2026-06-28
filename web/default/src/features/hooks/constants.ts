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
// FORK: 自定义钩子管理页常量。事件 / 类型 / 模式取值需与后端 relay/hook 保持一致。
import { type TFunction } from 'i18next'

// ============================================================================
// Hook 事件（与后端 relay/hook/hook.go 的 HookEvent 常量一致）
// 注意：Phase 1 仅 request.received 会被实际派发，其余为前向兼容预留。
// ============================================================================

export const HOOK_EVENTS = [
  'request.received',
  'upstream.before',
  'upstream.after',
  'request.completed',
  'request.error',
] as const

export function getHookEventOptions(t: TFunction) {
  return [
    { label: t('Request Received'), value: 'request.received' },
    { label: t('Before Upstream'), value: 'upstream.before' },
    { label: t('After Upstream'), value: 'upstream.after' },
    { label: t('Request Completed'), value: 'request.completed' },
    { label: t('Request Error'), value: 'request.error' },
  ]
}

// ============================================================================
// Hook 类型（与后端注册的 Factory 类型一致：webhook / archive）
// ============================================================================

export const HOOK_TYPES = ['webhook', 'archive'] as const

export function getHookTypeOptions(t: TFunction) {
  return [
    { label: t('Webhook'), value: 'webhook' },
    { label: t('Archive'), value: 'archive' },
  ]
}

// ============================================================================
// 执行模式 / 失败策略
// ============================================================================

export const HOOK_MODES = ['sync', 'async'] as const
export const HOOK_FAIL_MODES = ['closed', 'open'] as const

export function getHookModeOptions(t: TFunction) {
  return [
    { label: t('Synchronous (blocking)'), value: 'sync' },
    { label: t('Asynchronous (non-blocking)'), value: 'async' },
  ]
}

export function getHookFailModeOptions(t: TFunction) {
  return [
    { label: t('Fail closed (block on error)'), value: 'closed' },
    { label: t('Fail open (allow on error)'), value: 'open' },
  ]
}

// ============================================================================
// Validation Constants
// ============================================================================

export const HOOK_VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 128,
  TIMEOUT_MIN_MS: 0,
  TIMEOUT_MAX_MS: 60000,
} as const

// ============================================================================
// Error / Success Messages (i18n keys; use t(...) when displaying)
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  LOAD_FAILED: 'Failed to load hooks',
  CREATE_FAILED: 'Failed to create hook',
  UPDATE_FAILED: 'Failed to update hook',
  DELETE_FAILED: 'Failed to delete hook',
  NAME_REQUIRED: 'Hook name is required',
  EVENTS_REQUIRED: 'At least one event is required',
  MATCH_INVALID: 'Match must be valid JSON',
  CONFIG_INVALID: 'Config must be valid JSON',
} as const

export const SUCCESS_MESSAGES = {
  HOOK_CREATED: 'Hook created successfully',
  HOOK_UPDATED: 'Hook updated successfully',
  HOOK_DELETED: 'Hook deleted successfully',
} as const
