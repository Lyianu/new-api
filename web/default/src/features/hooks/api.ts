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
// FORK: 自定义钩子管理页 API 客户端。对应后端 router/hook-router.go 的 /api/hook 路由。
import { api } from '@/lib/api'
import type { Hook, ApiResponse, GetHooksResponse, HookFormData } from './types'

// Get all hook configs (flat list; admin config set is small, no pagination)
export async function getHooks(): Promise<GetHooksResponse> {
  const res = await api.get('/api/hook')
  return res.data
}

// Get single hook by ID
export async function getHook(id: number): Promise<ApiResponse<Hook>> {
  const res = await api.get(`/api/hook/${id}`)
  return res.data
}

// Create new hook
export async function createHook(
  data: HookFormData
): Promise<ApiResponse<Hook>> {
  const res = await api.post('/api/hook', data)
  return res.data
}

// Update existing hook
export async function updateHook(
  data: HookFormData & { id: number }
): Promise<ApiResponse<Hook>> {
  const res = await api.put('/api/hook', data)
  return res.data
}

// Delete hook by ID
export async function deleteHook(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/hook/${id}`)
  return res.data
}
