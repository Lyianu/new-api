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
// FORK: 自定义钩子表单的 schema / 默认值 / 转换。match、config 在 UI 里以 JSON 文本编辑，
// 提交前解析为对象；回填时序列化为缩进文本。
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { HOOK_VALIDATION, ERROR_MESSAGES } from '../constants'
import { type Hook, type HookFormData } from '../types'

// 校验一段文本是否为合法 JSON（空串视为合法，落库为空对象）。
function isValidJsonObjectText(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return true
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

export function getHookFormSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .min(HOOK_VALIDATION.NAME_MIN_LENGTH, t(ERROR_MESSAGES.NAME_REQUIRED))
      .max(HOOK_VALIDATION.NAME_MAX_LENGTH),
    type: z.string().min(1),
    enabled: z.boolean(),
    events: z.array(z.string()).min(1, t(ERROR_MESSAGES.EVENTS_REQUIRED)),
    mode: z.enum(['sync', 'async']),
    fail_mode: z.enum(['closed', 'open']),
    timeout_ms: z
      .number()
      .min(HOOK_VALIDATION.TIMEOUT_MIN_MS)
      .max(HOOK_VALIDATION.TIMEOUT_MAX_MS),
    priority: z.number(),
    match: z
      .string()
      .refine(isValidJsonObjectText, t(ERROR_MESSAGES.MATCH_INVALID)),
    config: z
      .string()
      .refine(isValidJsonObjectText, t(ERROR_MESSAGES.CONFIG_INVALID)),
  })
}

export type HookFormValues = {
  name: string
  type: string
  enabled: boolean
  events: string[]
  mode: 'sync' | 'async'
  fail_mode: 'closed' | 'open'
  timeout_ms: number
  priority: number
  match: string
  config: string
}

export const HOOK_FORM_DEFAULT_VALUES: HookFormValues = {
  name: '',
  type: 'webhook',
  enabled: true,
  events: ['request.received'],
  mode: 'sync',
  fail_mode: 'closed',
  timeout_ms: 3000,
  priority: 0,
  match: '{}',
  config: '{}',
}

// 把 JSON 文本安全解析为对象；空串 / 解析失败回退为空对象（schema 已先行校验）。
function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  if (trimmed === '') return {}
  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function transformFormDataToPayload(
  data: HookFormValues
): HookFormData {
  return {
    name: data.name.trim(),
    type: data.type,
    enabled: data.enabled,
    events: data.events,
    mode: data.mode,
    fail_mode: data.fail_mode,
    timeout_ms: data.timeout_ms,
    priority: data.priority,
    match: parseJsonObject(data.match),
    config: parseJsonObject(data.config),
  }
}

function stringifyJson(value: unknown): string {
  if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
    return '{}'
  }
  return JSON.stringify(value, null, 2)
}

export function transformHookToFormDefaults(hook: Hook): HookFormValues {
  return {
    name: hook.name,
    type: hook.type,
    enabled: hook.enabled,
    events: hook.events ?? [],
    mode: hook.mode === 'async' ? 'async' : 'sync',
    fail_mode: hook.fail_mode === 'open' ? 'open' : 'closed',
    timeout_ms: hook.timeout_ms,
    priority: hook.priority,
    match: stringifyJson(hook.match),
    config: stringifyJson(hook.config),
  }
}
