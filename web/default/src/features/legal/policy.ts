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
import { api } from '@/lib/api'

// 合规文档（版本化）：三类文档各自独立递增版本，注册时逐项确认，
// 版本更新后下次登录须重新确认，可标记"未确认前暂停 API 服务"。

export const POLICY_TYPES = [
  'terms_of_service',
  'privacy_policy',
  'refund_policy',
] as const

export type PolicyType = (typeof POLICY_TYPES)[number]

export type PolicyVersion = {
  id: number
  doc_type: PolicyType
  version: number
  title: string
  content: string
  block_until_accept: boolean
  created_at: number
  created_by: number
}

export type PolicyStatusItem = {
  doc_type: PolicyType
  title: string
  latest_version: number
  accepted_version: number
  needs_accept: boolean
  block: boolean
}

type ApiResponse<T> = { success: boolean; message?: string; data?: T }

// 匿名：各文档最新版本全文（注册页 / 公开政策页）
export async function getLatestPolicies(): Promise<PolicyVersion[]> {
  const res = await api.get<ApiResponse<PolicyVersion[]>>('/api/policy')
  return res.data?.data ?? []
}

// 登录用户：确认状态（前端据此弹重确认弹窗）
export async function getPolicyStatus(): Promise<PolicyStatusItem[]> {
  const res = await api.get<ApiResponse<PolicyStatusItem[]>>(
    '/api/policy/status'
  )
  return res.data?.data ?? []
}

export async function acceptPolicies(
  docTypes: PolicyType[]
): Promise<ApiResponse<null>> {
  const res = await api.post<ApiResponse<null>>('/api/policy/accept', {
    doc_types: docTypes,
  })
  return res.data
}

// 管理端
export async function getPolicyVersionHistory(
  docType: PolicyType
): Promise<PolicyVersion[]> {
  const res = await api.get<ApiResponse<PolicyVersion[]>>(
    '/api/policy/versions',
    { params: { doc_type: docType } }
  )
  return res.data?.data ?? []
}

export async function publishPolicy(payload: {
  doc_type: PolicyType
  title: string
  content: string
  block_until_accept: boolean
}): Promise<ApiResponse<PolicyVersion>> {
  const res = await api.post<ApiResponse<PolicyVersion>>(
    '/api/policy/publish',
    payload
  )
  return res.data
}
